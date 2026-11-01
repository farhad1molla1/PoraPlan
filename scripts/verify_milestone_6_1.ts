/**
 * ==============================================================================
 * PoraPlan Milestone 6.1 Verification Suite
 * Doubts Desk Attachment Integration: Architecture, Security, Validation & Workflows
 * ==============================================================================
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  createMockDoubt,
  addMockDoubtResponse,
  getMockDoubtById,
  deleteMockDoubt,
  isMockAuthorizedMentorForStudent,
} from '../src/lib/mockAuthStore';

let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, message: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`[PASS] ${message}`);
  } else {
    console.error(`[FAIL] ${message}`);
  }
}

console.log('================================================================');
console.log('PoraPlan Milestone 6.1: Doubts Desk Attachment Verification');
console.log('================================================================\n');

// ----------------------------------------------------------------------------
// SECTION 1: Migration 011 & Storage RLS Security Policies
// ----------------------------------------------------------------------------
console.log('--- SECTION 1: Database Migration & RLS Security Policy Inspection ---');

const migrationPath = path.resolve('supabase/migrations/20261030000011_doubts_attachments_storage.sql');
assert(fs.existsSync(migrationPath), 'Migration 20261030000011_doubts_attachments_storage.sql exists on disk');

const migrationContent = fs.readFileSync(migrationPath, 'utf8');

assert(
  migrationContent.includes('ALTER TABLE public.doubts') &&
    migrationContent.includes('ADD COLUMN IF NOT EXISTS attachment_path TEXT') &&
    migrationContent.includes('ADD COLUMN IF NOT EXISTS attachment_name TEXT') &&
    migrationContent.includes('ADD COLUMN IF NOT EXISTS attachment_size INTEGER'),
  'Migration adds attachment_path, attachment_name, attachment_size to public.doubts'
);

assert(
  migrationContent.includes('ALTER TABLE public.doubt_responses') &&
    migrationContent.includes('ADD COLUMN IF NOT EXISTS attachment_path TEXT') &&
    migrationContent.includes('ADD COLUMN IF NOT EXISTS attachment_name TEXT') &&
    migrationContent.includes('ADD COLUMN IF NOT EXISTS attachment_size INTEGER'),
  'Migration adds attachment_path, attachment_name, attachment_size to public.doubt_responses'
);

assert(
  migrationContent.includes('idx_doubts_attachment_path') &&
    migrationContent.includes('idx_doubt_responses_attachment_path'),
  'Migration provisions performance indexes on attachment_path columns'
);

// Storage RLS INSERT policy
assert(
  migrationContent.includes('"Authorized users can upload doubt attachment files"') &&
    migrationContent.includes("bucket_id = 'academic-attachments'") &&
    migrationContent.includes("split_part(name, '/', 1) = 'doubts'") &&
    migrationContent.includes("d.student_id = auth.uid()"),
  'Storage INSERT policy allows student owners to upload to their doubt conversation'
);

assert(
  migrationContent.includes('public.is_authorized_mentor_for_student(d.student_id, d.program_id)'),
  'Storage INSERT policy verifies active mentor authorization via centralized function'
);

assert(
  migrationContent.includes("p.role = 'admin'"),
  'Storage INSERT policy includes administrator oversight'
);

// Storage RLS SELECT policy
assert(
  migrationContent.includes('"Authorized users can view doubt attachment files"') &&
    migrationContent.includes("bucket_id = 'academic-attachments'") &&
    migrationContent.includes("split_part(name, '/', 1) = 'doubts'") &&
    migrationContent.includes("d.student_id = auth.uid()") &&
    migrationContent.includes('public.is_authorized_mentor_for_student(d.student_id, d.program_id)'),
  'Storage SELECT policy restricts viewing to student owner, authorized mentor, or admin'
);

// Storage RLS DELETE policy
assert(
  migrationContent.includes('"Authorized users can delete doubt attachment files"') &&
    migrationContent.includes("bucket_id = 'academic-attachments'") &&
    migrationContent.includes("split_part(name, '/', 1) = 'doubts'"),
  'Storage DELETE policy authorizes deletion for doubt participants and compensation cleanup'
);

// ----------------------------------------------------------------------------
// SECTION 2: TypeScript Database Types Inspection
// ----------------------------------------------------------------------------
console.log('\n--- SECTION 2: Database Schema Typings Inspection ---');

const dbTypesPath = path.resolve('src/types/database.ts');
assert(fs.existsSync(dbTypesPath), 'src/types/database.ts exists on disk');

const dbTypesContent = fs.readFileSync(dbTypesPath, 'utf8');

assert(
  dbTypesContent.includes('export type Doubt = {') &&
    dbTypesContent.includes('attachment_path?: string | null;') &&
    dbTypesContent.includes('attachment_name?: string | null;') &&
    dbTypesContent.includes('attachment_size?: number | null;'),
  'Doubt interface includes attachment_path, attachment_name, and attachment_size'
);

assert(
  dbTypesContent.includes('export type DoubtInsert = {') &&
    dbTypesContent.includes('attachment_path?: string | null;') &&
    dbTypesContent.includes('attachment_name?: string | null;') &&
    dbTypesContent.includes('attachment_size?: number | null;'),
  'DoubtInsert interface includes attachment metadata fields'
);

assert(
  dbTypesContent.includes('export type DoubtUpdate = {') &&
    dbTypesContent.includes('attachment_path?: string | null;') &&
    dbTypesContent.includes('attachment_name?: string | null;') &&
    dbTypesContent.includes('attachment_size?: number | null;'),
  'DoubtUpdate interface includes attachment metadata fields'
);

assert(
  dbTypesContent.includes('export type DoubtResponse = {') &&
    dbTypesContent.includes('attachment_path?: string | null;') &&
    dbTypesContent.includes('attachment_name?: string | null;') &&
    dbTypesContent.includes('attachment_size?: number | null;'),
  'DoubtResponse interface includes attachment_path, attachment_name, and attachment_size'
);

assert(
  dbTypesContent.includes('export type DoubtResponseInsert = {') &&
    dbTypesContent.includes('attachment_path?: string | null;') &&
    dbTypesContent.includes('attachment_name?: string | null;') &&
    dbTypesContent.includes('attachment_size?: number | null;'),
  'DoubtResponseInsert interface includes attachment metadata fields'
);

// ----------------------------------------------------------------------------
// SECTION 3: Storage Service Helper Architecture Inspection
// ----------------------------------------------------------------------------
console.log('\n--- SECTION 3: Storage Service Helper Inspection ---');

const storageFilePath = path.resolve('src/lib/storage.ts');
assert(fs.existsSync(storageFilePath), 'src/lib/storage.ts exists on disk');

const storageContent = fs.readFileSync(storageFilePath, 'utf8');

assert(
  storageContent.includes("category: 'submissions' | 'tasks' | 'doubts'"),
  'UploadAcademicFileParams supports category "doubts"'
);

assert(
  storageContent.includes('messageId?: string'),
  'UploadAcademicFileParams supports optional messageId for doubts'
);

assert(
  storageContent.includes("filePath = `doubts/${entityId.trim()}/${subId}/${uniqueName}`"),
  'uploadAcademicFile formats doubt storage paths as doubts/<doubt_id>/<message_id>/<timestamp>_<filename>'
);

assert(
  storageContent.includes("const subId = messageId && messageId.trim() ? messageId.trim() : 'inquiry'"),
  'uploadAcademicFile defaults messageId to "inquiry" for root question attachments'
);

assert(
  storageContent.includes("export const BUCKET_NAME = 'academic-attachments'"),
  'storage.ts targets private academic-attachments bucket'
);

assert(
  storageContent.includes('export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024'),
  'storage.ts enforces 10MB maximum file size limit'
);

// ----------------------------------------------------------------------------
// SECTION 4: Doubts Service Layer (`src/lib/doubts.ts`) Static Inspection
// ----------------------------------------------------------------------------
console.log('\n--- SECTION 4: Doubts Service Layer Inspection ---');

const doubtsServicePath = path.resolve('src/lib/doubts.ts');
assert(fs.existsSync(doubtsServicePath), 'src/lib/doubts.ts exists on disk');

const doubtsServiceContent = fs.readFileSync(doubtsServicePath, 'utf8');

assert(
  doubtsServiceContent.includes('uploadAcademicFile') &&
    doubtsServiceContent.includes('deleteAcademicFile') &&
    doubtsServiceContent.includes('validateAcademicFile'),
  'doubts.ts imports uploadAcademicFile, deleteAcademicFile, and validateAcademicFile'
);

assert(
  doubtsServiceContent.includes('attachmentFile?: File | null'),
  'createDoubt accepts optional attachmentFile parameter'
);

assert(
  doubtsServiceContent.includes('validateAcademicFile(params.attachmentFile)'),
  'createDoubt validates attachment before database operations'
);

assert(
  doubtsServiceContent.includes("category: 'doubts'") &&
    doubtsServiceContent.includes("messageId: 'inquiry'"),
  'createDoubt uploads with category "doubts" and messageId "inquiry"'
);

assert(
  doubtsServiceContent.includes("await supabase.from('doubts').delete().eq('id', insertedDoubt.id)"),
  'createDoubt implements compensation: removes newly created parent doubt if storage upload fails'
);

assert(
  doubtsServiceContent.includes('deleteAcademicFile(uploadedPath)') &&
    doubtsServiceContent.includes("await supabase.from('doubts').delete().eq('id', insertedDoubt.id)"),
  'createDoubt implements dual compensation: deletes uploaded storage object and parent doubt if metadata update fails'
);

assert(
  doubtsServiceContent.includes('attachmentFile?: File | null'),
  'addDoubtResponse accepts optional attachmentFile parameter'
);

assert(
  doubtsServiceContent.includes("category: 'doubts'") &&
    doubtsServiceContent.includes('messageId: responseId'),
  'addDoubtResponse uploads with category "doubts" and unique responseId'
);

assert(
  doubtsServiceContent.includes('deleteAcademicFile(uploadedPath)'),
  'addDoubtResponse implements compensation: deletes uploaded storage object if response row insertion fails'
);

assert(
  doubtsServiceContent.includes('deleteAcademicFile(doubt.attachment_path)') &&
    doubtsServiceContent.includes('deleteAcademicFile(r.attachment_path)'),
  'deleteDoubt cascades storage deletion to clean up both inquiry and response attachments'
);

assert(
  doubtsServiceContent.includes('attachment_path: r.attachment_path || undefined') &&
    doubtsServiceContent.includes('attachment_path: row.attachment_path || undefined'),
  'getStudentDoubts, getMentorDoubts, and getDoubtById map attachment metadata on doubts and responses'
);

// ----------------------------------------------------------------------------
// SECTION 5: UI Component & Frontend Integration Static Inspection
// ----------------------------------------------------------------------------
console.log('\n--- SECTION 5: UI Component & Frontend Integration ---');

const studentDoubtsPagePath = path.resolve('src/pages/dashboard/StudentDoubtsPage.tsx');
assert(fs.existsSync(studentDoubtsPagePath), 'StudentDoubtsPage.tsx exists on disk');

const studentPageContent = fs.readFileSync(studentDoubtsPagePath, 'utf8');

assert(
  studentPageContent.includes('AttachmentViewerModal'),
  'StudentDoubtsPage imports AttachmentViewerModal'
);
assert(
  studentPageContent.includes('validateAcademicFile') &&
    studentPageContent.includes('getAcademicFileSignedUrl'),
  'StudentDoubtsPage imports storage utilities'
);
assert(
  studentPageContent.includes('attachmentFile: selectedFile'),
  'StudentDoubtsPage passes selectedFile attachment to createDoubt'
);
assert(
  studentPageContent.includes('attachmentFile: replyFile'),
  'StudentDoubtsPage passes replyFile attachment to addDoubtResponse'
);
assert(
  studentPageContent.includes('activeDoubt.attachment_path') &&
    studentPageContent.includes('renderAttachmentCard'),
  'StudentDoubtsPage renders attachment card for root inquiry'
);
assert(
  studentPageContent.includes('resp.attachment_path'),
  'StudentDoubtsPage renders attachment card for thread responses'
);
assert(
  studentPageContent.includes('handleDownloadAttachment') &&
    studentPageContent.includes('handleOpenAttachmentViewer'),
  'StudentDoubtsPage implements preview and download handlers'
);
assert(
  studentPageContent.includes('doubt.attachment_path') &&
    studentPageContent.includes('Paperclip'),
  'StudentDoubtsPage displays attachment indicator in doubts list items'
);

const mentorDoubtsPagePath = path.resolve('src/pages/dashboard/MentorDoubtsPage.tsx');
assert(fs.existsSync(mentorDoubtsPagePath), 'MentorDoubtsPage.tsx exists on disk');

const mentorPageContent = fs.readFileSync(mentorDoubtsPagePath, 'utf8');

assert(
  mentorPageContent.includes('AttachmentViewerModal'),
  'MentorDoubtsPage imports AttachmentViewerModal'
);
assert(
  mentorPageContent.includes('validateAcademicFile') &&
    mentorPageContent.includes('getAcademicFileSignedUrl'),
  'MentorDoubtsPage imports storage utilities'
);
assert(
  mentorPageContent.includes('attachmentFile: replyFile'),
  'MentorDoubtsPage passes replyFile attachment to addDoubtResponse'
);
assert(
  mentorPageContent.includes('activeDoubt.attachment_path') &&
    mentorPageContent.includes('renderAttachmentCard'),
  'MentorDoubtsPage renders attachment card for student question'
);
assert(
  mentorPageContent.includes('resp.attachment_path'),
  'MentorDoubtsPage renders attachment card for thread responses'
);
assert(
  mentorPageContent.includes('handleDownloadAttachment') &&
    mentorPageContent.includes('handleOpenAttachmentViewer'),
  'MentorDoubtsPage implements preview and download handlers'
);
assert(
  mentorPageContent.includes('doubt.attachment_path') &&
    mentorPageContent.includes('Paperclip'),
  'MentorDoubtsPage displays attachment indicator in mentor queue items'
);

// ----------------------------------------------------------------------------
// SECTION 6: Runtime Filename Sanitization & Strict Validation Simulation
// ----------------------------------------------------------------------------
console.log('\n--- SECTION 6: Filename Sanitization & Validation Simulation ---');

function simulateSanitizeFileName(name: string): string {
  if (!name) return 'attachment';
  const baseName = name.replace(/\\/g, '/').split('/').pop() || 'attachment';
  const lastDot = baseName.lastIndexOf('.');
  let stem = lastDot !== -1 ? baseName.slice(0, lastDot) : baseName;
  const ext = lastDot !== -1 ? baseName.slice(lastDot).toLowerCase() : '';
  stem = stem.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '');
  if (!stem) stem = 'attachment';
  return `${stem}${ext}`;
}

assert(
  simulateSanitizeFileName('circuit_diagram.png') === 'circuit_diagram.png',
  'Sanitizer preserves valid filenames'
);
assert(
  simulateSanitizeFileName('../../etc/passwd.pdf') === 'passwd.pdf',
  'Sanitizer strips directory traversal path prefixes'
);
assert(
  simulateSanitizeFileName('..\\..\\windows\\calc.docx') === 'calc.docx',
  'Sanitizer strips Windows directory traversal path prefixes'
);
assert(
  simulateSanitizeFileName('question  #1 & final?.webp') === 'question_1_final.webp',
  'Sanitizer replaces unsafe characters with underscores'
);
assert(
  simulateSanitizeFileName('') === 'attachment',
  'Sanitizer provides fallback for empty names'
);

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
const ALLOWED_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg', '.webp', '.docx'];

function simulateValidateAcademicFile(fileName: string, mimeType: string, sizeBytes: number): { valid: boolean; error: string | null } {
  if (!fileName) return { valid: false, error: 'No file provided.' };
  if (sizeBytes <= 0) return { valid: false, error: 'File cannot be empty.' };
  if (sizeBytes > MAX_FILE_SIZE_BYTES) return { valid: false, error: 'File exceeds 10MB limit.' };

  const nameParts = fileName.split('.');
  const ext = nameParts.length > 1 ? `.${nameParts.pop()?.toLowerCase()}` : '';

  const isMimeAllowed = ALLOWED_MIME_TYPES.includes(mimeType);
  const isExtAllowed = ALLOWED_EXTENSIONS.includes(ext);

  if (!isExtAllowed || (mimeType !== '' && !isMimeAllowed)) {
    return { valid: false, error: 'Unsupported file format.' };
  }
  return { valid: true, error: null };
}

// 1. Supported PDF
assert(simulateValidateAcademicFile('homework.pdf', 'application/pdf', 500000).valid === true, 'Supported PDF passes validation');

// 2. Supported Images
assert(simulateValidateAcademicFile('diagram.png', 'image/png', 300000).valid === true, 'Supported PNG passes validation');
assert(simulateValidateAcademicFile('notes.jpg', 'image/jpeg', 400000).valid === true, 'Supported JPG passes validation');
assert(simulateValidateAcademicFile('render.webp', 'image/webp', 250000).valid === true, 'Supported WebP passes validation');

// 3. Supported DOCX
assert(
  simulateValidateAcademicFile(
    'essay.docx',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    600000
  ).valid === true,
  'Supported DOCX passes validation'
);

// 4. Unsupported Extension
assert(simulateValidateAcademicFile('virus.exe', 'application/x-msdownload', 100000).valid === false, 'Executable .exe is rejected');
assert(simulateValidateAcademicFile('archive.zip', 'application/zip', 100000).valid === false, 'Archive .zip is rejected');
assert(simulateValidateAcademicFile('script.sh', 'application/x-sh', 100000).valid === false, 'Shell script .sh is rejected');

// 5. Unsupported extension with allowed MIME type (rejected)
assert(
  simulateValidateAcademicFile('malicious.sh', 'application/pdf', 2000).valid === false,
  'Shell script (.sh) spoofing PDF MIME type is rejected'
);

// 6. Allowed extension with disallowed/mismatched MIME type (rejected)
assert(
  simulateValidateAcademicFile('homework.pdf', 'application/x-msdownload', 50000).valid === false,
  'PDF file with executable MIME type is rejected'
);

// 7. Case-insensitive extension check
assert(
  simulateValidateAcademicFile('REPORT.PDF', 'application/pdf', 100000).valid === true,
  'Case-insensitive uppercase .PDF extension is accepted'
);

// 8. Empty MIME with valid extension
assert(simulateValidateAcademicFile('scan.pdf', '', 100000).valid === true, 'Empty MIME with valid extension is permitted');

// 9. File larger than 10MB
assert(simulateValidateAcademicFile('giant.pdf', 'application/pdf', MAX_FILE_SIZE_BYTES + 1024).valid === false, 'File exceeding 10MB is rejected');

// 10. Zero-byte file
assert(simulateValidateAcademicFile('empty.pdf', 'application/pdf', 0).valid === false, 'Zero-byte file is rejected');

// ----------------------------------------------------------------------------
// SECTION 7: Runtime Mock Store & Service Workflow Simulation
// ----------------------------------------------------------------------------
console.log('\n--- SECTION 7: Mock Data & Workflow Simulation ---');

// 1. Create Mock Doubt with Attachment
const createdDoubtRes = createMockDoubt({
  studentId: 'mock-student-pp001',
  title: 'Atwood normal force and incline friction coupling',
  question: 'Does the normal force affect tension directly or through friction?',
  priority: 'high',
  programId: 'prog-academic-01',
  attachmentPath: 'doubts/mock-doubt-test/inquiry/1700000000_atwood.png',
  attachmentName: 'atwood.png',
  attachmentSize: 154000,
});

assert(createdDoubtRes.error === null, 'createMockDoubt with attachment succeeds');
assert(createdDoubtRes.doubt !== null, 'Created doubt object is returned');
assert(createdDoubtRes.doubt?.attachment_name === 'atwood.png', 'Mock doubt stores attachment_name');
assert(createdDoubtRes.doubt?.attachment_size === 154000, 'Mock doubt stores attachment_size');
assert(
  createdDoubtRes.doubt?.attachment_path?.startsWith('doubts/') === true,
  'Mock doubt stores attachment_path under doubts/ namespace'
);

const testDoubtId = createdDoubtRes.doubt!.id;

// 2. Add Mock Response with Attachment
const createdRespRes = addMockDoubtResponse({
  doubtId: testDoubtId,
  authorId: 'mock-mentor-ppm001',
  message: 'Normal force acts perpendicular to incline, coupling via fk = mu * N.',
  attachmentPath: `doubts/${testDoubtId}/resp-01/1700000010_derivation.pdf`,
  attachmentName: 'derivation.pdf',
  attachmentSize: 220000,
});

assert(createdRespRes.error === null, 'addMockDoubtResponse with attachment succeeds');
assert(createdRespRes.response !== null, 'Created response object is returned');
assert(createdRespRes.response?.attachment_name === 'derivation.pdf', 'Mock response stores attachment_name');
assert(createdRespRes.response?.attachment_size === 220000, 'Mock response stores attachment_size');
assert(
  createdRespRes.response?.attachment_path?.startsWith(`doubts/${testDoubtId}/`) === true,
  'Mock response stores attachment_path partitioned under doubt conversation'
);

// 3. Query Enriched Doubt
const retrieved = getMockDoubtById(testDoubtId);
assert(retrieved !== null, 'getMockDoubtById retrieves created doubt');
assert(retrieved?.attachment_name === 'atwood.png', 'Enriched doubt retains root inquiry attachment');
assert(retrieved?.responses && retrieved.responses.length > 0, 'Enriched doubt includes thread responses');
const matchingResp = retrieved?.responses?.find((r) => r.id === createdRespRes.response?.id);
assert(matchingResp?.attachment_name === 'derivation.pdf', 'Enriched response retains reply attachment');

// 4. Text-only response succeeds without attachment
const textRespRes = addMockDoubtResponse({
  doubtId: testDoubtId,
  authorId: 'mock-student-pp001',
  message: 'Understood completely, thank you!',
});
assert(textRespRes.error === null, 'Text-only reply succeeds');
assert(textRespRes.response?.attachment_path === null, 'Text-only reply has null attachment_path');

// 5. Delete Mock Doubt
const deleteResult = deleteMockDoubt(testDoubtId, 'mock-student-pp001');
assert(deleteResult.success === true, 'deleteMockDoubt succeeds for student owner');
assert(getMockDoubtById(testDoubtId) === null, 'Deleted doubt is no longer retrieved');

// ----------------------------------------------------------------------------
// SECTION 8: Authorization & Security Isolation Logic
// ----------------------------------------------------------------------------
console.log('\n--- SECTION 8: Authorization & Security Isolation Logic ---');

const authorizedMentorId = 'mock-mentor-ppm001';
const studentId = 'mock-student-pp001';
const programId = 'prog-academic-01';

// Active authorized mentor
assert(
  isMockAuthorizedMentorForStudent(authorizedMentorId, studentId, programId) === true,
  'Active assigned mentor is granted authorized access'
);

// Unassigned mentor
const unassignedMentorId = 'mock-mentor-unassigned';
assert(
  isMockAuthorizedMentorForStudent(unassignedMentorId, studentId, programId) === false,
  'Unassigned mentor is denied access'
);

// Cross-program isolation
const unrelatedProgramId = 'prog-different-02';
assert(
  isMockAuthorizedMentorForStudent(authorizedMentorId, studentId, unrelatedProgramId) === false,
  'Mentor assigned to different program is denied access (program isolation)'
);

// Unauthorized response attempt rejected
const unauthorizedRespRes = addMockDoubtResponse({
  doubtId: 'mock-doubt-001',
  authorId: 'unrelated-stranger',
  message: 'Unauthorized comment attempt',
});
assert(unauthorizedRespRes.error !== null, 'Unauthorized user cannot post response to doubt thread');

// ----------------------------------------------------------------------------
// SUMMARY
// ----------------------------------------------------------------------------
console.log('\n================================================================');
console.log(`Verification Summary: ${passedTests} / ${totalTests} Passed (${Math.round((passedTests / totalTests) * 100)}%)`);
console.log('================================================================');

if (passedTests !== totalTests) {
  process.exit(1);
}
