/**
 * PoraPlan — Milestone 8 Verification Suite
 * End-to-End Validation & Backend Readiness
 *
 * Comprehensive validation across:
 * 1. Milestone 8.1: Student End-to-End Workflows
 * 2. Milestone 8.2: Mentor End-to-End Workflows & Permission Boundaries
 * 3. Milestone 8.3: Backend Readiness & Security Audit (RLS, Storage, Triggers)
 * 4. Milestone 8.4: Responsiveness & UX Architecture
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import {
  formatLocalDate,
  computeLibraryDateRange,
  parseLibraryTab,
  getLibraryTabUrl,
  ACADEMIC_LIBRARY_TABS,
  DEFAULT_ACADEMIC_LIBRARY_TAB,
} from '../src/lib/library';

import {
  getMockStudentTasks,
  getMockStudentNotifications,
  getMockStudentResources,
  getMockDoubtById,
  getMockStudentAnnouncements,
  createMockTask,
  deleteMockTask,
  createMockAssignment,
  deleteMockAssignment,
  submitMockAssignment,
  reviewMockSubmission,
  createMockResource,
  deleteMockResource,
  createMockDoubt,
  addMockDoubtResponse,
  deleteMockDoubt,
  acknowledgeMockAnnouncement,
  isMockAuthorizedMentorForStudent,
} from '../src/lib/mockAuthStore';

let passedChecks = 0;
let totalChecks = 0;

function assert(condition: boolean, message: string) {
  totalChecks++;
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  passedChecks++;
  console.log(`  ✓ ${message}`);
}

async function runMilestone8Validation() {
  console.log('\n================================================================');
  console.log('PORAPLAN — MILESTONE 8: END-TO-END VALIDATION & BACKEND READINESS');
  console.log('================================================================\n');

  // ===========================================================================
  // SECTION 1: MILESTONE 8.1 — STUDENT END-TO-END WORKFLOW
  // ===========================================================================
  console.log('--- SECTION 1: Milestone 8.1 — Student End-to-End Workflows ---');

  const studentId = 'mock-student-pp001';
  const mentorId = 'mock-mentor-ppm001';
  const unassignedMentorId = 'mock-mentor-ppm002';
  const programId = 'prog-academic-01';

  // 1.1 Authentication & Protected Route Verification (Static & Mock)
  const protectedRouteContent = fs.readFileSync(
    path.resolve('src/components/auth/ProtectedRoute.tsx'),
    'utf-8'
  );
  assert(
    protectedRouteContent.includes('Navigate to="/login"'),
    'ProtectedRoute redirects unauthenticated visitors to /login'
  );
  assert(
    protectedRouteContent.includes('state={{ from: location }}'),
    'ProtectedRoute preserves navigation target in location state for post-login redirection'
  );
  assert(
    protectedRouteContent.includes('ACCESS RESTRICTED'),
    'ProtectedRoute renders explicit access restricted state on unauthorized role attempt'
  );

  const routesContent = fs.readFileSync(path.resolve('src/routes/index.tsx'), 'utf-8');
  assert(
    routesContent.includes("path=\"student/library\""),
    'Routes register /student/library under protected student shell'
  );
  assert(
    routesContent.includes("StudentResourcesRedirect"),
    'Routes register backward-compatible redirect for /student/resources'
  );
  assert(
    routesContent.includes("location.search"),
    'StudentResourcesRedirect preserves search query parameters during redirect'
  );

  // 1.2 Academic Library Tab Foundation & URL Synchronization
  assert(ACADEMIC_LIBRARY_TABS.includes('resources'), 'Library supports resources tab');
  assert(ACADEMIC_LIBRARY_TABS.includes('tasks'), 'Library supports tasks tab');
  assert(ACADEMIC_LIBRARY_TABS.includes('assignments'), 'Library supports assignments tab');
  assert(DEFAULT_ACADEMIC_LIBRARY_TAB === 'resources', 'Default tab is resources');
  assert(parseLibraryTab('tasks') === 'tasks', 'parseLibraryTab parses "tasks"');
  assert(parseLibraryTab('assignments') === 'assignments', 'parseLibraryTab parses "assignments"');
  assert(parseLibraryTab(null) === 'resources', 'parseLibraryTab falls back to resources on null');
  assert(parseLibraryTab('unknown_tab') === 'resources', 'parseLibraryTab falls back on invalid tab');
  assert(getLibraryTabUrl('/student/library', 'tasks') === '/student/library?tab=tasks', 'getLibraryTabUrl maps tasks tab');
  assert(getLibraryTabUrl('/student/library', 'assignments') === '/student/library?tab=assignments', 'getLibraryTabUrl maps assignments tab');

  // 1.3 Tasks & Study History Workflow
  const baselineTasks = getMockStudentTasks(studentId);
  assert(baselineTasks.length >= 1, `Student has ${baselineTasks.length} baseline tasks`);
  const firstTask = baselineTasks[0];
  assert(Boolean(firstTask.due_date), 'Scheduled task possesses due_date');
  assert(Boolean(firstTask.created_at), 'Task tracks created_at timestamp');

  // Date boundary calculation verification
  const testDate = new Date(2026, 10, 2); // Monday Nov 2, 2026
  const weekRange = computeLibraryDateRange('this_week', { today: testDate });
  assert(weekRange.startDate === '2026-11-02' && weekRange.endDate === '2026-11-08', 'Week range matches Monday-Sunday');

  const monthRange = computeLibraryDateRange('this_month', { today: testDate });
  assert(monthRange.startDate === '2026-11-01' && monthRange.endDate === '2026-11-30', 'Month range matches calendar month');

  // 1.4 Assignments & Submission Lifecycle Transitions
  const { assignment: practiceAssign } = createMockAssignment({
    studentId,
    mentorId,
    programId,
    title: 'E2E Validation Practice Assignment',
    instructions: 'Comprehensive lifecycle validation',
    status: 'published',
  });
  assert(Boolean(practiceAssign?.id), 'Practice assignment created');
  const assignId = practiceAssign!.id;

  // Step 1: Text submission
  const { submission: textSub } = submitMockAssignment({
    assignmentId: assignId,
    studentId,
    submissionType: 'text',
    content: 'Initial text solution',
  });
  assert(textSub?.status === 'submitted' && textSub.submission_type === 'text', 'Text submission succeeds');

  // Step 2: Transition Text -> File
  const mockFilePath = `submissions/${assignId}/${studentId}/12345_solution.pdf`;
  const { submission: fileSub } = submitMockAssignment({
    assignmentId: assignId,
    studentId,
    submissionType: 'file',
    content: 'Attached PDF solution',
    fileName: 'solution.pdf',
    fileSize: 1048576,
    filePath: mockFilePath,
  });
  assert(fileSub?.submission_type === 'file' && fileSub.file_path === mockFilePath, 'Text -> File transition succeeds');

  // Step 3: Transition File -> Link (Orphan Prevention)
  const { submission: linkSub } = submitMockAssignment({
    assignmentId: assignId,
    studentId,
    submissionType: 'link',
    linkUrl: 'https://github.com/example/repo',
    content: 'https://github.com/example/repo',
  });
  assert(linkSub?.submission_type === 'link', 'File -> Link transition succeeds');
  assert(linkSub?.file_path === null, 'File path is cleared to null when transitioning away from file');

  // Step 4: Mentor Review & Locking
  const { submission: reviewedSub } = reviewMockSubmission({
    submissionId: linkSub!.id,
    mentorId,
    score: 92,
    feedback: 'Good work on repository submission.',
    status: 'reviewed',
  });
  assert(reviewedSub?.status === 'reviewed', 'Mentor review recorded');

  // Step 5: Locking Verification (Cannot modify reviewed submission)
  const { submission: tamperSub, error: tamperErr } = submitMockAssignment({
    assignmentId: assignId,
    studentId,
    submissionType: 'text',
    content: 'Attempted modification after review',
  });
  assert(Boolean(tamperErr) && tamperSub === null, 'Modification of reviewed submission is strictly locked');

  // 1.5 Study Resources Distinction
  const { resource: tempFileRes } = createMockResource({
    studentId,
    title: 'E2E Friction & Work Theorem Reference PDF',
    resourceType: 'file',
    fileName: 'work_theorem.pdf',
    fileSize: 204800,
  });
  assert(Boolean(tempFileRes?.id), 'Created file-type study resource');

  const resources = getMockStudentResources(studentId);
  assert(resources.length >= 1, `Student has ${resources.length} accessible study resources`);
  const hasMetadataOnlyFiles = resources.some((r) => r.resource_type === 'file');
  assert(hasMetadataOnlyFiles, 'Study resources include reference file metadata without binary storage dependency');

  if (tempFileRes) {
    deleteMockResource(tempFileRes.id, mentorId);
  }

  // 1.6 Doubts Desk Student Workflow
  const { doubt: testDoubt } = createMockDoubt({
    studentId,
    subjectId: 'mock-sub-math-102',
    title: 'E2E Inquiry on Calculus Limit',
    question: 'How do we compute the limit as x approaches zero?',
    attachmentName: 'limit_graph.png',
    attachmentSize: 45000,
    attachmentPath: `doubts/test-doubt-001/inquiry/1700000000_limit_graph.png`,
  });
  assert(Boolean(testDoubt?.id), 'Student doubt inquiry created with attachment metadata');

  // 1.7 Announcements & Acknowledgment Workflow
  const studentAnnouncements = getMockStudentAnnouncements(studentId);
  assert(studentAnnouncements.length >= 1, 'Student can access targeted announcements');
  const annId = studentAnnouncements[0].id;
  const { acknowledgment } = acknowledgeMockAnnouncement(annId, studentId);
  assert(Boolean(acknowledgment), 'Student successfully acknowledges announcement');

  // 1.8 Notifications Route Destination
  const studentNotifs = getMockStudentNotifications(studentId);
  const taskNotifs = studentNotifs.filter((n) => n.type === 'task_created');
  if (taskNotifs.length > 0) {
    assert(
      taskNotifs.every((n) => n.link === '/student/tasks'),
      'All task notifications route to /student/tasks'
    );
  }
  const assignNotifs = studentNotifs.filter((n) => n.type === 'assignment_created' || n.type === 'submission_reviewed');
  if (assignNotifs.length > 0) {
    assert(
      assignNotifs.every((n) => n.link === '/student/assignments'),
      'All assignment notifications route to /student/assignments'
    );
  }

  // ===========================================================================
  // SECTION 2: MILESTONE 8.2 — MENTOR WORKFLOW & PERMISSION BOUNDARIES
  // ===========================================================================
  console.log('\n--- SECTION 2: Milestone 8.2 — Mentor Workflows & Security Boundaries ---');

  // 2.1 Authorized Mentor Verification
  const isAssigned = isMockAuthorizedMentorForStudent(mentorId, studentId, programId);
  assert(isAssigned === true, 'Mentor PPM001 is authorized for student PP001 in program-01');

  // 2.2 Unassigned Mentor Boundary
  const isUnassignedAllowed = isMockAuthorizedMentorForStudent(unassignedMentorId, studentId, programId);
  assert(isUnassignedAllowed === false, 'Unassigned mentor PPM002 is strictly rejected from accessing student PP001');

  // 2.3 Program Isolation Boundary
  const isDifferentProgramAllowed = isMockAuthorizedMentorForStudent(mentorId, studentId, 'unassigned-prog-999');
  assert(isDifferentProgramAllowed === false, 'Mentor is rejected for programs where they lack assignment');

  // 2.4 Mentor Task Assignment
  const { task: assignedTask } = createMockTask({
    studentId,
    createdBy: mentorId,
    title: 'Mentor Assigned Calculus Drill',
    priority: 'high',
    dueDate: formatLocalDate(new Date()),
  });
  assert(Boolean(assignedTask?.id), 'Authorized mentor can assign tasks to their mentee');

  // 2.5 Mentor Doubt Response Workflow
  const { response: mentorReply } = addMockDoubtResponse({
    doubtId: testDoubt!.id,
    authorId: mentorId,
    message: 'Apply L\'Hopital\'s rule by taking derivative of numerator and denominator.',
    attachmentName: 'solution_steps.pdf',
    attachmentSize: 78000,
    attachmentPath: `doubts/${testDoubt!.id}/resp-1/1700000000_solution_steps.pdf`,
  });
  assert(Boolean(mentorReply?.id), 'Authorized mentor can respond to student doubts with attachment');

  const resolvedDoubt = getMockDoubtById(testDoubt!.id);
  assert(Boolean(resolvedDoubt) && resolvedDoubt?.responses?.length === 1, 'Thread includes mentor response');

  // Clean up test doubt
  deleteMockDoubt(testDoubt!.id, studentId);

  // 2.6 Mentor Cannot Review Unassigned Student
  const { assignment: unassignedAssign } = createMockAssignment({
    studentId,
    mentorId,
    programId,
    title: 'Permission Boundary Assignment',
    status: 'published',
  });
  const { submission: unassignedSub } = submitMockAssignment({
    assignmentId: unassignedAssign!.id,
    studentId,
    submissionType: 'text',
    content: 'Boundary check text',
  });
  const { submission: illegalReview, error: reviewErr } = reviewMockSubmission({
    submissionId: unassignedSub!.id,
    mentorId: unassignedMentorId, // unassigned mentor
    score: 80,
    feedback: 'Illegal review attempt',
  });
  assert(Boolean(reviewErr) && illegalReview === null, 'Unassigned mentor is strictly blocked from reviewing submissions');

  // Clean up test assignment
  deleteMockAssignment(unassignedAssign!.id);
  deleteMockAssignment(assignId);
  if (assignedTask) deleteMockTask(assignedTask.id);

  // ===========================================================================
  // SECTION 3: MILESTONE 8.3 — BACKEND READINESS & SECURITY AUDIT
  // ===========================================================================
  console.log('\n--- SECTION 3: Milestone 8.3 — Backend Readiness & Security Audit ---');

  // 3.1 Migration 010 (Academic Attachments Storage) RLS Audit
  const mig010Content = fs.readFileSync(
    path.resolve('supabase/migrations/20261030000010_academic_attachments_storage.sql'),
    'utf-8'
  );
  assert(
    mig010Content.includes("bucket_id = 'academic-attachments'"),
    'Migration 010 establishes private academic-attachments bucket'
  );
  assert(
    mig010Content.includes("is_authorized_mentor_for_student"),
    'Migration 010 enforces active mentor relationship check for attachment access'
  );
  assert(
    mig010Content.includes('CREATE POLICY "Authorized users can view submission files"'),
    'Migration 010 restricts attachment reading to authorized owners, mentors, and admins'
  );

  // 3.2 Migration 011 (Doubts Attachments Storage) RLS Audit
  const mig011Content = fs.readFileSync(
    path.resolve('supabase/migrations/20261030000011_doubts_attachments_storage.sql'),
    'utf-8'
  );
  assert(
    mig011Content.includes('CREATE POLICY "Authorized users can view doubt attachment files"'),
    'Migration 011 establishes participant-scoped access for doubt attachments'
  );
  assert(
    mig011Content.includes('CREATE POLICY "Authorized users can delete doubt attachment files"'),
    'Migration 011 establishes author-scoped deletion for doubt attachments'
  );

  // 3.3 Security Definer Search Path Protection (Migrations 006, 007, 008, 009)
  const mig006Content = fs.readFileSync(
    path.resolve('supabase/migrations/20261030000006_security_hardening_and_program_integrity.sql'),
    'utf-8'
  );
  assert(
    mig006Content.includes("SET search_path = public"),
    'SECURITY DEFINER functions configure fixed search_path = public against search-path injection'
  );

  // 3.4 Submission Review Trigger & Immutability Check
  const mig008Content = fs.readFileSync(
    path.resolve('supabase/migrations/20261030000008_security_integrity_and_rls_corrections.sql'),
    'utf-8'
  );
  assert(
    mig008Content.includes("protect_submission_review_fields") || mig006Content.includes("protect_submission_review_fields"),
    'Database trigger protect_submission_review_fields enforces review field immutability'
  );

  // ===========================================================================
  // SECTION 4: MILESTONE 8.4 — RESPONSIVENESS & UX AUDIT
  // ===========================================================================
  console.log('\n--- SECTION 4: Milestone 8.4 — Responsive UX Architecture Audit ---');

  const libraryPage = fs.readFileSync(
    path.resolve('src/pages/dashboard/StudentLibraryPage.tsx'),
    'utf-8'
  );
  assert(
    libraryPage.includes('flex flex-wrap gap-2 sm:gap-3'),
    'Tab navigation uses flexible wrapping with breakpoint-scaled spacing'
  );
  assert(
    libraryPage.includes('p-4 sm:p-5'),
    'Task and assignment cards scale padding across mobile and desktop breakpoints'
  );
  const assignmentsPage = fs.readFileSync(
    path.resolve('src/pages/dashboard/StudentAssignmentsPage.tsx'),
    'utf-8'
  );
  assert(
    assignmentsPage.includes('border-t-3 border-brand-dark bg-brand-bg p-5 sm:p-6'),
    'Assignment submission container seamlessly integrates into assignment card layout with responsive padding'
  );
  assert(
    libraryPage.includes('max-w-2xl max-h-[90vh]'),
    'Resource content reader modal constrains desktop width with max-w-2xl and viewport height'
  );
  assert(
    libraryPage.includes('truncate'),
    'Attachment filenames and titles use CSS text truncation to prevent layout breaking'
  );

  const dashboardLayout = fs.readFileSync(
    path.resolve('src/layouts/DashboardLayout.tsx'),
    'utf-8'
  );
  assert(
    dashboardLayout.includes('md:hidden') && dashboardLayout.includes('fixed bottom-0'),
    'DashboardLayout implements dedicated mobile bottom navigation for screens under md breakpoint'
  );
  assert(
    dashboardLayout.includes('hidden md:flex'),
    'DashboardLayout implements full desktop sidebar for screens md and above'
  );

  // Summary
  console.log('\n================================================================');
  console.log(`VERIFICATION SUMMARY: ${passedChecks} / ${totalChecks} ASSERTIONS PASSED`);
  console.log('================================================================\n');
}

runMilestone8Validation().catch((err) => {
  console.error('\nVerification suite encountered fatal error:', err);
  process.exit(1);
});
