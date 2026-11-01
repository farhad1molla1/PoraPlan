/**
 * ==============================================================================
 * PoraPlan Milestone 6.0.2: Private Academic Storage Service
 *
 * Dedicated storage service for private academic attachments:
 * - Student assignment submission attachments (PDF, DOCX, images)
 * - Mentor task reference attachments
 *
 * Provides:
 * - Validation (size limits, MIME types, extensions)
 * - File name sanitization
 * - Strict partitioned path construction:
 *     submissions/<assignment_id>/<student_id>/<timestamp>_<filename>
 *     tasks/<task_id>/<timestamp>_<filename>
 * - Live Supabase Storage integration with signed private URLs
 * - Mock in-memory & object-URL fallback for local dev / offline testing
 * ==============================================================================
 */

import { supabase, isSupabaseConfigured } from './supabase';

/**
 * Storage bucket dedicated to private academic attachments.
 */
export const BUCKET_NAME = 'academic-attachments';

/**
 * Maximum attachment size: 10 Megabytes in bytes.
 */
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10,485,760 bytes

/**
 * Allowed MIME types for academic attachments.
 */
export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
] as const;

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

/**
 * Allowed file extensions matching the permitted MIME types.
 */
export const ALLOWED_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg', '.webp', '.docx'] as const;

export type AllowedExtension = (typeof ALLOWED_EXTENSIONS)[number];

/**
 * In-memory storage cache for mock / offline mode.
 */
interface MockStoredItem {
  file: File;
  objectUrl?: string;
  createdAt: string;
}

const mockStorageMap = new Map<string, MockStoredItem>();

/**
 * Clear mock storage items and revoke any active Object URLs.
 * Primarily intended for testing and test isolation.
 */
export function clearMockStorage(): void {
  if (typeof window !== 'undefined' && typeof window.URL?.revokeObjectURL === 'function') {
    mockStorageMap.forEach((item) => {
      if (item.objectUrl && item.objectUrl.startsWith('blob:')) {
        try {
          URL.revokeObjectURL(item.objectUrl);
        } catch {
          // Ignore revocation errors
        }
      }
    });
  }
  mockStorageMap.clear();
}

/**
 * Sanitizes a file name for secure storage:
 * - Strips directory traversal sequences (/ \ ..)
 * - Replaces whitespace and non-safe characters with underscores
 * - Preserves the valid lowercase extension
 */
export function sanitizeFileName(name: string): string {
  if (!name) return 'attachment';

  // Extract base filename without path separators
  const baseName = name.replace(/\\/g, '/').split('/').pop() || 'attachment';

  const lastDot = baseName.lastIndexOf('.');
  let stem = lastDot !== -1 ? baseName.slice(0, lastDot) : baseName;
  const ext = lastDot !== -1 ? baseName.slice(lastDot).toLowerCase() : '';

  // Sanitize stem: allow alphanumerics, dots, dashes, underscores
  stem = stem.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '');

  if (!stem) {
    stem = 'attachment';
  }

  return `${stem}${ext}`;
}

/**
 * Validates file size, MIME type, and extension for academic attachments.
 */
export function validateAcademicFile(file: File): { valid: boolean; error: string | null } {
  if (!file) {
    return { valid: false, error: 'No file provided.' };
  }

  if (file.size <= 0) {
    return { valid: false, error: 'File cannot be empty.' };
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
    return {
      valid: false,
      error: `File size (${sizeMb} MB) exceeds the maximum limit of 10 MB.`,
    };
  }

  const nameParts = file.name.split('.');
  const ext = nameParts.length > 1 ? `.${nameParts.pop()?.toLowerCase()}` : '';

  const isMimeAllowed = ALLOWED_MIME_TYPES.includes(file.type as AllowedMimeType);
  const isExtAllowed = ALLOWED_EXTENSIONS.includes(ext as AllowedExtension);

  // Reject if extension is unsupported, OR if non-empty MIME is not in allowed list
  if (!isExtAllowed || (file.type !== '' && !isMimeAllowed)) {
    return {
      valid: false,
      error: 'Unsupported file format. Please upload a PDF, Word document (.docx), or image (PNG, JPG, WebP).',
    };
  }

  return { valid: true, error: null };
}

export interface UploadAcademicFileParams {
  category: 'submissions' | 'tasks' | 'doubts';
  entityId: string; // assignment_id, task_id, or doubt_id
  studentId?: string; // required for submissions
  messageId?: string; // optional for doubts (e.g. response_id or 'inquiry')
  file: File;
}

/**
 * Uploads an academic attachment file to Supabase Storage or mock storage.
 *
 * Path schema:
 * - Submissions: submissions/<assignment_id>/<student_id>/<timestamp>_<sanitized_name>
 * - Tasks: tasks/<task_id>/<timestamp>_<sanitized_name>
 * - Doubts: doubts/<doubt_id>/<message_id>/<timestamp>_<sanitized_name>
 *
 * Task Upload Lifecycle Requirements (for UI integration):
 * 1. Create the task database row first (or pre-generate task UUID and insert row).
 * 2. Upload the attachment using the confirmed task ID via uploadAcademicFile.
 * 3. Update the task row with attachment metadata (attachment_path, attachment_name, attachment_size).
 * 4. If upload fails, retain a valid task without an attachment and return a clear user error.
 * 5. If metadata update fails after upload, attempt cleanup of the newly uploaded file via deleteAcademicFile.
 */
export async function uploadAcademicFile(
  params: UploadAcademicFileParams
): Promise<{ path: string | null; error: Error | null }> {
  const { category, entityId, studentId, messageId, file } = params;

  // 1. Validation
  const validation = validateAcademicFile(file);
  if (!validation.valid) {
    return { path: null, error: new Error(validation.error || 'Invalid file.') };
  }

  if (!entityId || typeof entityId !== 'string' || !entityId.trim()) {
    return { path: null, error: new Error('A valid entity ID (assignment, task, or doubt) is required.') };
  }

  if (category === 'submissions' && (!studentId || typeof studentId !== 'string' || !studentId.trim())) {
    return { path: null, error: new Error('Student ID is required for assignment submission attachments.') };
  }

  // 2. Build secure path
  const sanitized = sanitizeFileName(file.name);
  const timestamp = Date.now();
  const uniqueName = `${timestamp}_${sanitized}`;

  let filePath: string;
  if (category === 'submissions') {
    filePath = `submissions/${entityId.trim()}/${studentId!.trim()}/${uniqueName}`;
  } else if (category === 'doubts') {
    const subId = messageId && messageId.trim() ? messageId.trim() : 'inquiry';
    filePath = `doubts/${entityId.trim()}/${subId}/${uniqueName}`;
  } else {
    filePath = `tasks/${entityId.trim()}/${uniqueName}`;
  }

  // 3. Mock / offline mode fallback
  if (!isSupabaseConfigured()) {
    let objectUrl: string | undefined;
    if (typeof window !== 'undefined' && typeof window.URL?.createObjectURL === 'function') {
      try {
        objectUrl = URL.createObjectURL(file);
      } catch {
        // Fallback gracefully in simulated test environments
      }
    }

    mockStorageMap.set(filePath, {
      file,
      objectUrl,
      createdAt: new Date().toISOString(),
    });

    return { path: filePath, error: null };
  }

  // 4. Live Supabase Storage upload
  try {
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type || undefined,
      });

    if (error) {
      return { path: null, error };
    }

    return { path: data?.path || filePath, error: null };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { path: null, error };
  }
}

/**
 * Generates a temporary signed URL for private academic attachment viewing or download.
 *
 * @param filePath The storage path returned by uploadAcademicFile
 * @param expiresInSeconds Duration in seconds for which the signed URL is valid (default: 3600s / 1 hour)
 */
export async function getAcademicFileSignedUrl(
  filePath: string,
  expiresInSeconds = 3600
): Promise<{ signedUrl: string | null; error: Error | null }> {
  if (!filePath || typeof filePath !== 'string' || !filePath.trim()) {
    return { signedUrl: null, error: new Error('File path is required.') };
  }

  const cleanPath = filePath.trim();

  // Mock / offline mode fallback
  if (!isSupabaseConfigured()) {
    const item = mockStorageMap.get(cleanPath);
    if (item?.objectUrl) {
      return { signedUrl: item.objectUrl, error: null };
    }

    // If item exists in mock store but objectUrl wasn't generated yet
    if (item && typeof window !== 'undefined' && typeof window.URL?.createObjectURL === 'function') {
      try {
        const objectUrl = URL.createObjectURL(item.file);
        item.objectUrl = objectUrl;
        return { signedUrl: objectUrl, error: null };
      } catch {
        // Fall through to mock URI
      }
    }

    // Synthetic mock URI for environments without browser URL API
    return { signedUrl: `mock-academic-file://${cleanPath}`, error: null };
  }

  // Live Supabase Storage signed URL
  try {
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(cleanPath, expiresInSeconds);

    if (error) {
      return { signedUrl: null, error };
    }

    return { signedUrl: data?.signedUrl || null, error: null };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { signedUrl: null, error };
  }
}

/**
 * Deletes an academic attachment file from Supabase Storage or mock storage.
 */
export async function deleteAcademicFile(
  filePath: string
): Promise<{ success: boolean; error: Error | null }> {
  if (!filePath || typeof filePath !== 'string' || !filePath.trim()) {
    return { success: false, error: new Error('File path is required.') };
  }

  const cleanPath = filePath.trim();

  // Mock / offline mode fallback
  if (!isSupabaseConfigured()) {
    const item = mockStorageMap.get(cleanPath);
    if (item?.objectUrl && typeof window !== 'undefined' && typeof window.URL?.revokeObjectURL === 'function') {
      try {
        URL.revokeObjectURL(item.objectUrl);
      } catch {
        // Ignore revocation errors
      }
    }
    mockStorageMap.delete(cleanPath);
    return { success: true, error: null };
  }

  // Live Supabase Storage deletion
  try {
    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([cleanPath]);

    if (error) {
      return { success: false, error };
    }

    return { success: true, error: null };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { success: false, error };
  }
}

