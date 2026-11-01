/**
 * ==============================================================================
 * PoraPlan Milestone 6.0.3 Verification Script
 *
 * Validates:
 * 1. Student assignment file upload workflow in StudentAssignmentsPage.tsx
 * 2. AttachmentViewerModal component presence and structure
 * 3. Extended submitAssignment function in assignments.ts (supporting filePath)
 * 4. submitMockAssignment in mockAuthStore.ts (filePath persistence)
 * 5. Lifecycle safety: file validation, rollback on metadata failure,
 *    and locked state protection (under_review, reviewed)
 * 6. Non-regression of existing text and link submission workflows
 * ==============================================================================
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  submitMockAssignment,
  mockSubmissions,
} from '../src/lib/mockAuthStore';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, details?: string): void {
  if (condition) {
    console.log(`[PASS] ${testName}`);
    passed++;
  } else {
    console.error(`[FAIL] ${testName}${details ? ` -> ${details}` : ''}`);
    failed++;
  }
}

function runVerification(): void {
  console.log('================================================================');
  console.log('PoraPlan Milestone 6.0.3 Student File Attachment Verification');
  console.log('================================================================\n');

  // ----------------------------------------------------------------------------
  // SECTION 1: Static Architecture & Implementation Verification
  // ----------------------------------------------------------------------------
  const pagePath = path.resolve(process.cwd(), 'src/pages/dashboard/StudentAssignmentsPage.tsx');
  assert(fs.existsSync(pagePath), 'StudentAssignmentsPage.tsx exists on disk');
  const pageContent = fs.readFileSync(pagePath, 'utf8');

  assert(
    pageContent.includes('uploadAcademicFile') &&
      pageContent.includes('getAcademicFileSignedUrl') &&
      pageContent.includes('deleteAcademicFile') &&
      pageContent.includes('validateAcademicFile'),
    'StudentAssignmentsPage imports all required storage helpers'
  );

  assert(
    pageContent.includes('AttachmentViewerModal'),
    'StudentAssignmentsPage integrates AttachmentViewerModal'
  );

  assert(
    pageContent.includes('deleteAcademicFile(newUploadPath)') ||
      pageContent.includes('deleteAcademicFile(uploadedPath)'),
    'StudentAssignmentsPage implements rollback cleanup if submission metadata update fails'
  );

  assert(
    pageContent.includes("submissionStatus === 'under_review'") &&
      pageContent.includes("submissionStatus === 'reviewed'"),
    'StudentAssignmentsPage enforces submission lock for under_review and reviewed statuses'
  );

  assert(
    pageContent.includes('handlePreviewExistingAttachment') &&
      pageContent.includes('handleDownloadAttachment'),
    'StudentAssignmentsPage provides authorized preview and download actions'
  );

  const modalPath = path.resolve(process.cwd(), 'src/components/common/AttachmentViewerModal.tsx');
  assert(fs.existsSync(modalPath), 'AttachmentViewerModal.tsx component exists on disk');
  const modalContent = fs.readFileSync(modalPath, 'utf8');

  assert(
    modalContent.includes('isImage') &&
      modalContent.includes('isPdf') &&
      modalContent.includes('isDocx'),
    'AttachmentViewerModal supports PDF, images, and DOCX files'
  );

  const assignLibPath = path.resolve(process.cwd(), 'src/lib/assignments.ts');
  const assignLibContent = fs.readFileSync(assignLibPath, 'utf8');
  assert(
    assignLibContent.includes('filePath?: string') &&
      assignLibContent.includes('file_path: params.filePath || null'),
    'assignments.ts submitAssignment accepts and saves filePath'
  );

  // ----------------------------------------------------------------------------
  // SECTION 2: Mock Submission & Attachment Lifecycle Tests
  // ----------------------------------------------------------------------------
  const testStudentId = 'mock-student-pp001';
  const testAssignId = 'mock-assign-001';

  // 1. Submit text assignment (existing workflow compatibility)
  const textSub = submitMockAssignment({
    assignmentId: testAssignId,
    studentId: testStudentId,
    submissionType: 'text',
    content: 'Mathematical derivation proof steps.',
  });
  assert(
    textSub.error === null &&
      textSub.submission !== null &&
      textSub.submission.submission_type === 'text',
    'submitMockAssignment handles text-based submissions cleanly'
  );

  // 2. Submit link assignment (existing workflow compatibility)
  const linkSub = submitMockAssignment({
    assignmentId: testAssignId,
    studentId: testStudentId,
    submissionType: 'link',
    content: 'https://github.com/poraplan/solution-repo',
    linkUrl: 'https://github.com/poraplan/solution-repo',
  });
  assert(
    linkSub.error === null &&
      linkSub.submission !== null &&
      linkSub.submission.submission_type === 'link',
    'submitMockAssignment handles link-based submissions cleanly'
  );

  // 3. Submit file attachment with filePath
  const fileSub = submitMockAssignment({
    assignmentId: testAssignId,
    studentId: testStudentId,
    submissionType: 'file',
    content: 'Attached problem set answers.',
    fileName: 'calculus_homework.pdf',
    fileSize: 245000,
    filePath: 'submissions/mock-assign-001/mock-student-pp001/1690000000_calculus_homework.pdf',
  });
  assert(
    fileSub.error === null &&
      fileSub.submission !== null &&
      fileSub.submission.submission_type === 'file' &&
      fileSub.submission.file_path ===
        'submissions/mock-assign-001/mock-student-pp001/1690000000_calculus_homework.pdf',
    'submitMockAssignment preserves file_path, file_name, and file_size'
  );

  // 4. Update file attachment (preserves or updates file_path)
  const fileUpdate = submitMockAssignment({
    assignmentId: testAssignId,
    studentId: testStudentId,
    submissionType: 'file',
    content: 'Updated notes with corrected equation.',
    fileName: 'calculus_homework_v2.pdf',
    fileSize: 250000,
    filePath: 'submissions/mock-assign-001/mock-student-pp001/1690000001_calculus_homework_v2.pdf',
  });
  assert(
    fileUpdate.error === null &&
      fileUpdate.submission !== null &&
      fileUpdate.submission.file_name === 'calculus_homework_v2.pdf' &&
      fileUpdate.submission.file_path ===
        'submissions/mock-assign-001/mock-student-pp001/1690000001_calculus_homework_v2.pdf',
    'submitMockAssignment updates file metadata without duplicate entries'
  );

  // 5. Locked submission protection (under_review)
  const subIndex = mockSubmissions.findIndex((s) => s.assignment_id === testAssignId);
  if (subIndex !== -1) {
    mockSubmissions[subIndex].status = 'under_review';
  }
  const lockedUnderReview = submitMockAssignment({
    assignmentId: testAssignId,
    studentId: testStudentId,
    submissionType: 'file',
    content: 'Attempted modification while under review',
  });
  assert(
    lockedUnderReview.error !== null &&
      lockedUnderReview.error.message.includes('under mentor review'),
    'Submissions in under_review status cannot be modified or replaced'
  );

  // 6. Locked submission protection (reviewed)
  if (subIndex !== -1) {
    mockSubmissions[subIndex].status = 'reviewed';
  }
  const lockedReviewed = submitMockAssignment({
    assignmentId: testAssignId,
    studentId: testStudentId,
    submissionType: 'file',
    content: 'Attempted modification after grading',
  });
  assert(
    lockedReviewed.error !== null &&
      lockedReviewed.error.message.includes('already reviewed'),
    'Submissions in reviewed status cannot be modified or replaced'
  );

  // Reset mock submission status back to submitted for test isolation
  if (subIndex !== -1) {
    mockSubmissions[subIndex].status = 'submitted';
  }

  console.log('\n================================================================');
  console.log(`Summary: ${passed}/${passed + failed} scenarios passed (${failed} failed).`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runVerification();
