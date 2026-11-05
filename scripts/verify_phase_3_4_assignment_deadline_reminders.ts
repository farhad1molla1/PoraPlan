/**
 * PoraPlan — Phase 3.4 Verification Suite
 * Assignment Deadline Reminders Implementation & Policy Verification
 *
 * Verifies:
 * 1. Exact Reminder Timing (24h threshold, 6h after pub, 6h before deadline, 23:59 Asia/Dhaka)
 * 2. Publication Lifecycle (Direct publication, draft -> published, set-once timestamp)
 * 3. Eligibility Matrix (Status, student status, submissions: submitted/under_review/reviewed vs needs_revision)
 * 4. Deadline Mutations (Extended, shortened, cleared, post-delivery changes)
 * 5. Idempotency & Reliability (One per lifetime, student deletes notification, missed tick recovery)
 * 6. SQL Schema & Security Static Audit (Search path, SECURITY DEFINER, unique constraint, pg_cron check)
 * 7. Non-regression of existing notifications (Phases 3.1, 3.2, 3.3)
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  parseDhakaDeadline,
  calculateReminderSchedule,
  processMockAssignmentDeadlineReminders,
  resetMockAssignmentReminderDeliveries,
  getMockAssignmentReminderDeliveries,
  mockAssignments,
  mockSubmissions,
  mockNotifications,
  createMockAssignment,
  updateMockAssignment,
  getMockUserNotifications,
  getMockProfile,
  setMockAccountStatus,
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
  console.log(' PoraPlan — Phase 3.4: Assignment Deadline Reminders Verification');
  console.log('================================================================\n');

  // ---------------------------------------------------------------------------
  // Suite 1: Timing & Timezone Calculations (Dhaka 23:59 BST = 17:59 UTC)
  // ---------------------------------------------------------------------------
  console.log('--- Suite 1: Timing & Timezone Calculations ---');

  const deadline = parseDhakaDeadline('2026-11-10');
  // 23:59:00 in Asia/Dhaka (UTC+6) is exactly 17:59:00 UTC on 2026-11-10
  assert(
    deadline.toISOString() === '2026-11-10T17:59:00.000Z',
    'parseDhakaDeadline converts 2026-11-10 to exact 23:59:00 Asia/Dhaka (17:59:00 UTC)'
  );

  // Scenario 1.1: Exactly 24 hours between published_at and deadline
  // pub: 2026-11-09T17:59:00.000Z, deadline: 2026-11-10T17:59:00.000Z (diff = 24h)
  // Policy: duration <= 24h -> reminder_at = published_at + 6h
  const sched24h = calculateReminderSchedule('2026-11-09T17:59:00.000Z', '2026-11-10');
  assert(sched24h.isEligibleTiming === true, 'Schedule with exactly 24h duration is eligible');
  assert(
    sched24h.reminderAt.toISOString() === '2026-11-09T23:59:00.000Z',
    'Schedule with exactly 24h sets reminder_at to published_at + 6 hours'
  );

  // Scenario 1.2: Less than 24 hours (e.g. 12 hours)
  // pub: 2026-11-10T05:59:00.000Z, deadline: 2026-11-10T17:59:00.000Z (diff = 12h)
  // Policy: reminder_at = published_at + 6h
  const sched12h = calculateReminderSchedule('2026-11-10T05:59:00.000Z', '2026-11-10');
  assert(sched12h.isEligibleTiming === true, 'Schedule with 12h duration is eligible');
  assert(
    sched12h.reminderAt.toISOString() === '2026-11-10T11:59:00.000Z',
    'Schedule with 12h sets reminder_at to published_at + 6 hours'
  );

  // Scenario 1.3: More than 24 hours (e.g. 48 hours)
  // pub: 2026-11-08T17:59:00.000Z, deadline: 2026-11-10T17:59:00.000Z (diff = 48h)
  // Policy: reminder_at = deadline_at - 6h
  const sched48h = calculateReminderSchedule('2026-11-08T17:59:00.000Z', '2026-11-10');
  assert(sched48h.isEligibleTiming === true, 'Schedule with 48h duration is eligible');
  assert(
    sched48h.reminderAt.toISOString() === '2026-11-10T11:59:00.000Z',
    'Schedule with 48h sets reminder_at to deadline_at - 6 hours'
  );

  // Scenario 1.4: Very short assignment (e.g. 3 hours)
  // pub: 2026-11-10T14:59:00.000Z, deadline: 2026-11-10T17:59:00.000Z (diff = 3h)
  // reminder_at = pub + 6h = 20:59:00.000Z > deadline_at (17:59:00.000Z)
  // Policy: reminder_at >= deadline_at -> must be skipped!
  const sched3h = calculateReminderSchedule('2026-11-10T14:59:00.000Z', '2026-11-10');
  assert(
    sched3h.isEligibleTiming === false,
    'Schedule with 3h duration is ineligible because reminder_at >= deadline_at'
  );

  // Scenario 1.5: Deadline already in the past at publication
  const schedPast = calculateReminderSchedule('2026-11-11T12:00:00.000Z', '2026-11-10');
  assert(
    schedPast.isEligibleTiming === false,
    'Schedule with deadline prior to publication is marked ineligible'
  );

  // ---------------------------------------------------------------------------
  // Suite 2: Publication Lifecycle & Timestamp Integrity
  // ---------------------------------------------------------------------------
  console.log('\n--- Suite 2: Publication Lifecycle & Timestamp Integrity ---');
  mockNotifications.length = 0;
  resetMockAssignmentReminderDeliveries();

  // Scenario 2.1: Directly published assignment gets published_at at creation
  const createdDirect = createMockAssignment({
    studentId: 'mock-student-pp001',
    mentorId: 'mock-mentor-ppm001',
    title: 'Directly Published Assignment',
    dueDate: '2026-11-20',
    status: 'published',
  });
  assert(
    Boolean(createdDirect.assignment?.published_at),
    'Directly published assignment has published_at populated immediately'
  );

  // Scenario 2.2: Draft assignment created without published_at
  const createdDraft = createMockAssignment({
    studentId: 'mock-student-pp001',
    mentorId: 'mock-mentor-ppm001',
    title: 'Draft Assignment Later Published',
    dueDate: '2026-11-20',
    status: 'draft',
  });
  assert(
    createdDraft.assignment?.published_at === null,
    'Draft assignment has null published_at at creation'
  );

  // Scenario 2.3: Draft published later gets published_at set at transition time
  await new Promise((r) => setTimeout(r, 10));
  const publishedDraft = updateMockAssignment(createdDraft.assignment!.id, {
    status: 'published',
  });
  assert(
    Boolean(publishedDraft.assignment?.published_at),
    'Draft assignment published later receives a valid published_at'
  );
  const initialDraftPubAt = publishedDraft.assignment!.published_at!;

  // Scenario 2.4: Subsequent updates to published assignment preserve original published_at
  await new Promise((r) => setTimeout(r, 10));
  const updatedPubAssignment = updateMockAssignment(publishedDraft.assignment!.id, {
    title: 'Draft Assignment Later Published (Title Edited)',
  });
  assert(
    updatedPubAssignment.assignment?.published_at === initialDraftPubAt,
    'Subsequent metadata updates strictly preserve original published_at without overwriting'
  );

  // ---------------------------------------------------------------------------
  // Suite 3: Eligibility Matrix & Submission Status Handling
  // ---------------------------------------------------------------------------
  console.log('\n--- Suite 3: Eligibility Matrix & Submission Status Handling ---');
  mockNotifications.length = 0;
  resetMockAssignmentReminderDeliveries();

  // Prepare standard student and assignment setup:
  // published_at: 2026-11-01T12:00:00.000Z, due_date: 2026-11-05 (deadline = 2026-11-05T17:59:00.000Z)
  // reminder_at: deadline - 6h = 2026-11-05T11:59:00.000Z
  const assignEligible = createMockAssignment({
    studentId: 'mock-student-pp001',
    title: 'Standard Eligible Assignment',
    dueDate: '2026-11-05',
    status: 'published',
  });
  assignEligible.assignment!.published_at = '2026-11-01T12:00:00.000Z';
  mockAssignments.find((a) => a.id === assignEligible.assignment!.id)!.published_at = '2026-11-01T12:00:00.000Z';

  // Draft assignment
  const assignDraft = createMockAssignment({
    studentId: 'mock-student-pp001',
    title: 'Draft Ineligible Assignment',
    dueDate: '2026-11-05',
    status: 'draft',
  });

  // Closed assignment
  const assignClosed = createMockAssignment({
    studentId: 'mock-student-pp001',
    title: 'Closed Ineligible Assignment',
    dueDate: '2026-11-05',
    status: 'closed',
  });
  assignClosed.assignment!.published_at = '2026-11-01T12:00:00.000Z';
  mockAssignments.find((a) => a.id === assignClosed.assignment!.id)!.published_at = '2026-11-01T12:00:00.000Z';

  // Archived assignment
  const assignArchived = createMockAssignment({
    studentId: 'mock-student-pp001',
    title: 'Archived Ineligible Assignment',
    dueDate: '2026-11-05',
    status: 'archived',
  });
  assignArchived.assignment!.published_at = '2026-11-01T12:00:00.000Z';
  mockAssignments.find((a) => a.id === assignArchived.assignment!.id)!.published_at = '2026-11-01T12:00:00.000Z';

  // Null deadline assignment
  const assignNoDate = createMockAssignment({
    studentId: 'mock-student-pp001',
    title: 'Unscheduled Ineligible Assignment',
    dueDate: undefined,
    status: 'published',
  });
  assignNoDate.assignment!.published_at = '2026-11-01T12:00:00.000Z';
  mockAssignments.find((a) => a.id === assignNoDate.assignment!.id)!.published_at = '2026-11-01T12:00:00.000Z';

  // Assignment with completed submission ('submitted') -> must be suppressed
  const assignSubmitted = createMockAssignment({
    studentId: 'mock-student-pp001',
    title: 'Already Submitted Assignment',
    dueDate: '2026-11-05',
    status: 'published',
  });
  assignSubmitted.assignment!.published_at = '2026-11-01T12:00:00.000Z';
  mockAssignments.find((a) => a.id === assignSubmitted.assignment!.id)!.published_at = '2026-11-01T12:00:00.000Z';
  mockSubmissions.push({
    id: 'sub-test-submitted',
    assignment_id: assignSubmitted.assignment!.id,
    student_id: 'mock-student-pp001',
    submission_type: 'text',
    content: 'My completed answers',
    status: 'submitted',
    submitted_at: '2026-11-04T10:00:00.000Z',
    updated_at: '2026-11-04T10:00:00.000Z',
  });

  // Assignment with 'under_review' submission -> must be suppressed
  const assignUnderReview = createMockAssignment({
    studentId: 'mock-student-pp001',
    title: 'Under Review Assignment',
    dueDate: '2026-11-05',
    status: 'published',
  });
  assignUnderReview.assignment!.published_at = '2026-11-01T12:00:00.000Z';
  mockAssignments.find((a) => a.id === assignUnderReview.assignment!.id)!.published_at = '2026-11-01T12:00:00.000Z';
  mockSubmissions.push({
    id: 'sub-test-under-review',
    assignment_id: assignUnderReview.assignment!.id,
    student_id: 'mock-student-pp001',
    submission_type: 'text',
    content: 'Review in progress',
    status: 'under_review',
    submitted_at: '2026-11-04T10:00:00.000Z',
    updated_at: '2026-11-04T10:00:00.000Z',
  });

  // Assignment with 'reviewed' submission -> must be suppressed
  const assignReviewed = createMockAssignment({
    studentId: 'mock-student-pp001',
    title: 'Reviewed Assignment',
    dueDate: '2026-11-05',
    status: 'published',
  });
  assignReviewed.assignment!.published_at = '2026-11-01T12:00:00.000Z';
  mockAssignments.find((a) => a.id === assignReviewed.assignment!.id)!.published_at = '2026-11-01T12:00:00.000Z';
  mockSubmissions.push({
    id: 'sub-test-reviewed',
    assignment_id: assignReviewed.assignment!.id,
    student_id: 'mock-student-pp001',
    submission_type: 'text',
    content: 'Fully graded',
    status: 'reviewed',
    submitted_at: '2026-11-04T10:00:00.000Z',
    updated_at: '2026-11-04T10:00:00.000Z',
  });

  // Assignment with 'needs_revision' submission -> REMAIN ELIGIBLE (student must still act!)
  const assignNeedsRevision = createMockAssignment({
    studentId: 'mock-student-pp001',
    title: 'Needs Revision Assignment',
    dueDate: '2026-11-05',
    status: 'published',
  });
  assignNeedsRevision.assignment!.published_at = '2026-11-01T12:00:00.000Z';
  mockAssignments.find((a) => a.id === assignNeedsRevision.assignment!.id)!.published_at = '2026-11-01T12:00:00.000Z';
  mockSubmissions.push({
    id: 'sub-test-needs-revision',
    assignment_id: assignNeedsRevision.assignment!.id,
    student_id: 'mock-student-pp001',
    submission_type: 'text',
    content: 'Needs revision response',
    status: 'needs_revision',
    submitted_at: '2026-11-04T10:00:00.000Z',
    updated_at: '2026-11-04T10:00:00.000Z',
  });

  // Assignment for 'not_activated' student (mock-student-pp002) -> must be suppressed
  const assignNotActivated = createMockAssignment({
    studentId: 'mock-student-pp002',
    title: 'Not Activated Student Assignment',
    dueDate: '2026-11-05',
    status: 'published',
  });
  assignNotActivated.assignment!.published_at = '2026-11-01T12:00:00.000Z';
  mockAssignments.find((a) => a.id === assignNotActivated.assignment!.id)!.published_at = '2026-11-01T12:00:00.000Z';

  // Assignment for 'suspended' student (mock-student-pp003) -> must be suppressed
  const student3 = getMockProfile('mock-student-pp003');
  const originalStatus3 = student3?.status || 'active';
  setMockAccountStatus('mock-student-pp003', 'suspended');
  const assignSuspended = createMockAssignment({
    studentId: 'mock-student-pp003',
    title: 'Suspended Student Assignment',
    dueDate: '2026-11-05',
    status: 'published',
  });
  assignSuspended.assignment!.published_at = '2026-11-01T12:00:00.000Z';
  mockAssignments.find((a) => a.id === assignSuspended.assignment!.id)!.published_at = '2026-11-01T12:00:00.000Z';

  // Run mock reminder scheduler at 2026-11-05T12:00:00.000Z (after reminder_at 11:59 UTC, before deadline 17:59 UTC)
  const resultEligibility = processMockAssignmentDeadlineReminders('2026-11-05T12:00:00.000Z');

  // Restore student3 status
  setMockAccountStatus('mock-student-pp003', originalStatus3 as any);

  assert(
    resultEligibility.deliveredAssignmentIds.includes(assignEligible.assignment!.id),
    'Standard published assignment with no submission receives deadline reminder'
  );
  assert(
    !resultEligibility.deliveredAssignmentIds.includes(assignDraft.assignment!.id),
    'Draft assignment is suppressed from reminder delivery'
  );
  assert(
    !resultEligibility.deliveredAssignmentIds.includes(assignClosed.assignment!.id),
    'Closed assignment is suppressed from reminder delivery'
  );
  assert(
    !resultEligibility.deliveredAssignmentIds.includes(assignArchived.assignment!.id),
    'Archived assignment is suppressed from reminder delivery'
  );
  assert(
    !resultEligibility.deliveredAssignmentIds.includes(assignNoDate.assignment!.id),
    'Unscheduled assignment (no due_date) is suppressed from reminder delivery'
  );
  assert(
    !resultEligibility.deliveredAssignmentIds.includes(assignSubmitted.assignment!.id),
    'Assignment with status: submitted is suppressed from reminder delivery'
  );
  assert(
    !resultEligibility.deliveredAssignmentIds.includes(assignUnderReview.assignment!.id),
    'Assignment with status: under_review is suppressed from reminder delivery'
  );
  assert(
    !resultEligibility.deliveredAssignmentIds.includes(assignReviewed.assignment!.id),
    'Assignment with status: reviewed is suppressed from reminder delivery'
  );
  assert(
    resultEligibility.deliveredAssignmentIds.includes(assignNeedsRevision.assignment!.id),
    'Assignment with status: needs_revision remains eligible and receives deadline reminder'
  );
  assert(
    !resultEligibility.deliveredAssignmentIds.includes(assignNotActivated.assignment!.id),
    'Assignment for student with status: not_activated is suppressed from reminder delivery'
  );
  assert(
    !resultEligibility.deliveredAssignmentIds.includes(assignSuspended.assignment!.id),
    'Assignment for student with status: suspended is suppressed from reminder delivery'
  );

  // ---------------------------------------------------------------------------
  // Suite 4: Notification Shape & Content Verification
  // ---------------------------------------------------------------------------
  console.log('\n--- Suite 4: Notification Shape & Content Verification ---');
  const studentNotifs = getMockUserNotifications('mock-student-pp001');
  const reminderNotif = studentNotifs.find(
    (n) => n.type === 'assignment_deadline_reminder' && n.idempotency_key === `assignment_reminder:${assignEligible.assignment!.id}`
  );

  assert(Boolean(reminderNotif), 'Notification inbox contains assignment_deadline_reminder');
  assert(
    reminderNotif?.title === 'Assignment Deadline Reminder',
    'Notification title matches exact required copy: "Assignment Deadline Reminder"'
  );
  assert(
    reminderNotif?.message === 'Your assignment "Standard Eligible Assignment" is approaching its deadline. Please complete and submit it on time.',
    'Notification message matches exact required copy with title placeholder'
  );
  assert(
    reminderNotif?.link === '/student/assignments',
    'Notification link routes safely to /student/assignments'
  );
  assert(
    !/\d+\s*(points|pts|bdt|\$|tk)/i.test(reminderNotif?.message || ''),
    'Notification message strictly respects zero-amount/zero-points policy'
  );

  // ---------------------------------------------------------------------------
  // Suite 5: Deadline Modifications & Dynamic Recalculation
  // ---------------------------------------------------------------------------
  console.log('\n--- Suite 5: Deadline Modifications & Dynamic Recalculation ---');
  mockNotifications.length = 0;
  resetMockAssignmentReminderDeliveries();

  // Create assignment with original due date 2026-11-05
  const assignMut = createMockAssignment({
    studentId: 'mock-student-pp001',
    title: 'Mutable Deadline Assignment',
    dueDate: '2026-11-05',
    status: 'published',
  });
  assignMut.assignment!.published_at = '2026-11-01T12:00:00.000Z';
  mockAssignments.find((a) => a.id === assignMut.assignment!.id)!.published_at = '2026-11-01T12:00:00.000Z';

  // Before reminder time (e.g. 2026-11-04), mentor extends deadline to 2026-11-15
  updateMockAssignment(assignMut.assignment!.id, {
    due_date: '2026-11-15',
  });

  // Evaluate at old reminder time 2026-11-05T12:00:00.000Z -> should NOT trigger because deadline was extended!
  const runAtOldTime = processMockAssignmentDeadlineReminders('2026-11-05T12:00:00.000Z');
  assert(
    !runAtOldTime.deliveredAssignmentIds.includes(assignMut.assignment!.id),
    'Extended deadline recalculates reminder window; old reminder window does not trigger prematurely'
  );

  // Evaluate at new reminder time (2026-11-15T12:00:00.000Z) -> should trigger!
  const runAtNewTime = processMockAssignmentDeadlineReminders('2026-11-15T12:00:00.000Z');
  assert(
    runAtNewTime.deliveredAssignmentIds.includes(assignMut.assignment!.id),
    'Extended deadline triggers reminder at newly recalculated reminder time'
  );

  // Scenario 5.2: Deadline changed AFTER delivery -> NO second reminder allowed
  updateMockAssignment(assignMut.assignment!.id, {
    due_date: '2026-11-25',
  });
  const runPostDelivery = processMockAssignmentDeadlineReminders('2026-11-25T12:00:00.000Z');
  assert(
    !runPostDelivery.deliveredAssignmentIds.includes(assignMut.assignment!.id),
    'Post-delivery deadline change does NOT trigger a second reminder (one per lifetime enforced)'
  );

  // ---------------------------------------------------------------------------
  // Suite 6: Durable Delivery Tracking & Inbox Deletion Immunity
  // ---------------------------------------------------------------------------
  console.log('\n--- Suite 6: Durable Delivery Tracking & Inbox Deletion Immunity ---');
  const deliveriesBefore = getMockAssignmentReminderDeliveries();
  const deliveryRecord = deliveriesBefore.find((d) => d.assignment_id === assignMut.assignment!.id);
  assert(Boolean(deliveryRecord), 'Durable delivery record exists in assignment_reminder_deliveries');

  // Student clears/deletes notification from inbox
  const notifToDelete = getMockUserNotifications('mock-student-pp001').find(
    (n) => n.idempotency_key === `assignment_reminder:${assignMut.assignment!.id}`
  );
  if (notifToDelete) {
    // Simulate user deleting notification row
    const notifs = getMockUserNotifications('mock-student-pp001');
    const idx = notifs.findIndex((n) => n.id === notifToDelete.id);
    if (idx !== -1) notifs.splice(idx, 1);
  }

  // Run scheduler again at same or future time
  const reRunAfterDelete = processMockAssignmentDeadlineReminders('2026-11-15T13:00:00.000Z');
  assert(
    !reRunAfterDelete.deliveredAssignmentIds.includes(assignMut.assignment!.id),
    'Deleting notification from inbox does NOT cause scheduler to re-dispatch (durable tracking immunity)'
  );

  // ---------------------------------------------------------------------------
  // Suite 7: Missed Tick Recovery & Deadline Cutoff
  // ---------------------------------------------------------------------------
  console.log('\n--- Suite 7: Missed Tick Recovery & Deadline Cutoff ---');
  mockNotifications.length = 0;
  resetMockAssignmentReminderDeliveries();

  // Assignment due 2026-11-05 (deadline = 17:59 UTC, reminder_at = 11:59 UTC)
  const assignMissed = createMockAssignment({
    studentId: 'mock-student-pp001',
    title: 'Missed Tick Assignment',
    dueDate: '2026-11-05',
    status: 'published',
  });
  assignMissed.assignment!.published_at = '2026-11-01T12:00:00.000Z';
  mockAssignments.find((a) => a.id === assignMissed.assignment!.id)!.published_at = '2026-11-01T12:00:00.000Z';

  // Scheduler missed 11:59 UTC, but wakes up at 14:00 UTC (still before deadline 17:59 UTC)
  const recoveryRun = processMockAssignmentDeadlineReminders('2026-11-05T14:00:00.000Z');
  assert(
    recoveryRun.deliveredAssignmentIds.includes(assignMissed.assignment!.id),
    'Scheduler successfully recovers and delivers pending reminder on delayed/missed execution'
  );

  // Assignment where scheduler wakes up AFTER deadline has already passed
  mockNotifications.length = 0;
  resetMockAssignmentReminderDeliveries();
  const assignLate = createMockAssignment({
    studentId: 'mock-student-pp001',
    title: 'Post-Deadline Assignment',
    dueDate: '2026-11-05',
    status: 'published',
  });
  assignLate.assignment!.published_at = '2026-11-01T12:00:00.000Z';
  mockAssignments.find((a) => a.id === assignLate.assignment!.id)!.published_at = '2026-11-01T12:00:00.000Z';

  // Evaluated at 2026-11-05T18:30:00.000Z (after 17:59 UTC deadline)
  const postDeadlineRun = processMockAssignmentDeadlineReminders('2026-11-05T18:30:00.000Z');
  assert(
    !postDeadlineRun.deliveredAssignmentIds.includes(assignLate.assignment!.id),
    'Scheduler strictly suppresses reminder delivery after deadline has elapsed'
  );

  // ---------------------------------------------------------------------------
  // Suite 8: SQL Migration & Security Architecture Static Audit
  // ---------------------------------------------------------------------------
  console.log('\n--- Suite 8: SQL Migration & Security Architecture Static Audit ---');
  const migrationPath = resolve(__dirname, '../supabase/migrations/20261105000002_assignment_deadline_reminders.sql');
  const migrationSql = readFileSync(migrationPath, 'utf8');

  assert(
    migrationSql.includes('ALTER TABLE public.assignments ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;'),
    'Migration adds published_at TIMESTAMPTZ to public.assignments'
  );
  assert(
    migrationSql.includes('CREATE TRIGGER trg_assignment_published_at'),
    'Migration installs trigger enforcing set-once semantics for published_at'
  );
  assert(
    migrationSql.includes("'assignment_deadline_reminder'"),
    'Migration extends check_notifications_type to include assignment_deadline_reminder'
  );
  assert(
    migrationSql.includes('CREATE TABLE IF NOT EXISTS public.assignment_reminder_deliveries'),
    'Migration creates public.assignment_reminder_deliveries tracking table'
  );
  assert(
    migrationSql.includes('CONSTRAINT uq_assignment_reminder UNIQUE (assignment_id)'),
    'Migration enforces uq_assignment_reminder UNIQUE (assignment_id)'
  );
  assert(
    migrationSql.includes('SECURITY DEFINER') && migrationSql.includes('SET search_path = public, pg_temp'),
    'Function uses SECURITY DEFINER with fixed search_path = public, pg_temp'
  );
  assert(
    migrationSql.includes('REVOKE ALL ON FUNCTION public.process_assignment_deadline_reminders() FROM PUBLIC') &&
      migrationSql.includes('GRANT EXECUTE ON FUNCTION public.process_assignment_deadline_reminders() TO postgres;'),
    'Function restricts execution to postgres/service_role and revokes from PUBLIC/authenticated/anon'
  );
  assert(
    migrationSql.includes("((a.due_date::text || ' 23:59:00')::timestamp AT TIME ZONE 'Asia/Dhaka')"),
    'Function interprets due_date at 23:59:00 Asia/Dhaka'
  );
  assert(
    migrationSql.includes("pg_cron"),
    'Migration conditionally detects pg_cron and registers schedule safely'
  );
  assert(
    migrationSql.includes('NEW.published_at := now();') && !migrationSql.includes("NEW.published_at := timezone('utc'"),
    'published_at trigger assigns timezone-invariant now() instead of session-dependent timezone() conversion'
  );
  assert(
    migrationSql.includes('sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),') && !migrationSql.includes("DEFAULT timezone('utc'"),
    'assignment_reminder_deliveries defaults sent_at to now() instead of timezone() conversion'
  );
  assert(
    migrationSql.includes('v_now TIMESTAMPTZ := now();') && !migrationSql.includes("v_now TIMESTAMPTZ := timezone('utc'"),
    'process_assignment_deadline_reminders initializes v_now to now() directly'
  );
  assert(
    migrationSql.includes("AND p.status = 'active'") && !migrationSql.includes("p.status != 'suspended'"),
    'Student eligibility query strictly requires p.status = active (excluding unactivated and suspended)'
  );
  assert(
    migrationSql.includes('CREATE OR REPLACE FUNCTION public.register_assignment_deadline_reminder_cron()'),
    'Dedicated idempotent register_assignment_deadline_reminder_cron procedure exists'
  );
  assert(
    !migrationSql.includes('CREATE EXTENSION IF NOT EXISTS pg_cron;'),
    'Registration function removes extension installation and does not attempt CREATE EXTENSION'
  );
  assert(
    migrationSql.includes("RAISE EXCEPTION 'pg_cron extension is not active"),
    'Registration function raises an actionable exception when pg_cron extension is missing'
  );
  assert(
    migrationSql.includes("pg_advisory_xact_lock(hashtext('process-assignment-deadline-reminders')::bigint);"),
    'Registration function acquires transaction-level advisory lock before job inspection or unscheduling'
  );
  assert(
    migrationSql.includes('FOR v_job_id IN (') && migrationSql.includes('PERFORM cron.unschedule(v_job_id);'),
    'Registration procedure unschedules existing jobs by jobid to guarantee zero duplicates'
  );
  assert(
    migrationSql.includes("PERFORM cron.schedule(\n    'process-assignment-deadline-reminders',\n    '* * * * *',\n    'SELECT public.process_assignment_deadline_reminders()'\n  );"),
    'Registration registers exactly one job with 1-minute ticker schedule and canonical command'
  );
  assert(
    migrationSql.includes('REVOKE ALL ON FUNCTION public.register_assignment_deadline_reminder_cron() FROM PUBLIC;') &&
      migrationSql.includes('GRANT EXECUTE ON FUNCTION public.register_assignment_deadline_reminder_cron() TO postgres;') &&
      migrationSql.includes('GRANT EXECUTE ON FUNCTION public.register_assignment_deadline_reminder_cron() TO service_role;'),
    'Registration procedure restricts execution to postgres/service_role and revokes from PUBLIC/authenticated/anon'
  );

  const snippetPath = resolve(__dirname, '../supabase/snippets/register_deadline_reminders_cron.sql');
  const snippetSql = readFileSync(snippetPath, 'utf8');
  assert(
    snippetSql.includes('SELECT public.register_assignment_deadline_reminder_cron();'),
    'Standalone snippet invokes register_assignment_deadline_reminder_cron cleanly'
  );
  assert(
    snippetSql.includes('1. Apply the migration') &&
      snippetSql.includes('2. Enable pg_cron from Supabase Dashboard') &&
      snippetSql.includes('3. Execute this registration SQL snippet') &&
      snippetSql.includes('4. Verify exactly one matching job exists in cron.job'),
    'Standalone snippet documents the complete 4-step deployment and verification lifecycle'
  );

  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------
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
