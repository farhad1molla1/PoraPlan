/**
 * PoraPlan Milestone 6.0.4 Verification Suite
 * Mentor Assignment Review: Attachment Preview & Download
 */

import fs from 'fs';
import path from 'path';
import {
  getMockMentorSubmissions,
  reviewMockSubmission,
  submitMockAssignment,
  mockAssignments,
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
console.log('PoraPlan Milestone 6.0.4 Mentor Attachment Review Verification');
console.log('================================================================\n');

// 1. Static checks on MentorReviewQueuePage.tsx
const mentorQueuePath = path.resolve('src/pages/dashboard/MentorReviewQueuePage.tsx');
assert(fs.existsSync(mentorQueuePath), 'MentorReviewQueuePage.tsx exists on disk');

const mentorQueueContent = fs.readFileSync(mentorQueuePath, 'utf8');

assert(
  mentorQueueContent.includes("import { AttachmentViewerModal } from '../../components/common/AttachmentViewerModal'"),
  'MentorReviewQueuePage imports AttachmentViewerModal'
);

assert(
  mentorQueueContent.includes('getAcademicFileSignedUrl'),
  'MentorReviewQueuePage imports getAcademicFileSignedUrl from storage'
);

assert(
  mentorQueueContent.includes('handlePreviewAttachment'),
  'MentorReviewQueuePage implements handlePreviewAttachment'
);

assert(
  mentorQueueContent.includes('handleDownloadAttachment'),
  'MentorReviewQueuePage implements handleDownloadAttachment'
);

assert(
  mentorQueueContent.includes('viewerModal') && mentorQueueContent.includes('<AttachmentViewerModal'),
  'MentorReviewQueuePage renders AttachmentViewerModal at root level'
);

assert(
  mentorQueueContent.includes('reviewTarget.submission_type === \'file\''),
  'MentorReviewQueuePage checks for file submission type in evaluation modal'
);

assert(
  mentorQueueContent.includes('handlePreviewAttachment(reviewTarget)') &&
    mentorQueueContent.includes('handleDownloadAttachment(reviewTarget)'),
  'MentorReviewQueuePage provides Preview and Download in evaluation modal'
);

// 2. Static check on AttachmentViewerModal.tsx z-index
const attachmentViewerPath = path.resolve('src/components/common/AttachmentViewerModal.tsx');
assert(fs.existsSync(attachmentViewerPath), 'AttachmentViewerModal.tsx exists on disk');

const attachmentViewerContent = fs.readFileSync(attachmentViewerPath, 'utf8');
assert(
  attachmentViewerContent.includes('z-[60]'),
  'AttachmentViewerModal uses z-[60] to properly layer above review modal (z-50)'
);

// 3. Static check on src/lib/assignments.ts mapping
const assignmentsLibPath = path.resolve('src/lib/assignments.ts');
const assignmentsLibContent = fs.readFileSync(assignmentsLibPath, 'utf8');

assert(
  assignmentsLibContent.includes('file_path: row.file_path || null'),
  'assignments.ts getMentorReviewQueue() maps file_path from database rows'
);

// 4. Runtime / Mock Store Verification
const mentorId = 'mock-mentor-ppm001';
const studentId = 'mock-student-pp001';
const testAssignment = mockAssignments[0];

// Submit a file-based assignment in mock store
const mockFilePath = `submissions/${testAssignment.id}/${studentId}/1700000000000_solution_proof.pdf`;
const mockFileName = 'solution_proof.pdf';
const mockFileSize = 204800; // 200 KB

const submitResult = submitMockAssignment({
  assignmentId: testAssignment.id,
  studentId: studentId,
  submissionType: 'file',
  content: 'Attached handwritten mathematical derivations.',
  filePath: mockFilePath,
  fileName: mockFileName,
  fileSize: mockFileSize,
});

assert(submitResult.error === null, 'Mock file submission completes without error');
assert(submitResult.submission?.file_path === mockFilePath, 'Mock file submission retains file_path');
assert(submitResult.submission?.file_name === mockFileName, 'Mock file submission retains file_name');
assert(submitResult.submission?.file_size === mockFileSize, 'Mock file submission retains file_size');

// Check that getMockMentorSubmissions returns the submission with all attachment fields
const mentorQueue = getMockMentorSubmissions(mentorId);
const queuedSub = mentorQueue.find((s) => s.id === submitResult.submission?.id);

assert(queuedSub !== undefined, 'Mentor review queue contains student file submission');
assert(queuedSub?.submission_type === 'file', 'Queued submission indicates submission_type file');
assert(queuedSub?.file_path === mockFilePath, 'Queued submission contains accurate file_path');
assert(queuedSub?.file_name === mockFileName, 'Queued submission contains accurate file_name');
assert(queuedSub?.file_size === mockFileSize, 'Queued submission contains accurate file_size');

// Mentor reviews and evaluates the file submission
const reviewResult = reviewMockSubmission({
  submissionId: queuedSub!.id,
  mentorId: mentorId,
  status: 'reviewed',
  score: 95,
  feedback: 'Excellent step-by-step calculus derivation. Clean work.',
});

assert(reviewResult.error === null, 'Mentor review evaluation saves without error');
assert(reviewResult.submission?.status === 'reviewed', 'Evaluation updates status to reviewed');
assert(reviewResult.submission?.score === 95, 'Evaluation saves score accurately');
assert(
  reviewResult.submission?.feedback === 'Excellent step-by-step calculus derivation. Clean work.',
  'Evaluation saves feedback accurately'
);
assert(
  reviewResult.submission?.file_path === mockFilePath,
  'Evaluation preserves attachment file_path intact'
);
assert(
  reviewResult.submission?.file_name === mockFileName,
  'Evaluation preserves attachment file_name intact'
);

console.log('\n================================================================');
console.log(`Summary: ${passedTests}/${totalTests} scenarios passed (${totalTests - passedTests} failed).`);
console.log('================================================================');

if (passedTests !== totalTests) {
  process.exit(1);
}
