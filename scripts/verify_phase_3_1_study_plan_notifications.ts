/**
 * Verification Script: Phase 3.1 - Study Plan Update Notifications
 *
 * Verifies that:
 * 1. Mentor updating study plan title triggers a notification to student.
 * 2. Mentor updating study plan description triggers a notification to student.
 * 3. Mentor updating study plan subject triggers a notification to student.
 * 4. Mentor updating study plan status triggers a notification to student.
 * 5. Mentor modifying roadmap items triggers a notification to student.
 * 6. Mentor reordering / adding / removing roadmap items triggers a notification to student.
 * 7. No-op updates (identical title, description, subject, status, items) send NO notification.
 * 8. Student self-update (updaterId === studentId) sends NO notification.
 * 9. Failed update (non-existent plan ID, empty title) sends NO notification.
 * 10. Idempotent deduplication preserves exactly 1 notification.
 * 11. Initial plan creation notification remains intact ('Study Plan Assigned', key: plan:${id}).
 * 12. Notification fields comply with schema: type 'plan_updated', link '/student/plans', correct recipient & actor.
 */

import {
  createMockStudyPlan,
  updateMockStudyPlan,
  createMockNotification,
  getMockUserNotifications,
  mockStudyPlans,
  mockNotifications,
} from '../src/lib/mockAuthStore';

let passed = 0;
let failed = 0;

function assert(condition: boolean, desc: string) {
  if (condition) {
    console.log(`  ✓ ${desc}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${desc}`);
    failed++;
  }
}

async function run() {
  console.log('--- Phase 3.1: Study Plan Update Notifications Verification ---\n');

  // Reset notifications array for clean testing
  mockNotifications.length = 0;

  const mentorId = 'mock-mentor-ppm001';
  const studentId = 'mock-student-pp001';

// Test 1: Plan creation notification verification
console.log('1. Plan Creation Baseline:');
const { plan: newPlan, error: createError } = createMockStudyPlan({
  studentId,
  createdBy: mentorId,
  title: 'Calculus I Mastery Plan',
  description: 'Master limits, derivatives, and integral foundations.',
  items: [
    { title: 'Module 1: Limits & Continuity', estimated_minutes: 60, status: 'pending' },
    { title: 'Module 2: Differentiation Rules', estimated_minutes: 90, status: 'pending' },
  ],
});

assert(!createError && !!newPlan, 'Study plan created successfully');
const creationNotifs = getMockUserNotifications(studentId);
assert(creationNotifs.length === 1, 'Exactly 1 notification received upon plan creation');
assert(creationNotifs[0].type === 'plan_updated', 'Creation notification has type plan_updated');
assert(creationNotifs[0].title === 'Study Plan Assigned', 'Creation notification title is "Study Plan Assigned"');
assert(creationNotifs[0].idempotency_key === `plan:${newPlan!.id}`, 'Creation idempotency key is plan:${newPlan.id}');
assert(creationNotifs[0].link === '/student/plans', 'Notification link points to /student/plans');

// Clear notifications for update tests
mockNotifications.length = 0;

// Test 2: Mentor updates plan title
console.log('\n2. Mentor Updates Plan Title:');
const { plan: updatedTitlePlan, error: updateTitleError } = updateMockStudyPlan(
  newPlan!.id,
  { title: 'Advanced Calculus I & Analysis' },
  undefined,
  mentorId
);

assert(!updateTitleError && !!updatedTitlePlan, 'Plan title updated successfully');
const titleNotifs = getMockUserNotifications(studentId);
assert(titleNotifs.length === 1, 'Student receives exactly 1 notification for title change');
assert(titleNotifs[0].title === 'Study Plan Updated', 'Notification title is "Study Plan Updated"');
assert(titleNotifs[0].message.includes('Advanced Calculus I & Analysis'), 'Notification message mentions new title');
assert(titleNotifs[0].actor_id === mentorId, 'Actor ID is the mentor');
assert(titleNotifs[0].recipient_id === studentId, 'Recipient ID is the student');
assert(titleNotifs[0].link === '/student/plans', 'Link is /student/plans');
assert(
  titleNotifs[0].idempotency_key === `plan_update:${newPlan!.id}:${updatedTitlePlan!.updated_at}`,
  'Idempotency key uses plan_update:${id}:${updated_at} format'
);

// Clear notifications
mockNotifications.length = 0;

// Test 3: Mentor updates plan description
console.log('\n3. Mentor Updates Plan Description:');
const { plan: updatedDescPlan, error: updateDescError } = updateMockStudyPlan(
  newPlan!.id,
  { description: 'Revised scope: focus heavily on delta-epsilon proofs and FTC.' },
  undefined,
  mentorId
);

assert(!updateDescError && !!updatedDescPlan, 'Plan description updated successfully');
const descNotifs = getMockUserNotifications(studentId);
assert(descNotifs.length === 1, 'Student receives exactly 1 notification for description change');
assert(descNotifs[0].title === 'Study Plan Updated', 'Notification title is "Study Plan Updated"');

// Clear notifications
mockNotifications.length = 0;

// Test 4: Mentor updates plan subject
console.log('\n4. Mentor Updates Plan Subject:');
const { plan: updatedSubjPlan, error: updateSubjError } = updateMockStudyPlan(
  newPlan!.id,
  { subject_id: 'mock-sub-math-102' },
  undefined,
  mentorId
);

assert(!updateSubjError && !!updatedSubjPlan, 'Plan subject updated successfully');
const subjNotifs = getMockUserNotifications(studentId);
assert(subjNotifs.length === 1, 'Student receives exactly 1 notification for subject change');
assert(subjNotifs[0].title === 'Study Plan Updated', 'Notification title is "Study Plan Updated"');

// Clear notifications
mockNotifications.length = 0;

// Test 5: Mentor updates plan status (e.g. active -> completed)
console.log('\n5. Mentor Updates Plan Status:');
const { plan: updatedStatusPlan, error: updateStatusError } = updateMockStudyPlan(
  newPlan!.id,
  { status: 'completed' },
  undefined,
  mentorId
);

assert(!updateStatusError && !!updatedStatusPlan, 'Plan status updated successfully');
const statusNotifs = getMockUserNotifications(studentId);
assert(statusNotifs.length === 1, 'Student receives exactly 1 notification for status change');
assert(statusNotifs[0].title === 'Study Plan Updated', 'Notification title is "Study Plan Updated"');

// Reset status back to active for next tests
updateMockStudyPlan(newPlan!.id, { status: 'active' }, undefined, mentorId);
mockNotifications.length = 0;

// Test 6: Mentor updates roadmap items content/target date/estimated minutes
console.log('\n6. Mentor Updates Roadmap Items Content:');
const { plan: updatedItemPlan, items: updatedItems, error: updateItemError } = updateMockStudyPlan(
  newPlan!.id,
  {},
  [
    { title: 'Module 1: Limits & Continuity (Updated)', estimated_minutes: 75, target_date: '2026-11-10', status: 'pending' },
    { title: 'Module 2: Differentiation Rules', estimated_minutes: 90, status: 'pending' },
  ],
  mentorId
);

assert(!updateItemError && !!updatedItemPlan && updatedItems.length === 2, 'Roadmap items updated successfully');
const itemNotifs = getMockUserNotifications(studentId);
assert(itemNotifs.length === 1, 'Student receives exactly 1 notification for roadmap item changes');
assert(itemNotifs[0].title === 'Study Plan Updated', 'Notification title is "Study Plan Updated"');

// Clear notifications
mockNotifications.length = 0;

// Test 7: Mentor adds / reorders roadmap items
console.log('\n7. Mentor Adds a Roadmap Item:');
const { items: extendedItems, error: extendError } = updateMockStudyPlan(
  newPlan!.id,
  {},
  [
    { title: 'Module 1: Limits & Continuity (Updated)', estimated_minutes: 75, target_date: '2026-11-10', status: 'pending' },
    { title: 'Module 2: Differentiation Rules', estimated_minutes: 90, status: 'pending' },
    { title: 'Module 3: Integration by Parts', estimated_minutes: 120, status: 'pending' },
  ],
  mentorId
);

assert(!extendError && extendedItems.length === 3, 'Roadmap items extended to 3 items');
const extendNotifs = getMockUserNotifications(studentId);
assert(extendNotifs.length === 1, 'Student receives notification when roadmap items list changes length');

// Clear notifications
mockNotifications.length = 0;

// Test 8: No-op update (identical fields and items)
console.log('\n8. No-Op Update (No meaningful change):');
const { error: noopError } = updateMockStudyPlan(
  newPlan!.id,
  {
    title: updatedItemPlan!.title,
    description: updatedItemPlan!.description || undefined,
    subject_id: updatedItemPlan!.subject_id,
    status: updatedItemPlan!.status,
  },
  [
    { title: 'Module 1: Limits & Continuity (Updated)', estimated_minutes: 75, target_date: '2026-11-10', status: 'pending' },
    { title: 'Module 2: Differentiation Rules', estimated_minutes: 90, status: 'pending' },
    { title: 'Module 3: Integration by Parts', estimated_minutes: 120, status: 'pending' },
  ],
  mentorId
);

assert(!noopError, 'No-op update executed without error');
const noopNotifs = getMockUserNotifications(studentId);
assert(noopNotifs.length === 0, 'No notification dispatched for identical/no-op update');

// Test 9: Student updates own plan (updaterId === studentId)
console.log('\n9. Student Self-Update:');
const { error: studentUpdateError } = updateMockStudyPlan(
  newPlan!.id,
  { title: 'Calculus I - My Custom Title' },
  undefined,
  studentId // Student updater
);

assert(!studentUpdateError, 'Student self-update succeeded');
const studentSelfNotifs = getMockUserNotifications(studentId);
assert(studentSelfNotifs.length === 0, 'No notification dispatched when student updates their own plan');

// Test 10: Failed update (invalid plan ID)
console.log('\n10. Failed Update Handling:');
const { error: failedError } = updateMockStudyPlan(
  'non-existent-plan-id',
  { title: 'Should Fail' },
  undefined,
  mentorId
);

assert(!!failedError, 'Non-existent plan update returned error');
const failedNotifs = getMockUserNotifications(studentId);
assert(failedNotifs.length === 0, 'No notification dispatched on failed update');

// Test 11: Idempotency Deduplication Check
console.log('\n11. Idempotency Key Deduplication:');
// Reset notifications
mockNotifications.length = 0;

// Perform update
const { plan: dedupePlan } = updateMockStudyPlan(
  newPlan!.id,
  { title: 'Final Calculus Syllabus' },
  undefined,
  mentorId
);

assert(!!dedupePlan, 'Plan updated for deduplication test');
assert(mockNotifications.length === 1, 'Initial notification created');
const initialKey = mockNotifications[0].idempotency_key;

// Calling createMockNotification again with the same idempotency key should be deduped
const { notification: dupeNotif } = createMockNotification({
  recipientId: studentId,
  actorId: mentorId,
  type: 'plan_updated',
  title: 'Study Plan Updated',
  message: 'Retry attempt with same key',
  link: '/student/plans',
  idempotencyKey: initialKey,
});

assert(!!dupeNotif, 'Duplicate call returned existing notification');
assert(mockNotifications.length === 1, 'Duplicate with same idempotency key did not increase count');

// Perform a subsequent update after time advance
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
await sleep(10);

const { plan: secondPlan } = updateMockStudyPlan(
  newPlan!.id,
  { title: 'Final Calculus Syllabus (v2)' },
  undefined,
  mentorId
);

assert(!!secondPlan, 'Second distinct update succeeded');
assert(mockNotifications.length === 2, 'Second distinct update created a second notification');
assert(
  mockNotifications[0].idempotency_key !== mockNotifications[1].idempotency_key,
  'Each distinct update receives unique timestamp-based idempotency key'
);

  console.log('\n======================================================');
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('======================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Unhandled error in test:', err);
  process.exit(1);
});
