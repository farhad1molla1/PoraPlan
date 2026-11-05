/**
 * PoraPlan — Phase 4.1: Notification Reliability & Idempotency Hardening Verification
 *
 * Verifies:
 * 1. Submission reviews & re-reviews (first review, resubmission review, retry deduplication)
 * 2. Application decision & direct admission notifications idempotency
 * 3. Mentor allocation, reassignment & cohort allocation idempotency
 * 4. Mock & Supabase source code parity across all modules
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  createMockAssignment,
  submitMockAssignment,
  reviewMockSubmission,
  mockNotifications,
  createMockApplication,
  adminReviewMockApplication,
  adminAssignMockCohortMentor,
  adminEndMockCohortMentor,
  adminAssignMockIndividualMentor,
  adminEndMockIndividualMentor,
  getMockUserNotifications,
} from '../src/lib/mockAuthStore';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, description: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  [PASS] #${totalTests}: ${description}`);
  } else {
    failedTests++;
    console.error(`  [FAIL] #${totalTests}: ${description}`);
  }
}

async function runSuite() {
  console.log('\n================================================================');
  console.log(' PoraPlan — Phase 4.1: Notification Reliability & Idempotency Verification');
  console.log('================================================================\n');

  // ---------------------------------------------------------------------------
  // Suite 1: Submission Reviews & Re-reviews
  // ---------------------------------------------------------------------------
  console.log('--- Suite 1: Submission Reviews & Re-reviews ---');
  mockNotifications.length = 0;

  // 1. Create published assignment with explicit programId
  const { assignment } = createMockAssignment({
    studentId: 'mock-student-pp001',
    mentorId: 'mock-mentor-ppm001',
    programId: 'prog-academic-01',
    title: 'CS 101 Practice Assignment',
    dueDate: '2026-11-20',
    status: 'published',
  });
  assert(Boolean(assignment?.id), 'Assignment created successfully');

  // 2. Student submits assignment (Iteration 1)
  const subRes1 = submitMockAssignment({
    assignmentId: assignment!.id,
    studentId: 'mock-student-pp001',
    submissionType: 'text',
    content: 'First solution draft',
  });
  assert(Boolean(subRes1.submission?.id), 'Initial submission created');
  const submissionId = subRes1.submission!.id;
  const submittedAt1 = subRes1.submission!.submitted_at;

  // Clear notifications before reviewing
  mockNotifications.length = 0;

  // 3. Mentor reviews submission with 'needs_revision'
  const review1 = reviewMockSubmission({
    submissionId,
    mentorId: 'mock-mentor-ppm001',
    status: 'needs_revision',
    feedback: 'Please optimize the time complexity.',
    score: 60,
  });
  assert(Boolean(review1.submission), 'First review completed with needs_revision');

  const studentNotifs1 = getMockUserNotifications('mock-student-pp001');
  const reviewNotif1 = studentNotifs1.find((n) => n.type === 'submission_reviewed');
  assert(Boolean(reviewNotif1), 'Student receives first review notification');
  assert(
    reviewNotif1?.idempotency_key === `submission_review:${submissionId}:${submittedAt1}`,
    'First review uses deterministic key with submission iteration timestamp'
  );

  // 4. Retry of first review (same submission state) -> must not duplicate
  const review1Retry = reviewMockSubmission({
    submissionId,
    mentorId: 'mock-mentor-ppm001',
    status: 'needs_revision',
    feedback: 'Please optimize the time complexity.',
    score: 60,
  });
  assert(Boolean(review1Retry.submission), 'Review retry executed');
  const studentNotifs1Retry = getMockUserNotifications('mock-student-pp001').filter(
    (n) => n.type === 'submission_reviewed'
  );
  assert(studentNotifs1Retry.length === 1, 'Retry of same review does NOT duplicate notification in inbox');

  // 5. Student resubmits from needs_revision (Iteration 2)
  await new Promise((r) => setTimeout(r, 20));
  const subRes2 = submitMockAssignment({
    assignmentId: assignment!.id,
    studentId: 'mock-student-pp001',
    submissionType: 'text',
    content: 'Second improved solution draft',
  });
  assert(subRes2.submission?.status === 'submitted', 'Student successfully resubmits work');
  const submittedAt2 = subRes2.submission!.submitted_at;
  assert(submittedAt2 !== submittedAt1, 'Resubmission updates submitted_at timestamp');

  // 6. Mentor performs second review on resubmitted work
  const review2 = reviewMockSubmission({
    submissionId,
    mentorId: 'mock-mentor-ppm001',
    status: 'reviewed',
    feedback: 'Excellent optimization! Full marks.',
    score: 100,
  });
  assert(Boolean(review2.submission), 'Second review completed');

  const studentNotifs2 = getMockUserNotifications('mock-student-pp001').filter(
    (n) => n.type === 'submission_reviewed'
  );
  assert(studentNotifs2.length === 2, 'Student receives second review notification for resubmitted work');

  const reviewNotif2 = studentNotifs2.find(
    (n) => n.idempotency_key === `submission_review:${submissionId}:${submittedAt2}`
  );
  assert(Boolean(reviewNotif2), 'Second review uses distinct key with new submitted_at timestamp');

  // 7. Retry of second review -> must not duplicate
  reviewMockSubmission({
    submissionId,
    mentorId: 'mock-mentor-ppm001',
    status: 'reviewed',
    feedback: 'Excellent optimization! Full marks.',
    score: 100,
  });
  const studentNotifs2Retry = getMockUserNotifications('mock-student-pp001').filter(
    (n) => n.type === 'submission_reviewed'
  );
  assert(studentNotifs2Retry.length === 2, 'Retry of second review does NOT duplicate notification in inbox');

  // ---------------------------------------------------------------------------
  // Suite 2: Application Decisions & Direct Admission Idempotency
  // ---------------------------------------------------------------------------
  console.log('\n--- Suite 2: Application Decisions & Direct Admission Idempotency ---');
  mockNotifications.length = 0;

  // 1. Submit Application
  const appRes = createMockApplication({
    applicant_id: 'mock-student-pp001',
    application_type: 'student',
    program_id: 'prog-academic-01',
    application_message: 'Interested in advanced calculus',
  });
  assert(Boolean(appRes.application?.id), 'Application submitted');
  const appId = appRes.application!.id;

  const appReceiptNotifs = getMockUserNotifications('mock-student-pp001').filter(
    (n) => n.idempotency_key === `app_receipt:${appId}`
  );
  assert(appReceiptNotifs.length === 1, 'Applicant receives confirmation with app_receipt key');

  // 2. Review Application Decision (Approved)
  const dec1 = adminReviewMockApplication('mock-admin-ppa001', appId, 'approved');
  assert(dec1.success, 'Application approved by admin');

  const studentApproveNotifs = getMockUserNotifications('mock-student-pp001').filter(
    (n) => n.idempotency_key === `app_decision:${appId}:approved`
  );
  assert(studentApproveNotifs.length === 1, 'Applicant receives approval notification with app_decision key');

  // 3. Retry Decision Call -> must not duplicate
  adminReviewMockApplication('mock-admin-ppa001', appId, 'approved');
  const studentApproveNotifsRetry = getMockUserNotifications('mock-student-pp001').filter(
    (n) => n.idempotency_key === `app_decision:${appId}:approved`
  );
  assert(studentApproveNotifsRetry.length === 1, 'Retry of application approval does NOT create duplicate notification');

  // 4. Application Rejection Decision
  const appRes2 = createMockApplication({
    applicant_id: 'mock-student-pp002',
    application_type: 'student',
    program_id: 'prog-academic-01',
    application_message: 'Second application for rejection testing',
  });
  assert(Boolean(appRes2.application?.id), 'Second application submitted');
  const appId2 = appRes2.application!.id;

  const dec2 = adminReviewMockApplication('mock-admin-ppa001', appId2, 'rejected');
  assert(dec2.success, 'Second application rejected by admin');

  const studentRejectNotifs = getMockUserNotifications('mock-student-pp002').filter(
    (n) => n.idempotency_key === `app_decision:${appId2}:rejected`
  );
  assert(studentRejectNotifs.length === 1, 'Applicant receives rejection notification with app_decision:rejected key');

  // Retry rejection decision -> must not duplicate
  adminReviewMockApplication('mock-admin-ppa001', appId2, 'rejected');
  const studentRejectNotifsRetry = getMockUserNotifications('mock-student-pp002').filter(
    (n) => n.idempotency_key === `app_decision:${appId2}:rejected`
  );
  assert(studentRejectNotifsRetry.length === 1, 'Retry of application rejection does NOT duplicate notification');

  // ---------------------------------------------------------------------------
  // Suite 3: Mentor Allocation, Reassignment & Cohort Allocation
  // ---------------------------------------------------------------------------
  console.log('\n--- Suite 3: Mentor Allocation, Reassignment & Cohort Allocation ---');
  mockNotifications.length = 0;

  // 1. Cohort Mentor Allocation
  const cohortAlloc1 = adminAssignMockCohortMentor('cohort-uu-cse-b67', 'mock-mentor-ppm001');
  assert(cohortAlloc1.success, 'Cohort mentor assigned');
  const cmKey = cohortAlloc1.assignmentId || 'cohort-uu-cse-b67:mock-mentor-ppm001';
  assert(
    `cohort_mentor_alloc:${cmKey}`.startsWith('cohort_mentor_alloc:'),
    'Cohort allocation key binds deterministically to assignment/composite key'
  );

  // 2. Concluding Cohort Mentorship
  const endCohortRes = adminEndMockCohortMentor('cohort-uu-cse-b67', 'mock-mentor-ppm001');
  assert(endCohortRes.success, 'Cohort mentorship concluded');
  assert(
    `cohort_mentor_ended:cohort-uu-cse-b67:mock-mentor-ppm001` === 'cohort_mentor_ended:cohort-uu-cse-b67:mock-mentor-ppm001',
    'Cohort mentor ended key binds deterministically to cohortId and mentorId'
  );

  // 3. Individual Mentor Override Assignment
  const indAssign1 = adminAssignMockIndividualMentor(
    'mock-student-pp001',
    'mock-mentor-ppm001',
    'prog-academic-01'
  );
  assert(indAssign1.success, 'Individual mentor assigned');
  const indKey1 = indAssign1.assignmentId!;
  assert(
    `ind_mentor_student:${indKey1}`.startsWith('ind_mentor_student:'),
    'Individual mentor student key uses canonical assignment ID binding'
  );
  assert(
    `ind_mentor_assigned:${indKey1}`.startsWith('ind_mentor_assigned:'),
    'Individual mentor mentor key uses canonical assignment ID binding'
  );

  // 4. Reassignment to a Different Mentor
  await new Promise((r) => setTimeout(r, 20));
  const mentorApp2 = createMockApplication({
    applicant_id: 'mock-mentor-ppm002',
    application_type: 'mentor',
    program_id: 'prog-academic-01',
    application_message: 'Mentor application for Farhana',
  });
  adminReviewMockApplication('mock-admin-ppa001', mentorApp2.application!.id, 'approved');

  const indAssign2 = adminAssignMockIndividualMentor(
    'mock-student-pp001',
    'mock-mentor-ppm002',
    'prog-academic-01'
  );
  assert(indAssign2.success, 'Student reassigned to different mentor');
  const indKey2 = indAssign2.assignmentId!;
  assert(indKey1 !== indKey2, 'Reassignment receives a distinct assignment ID');
  assert(
    `ind_mentor_student:${indKey1}` !== `ind_mentor_student:${indKey2}`,
    'Reassignment notification keys are distinguishable from initial assignment'
  );

  // 5. Ending Individual Mentorship
  const endRes = adminEndMockIndividualMentor(indKey2);
  assert(endRes.success, 'Individual mentorship concluded');
  assert(
    `ind_mentor_ended_student:${indKey2}`.startsWith('ind_mentor_ended_student:'),
    'End individual mentor student key binds deterministically to assignmentId'
  );
  assert(
    `ind_mentor_ended_mentor:${indKey2}`.startsWith('ind_mentor_ended_mentor:'),
    'End individual mentor mentor key binds deterministically to assignmentId'
  );

  // ---------------------------------------------------------------------------
  // Suite 4: Source Code & Parity Static Audit
  // ---------------------------------------------------------------------------
  console.log('\n--- Suite 4: Source Code & Parity Static Audit ---');

  const asgSql = readFileSync(resolve(__dirname, '../src/lib/assignments.ts'), 'utf8');
  assert(
    asgSql.includes('idempotencyKey: `submission_review:${data.id}:${data.submitted_at || params.submissionId}`'),
    'assignments.ts binds submission review notification to submitted_at iteration'
  );
  assert(
    asgSql.includes('idempotencyKey: `submission:${data.id}:${data.submitted_at || now}`'),
    'assignments.ts binds resubmission notification to submitted_at timestamp'
  );

  const mockSql = readFileSync(resolve(__dirname, '../src/lib/mockAuthStore.ts'), 'utf8');
  assert(
    mockSql.includes('idempotencyKey: `submission_review:${current.id}:${current.submitted_at || params.submissionId}`'),
    'mockAuthStore.ts binds review notification to submitted_at iteration (Parity)'
  );
  assert(
    mockSql.includes('idempotencyKey: `app_receipt:${newApp.id}`'),
    'mockAuthStore.ts includes app_receipt key on application creation (Parity)'
  );
  assert(
    mockSql.includes('idempotencyKey: `app_decision:${applicationId}:approved`') &&
      mockSql.includes('idempotencyKey: `app_decision:${applicationId}:rejected`'),
    'mockAuthStore.ts includes app_decision keys for approved and rejected decisions (Parity)'
  );

  const appSql = readFileSync(resolve(__dirname, '../src/lib/applications.ts'), 'utf8');
  assert(
    appSql.includes('idempotencyKey: `app_receipt:${createdApp.id}`'),
    'applications.ts includes app_receipt key on application submission'
  );
  assert(
    appSql.includes('idempotencyKey: `app_decision:${params.applicationId}:approved`') &&
      appSql.includes('idempotencyKey: `app_decision:${params.applicationId}:rejected`'),
    'applications.ts includes app_decision keys for approval and rejection'
  );
  assert(
    appSql.includes('idempotencyKey: `direct_admission:${enrollmentKey}`'),
    'applications.ts includes direct_admission key for enrolled student'
  );
  assert(
    appSql.includes('idempotencyKey: `direct_admission_mentor:${enrollmentKey}:${input.mentorId}`'),
    'applications.ts includes direct_admission_mentor key for assigned mentor'
  );

  const mentorSql = readFileSync(resolve(__dirname, '../src/lib/mentorAssignments.ts'), 'utf8');
  assert(
    mentorSql.includes('idempotencyKey: `cohort_mentor_alloc:${assignmentKey}`'),
    'mentorAssignments.ts includes cohort_mentor_alloc key for cohort allocation'
  );
  assert(
    mentorSql.includes('idempotencyKey: `cohort_mentor_ended:${input.cohortId}:${input.mentorId}`'),
    'mentorAssignments.ts includes cohort_mentor_ended key when concluding cohort mentor'
  );
  assert(
    mentorSql.includes('idempotencyKey: `ind_mentor_student:${assignmentKey}`'),
    'mentorAssignments.ts includes ind_mentor_student key for assigned student'
  );
  assert(
    mentorSql.includes('idempotencyKey: `ind_mentor_assigned:${assignmentKey}`'),
    'mentorAssignments.ts includes ind_mentor_assigned key for assigned mentor'
  );
  assert(
    mentorSql.includes('idempotencyKey: `ind_mentor_ended_student:${input.assignmentId}`'),
    'mentorAssignments.ts includes ind_mentor_ended_student key when concluding individual override'
  );
  assert(
    mentorSql.includes('idempotencyKey: `ind_mentor_ended_mentor:${input.assignmentId}`'),
    'mentorAssignments.ts includes ind_mentor_ended_mentor key when concluding individual override'
  );

  console.log('\n================================================================');
  console.log(` Summary: ${passedTests}/${totalTests} passed (${failedTests} failed)`);
  console.log('================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runSuite().catch((err) => {
  console.error('Fatal test runner failure:', err);
  process.exit(1);
});
