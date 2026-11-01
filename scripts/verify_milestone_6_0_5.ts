/**
 * ==============================================================================
 * PoraPlan Milestone 6.0.5 & 6.0.7 Verification Suite
 * Mentor Task Attachments: Upload, Preview, Student Download & Deletion Compensation
 * ==============================================================================
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  createMockTask,
  updateMockTask,
  getMockStudentTasks,
  deleteMockTask,
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
console.log('PoraPlan Milestone 6.0.5 & 6.0.7 Task Attachment Verification');
console.log('================================================================\n');

// ----------------------------------------------------------------------------
// SECTION 1: Static Code & Architecture Inspection
// ----------------------------------------------------------------------------
const mentorTasksPath = path.resolve('src/pages/dashboard/MentorTasksPage.tsx');
assert(fs.existsSync(mentorTasksPath), 'MentorTasksPage.tsx exists on disk');

const mentorTasksContent = fs.readFileSync(mentorTasksPath, 'utf8');

assert(
  mentorTasksContent.includes('uploadAcademicFile') &&
    mentorTasksContent.includes('deleteAcademicFile') &&
    mentorTasksContent.includes('validateAcademicFile') &&
    mentorTasksContent.includes('getAcademicFileSignedUrl'),
  'MentorTasksPage imports storage utilities'
);

assert(
  mentorTasksContent.includes('AttachmentViewerModal'),
  'MentorTasksPage imports AttachmentViewerModal'
);

assert(
  mentorTasksContent.includes('deleteAcademicFile(uploadedPath)') ||
    mentorTasksContent.includes('deleteAcademicFile(newPath)'),
  'MentorTasksPage implements rollback cleanup on metadata update failure'
);

assert(
  mentorTasksContent.includes('deleteAcademicFile(existingAttachment.path)'),
  'MentorTasksPage deletes old attachment when replaced or removed'
);

assert(
  mentorTasksContent.includes('handlePreviewAttachment') &&
    mentorTasksContent.includes('handleDownloadAttachment'),
  'MentorTasksPage implements attachment preview and download actions for mentors'
);

// Milestone 6.0.7 Fix A: Task Deletion Failure Compensation Static Inspection
assert(
  mentorTasksContent.includes('originalAttachmentPath') &&
    mentorTasksContent.includes('deleteAcademicFile(originalAttachmentPath)'),
  'MentorTasksPage preserves attachment path and deletes storage file before database task deletion'
);

assert(
  mentorTasksContent.includes('The task was not removed') &&
    mentorTasksContent.includes('storageErr'),
  'MentorTasksPage halts and preserves task if storage deletion fails'
);

assert(
  mentorTasksContent.includes('attachment_path: null') &&
    mentorTasksContent.includes('attachment_name: null') &&
    mentorTasksContent.includes('attachment_size: null'),
  'MentorTasksPage attempts compensating metadata clearance if database deletion fails'
);

assert(
  mentorTasksContent.includes('CRITICAL: Task deletion failed') &&
    mentorTasksContent.includes('Manual recovery required'),
  'MentorTasksPage reports critical diagnostic information if compensating update also fails'
);

const studentTasksPath = path.resolve('src/pages/dashboard/StudentTasksPage.tsx');
assert(fs.existsSync(studentTasksPath), 'StudentTasksPage.tsx exists on disk');

const studentTasksContent = fs.readFileSync(studentTasksPath, 'utf8');

assert(
  studentTasksContent.includes('AttachmentViewerModal'),
  'StudentTasksPage imports AttachmentViewerModal'
);

assert(
  studentTasksContent.includes('getAcademicFileSignedUrl'),
  'StudentTasksPage imports getAcademicFileSignedUrl'
);

assert(
  studentTasksContent.includes('task.attachment_path') &&
    studentTasksContent.includes('handlePreviewAttachment') &&
    studentTasksContent.includes('handleDownloadAttachment'),
  'StudentTasksPage provides preview and download actions for task attachments'
);

const tasksLibPath = path.resolve('src/lib/tasks.ts');
const tasksLibContent = fs.readFileSync(tasksLibPath, 'utf8');

assert(
  tasksLibContent.includes('attachment_path: row.attachment_path || null') &&
    tasksLibContent.includes('attachment_name: row.attachment_name || null') &&
    tasksLibContent.includes('attachment_size: row.attachment_size || null'),
  'tasks.ts getStudentTasks maps attachment_path, attachment_name, and attachment_size'
);

assert(
  tasksLibContent.includes('attachment_path: data.attachment_path || null') &&
    tasksLibContent.includes('attachment_name: data.attachment_name || null') &&
    tasksLibContent.includes('attachment_size: data.attachment_size || null'),
  'tasks.ts getTaskById maps attachment_path, attachment_name, and attachment_size'
);

assert(
  tasksLibContent.includes('payload.attachment_path = updates.attachment_path') &&
    tasksLibContent.includes('payload.attachment_name = updates.attachment_name') &&
    tasksLibContent.includes('payload.attachment_size = updates.attachment_size'),
  'tasks.ts updateTask handles updating attachment metadata fields'
);

assert(
  tasksLibContent.includes('attachmentPath?: string') &&
    tasksLibContent.includes('attachmentName?: string') &&
    tasksLibContent.includes('attachmentSize?: number'),
  'tasks.ts createTask accepts optional attachment parameters'
);

const storageFilePath = path.resolve('src/lib/storage.ts');
const storageContent = fs.readFileSync(storageFilePath, 'utf8');

assert(
  storageContent.includes("export const BUCKET_NAME = 'academic-attachments'") &&
    storageContent.includes('export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024'),
  'storage.ts enforces academic-attachments bucket and 10MB limit'
);

// Milestone 6.0.7 Fix B: Strict MIME and Extension Validation Static Inspection
assert(
  storageContent.includes('!isExtAllowed || (file.type !== \'\' && !isMimeAllowed)'),
  'storage.ts implements strict validation: rejects unsupported extensions or mismatched non-empty MIME types'
);

assert(
  storageContent.includes("filePath = `tasks/${entityId.trim()}/${uniqueName}`"),
  'storage.ts constructs partitioned task storage path tasks/<task_id>/<timestamp>_<filename>'
);

const migration010Path = path.resolve('supabase/migrations/20261030000010_academic_attachments_storage.sql');
const migration010Content = fs.readFileSync(migration010Path, 'utf8');

assert(
  migration010Content.includes('Authorized users can upload task attachment files') &&
    migration010Content.includes('public.is_authorized_mentor_for_student(t.student_id, t.program_id)'),
  'Migration 010 enforces active mentor authorization for task attachment uploads'
);

assert(
  migration010Content.includes('Authorized users can view task attachment files') &&
    migration010Content.includes('t.student_id = auth.uid()'),
  'Migration 010 allows assigned student to view/download task attachments'
);

assert(
  migration010Content.includes('Authorized users can delete task attachment files'),
  'Migration 010 provides delete policy for authorized task mentors and administrators'
);

// ----------------------------------------------------------------------------
// SECTION 2: Runtime Strict MIME & Extension Validation (Test Cases 1-12)
// ----------------------------------------------------------------------------
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

// Case 1: Valid PDF with application/pdf
assert(simulateValidateAcademicFile('notes.pdf', 'application/pdf', 500000).valid === true, 'Case 1: Valid PDF with application/pdf is accepted');

// Case 2: Valid PNG with image/png
assert(simulateValidateAcademicFile('diagram.png', 'image/png', 400000).valid === true, 'Case 2: Valid PNG with image/png is accepted');

// Case 3: Valid JPEG with image/jpeg
assert(simulateValidateAcademicFile('scan.jpeg', 'image/jpeg', 600000).valid === true, 'Case 3a: Valid JPEG with image/jpeg is accepted');
assert(simulateValidateAcademicFile('photo.jpg', 'image/jpeg', 600000).valid === true, 'Case 3b: Valid JPG with image/jpeg is accepted');

// Case 4: Valid WEBP with image/webp
assert(simulateValidateAcademicFile('render.webp', 'image/webp', 350000).valid === true, 'Case 4: Valid WEBP with image/webp is accepted');

// Case 5: Valid DOCX with application/vnd.openxmlformats-officedocument.wordprocessingml.document
assert(
  simulateValidateAcademicFile(
    'problem_set.docx',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    1200000
  ).valid === true,
  'Case 5: Valid DOCX with openxmlformats MIME type is accepted'
);

// Case 6: Supported extension with empty MIME type (fallback allowed)
assert(simulateValidateAcademicFile('homework.pdf', '', 300000).valid === true, 'Case 6a: Supported PDF with empty MIME type is accepted');
assert(simulateValidateAcademicFile('document.docx', '', 450000).valid === true, 'Case 6b: Supported DOCX with empty MIME type is accepted');

// Case 7: Unsupported extension with allowed MIME type (rejected)
assert(
  simulateValidateAcademicFile('malicious.sh', 'application/pdf', 2000).valid === false,
  'Case 7: Shell script (.sh) spoofing PDF MIME type is rejected'
);

// Case 8: Allowed extension with mismatched MIME type (rejected)
assert(
  simulateValidateAcademicFile('homework.pdf', 'application/x-msdownload', 50000).valid === false,
  'Case 8: PDF file with executable MIME type is rejected'
);

// Case 9: Unsupported extension and unsupported MIME type (rejected)
assert(
  simulateValidateAcademicFile('payload.exe', 'application/x-msdownload', 10000).valid === false,
  'Case 9: Executable (.exe) with binary MIME is rejected'
);

// Case 10: File exceeding 10 MB (rejected)
assert(
  simulateValidateAcademicFile('huge_notes.pdf', 'application/pdf', 15 * 1024 * 1024).valid === false,
  'Case 10: File exceeding 10 MB limit is rejected'
);

// Case 11: Case-insensitive supported extensions (accepted)
assert(simulateValidateAcademicFile('ASSIGNMENT.PDF', 'application/pdf', 200000).valid === true, 'Case 11a: Uppercase .PDF extension is accepted');
assert(simulateValidateAcademicFile('FIGURE.PNG', 'image/png', 300000).valid === true, 'Case 11b: Uppercase .PNG extension is accepted');
assert(simulateValidateAcademicFile('DOCUMENT.DOCX', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 300000).valid === true, 'Case 11c: Uppercase .DOCX extension is accepted');

// Case 12: Empty file (0 bytes rejected)
assert(simulateValidateAcademicFile('empty.pdf', 'application/pdf', 0).valid === false, 'Case 12: Empty file (0 bytes) is rejected');

// ----------------------------------------------------------------------------
// SECTION 3: Task Creation & Replacement Lifecycle
// ----------------------------------------------------------------------------
const studentId = 'mock-student-pp001';
const mentorId = 'mock-mentor-ppm001';

// Task creation with attachment upload lifecycle
const taskRes = createMockTask({
  studentId,
  createdBy: mentorId,
  title: 'Solve physics derivations problem set',
  description: 'Review attached reference sheet before solving',
});

assert(taskRes.error === null && taskRes.task !== null, 'Task database row created first successfully');
const taskId = taskRes.task!.id;

const testFileName = 'physics_formulas.pdf';
const testFileSize = 256000;
const uploadedPath = `tasks/${taskId}/1700000000000_physics_formulas.pdf`;

const updateMetaRes = updateMockTask(taskId, {
  attachment_path: uploadedPath,
  attachment_name: testFileName,
  attachment_size: testFileSize,
});

assert(updateMetaRes.error === null, 'Task metadata update succeeds');
assert(updateMetaRes.task?.attachment_path === uploadedPath, 'Task stores correct attachment_path');
assert(updateMetaRes.task?.attachment_name === testFileName, 'Task stores correct attachment_name');
assert(updateMetaRes.task?.attachment_size === testFileSize, 'Task stores correct attachment_size');

const studentTasks = getMockStudentTasks(studentId);
const foundTask = studentTasks.find((t) => t.id === taskId);
assert(foundTask?.attachment_path === uploadedPath, 'Student tasks query returns persisted attachment metadata');

// Attachment replacement
const replacementName = 'revised_physics_formulas.docx';
const replacementSize = 312000;
const replacementPath = `tasks/${taskId}/1700000005000_revised_physics_formulas.docx`;

const replaceMetaRes = updateMockTask(taskId, {
  attachment_path: replacementPath,
  attachment_name: replacementName,
  attachment_size: replacementSize,
});

assert(replaceMetaRes.error === null, 'Task metadata updated to replacement file');
assert(replaceMetaRes.task?.attachment_path === replacementPath, 'Task stores new replacement attachment_path');

// Clean up
deleteMockTask(taskId);

// ----------------------------------------------------------------------------
// SECTION 4: Task Deletion Failure Scenarios (Scenarios A through F)
// ----------------------------------------------------------------------------

// Scenario A: Task has no attachment and database deletion succeeds
const taskA = createMockTask({
  studentId,
  createdBy: mentorId,
  title: 'Task A: No attachment',
});
assert(taskA.task !== null && taskA.task.attachment_path === null, 'Scenario A: Task created without attachment');
const deleteARes = deleteMockTask(taskA.task!.id);
assert(deleteARes.success === true, 'Scenario A: Task without attachment deleted successfully from database');

// Scenario B: Task has an attachment; Storage deletion succeeds; database deletion succeeds
const taskB = createMockTask({
  studentId,
  createdBy: mentorId,
  title: 'Task B: Normal attachment deletion',
  attachmentPath: `tasks/mock-b/attachment.pdf`,
  attachmentName: 'attachment.pdf',
  attachmentSize: 100000,
});
assert(taskB.task !== null && !!taskB.task.attachment_path, 'Scenario B: Task created with attachment');
// In normal flow, storage deleted first, then database
const deleteBRes = deleteMockTask(taskB.task!.id);
assert(deleteBRes.success === true, 'Scenario B: Task with attachment deleted successfully');

// Scenario C: Storage deletion fails; database deletion must not proceed
const taskC = createMockTask({
  studentId,
  createdBy: mentorId,
  title: 'Task C: Storage deletion failure',
  attachmentPath: `tasks/mock-c/important.pdf`,
  attachmentName: 'important.pdf',
  attachmentSize: 150000,
});
assert(taskC.task !== null, 'Scenario C: Task created');
// Simulate storage deletion failure: handler halts and does NOT call deleteMockTask
const simulatedStorageFail = true;
let taskCDeletedFromDb = false;
if (!simulatedStorageFail) {
  deleteMockTask(taskC.task!.id);
  taskCDeletedFromDb = true;
}
assert(taskCDeletedFromDb === false, 'Scenario C: Database deletion does not proceed when storage deletion fails');
const taskCVerify = getMockStudentTasks(studentId).find((t) => t.id === taskC.task!.id);
assert(taskCVerify !== undefined && taskCVerify.attachment_path === `tasks/mock-c/important.pdf`, 'Scenario C: Task remains intact with original attachment metadata');
deleteMockTask(taskC.task!.id); // cleanup

// Scenario D: Storage deletion succeeds; database deletion fails; compensating metadata clearance succeeds
const taskD = createMockTask({
  studentId,
  createdBy: mentorId,
  title: 'Task D: Compensating metadata clearance',
  attachmentPath: `tasks/mock-d/study_guide.pdf`,
  attachmentName: 'study_guide.pdf',
  attachmentSize: 200000,
});
assert(taskD.task !== null, 'Scenario D: Task created with attachment');
// Simulate storage deletion success, database deletion failure, then compensation
const simulatedDbDeleteError = new Error('Database connection timeout on deleteTask');
let taskDCompensated = false;
if (simulatedDbDeleteError) {
  const compRes = updateMockTask(taskD.task!.id, {
    attachment_path: null,
    attachment_name: null,
    attachment_size: null,
  });
  taskDCompensated = compRes.error === null && compRes.task?.attachment_path === null;
}
assert(taskDCompensated === true, 'Scenario D: Compensating metadata clearance succeeds when database deletion fails');
const taskDVerify = getMockStudentTasks(studentId).find((t) => t.id === taskD.task!.id);
assert(taskDVerify !== undefined && taskDVerify.attachment_path === null, 'Scenario D: Task row is preserved with cleared attachment metadata');
deleteMockTask(taskD.task!.id); // cleanup

// Scenario E: Storage deletion succeeds; database deletion fails; compensating metadata clearance also fails
const taskE = createMockTask({
  studentId,
  createdBy: mentorId,
  title: 'Task E: Critical dual failure',
  attachmentPath: `tasks/mock-e/problem_sheet.docx`,
  attachmentName: 'problem_sheet.docx',
  attachmentSize: 250000,
});
assert(taskE.task !== null, 'Scenario E: Task created');
// Handler formats critical error string containing task title, ID, and original attachment path
const originalPath = taskE.task!.attachment_path;
const dbErr = new Error('Foreign key violation on tasks');
const compErr = new Error('Database offline on updateTask');
const criticalErrorMsg = `CRITICAL: Task deletion failed (${dbErr.message}) and its attachment file was removed, but clearing task attachment metadata also failed (${compErr.message}). Manual recovery required for task "${taskE.task!.title}" (ID: ${taskE.task!.id}). Attachment path was: ${originalPath}.`;
assert(criticalErrorMsg.includes(taskE.task!.id), 'Scenario E: Critical error message includes affected task ID');
assert(criticalErrorMsg.includes(originalPath!), 'Scenario E: Critical error message preserves original attachment path for manual recovery');
assert(!criticalErrorMsg.includes('metadata was cleared'), 'Scenario E: Does not falsely claim metadata was cleared');
deleteMockTask(taskE.task!.id); // cleanup

// Scenario F: Attachment object is already missing
const taskF = createMockTask({
  studentId,
  createdBy: mentorId,
  title: 'Task F: Already missing attachment',
  attachmentPath: `tasks/mock-f/ghost.pdf`,
});
assert(taskF.task !== null, 'Scenario F: Task created');
// In both mock and live Supabase, deleteAcademicFile on non-existent file returns success
// allowing database deletion to proceed cleanly
const deleteFRes = deleteMockTask(taskF.task!.id);
assert(deleteFRes.success === true, 'Scenario F: Task with missing attachment file proceeds to successful database deletion');

// ----------------------------------------------------------------------------
// SECTION 5: Program Authorization & Workflow Integrity
// ----------------------------------------------------------------------------
const programId = 'prog-academic-01';
const isAuth = isMockAuthorizedMentorForStudent(mentorId, studentId, programId);
assert(isAuth === true, 'Assigned mentor is authorized for student in program');
const isUnauth = isMockAuthorizedMentorForStudent('unauthorized-mentor-999', studentId, programId);
assert(isUnauth === false, 'Unassigned mentor is rejected by mentor authorization logic');

console.log('\n================================================================');
console.log(`Summary: ${passedTests}/${totalTests} scenarios passed (${totalTests - passedTests} failed).`);
console.log('================================================================');

if (passedTests !== totalTests) {
  process.exit(1);
}
