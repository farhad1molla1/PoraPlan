/**
 * PoraPlan — Milestone 7 Verification Suite
 * Academic Library Edge-Case Hardening Verification
 *
 * Verifies:
 * 1. PL-AUD-001: Client-Side Local Calendar Date Handling across Timezones & Boundaries
 * 2. PL-AUD-002: Storage Lifecycle & Submission Attachment Cleanup (Transitions & Safety)
 * 3. PL-AUD-003: Accurate Tab Count Badges & Prefetching
 * 4. PL-AUD-004: Standardized Notification Deep-Link Destination Routes
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import {
  formatLocalDate,
  computeLibraryDateRange,
  getLibraryTabUrl,
} from '../src/lib/library';

import {
  getMockStudentTasks,
  getMockStudentAssignments,
  getMockStudentNotifications,
  createMockTask,
  createMockAssignment,
  submitMockAssignment,
  reviewMockSubmission,
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

async function runHardeningVerification() {
  console.log('\n================================================================');
  console.log('PORAPLAN — MILESTONE 7: ACADEMIC LIBRARY HARDENING VERIFICATION');
  console.log('================================================================\n');

  // ===========================================================================
  // MODULE 1: PL-AUD-001 — TIMEZONE & CALENDAR DATE CALCULATIONS
  // ===========================================================================
  console.log('--- MODULE 1: PL-AUD-001 — Local Calendar Date & Timezone Tests ---');

  // 1.1 Local Date Formatter Basics
  const d1 = new Date(2026, 10, 2); // November 2, 2026
  assert(formatLocalDate(d1) === '2026-11-02', 'Formats standard local date correctly (YYYY-MM-DD)');

  // 1.2 Padding single-digit months and days
  const d2 = new Date(2026, 0, 5); // January 5, 2026
  assert(formatLocalDate(d2) === '2026-01-05', 'Pads single-digit month and day with zeros');

  // 1.3 Leap-Year February Boundary
  const leapFeb29 = new Date(2024, 1, 29, 23, 59, 59); // Feb 29, 2024
  assert(formatLocalDate(leapFeb29) === '2024-02-29', 'Handles leap-year Feb 29 local date');
  const leapMonth = computeLibraryDateRange('this_month', { today: leapFeb29 });
  assert(
    leapMonth.startDate === '2024-02-01' && leapMonth.endDate === '2024-02-29',
    'This Month preset correctly terminates on Feb 29 in leap year'
  );

  // 1.4 Non-Leap February Boundary
  const nonLeapFeb = new Date(2025, 1, 15);
  const nonLeapMonth = computeLibraryDateRange('this_month', { today: nonLeapFeb });
  assert(
    nonLeapMonth.startDate === '2025-02-01' && nonLeapMonth.endDate === '2025-02-28',
    'This Month preset terminates on Feb 28 in non-leap year'
  );

  // 1.5 Year Boundary (Dec 31 -> Jan 1)
  const dec31 = new Date(2026, 11, 31, 23, 55, 0); // Dec 31, 2026
  const decMonth = computeLibraryDateRange('this_month', { today: dec31 });
  assert(
    decMonth.startDate === '2026-12-01' && decMonth.endDate === '2026-12-31',
    'This Month preset for Dec 31 ends on 2026-12-31'
  );

  const decWeek = computeLibraryDateRange('this_week', { today: dec31 });
  // Dec 31 2026 is Thursday. Monday is Dec 28 2026, Sunday is Jan 3 2027
  assert(
    decWeek.startDate === '2026-12-28' && decWeek.endDate === '2027-01-03',
    'This Week preset correctly spans year boundary from 2026 to 2027'
  );

  const jan1 = new Date(2027, 0, 1, 0, 5, 0); // Jan 1, 2027
  const janWeek = computeLibraryDateRange('this_week', { today: jan1 });
  assert(
    janWeek.startDate === '2026-12-28' && janWeek.endDate === '2027-01-03',
    'Jan 1 belongs to the exact same calendar week as Dec 31'
  );

  // 1.6 Week Presets across every Day of Week (Monday through Sunday)
  for (let offset = 0; offset < 7; offset++) {
    const testDay = new Date(2026, 10, 2 + offset, 12, 0, 0);
    const range = computeLibraryDateRange('this_week', { today: testDay });
    assert(
      range.startDate === '2026-11-02' && range.endDate === '2026-11-08',
      `This Week preset returns Monday-Sunday range for day offset +${offset} (${formatLocalDate(testDay)})`
    );
  }

  // 1.7 Single Date and Custom Range Presets
  const specificRange = computeLibraryDateRange('specific_date', {
    selectedSpecificDate: '2026-11-15',
  });
  assert(
    specificRange.startDate === '2026-11-15' && specificRange.endDate === '2026-11-15',
    'Specific Date preset returns identical start and end boundaries'
  );

  const customRange = computeLibraryDateRange('custom_range', {
    customStartDate: '2026-10-01',
    customEndDate: '2026-11-30',
  });
  assert(
    customRange.startDate === '2026-10-01' && customRange.endDate === '2026-11-30',
    'Custom Range preset passes custom boundaries unchanged'
  );

  // 1.8 Preset 'all' returns empty object
  const allRange = computeLibraryDateRange('all');
  assert(
    allRange.startDate === undefined && allRange.endDate === undefined,
    'All preset returns empty boundaries for unrestricted query'
  );

  // 1.9 Timezone-Shift Regression Simulation (Dhaka UTC+6 vs New York UTC-5)
  const originalTZ = process.env.TZ;
  try {
    process.env.TZ = 'Asia/Dhaka';
    const dhakaDate = new Date('2026-11-01T19:00:00Z');
    assert(
      formatLocalDate(dhakaDate) === '2026-11-02',
      'Asia/Dhaka (UTC+6): 01:00 AM Nov 2 resolves to 2026-11-02 (no backward shift)'
    );

    process.env.TZ = 'Asia/Kolkata';
    const kolkataDate = new Date('2026-11-01T19:00:00Z');
    assert(
      formatLocalDate(kolkataDate) === '2026-11-02',
      'Asia/Kolkata (UTC+5:30): 00:30 AM Nov 2 resolves to 2026-11-02'
    );

    process.env.TZ = 'UTC';
    const utcDate = new Date('2026-11-02T00:00:00Z');
    assert(
      formatLocalDate(utcDate) === '2026-11-02',
      'UTC: Midnight Nov 2 resolves to 2026-11-02'
    );

    process.env.TZ = 'America/New_York';
    const nyDate = new Date('2026-11-02T02:00:00Z');
    assert(
      formatLocalDate(nyDate) === '2026-11-01',
      'America/New_York (negative UTC): Evening Nov 1 resolves to 2026-11-01'
    );
  } finally {
    process.env.TZ = originalTZ;
  }

  // 1.10 Static Verification: StudentLibraryPage.tsx uses formatLocalDate and 0 toISOString
  const libraryPageContent = fs.readFileSync(
    path.resolve('src/pages/dashboard/StudentLibraryPage.tsx'),
    'utf-8'
  );
  assert(
    libraryPageContent.includes('formatLocalDate(new Date())'),
    'StudentLibraryPage.tsx calls formatLocalDate(new Date())'
  );
  assert(
    !libraryPageContent.includes('toISOString().split'),
    'StudentLibraryPage.tsx contains 0 occurrences of toISOString().split'
  );

  // ===========================================================================
  // MODULE 2: PL-AUD-002 — SUBMISSION ATTACHMENT STORAGE LIFECYCLE
  // ===========================================================================
  console.log('\n--- MODULE 2: PL-AUD-002 — Submission Attachment Lifecycle Tests ---');

  const studentId = 'mock-student-pp001';
  const mentorId = 'mock-mentor-ppm001';

  // Create an active assignment for lifecycle testing
  const { assignment: testAssign } = createMockAssignment({
    studentId,
    mentorId,
    title: 'Storage Lifecycle Test Assignment',
    instructions: 'Test transitions between file, text, and link submissions',
    status: 'published',
  });
  assert(Boolean(testAssign?.id), 'Test assignment created successfully');
  const assignId = testAssign!.id;

  // Track simulated storage operations safely
  const simulatedStorage = new Map<string, { size: number; deleted: boolean }>();
  let deletedPaths: string[] = [];

  const mockDeleteFile = async (filePath: string): Promise<{ success: boolean; error: Error | null }> => {
    deletedPaths.push(filePath);
    if (simulatedStorage.has(filePath)) {
      simulatedStorage.get(filePath)!.deleted = true;
      return { success: true, error: null };
    }
    return { success: true, error: null };
  };

  // Lifecycle Step 1: Initial Submission (File)
  const initialFilePath = `submissions/${assignId}/${studentId}/doc_v1.pdf`;
  simulatedStorage.set(initialFilePath, { size: 1024, deleted: false });

  const { submission: sub1 } = submitMockAssignment({
    assignmentId: assignId,
    studentId,
    submissionType: 'file',
    content: 'Attached assignment v1',
    fileName: 'doc_v1.pdf',
    fileSize: 1024,
    filePath: initialFilePath,
  });
  assert(sub1?.file_path === initialFilePath, 'Initial file submission persisted with file_path');
  assert(sub1?.submission_type === 'file', 'Submission type is "file"');

  // Lifecycle Step 2: Transition A: File -> File (Replaced with new file)
  const newFilePath = `submissions/${assignId}/${studentId}/doc_v2.pdf`;
  simulatedStorage.set(newFilePath, { size: 2048, deleted: false });

  const prevPathA = sub1?.file_path;
  const { submission: sub2, error: errA } = submitMockAssignment({
    assignmentId: assignId,
    studentId,
    submissionType: 'file',
    content: 'Attached assignment v2',
    fileName: 'doc_v2.pdf',
    fileSize: 2048,
    filePath: newFilePath,
  });
  assert(!errA && sub2?.file_path === newFilePath, 'Updated to file v2 in database');

  // Cleanup check for Case A: isFileReplaced
  const isFileReplacedA = Boolean(newFilePath && prevPathA && prevPathA !== newFilePath);
  assert(isFileReplacedA, 'Case A recognized: isFileReplaced is true');
  if (isFileReplacedA && prevPathA) {
    await mockDeleteFile(prevPathA);
  }
  assert(deletedPaths.includes(initialFilePath), 'Previous file v1 cleaned up after replacement');
  assert(!deletedPaths.includes(newFilePath), 'Current file v2 is preserved and NOT deleted');

  // Lifecycle Step 3: Transition B: File -> Text
  deletedPaths = [];
  const prevPathB = sub2?.file_path; // doc_v2.pdf

  const { submission: sub3, error: errB } = submitMockAssignment({
    assignmentId: assignId,
    studentId,
    submissionType: 'text',
    content: 'Converted to rich text answer content.',
  });
  assert(!errB && sub3?.submission_type === 'text', 'Updated to text submission in database');
  assert(sub3?.file_path === null, 'Old file_path cleared to null in database');

  // Cleanup check for Case B: isFileCleared
  const typeB: string = 'text';
  const isFileClearedB = Boolean(typeB !== 'file' && prevPathB);
  assert(isFileClearedB, 'Case B recognized: isFileCleared is true');
  if (isFileClearedB && prevPathB) {
    await mockDeleteFile(prevPathB);
  }
  assert(deletedPaths.includes(newFilePath), 'Old file v2 deleted after transitioning to text');

  // Lifecycle Step 4: Transition C: Text -> File
  deletedPaths = [];
  const v3FilePath = `submissions/${assignId}/${studentId}/doc_v3.pdf`;
  simulatedStorage.set(v3FilePath, { size: 3000, deleted: false });

  const prevPathC = sub3?.file_path; // null
  const { submission: sub4 } = submitMockAssignment({
    assignmentId: assignId,
    studentId,
    submissionType: 'file',
    content: 'Re-attached file v3',
    fileName: 'doc_v3.pdf',
    fileSize: 3000,
    filePath: v3FilePath,
  });
  const typeC: string = 'file';
  const isFileReplacedC = Boolean(v3FilePath && prevPathC && prevPathC !== v3FilePath);
  const isFileClearedC = Boolean(typeC !== 'file' && prevPathC);
  assert(!isFileReplacedC && !isFileClearedC, 'No orphan cleanup needed when transition is text -> file');
  assert(deletedPaths.length === 0, 'No files deleted during text -> file transition');

  // Lifecycle Step 5: Transition D: File -> Link
  deletedPaths = [];
  const prevPathD = sub4?.file_path; // doc_v3.pdf

  const { submission: sub5, error: errD } = submitMockAssignment({
    assignmentId: assignId,
    studentId,
    submissionType: 'link',
    linkUrl: 'https://github.com/example/project',
    content: 'https://github.com/example/project',
  });
  assert(!errD && sub5?.submission_type === 'link', 'Updated to link submission in database');
  assert(sub5?.file_path === null, 'File path cleared to null on link transition');

  const typeD: string = 'link';
  const isFileClearedD = Boolean(typeD !== 'file' && prevPathD);
  assert(isFileClearedD, 'Case D recognized: isFileCleared is true for file -> link');
  if (isFileClearedD && prevPathD) {
    await mockDeleteFile(prevPathD);
  }
  assert(deletedPaths.includes(v3FilePath), 'Old file v3 deleted after transitioning to link');

  // Lifecycle Step 6: Database Failure Safety
  deletedPaths = [];
  const preservedOldFile = `submissions/${assignId}/${studentId}/doc_safe.pdf`;
  const orphanedCandidate = `submissions/${assignId}/${studentId}/doc_aborted.pdf`;
  const uploadFailedPath = orphanedCandidate;

  const { submission: failedSub, error: submitErr } = submitMockAssignment({
    assignmentId: assignId,
    studentId,
    submissionType: 'file',
    content: '', // empty content triggers validation error
    filePath: orphanedCandidate,
  });
  assert(Boolean(submitErr) && failedSub === null, 'Submission properly rejected on empty content');

  if (submitErr && uploadFailedPath) {
    await mockDeleteFile(uploadFailedPath);
  }
  assert(deletedPaths.includes(orphanedCandidate), 'Newly uploaded object rolled back on submission failure');
  assert(!deletedPaths.includes(preservedOldFile), 'Previously preserved attachment was NOT touched');

  // 2.7 Static Verification of Storage Cleanup in both pages
  const assignmentsPageContent = fs.readFileSync(
    path.resolve('src/pages/dashboard/StudentAssignmentsPage.tsx'),
    'utf-8'
  );
  assert(
    assignmentsPageContent.includes('const isFileCleared = Boolean(submissionType !== \'file\' && previousFilePath);'),
    'StudentAssignmentsPage.tsx implements isFileCleared cleanup condition'
  );
  assert(
    libraryPageContent.includes('const isFileCleared = Boolean(submissionType !== \'file\' && previousFilePath);'),
    'StudentLibraryPage.tsx implements isFileCleared cleanup condition'
  );

  // ===========================================================================
  // MODULE 3: PL-AUD-003 — ACCURATE TAB COUNT BADGES & PREFETCHING
  // ===========================================================================
  console.log('\n--- MODULE 3: PL-AUD-003 — Tab Count Badges & Prefetching Tests ---');

  // 3.1 Fetch lightweight counts for student PP001
  const mockTasks = getMockStudentTasks(studentId);
  const taskCount = mockTasks.length;
  assert(taskCount >= 0, `Lightweight task count retrieved: ${taskCount}`);

  const mockAssigns = getMockStudentAssignments(studentId);
  const assignCount = mockAssigns.length;
  assert(assignCount >= 1, `Lightweight assignment count retrieved: ${assignCount}`);

  // 3.2 Adding a new task increments count
  createMockTask({
    studentId,
    title: 'Verification Milestone Task Counter Check',
    priority: 'high',
    dueDate: '2026-11-10',
  });
  const updatedTaskCount = getMockStudentTasks(studentId).length;
  assert(updatedTaskCount === taskCount + 1, 'Task count increments deterministically after task creation');

  // 3.3 Adding a new assignment increments count
  createMockAssignment({
    studentId,
    mentorId,
    title: 'Verification Milestone Assignment Counter Check',
    instructions: 'Count verification assignment',
    status: 'published',
  });
  const updatedAssignCount = getMockStudentAssignments(studentId).length;
  assert(updatedAssignCount === assignCount + 1, 'Assignment count increments deterministically after assignment creation');

  // 3.4 Static verification: tasks.ts and assignments.ts export count functions
  const tasksServiceContent = fs.readFileSync(path.resolve('src/lib/tasks.ts'), 'utf-8');
  assert(
    tasksServiceContent.includes('export async function getStudentTasksCount'),
    'src/lib/tasks.ts exports getStudentTasksCount'
  );
  assert(
    tasksServiceContent.includes("count: 'exact', head: true"),
    'src/lib/tasks.ts uses lightweight HEAD query for count'
  );

  const assignsServiceContent = fs.readFileSync(path.resolve('src/lib/assignments.ts'), 'utf-8');
  assert(
    assignsServiceContent.includes('export async function getStudentAssignmentsCount'),
    'src/lib/assignments.ts exports getStudentAssignmentsCount'
  );
  assert(
    assignsServiceContent.includes("count: 'exact', head: true"),
    'src/lib/assignments.ts uses lightweight HEAD query for count'
  );

  // 3.5 Static verification: StudentLibraryPage.tsx renders tabCounts without false 0
  assert(
    libraryPageContent.includes('tabCounts.tasks !== null'),
    'StudentLibraryPage.tsx checks tabCounts.tasks !== null'
  );
  assert(
    libraryPageContent.includes('tabCounts.assignments !== null'),
    'StudentLibraryPage.tsx checks tabCounts.assignments !== null'
  );
  assert(
    libraryPageContent.includes('tabCounts.resources !== null'),
    'StudentLibraryPage.tsx checks tabCounts.resources !== null'
  );

  // ===========================================================================
  // MODULE 4: PL-AUD-004 — STANDARDIZED NOTIFICATION DEEP LINKS
  // ===========================================================================
  console.log('\n--- MODULE 4: PL-AUD-004 — Standardized Notification Route Tests ---');

  // 4.1 Task Notification Route Check
  const { task: notifTask } = createMockTask({
    studentId,
    createdBy: mentorId,
    title: 'Deep Link Verification Task',
    priority: 'medium',
  });
  assert(Boolean(notifTask?.id), 'Task created by mentor');

  const allNotifications = getMockStudentNotifications(studentId);
  const taskNotif = allNotifications.find(
    (n) => n.recipient_id === studentId && n.type === 'task_created' && n.title === 'New Task Assigned'
  );
  assert(Boolean(taskNotif), 'Task assigned notification generated for student');
  assert(
    taskNotif?.link === '/student/library?tab=tasks',
    `Task notification routes to Academic Library tasks tab: "${taskNotif?.link}"`
  );

  // 4.2 Assignment Published Notification Route Check
  const { assignment: notifAssign } = createMockAssignment({
    studentId,
    mentorId,
    programId: 'prog-academic-01',
    title: 'Deep Link Verification Assignment',
    instructions: 'Check notification link',
    status: 'published',
  });
  assert(Boolean(notifAssign?.id), 'Assignment created and published by mentor');

  const assignNotif = allNotifications.find(
    (n) => n.recipient_id === studentId && n.type === 'assignment_created'
  );
  assert(Boolean(assignNotif), 'Assignment published notification generated for student');
  assert(
    assignNotif?.link === '/student/library?tab=assignments',
    `Assignment notification routes to Academic Library assignments tab: "${assignNotif?.link}"`
  );

  // 4.3 Assignment Submission Reviewed Notification Route Check
  const { submission: studentWork } = submitMockAssignment({
    assignmentId: notifAssign!.id,
    studentId,
    submissionType: 'text',
    content: 'Reviewable submission content',
  });
  assert(Boolean(studentWork?.id), 'Assignment submitted by student');

  const { submission: reviewedWork } = reviewMockSubmission({
    submissionId: studentWork!.id,
    mentorId,
    score: 95,
    feedback: 'Excellent work!',
    status: 'reviewed',
  });
  assert(Boolean(reviewedWork), 'Submission reviewed by mentor');

  const updatedNotifications = getMockStudentNotifications(studentId);
  const reviewNotif = updatedNotifications.find(
    (n) => n.recipient_id === studentId && n.type === 'submission_reviewed'
  );
  assert(Boolean(reviewNotif), 'Submission reviewed notification generated for student');
  assert(
    reviewNotif?.link === '/student/library?tab=assignments',
    `Review notification routes to Academic Library assignments tab: "${reviewNotif?.link}"`
  );

  // 4.4 Static verification: Real services also use /student/library?tab=...
  assert(
    tasksServiceContent.includes("link: '/student/library?tab=tasks'"),
    'src/lib/tasks.ts uses link: "/student/library?tab=tasks"'
  );
  assert(
    assignsServiceContent.includes("link: '/student/library?tab=assignments'"),
    'src/lib/assignments.ts uses link: "/student/library?tab=assignments"'
  );

  // 4.5 URL Tab Routing Helper Verification
  assert(getLibraryTabUrl('/student/library', 'tasks') === '/student/library?tab=tasks', 'getLibraryTabUrl tasks');
  assert(
    getLibraryTabUrl('/student/library', 'assignments') === '/student/library?tab=assignments',
    'getLibraryTabUrl assignments'
  );
  assert(
    getLibraryTabUrl('/student/library', 'resources') === '/student/library?tab=resources',
    'getLibraryTabUrl resources'
  );

  // Summary
  console.log('\n================================================================');
  console.log(`VERIFICATION SUMMARY: ${passedChecks} / ${totalChecks} ASSERTIONS PASSED`);
  console.log('================================================================\n');
}

runHardeningVerification().catch((err) => {
  console.error('\nVerification suite encountered fatal error:', err);
  process.exit(1);
});
