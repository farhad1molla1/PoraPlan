/**
 * Verification Script: Phase 3.3 - Assignment Metadata Update Notifications
 *
 * Verifies that:
 * 1. Draft creation produces no notification.
 * 2. Draft -> published produces exactly one "assignment_created" notification.
 * 3. Publication uses the canonical link "/student/assignments".
 * 4. Publication and metadata changes together produce one publication notification only.
 * 5. Repeated publication does not create a duplicate notification.
 * 6. Published title change generates one "assignment_updated".
 * 7. Published due-date change generates one "assignment_updated".
 * 8. Published instructions change generates one "assignment_updated".
 * 9. Multiple approved fields changed together generate only one notification.
 * 10. No-op update generates none.
 * 11. total_points-only update generates none.
 * 12. subject_id-only update generates none.
 * 13. plan_id-only update generates none.
 * 14. Closing or archiving generates none.
 * 15. Closing/archiving in the same update as metadata changes generates none.
 * 16. Draft metadata update while remaining draft generates none.
 * 17. Failed update generates none.
 * 18. Existing published assignment creation notification remains intact.
 * 19. Correct recipient, actor, type, title, message, destination, and idempotency behavior.
 */

import {
  createMockAssignment,
  updateMockAssignment,
  createMockNotification,
  getMockUserNotifications,
  mockAssignments,
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
  console.log('--- Phase 3.3: Assignment Update Notifications Verification ---\n');

  // Reset notifications array for clean testing
  mockNotifications.length = 0;

  const mentorId = 'mock-mentor-ppm001';
  const studentId = 'mock-student-pp001';

  // 1. Published Creation Baseline Check
  console.log('1. Baseline: Published Assignment Creation:');
  const { assignment: baselinePublished, error: baselinePubError } = createMockAssignment({
    studentId,
    mentorId,
    title: 'Linear Algebra Problem Set 1',
    instructions: 'Complete exercises 1.1 to 1.4 on Gaussian Elimination.',
    dueDate: '2026-11-12',
    totalPoints: 100,
    status: 'published',
  });

  assert(!baselinePubError && !!baselinePublished, 'Published assignment created successfully');
  const pubNotifs = getMockUserNotifications(studentId);
  assert(pubNotifs.length === 1, 'Exactly 1 notification received upon published assignment creation');
  assert(pubNotifs[0].type === 'assignment_created', 'Notification has type "assignment_created"');
  assert(pubNotifs[0].title === 'New Assignment Published', 'Notification title is "New Assignment Published"');
  assert(pubNotifs[0].link === '/student/assignments', 'Notification link routes to /student/assignments');
  assert(pubNotifs[0].idempotency_key === `assignment:${baselinePublished!.id}`, 'Idempotency key is assignment:${id}');

  // Clear notifications
  mockNotifications.length = 0;

  // 2. Draft Creation: Must Produce ZERO Notifications
  console.log('\n2. Draft Assignment Creation:');
  const { assignment: draftAssign, error: draftCreateError } = createMockAssignment({
    studentId,
    mentorId,
    title: 'Draft Matrix Decompositions Project',
    instructions: 'Detailed LU and QR decomposition specifications.',
    dueDate: '2026-11-20',
    totalPoints: 50,
    status: 'draft',
  });

  assert(!draftCreateError && !!draftAssign, 'Draft assignment created successfully');
  const draftCreateNotifs = getMockUserNotifications(studentId);
  assert(draftCreateNotifs.length === 0, 'Draft creation produces NO notification');

  // 3. Draft Metadata Update While Remaining Draft: Must Produce ZERO Notifications
  console.log('\n3. Draft Metadata Update (Remaining Draft):');
  const { assignment: updatedDraft, error: draftUpdateError } = updateMockAssignment(
    draftAssign!.id,
    {
      title: 'Draft Matrix Decompositions Project (Refined Draft)',
      instructions: 'Updated draft instructions for LU factoring.',
      due_date: '2026-11-22',
    },
    mentorId
  );

  assert(!draftUpdateError && !!updatedDraft, 'Draft metadata updated cleanly');
  const draftUpdateNotifs = getMockUserNotifications(studentId);
  assert(draftUpdateNotifs.length === 0, 'Draft metadata update while remaining draft produces NO notification');

  // 4. Draft -> Published: Must Generate Exactly ONE "assignment_created" Notification
  console.log('\n4. Draft -> Published Transition:');
  const { assignment: publishedDraft, error: pubDraftError } = updateMockAssignment(
    draftAssign!.id,
    { status: 'published' },
    mentorId
  );

  assert(!pubDraftError && !!publishedDraft && publishedDraft.status === 'published', 'Draft published successfully');
  const pubDraftNotifs = getMockUserNotifications(studentId);
  assert(pubDraftNotifs.length === 1, 'Draft -> Published produces exactly ONE notification');
  assert(pubDraftNotifs[0].type === 'assignment_created', 'Publication notification has type "assignment_created"');
  assert(pubDraftNotifs[0].title === 'New Assignment Published', 'Notification title is "New Assignment Published"');
  assert(
    pubDraftNotifs[0].message === `A new assignment has been published: "${publishedDraft.title}".`,
    'Message text matches required wording: A new assignment has been published: "${title}".'
  );
  assert(pubDraftNotifs[0].link === '/student/assignments', 'Link routes to canonical /student/assignments');
  assert(pubDraftNotifs[0].idempotency_key === `assignment:${draftAssign!.id}`, 'Publication uses key assignment:${id}');

  // 5. Repeated Publication (Already Published -> Published): Must NOT Duplicate Notification
  console.log('\n5. Repeated Publication Call:');
  const { assignment: repeatPub } = updateMockAssignment(
    draftAssign!.id,
    { status: 'published' },
    mentorId
  );
  assert(!!repeatPub, 'Repeated publication call succeeded');
  assert(getMockUserNotifications(studentId).length === 1, 'Repeated publication does not create a duplicate notification');

  // Clear notifications for metadata update tests
  mockNotifications.length = 0;

  // 6. Publication and Metadata Changes Together Produce ONE Publication Notification Only
  console.log('\n6. Draft Publication Combined with Metadata Changes:');
  const { assignment: draft2 } = createMockAssignment({
    studentId,
    mentorId,
    title: 'Draft SVD Analysis',
    status: 'draft',
  });
  assert(getMockUserNotifications(studentId).length === 0, 'Second draft created with no notification');

  const { assignment: pubWithMeta } = updateMockAssignment(
    draft2!.id,
    {
      title: 'Singular Value Decomposition Assignment',
      instructions: 'Compute singular values and plot energy spectrum.',
      due_date: '2026-11-25',
      status: 'published',
    },
    mentorId
  );
  assert(!!pubWithMeta && pubWithMeta.status === 'published', 'Published with simultaneous metadata update');
  const combinedNotifs = getMockUserNotifications(studentId);
  assert(combinedNotifs.length === 1, 'Simultaneous publication and metadata changes generate exactly ONE notification');
  assert(combinedNotifs[0].type === 'assignment_created', 'Combined transition generates publication notification (assignment_created)');
  assert(combinedNotifs[0].title === 'New Assignment Published', 'Title is "New Assignment Published"');

  // Clear notifications
  mockNotifications.length = 0;

  // 7. Published Title Change Generates ONE "assignment_updated"
  console.log('\n7. Published Assignment: Title Change:');
  const { assignment: titleUpdated, error: titleErr } = updateMockAssignment(
    baselinePublished!.id,
    { title: 'Linear Algebra Problem Set 1 (Comprehensive Vector Spaces)' },
    mentorId
  );

  assert(!titleErr && !!titleUpdated, 'Title updated successfully');
  const titleNotifs = getMockUserNotifications(studentId);
  assert(titleNotifs.length === 1, 'Title update produces exactly ONE notification');
  assert(titleNotifs[0].type === 'assignment_updated', 'Notification type is "assignment_updated"');
  assert(titleNotifs[0].title === 'Assignment Updated', 'Notification title is "Assignment Updated"');
  assert(
    titleNotifs[0].message === `Mentor updated assignment "${titleUpdated.title}".`,
    'Message text matches required: Mentor updated assignment "${title}".'
  );
  assert(titleNotifs[0].link === '/student/assignments', 'Link routes to /student/assignments');
  assert(
    titleNotifs[0].idempotency_key === `assignment_update:${baselinePublished!.id}:${titleUpdated.updated_at}`,
    'Idempotency key uses assignment_update:${id}:${updated_at}'
  );

  // Clear notifications
  mockNotifications.length = 0;

  // 8. Published Due Date (Deadline) Change Generates ONE "assignment_updated"
  console.log('\n8. Published Assignment: Due Date Change:');
  const { assignment: dueUpdated, error: dueErr } = updateMockAssignment(
    baselinePublished!.id,
    { due_date: '2026-11-18' },
    mentorId
  );

  assert(!dueErr && !!dueUpdated, 'Due date updated successfully');
  const dueNotifs = getMockUserNotifications(studentId);
  assert(dueNotifs.length === 1, 'Due date update produces exactly ONE notification');
  assert(dueNotifs[0].type === 'assignment_updated', 'Notification type is "assignment_updated"');
  assert(dueNotifs[0].title === 'Assignment Updated', 'Notification title is "Assignment Updated"');

  // Clear notifications
  mockNotifications.length = 0;

  // 9. Published Instructions Change Generates ONE "assignment_updated"
  console.log('\n9. Published Assignment: Instructions Change:');
  const { assignment: instUpdated, error: instErr } = updateMockAssignment(
    baselinePublished!.id,
    { instructions: 'Extended instructions: solve problems 1 through 8 and verify row echelon forms.' },
    mentorId
  );

  assert(!instErr && !!instUpdated, 'Instructions updated successfully');
  const instNotifs = getMockUserNotifications(studentId);
  assert(instNotifs.length === 1, 'Instructions update produces exactly ONE notification');
  assert(instNotifs[0].type === 'assignment_updated', 'Notification type is "assignment_updated"');
  assert(instNotifs[0].title === 'Assignment Updated', 'Notification title is "Assignment Updated"');

  // Clear notifications
  mockNotifications.length = 0;

  // 10. Multiple Approved Fields Changed Together Generate ONE Notification
  console.log('\n10. Multiple Approved Fields Changed Together (Title + Due Date + Instructions):');
  const { assignment: multiUpdated, error: multiErr } = updateMockAssignment(
    baselinePublished!.id,
    {
      title: 'Linear Algebra Problem Set 1 (Final Specification)',
      due_date: '2026-11-19',
      instructions: 'Final scope: Complete all section 1 questions.',
    },
    mentorId
  );

  assert(!multiErr && !!multiUpdated, 'Multi-field update succeeded');
  const multiNotifs = getMockUserNotifications(studentId);
  assert(multiNotifs.length === 1, 'Multiple approved changes together produce exactly ONE notification');
  assert(multiNotifs[0].type === 'assignment_updated', 'Notification type is "assignment_updated"');

  // Clear notifications
  mockNotifications.length = 0;

  // 11. Suppression: total_points-Only Update
  console.log('\n11. Suppression: total_points-Only Change:');
  const { assignment: ptsUpdated, error: ptsErr } = updateMockAssignment(
    baselinePublished!.id,
    { total_points: 75 },
    mentorId
  );

  assert(!ptsErr && !!ptsUpdated && ptsUpdated.total_points === 75, 'total_points updated');
  const ptsNotifs = getMockUserNotifications(studentId);
  assert(ptsNotifs.length === 0, 'total_points-only update generates NO notification');

  // 12. Suppression: subject_id-Only Update
  console.log('\n12. Suppression: subject_id-Only Change:');
  const { assignment: subUpdated, error: subErr } = updateMockAssignment(
    baselinePublished!.id,
    { subject_id: 'mock-sub-math-102' },
    mentorId
  );

  assert(!subErr && !!subUpdated, 'subject_id updated');
  const subNotifs = getMockUserNotifications(studentId);
  assert(subNotifs.length === 0, 'subject_id-only update generates NO notification');

  // 13. Suppression: plan_id-Only Update
  console.log('\n13. Suppression: plan_id-Only Change:');
  const { assignment: planUpdated, error: planErr } = updateMockAssignment(
    baselinePublished!.id,
    { plan_id: 'mock-plan-phy-001' },
    mentorId
  );

  assert(!planErr && !!planUpdated, 'plan_id updated');
  const planNotifs = getMockUserNotifications(studentId);
  assert(planNotifs.length === 0, 'plan_id-only update generates NO notification');

  // 14. Suppression: Closing or Archiving Assignment
  console.log('\n14. Suppression: Closing or Archiving Status Transition:');
  const { assignment: closedAssign, error: closeErr } = updateMockAssignment(
    baselinePublished!.id,
    { status: 'closed' },
    mentorId
  );

  assert(!closeErr && !!closedAssign && closedAssign.status === 'closed', 'Assignment status set to closed');
  const closeNotifs = getMockUserNotifications(studentId);
  assert(closeNotifs.length === 0, 'Closing assignment generates NO notification');

  // Re-open for subsequent tests
  updateMockAssignment(baselinePublished!.id, { status: 'published' }, mentorId);
  mockNotifications.length = 0;

  // 15. Suppression: Closing in the Same Update as Metadata Changes
  console.log('\n15. Suppression: Closing in the Same Update as Metadata Changes:');
  const { assignment: closeWithMeta, error: closeMetaErr } = updateMockAssignment(
    baselinePublished!.id,
    {
      title: 'Attempted Change On Closure',
      due_date: '2026-11-30',
      status: 'closed',
    },
    mentorId
  );

  assert(!closeMetaErr && !!closeWithMeta && closeWithMeta.status === 'closed', 'Assignment closed with simultaneous metadata update');
  const closeMetaNotifs = getMockUserNotifications(studentId);
  assert(closeMetaNotifs.length === 0, 'Closing with simultaneous metadata changes suppresses metadata notification');

  // Re-open baseline
  updateMockAssignment(baselinePublished!.id, { status: 'published' }, mentorId);
  mockNotifications.length = 0;

  // 16. Suppression: No-Op Update (Identical values)
  console.log('\n16. Suppression: No-Op Update:');
  const currentBaseline = mockAssignments.find((a) => a.id === baselinePublished!.id)!;
  const { assignment: noopAssign, error: noopErr } = updateMockAssignment(
    baselinePublished!.id,
    {
      title: currentBaseline.title,
      instructions: currentBaseline.instructions || undefined,
      due_date: currentBaseline.due_date || undefined,
      total_points: currentBaseline.total_points || undefined,
      status: currentBaseline.status,
    },
    mentorId
  );

  assert(!noopErr && !!noopAssign, 'No-op update executed cleanly');
  const noopNotifs = getMockUserNotifications(studentId);
  assert(noopNotifs.length === 0, 'No-op update generates NO notification');

  // 17. Suppression: Failed Updates
  console.log('\n17. Suppression: Failed Updates:');
  const { error: nonExistentErr } = updateMockAssignment('non-existent-assign-id', { title: 'Ghost' }, mentorId);
  assert(!!nonExistentErr, 'Non-existent assignment returns error');

  const { error: emptyTitleErr } = updateMockAssignment(baselinePublished!.id, { title: '   ' }, mentorId);
  assert(!!emptyTitleErr, 'Empty title returns error');

  const failNotifs = getMockUserNotifications(studentId);
  assert(failNotifs.length === 0, 'Failed updates generate NO notification');

  // 18. Idempotency Key Deduplication Check
  console.log('\n18. Idempotency Key Deduplication:');
  mockNotifications.length = 0;

  const { assignment: dedupeAssign } = updateMockAssignment(
    baselinePublished!.id,
    { title: 'Linear Algebra Final Review Problem Set' },
    mentorId
  );

  assert(!!dedupeAssign, 'Assignment updated for deduplication test');
  assert(mockNotifications.length === 1, 'Initial notification created');
  const initialKey = mockNotifications[0].idempotency_key;

  // Retry with duplicate key
  const { notification: dupeNotif } = createMockNotification({
    recipientId: studentId,
    actorId: mentorId,
    type: 'assignment_updated',
    title: 'Assignment Updated',
    message: 'Retry attempt with same key',
    link: '/student/assignments',
    idempotencyKey: initialKey,
  });

  assert(!!dupeNotif, 'Duplicate call returned existing notification');
  assert(mockNotifications.length === 1, 'Duplicate with same idempotency key did not increase count');

  // Subsequent distinct update after timestamp advance
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
  await sleep(10);

  const { assignment: secondAssign } = updateMockAssignment(
    baselinePublished!.id,
    { title: 'Linear Algebra Final Review Problem Set (v2)' },
    mentorId
  );

  assert(!!secondAssign, 'Second distinct update succeeded');
  assert(mockNotifications.length === 2, 'Second distinct update created a second notification');
  assert(
    mockNotifications[0].idempotency_key !== mockNotifications[1].idempotency_key,
    'Each distinct update receives a unique timestamp-based idempotency key'
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

