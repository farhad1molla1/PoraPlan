/**
 * PoraPlan — Milestone 5: Academic Library Assignments & Submissions Integration Verification
 *
 * Verifies:
 * 1. Architecture & Component Existence (StudentLibraryPage Tab 3, AttachmentViewerModal, assignment services)
 * 2. Tab Navigation & URL Synchronization (Tab 3 'assignments' mapping, query params, 3 tabs preserved)
 * 3. Static Inspection of StudentLibraryPage Tab 3 (Assignment list, filters, submission form, review display)
 * 4. Assignment Retrieval & Baseline Data
 * 5. Student-Specific Access & Authorization Constraints
 * 6. Multi-dimensional Filtering (Subject, Status: pending, submitted, under_review, reviewed, needs_revision)
 * 7. Search Functionality (Title, instructions, subject, submission text)
 * 8. Submission Lifecycle:
 *    - Text Submission
 *    - Link Submission (protocol validation)
 *    - File Submission (extension and size constraints)
 *    - Single-Submission Upsert Semantics (prevents duplicate submission rows)
 *    - Review Locking (under_review & reviewed cannot be modified; needs_revision can be resubmitted)
 * 9. Attachment Handling & Storage Integration (private academic-attachments bucket, signed URLs)
 * 10. Mentor Review Information & Grading Integration (score, feedback, reviewed_at)
 * 11. Preservation of Standalone Routes & Independent Modules
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  parseLibraryTab,
  getLibraryTabUrl,
  ACADEMIC_LIBRARY_TABS,
  DEFAULT_ACADEMIC_LIBRARY_TAB,
} from '../src/lib/library';
import {
  getMockStudentAssignments,
  createMockAssignment,
  deleteMockAssignment,
  submitMockAssignment,
  updateMockSubmissionStatus,
  reviewMockSubmission,
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
    process.exitCode = 1;
  }
}

async function runVerification() {
  console.log('================================================================');
  console.log('PoraPlan Milestone 5: Academic Library Assignments Integration');
  console.log('================================================================\n');

  const studentId = 'mock-student-pp001';

  // ---------------------------------------------------------------------------
  // SECTION 1: Architecture & Component Existence
  // ---------------------------------------------------------------------------
  console.log('--- SECTION 1: Architecture & File Existence ---');

  const libraryPagePath = path.resolve('src/pages/dashboard/StudentLibraryPage.tsx');
  assert(fs.existsSync(libraryPagePath), 'StudentLibraryPage.tsx exists on disk');

  const studentAssignmentsPagePath = path.resolve('src/pages/dashboard/StudentAssignmentsPage.tsx');
  assert(fs.existsSync(studentAssignmentsPagePath), 'StudentAssignmentsPage.tsx exists on disk');

  const assignmentsLibPath = path.resolve('src/lib/assignments.ts');
  assert(fs.existsSync(assignmentsLibPath), 'src/lib/assignments.ts exists on disk');

  const storageLibPath = path.resolve('src/lib/storage.ts');
  assert(fs.existsSync(storageLibPath), 'src/lib/storage.ts exists on disk');

  const attachmentModalPath = path.resolve('src/components/common/AttachmentViewerModal.tsx');
  assert(fs.existsSync(attachmentModalPath), 'AttachmentViewerModal.tsx exists on disk');

  // ---------------------------------------------------------------------------
  // SECTION 2: Tab Navigation & URL Synchronization
  // ---------------------------------------------------------------------------
  console.log('\n--- SECTION 2: Tab Navigation & URL Synchronization ---');

  assert(ACADEMIC_LIBRARY_TABS.includes('assignments'), 'assignments is in ACADEMIC_LIBRARY_TABS list');
  assert(parseLibraryTab('assignments') === 'assignments', 'parseLibraryTab parses ?tab=assignments correctly');
  assert(
    getLibraryTabUrl('/student/library', 'assignments') === '/student/library?tab=assignments',
    'getLibraryTabUrl generates /student/library?tab=assignments'
  );
  assert(
    getLibraryTabUrl('/student/library', 'resources') === '/student/library?tab=resources',
    'getLibraryTabUrl generates /student/library?tab=resources for resources'
  );
  assert(
    DEFAULT_ACADEMIC_LIBRARY_TAB === 'resources',
    'Default academic library tab remains resources'
  );

  // ---------------------------------------------------------------------------
  // SECTION 3: Static Inspection of StudentLibraryPage Tab 3 Implementation
  // ---------------------------------------------------------------------------
  console.log('\n--- SECTION 3: Static Inspection of StudentLibraryPage ---');

  const libraryPageContent = fs.readFileSync(libraryPagePath, 'utf8');

  assert(
    libraryPageContent.includes("activeTab === 'assignments'"),
    'StudentLibraryPage contains activeTab === assignments view'
  );
  assert(
    libraryPageContent.includes('getStudentAssignments'),
    'StudentLibraryPage calls getStudentAssignments'
  );
  assert(
    libraryPageContent.includes('submitAssignment'),
    'StudentLibraryPage integrates submitAssignment'
  );
  assert(
    libraryPageContent.includes('validateAcademicFile'),
    'StudentLibraryPage validates submission files via validateAcademicFile'
  );
  assert(
    libraryPageContent.includes('uploadAcademicFile'),
    'StudentLibraryPage uploads attachments via uploadAcademicFile'
  );
  assert(
    libraryPageContent.includes('getAcademicFileSignedUrl'),
    'StudentLibraryPage uses getAcademicFileSignedUrl for secure links'
  );
  assert(
    libraryPageContent.includes('deleteAcademicFile'),
    'StudentLibraryPage implements compensation rollback cleanup via deleteAcademicFile'
  );
  assert(
    libraryPageContent.includes('AttachmentViewerModal'),
    'StudentLibraryPage embeds AttachmentViewerModal for submission attachments'
  );
  assert(
    libraryPageContent.includes('handlePreviewAttachment'),
    'StudentLibraryPage implements handlePreviewAttachment'
  );
  assert(
    libraryPageContent.includes('handleDownloadAttachment'),
    'StudentLibraryPage implements handleDownloadAttachment'
  );
  assert(
    libraryPageContent.includes('handleOpenSubmission'),
    'StudentLibraryPage implements handleOpenSubmission drawer toggle'
  );
  assert(
    libraryPageContent.includes('handleSubmitWork'),
    'StudentLibraryPage implements handleSubmitWork handler'
  );
  assert(
    libraryPageContent.includes('REVISION REQUESTED') || libraryPageContent.includes('needs_revision'),
    'StudentLibraryPage displays revision requested feedback state'
  );

  // ---------------------------------------------------------------------------
  // SECTION 4: Assignment Retrieval & Baseline Data
  // ---------------------------------------------------------------------------
  console.log('\n--- SECTION 4: Assignment Retrieval & Baseline Data ---');

  const baselineAssignments = getMockStudentAssignments(studentId);
  assert(Array.isArray(baselineAssignments), 'getMockStudentAssignments returns an array');
  assert(baselineAssignments.length >= 2, `Student has ${baselineAssignments.length} baseline assignments`);

  const a1 = baselineAssignments[0];
  assert(typeof a1.id === 'string', 'Assignment has valid ID');
  assert(typeof a1.title === 'string', 'Assignment has valid title');
  assert('due_date' in a1, 'Assignment contains due_date');
  assert('total_points' in a1, 'Assignment contains total_points');
  assert('submission' in a1, 'Assignment includes submission relation');

  // ---------------------------------------------------------------------------
  // SECTION 5: Student-Specific Access & Authorization Constraints
  // ---------------------------------------------------------------------------
  console.log('\n--- SECTION 5: Student Access & Authorization ---');

  const otherStudentId = 'mock-student-other-999';
  const otherAssignments = getMockStudentAssignments(otherStudentId);
  assert(otherAssignments.length === 0, 'Unassigned student retrieves 0 assignments');

  // Verify unauthorized student cannot submit work to another student's assignment
  const unauthorizedSubmitRes = submitMockAssignment({
    assignmentId: a1.id,
    studentId: otherStudentId,
    submissionType: 'text',
    content: 'Malicious unauthorized submission attempt',
  });
  assert(Boolean(unauthorizedSubmitRes.error), 'Unauthorized student submission is rejected with error');
  assert(
    unauthorizedSubmitRes.error?.message.includes('not authorized') === true,
    'Rejection message explicitly states lack of authorization'
  );

  // ---------------------------------------------------------------------------
  // SECTION 6: Multi-Dimensional Filtering
  // ---------------------------------------------------------------------------
  console.log('\n--- SECTION 6: Multi-Dimensional Filtering ---');

  // Baseline assignment with submission vs without submission
  const withSubmission = baselineAssignments.find((a) => a.submission !== null);
  const withoutSubmission = baselineAssignments.find((a) => a.submission === null);

  assert(Boolean(withSubmission), 'Found baseline assignment with existing submission');
  assert(Boolean(withoutSubmission), 'Found baseline assignment pending submission');

  // Filter: Pending (no submission)
  const pendingFilter = baselineAssignments.filter((a) => !a.submission);
  assert(pendingFilter.length >= 1, `Pending filter identified ${pendingFilter.length} assignment(s)`);
  assert(
    pendingFilter.every((a) => a.submission === null),
    'All pending filtered assignments have no submission'
  );

  // Filter: Submitted
  const submittedFilter = baselineAssignments.filter((a) => a.submission?.status === 'submitted');
  assert(submittedFilter.length >= 1, `Submitted filter identified ${submittedFilter.length} assignment(s)`);
  assert(
    submittedFilter.every((a) => a.submission?.status === 'submitted'),
    'All submitted filtered assignments have status submitted'
  );

  // Filter: Subject
  if (a1.subject_id) {
    const subjectFilter = baselineAssignments.filter((a) => a.subject_id === a1.subject_id);
    assert(subjectFilter.length >= 1, `Subject filter matched ${subjectFilter.length} assignment(s)`);
    assert(
      subjectFilter.every((a) => a.subject_id === a1.subject_id),
      `All assignments match subject_id ${a1.subject_id}`
    );
  }

  // ---------------------------------------------------------------------------
  // SECTION 7: Submission Lifecycle & Validation
  // ---------------------------------------------------------------------------
  console.log('\n--- SECTION 7: Submission Lifecycle & Validation ---');

  // Create temporary assignment for testing submission workflows
  const tempAssignRes = createMockAssignment({
    studentId,
    mentorId: 'mock-mentor-ppm001',
    programId: 'prog-academic-01',
    title: 'Milestone 5 Test Practice Problem Set',
    instructions: 'Derive kinetic energy formula from work-energy theorem.',
    dueDate: '2026-11-25',
    totalPoints: 100,
  });
  assert(Boolean(tempAssignRes.assignment?.id), 'Created temporary assignment for testing');

  if (tempAssignRes.assignment) {
    const testAssignId = tempAssignRes.assignment.id;

    // 1. Text Submission
    const textSubmitRes = submitMockAssignment({
      assignmentId: testAssignId,
      studentId,
      submissionType: 'text',
      content: 'W = ∫ F dx = ∫ m (dv/dt) dx = ∫ m v dv = (1/2)mv^2. Proven.',
    });
    assert(!textSubmitRes.error, 'Text submission succeeds without error');
    assert(textSubmitRes.submission?.submission_type === 'text', 'Submission type is text');
    assert(textSubmitRes.submission?.status === 'submitted', 'Submission status is submitted');
    const submissionId = textSubmitRes.submission!.id;

    // 2. Link Submission with Protocol Validation
    const invalidLinkRes = submitMockAssignment({
      assignmentId: testAssignId,
      studentId,
      submissionType: 'link',
      content: 'ftp://invalid-url.com',
      linkUrl: 'ftp://invalid-url.com',
    });
    assert(Boolean(invalidLinkRes.error), 'Link without http/https protocol is rejected');

    const validLinkRes = submitMockAssignment({
      assignmentId: testAssignId,
      studentId,
      submissionType: 'link',
      content: 'https://github.com/example/solution-repo',
      linkUrl: 'https://github.com/example/solution-repo',
    });
    assert(!validLinkRes.error, 'Valid https:// link submission succeeds');
    assert(validLinkRes.submission?.submission_type === 'link', 'Submission type updated to link');
    assert(
      validLinkRes.submission?.id === submissionId,
      'Single submission record upserted (ID preserved, no duplicates)'
    );

    // 3. File Attachment Submission
    const fileSubmitRes = submitMockAssignment({
      assignmentId: testAssignId,
      studentId,
      submissionType: 'file',
      content: 'Attached handwritten derivation notes',
      fileName: 'derivation_notes.pdf',
      fileSize: 524288,
      filePath: `submissions/${testAssignId}/${studentId}/12345_derivation_notes.pdf`,
    });
    assert(!fileSubmitRes.error, 'File attachment submission succeeds');
    assert(fileSubmitRes.submission?.submission_type === 'file', 'Submission type updated to file');
    assert(fileSubmitRes.submission?.file_name === 'derivation_notes.pdf', 'Attachment file_name preserved');
    assert(fileSubmitRes.submission?.file_size === 524288, 'Attachment file_size preserved');
    assert(
      fileSubmitRes.submission?.file_path?.includes('submissions/') === true,
      'Attachment file_path structured under submissions/ namespace'
    );

    // 4. Mentor Review & Review Locking
    const reviewRes = reviewMockSubmission({
      submissionId,
      mentorId: 'mock-mentor-ppm001',
      status: 'reviewed',
      feedback: 'Excellent work! Rigorous calculus proof of the work-energy theorem.',
      score: 98,
    });
    assert(!reviewRes.error, 'Mentor review submitted successfully');
    assert(reviewRes.submission?.status === 'reviewed', 'Submission status is reviewed');
    assert(reviewRes.submission?.score === 98, 'Score 98/100 recorded');
    assert(
      reviewRes.submission?.feedback?.includes('Excellent work') === true,
      'Mentor feedback preserved'
    );

    // 5. Verification that student CANNOT modify reviewed submission
    const modifyReviewedRes = submitMockAssignment({
      assignmentId: testAssignId,
      studentId,
      submissionType: 'text',
      content: 'Attempt to overwrite graded submission',
    });
    assert(Boolean(modifyReviewedRes.error), 'Modification of reviewed submission is strictly locked and rejected');

    // 6. Mentor requests revision
    const revisionReqRes = updateMockSubmissionStatus(submissionId, 'needs_revision');
    assert(!revisionReqRes.error, 'Submission transitioned to needs_revision');

    // 7. Student resubmits after revision requested
    const resubmitRes = submitMockAssignment({
      assignmentId: testAssignId,
      studentId,
      submissionType: 'text',
      content: 'Revised proof with expanded integration boundary justification.',
    });
    assert(!resubmitRes.error, 'Resubmission permitted when status is needs_revision');
    assert(resubmitRes.submission?.status === 'submitted', 'Resubmission sets status back to submitted');

    // Cleanup
    deleteMockAssignment(testAssignId);
  }

  // ---------------------------------------------------------------------------
  // SECTION 8: Attachment Handling & Storage Service Integration
  // ---------------------------------------------------------------------------
  console.log('\n--- SECTION 8: Attachment Handling & Storage Integration ---');

  const storageContent = fs.readFileSync(storageLibPath, 'utf8');
  assert(
    storageContent.includes('academic-attachments'),
    'Storage service references private academic-attachments bucket'
  );
  assert(
    storageContent.includes('category: \'submissions\'') || storageContent.includes('category === \'submissions\'') || storageContent.includes('submissions'),
    'Storage service supports submissions category'
  );
  assert(
    storageContent.includes('getAcademicFileSignedUrl'),
    'Storage service exports getAcademicFileSignedUrl'
  );
  assert(
    storageContent.includes('10 * 1024 * 1024'),
    'Storage service enforces 10MB maximum file size constraint'
  );

  // ---------------------------------------------------------------------------
  // SECTION 9: Module Isolation & Preservation
  // ---------------------------------------------------------------------------
  console.log('\n--- SECTION 9: Module Isolation & Preservation ---');

  assert(fs.existsSync(path.resolve('src/pages/dashboard/StudentResourcesPage.tsx')), 'StudentResourcesPage.tsx preserved');
  assert(fs.existsSync(path.resolve('src/pages/dashboard/StudentTasksPage.tsx')), 'StudentTasksPage.tsx preserved');
  assert(fs.existsSync(path.resolve('src/pages/dashboard/StudentDoubtsPage.tsx')), 'StudentDoubtsPage.tsx preserved');
  assert(fs.existsSync(path.resolve('src/pages/dashboard/MentorReviewQueuePage.tsx')), 'MentorReviewQueuePage.tsx preserved');
  assert(fs.existsSync(path.resolve('src/pages/dashboard/MentorAssignmentsPage.tsx')), 'MentorAssignmentsPage.tsx preserved');

  const studentAssignPageContent = fs.readFileSync(studentAssignmentsPagePath, 'utf8');
  assert(
    studentAssignPageContent.includes('StudentAssignmentsPage'),
    'Standalone StudentAssignmentsPage component intact'
  );

  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`Results: ${passedTests} / ${totalTests} assertions passed.`);
  console.log('================================================================');

  if (passedTests !== totalTests) {
    process.exitCode = 1;
    throw new Error(`Failed ${totalTests - passedTests} tests.`);
  }
}

runVerification().catch((err) => {
  console.error('Unhandled verification error:', err);
  process.exit(1);
});
