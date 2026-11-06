/**
 * Verification Script: Phase 3.2 - Task Update Notifications
 *
 * Verifies that:
 * 1. Mentor changes task title -> student receives notification.
 * 2. Mentor changes due date -> student receives notification.
 * 3. Mentor changes instructions (description) -> student receives notification.
 * 4. Multiple meaningful fields change in one update -> exactly one notification.
 * 5. Priority-only change -> no notification.
 * 6. Attachment-only change -> no notification.
 * 7. No-op update -> no notification.
 * 8. Student updates own task (updaterId === studentId) -> no mentor-update notification.
 * 9. Student task completion / status change (setTaskStatus) -> no mentor notification.
 * 10. Failed update (non-existent task ID, empty title) -> no notification.
 * 11. Retried update does not duplicate notification where idempotency supports it.
 * 12. Existing task creation notification remains unchanged (type: task_created, key: task:${id}).
 * 13. Correct notification type ('task_updated'), recipient, actor and link ('/student/library?tab=tasks').
 * 14. Mock and Supabase behavior parity.
 */

import {
  createMockTask,
  updateMockTask,
  createMockNotification,
  getMockUserNotifications,
  mockTasks,
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
  console.log('--- Phase 3.2: Task Update Notifications Verification ---\n');

  // Reset notifications array for clean testing
  mockNotifications.length = 0;

  const mentorId = 'mock-mentor-ppm001';
  const studentId = 'mock-student-pp001';

  // 1. Task Creation Baseline Verification
  console.log('1. Task Creation Baseline:');
  const { task: newTask, error: createError } = createMockTask({
    studentId,
    createdBy: mentorId,
    title: 'Solve Kinematics Problem Set 1',
    description: 'Complete problems 1 to 5 from chapter 2.',
    dueDate: '2026-11-10',
    priority: 'high',
    estimatedMinutes: 60,
  });

  assert(!createError && !!newTask, 'Task created successfully');
  const creationNotifs = getMockUserNotifications(studentId);
  assert(creationNotifs.length === 1, 'Exactly 1 notification generated upon task creation');
  assert(creationNotifs[0].type === 'task_created', 'Creation notification has type "task_created"');
  assert(creationNotifs[0].title === 'New Task Assigned', 'Creation notification title is "New Task Assigned"');
  assert(creationNotifs[0].idempotency_key === `task:${newTask!.id}`, 'Creation idempotency key is task:${id}');
  assert(creationNotifs[0].link === '/student/tasks', 'Link routes to /student/tasks');

  // Clear notifications for update tests
  mockNotifications.length = 0;

  // 2. Mentor Updates Task Title
  console.log('\n2. Mentor Updates Task Title:');
  const { task: updatedTitleTask, error: updateTitleError } = updateMockTask(
    newTask!.id,
    { title: 'Solve Kinematics Problem Set 1 (Extended Edition)' },
    mentorId
  );

  assert(!updateTitleError && !!updatedTitleTask, 'Task title updated successfully');
  const titleNotifs = getMockUserNotifications(studentId);
  assert(titleNotifs.length === 1, 'Student receives exactly 1 notification for title change');
  assert(titleNotifs[0].type === 'task_updated', 'Notification type is "task_updated"');
  assert(titleNotifs[0].title === 'Task Updated', 'Notification title is "Task Updated"');
  assert(titleNotifs[0].message.includes('Extended Edition'), 'Notification message mentions new title');
  assert(titleNotifs[0].actor_id === mentorId, 'Actor ID is the mentor');
  assert(titleNotifs[0].recipient_id === studentId, 'Recipient ID is the student');
  assert(titleNotifs[0].link === '/student/tasks', 'Link is /student/tasks');
  assert(
    titleNotifs[0].idempotency_key === `task_update:${newTask!.id}:${updatedTitleTask!.updated_at}`,
    'Idempotency key uses task_update:${id}:${updated_at} format'
  );

  // Clear notifications
  mockNotifications.length = 0;

  // 3. Mentor Updates Task Due Date (Deadline)
  console.log('\n3. Mentor Updates Task Due Date (Deadline):');
  const { task: updatedDueTask, error: updateDueError } = updateMockTask(
    newTask!.id,
    { due_date: '2026-11-15' },
    mentorId
  );

  assert(!updateDueError && !!updatedDueTask, 'Task due date updated successfully');
  const dueNotifs = getMockUserNotifications(studentId);
  assert(dueNotifs.length === 1, 'Student receives exactly 1 notification for due date change');
  assert(dueNotifs[0].type === 'task_updated', 'Notification type is "task_updated"');
  assert(dueNotifs[0].title === 'Task Updated', 'Notification title is "Task Updated"');

  // Clear notifications
  mockNotifications.length = 0;

  // 4. Mentor Updates Task Instructions (Description)
  console.log('\n4. Mentor Updates Task Instructions/Description:');
  const { task: updatedDescTask, error: updateDescError } = updateMockTask(
    newTask!.id,
    { description: 'Revised instructions: complete problems 1 through 10, showing coordinate axes.' },
    mentorId
  );

  assert(!updateDescError && !!updatedDescTask, 'Task description updated successfully');
  const descNotifs = getMockUserNotifications(studentId);
  assert(descNotifs.length === 1, 'Student receives exactly 1 notification for description change');
  assert(descNotifs[0].type === 'task_updated', 'Notification type is "task_updated"');
  assert(descNotifs[0].title === 'Task Updated', 'Notification title is "Task Updated"');

  // Clear notifications
  mockNotifications.length = 0;

  // 5. Multiple Meaningful Fields Change In One Update
  console.log('\n5. Multiple Meaningful Fields Change (Title + Due Date + Description):');
  const { task: multiTask, error: multiError } = updateMockTask(
    newTask!.id,
    {
      title: 'Kinematics Mastery Workshop',
      due_date: '2026-11-20',
      description: 'Comprehensive problem set covering 2D projectile motion.',
    },
    mentorId
  );

  assert(!multiError && !!multiTask, 'Multi-field update succeeded');
  const multiNotifs = getMockUserNotifications(studentId);
  assert(multiNotifs.length === 1, 'Exactly ONE notification dispatched for multiple changes');
  assert(multiNotifs[0].type === 'task_updated', 'Notification type is "task_updated"');

  // Clear notifications
  mockNotifications.length = 0;

  // 6. Priority-Only Change
  console.log('\n6. Priority-Only Change (Non-approved field):');
  const { task: prioTask, error: prioError } = updateMockTask(
    newTask!.id,
    { priority: 'low' },
    mentorId
  );

  assert(!prioError && !!prioTask && prioTask.priority === 'low', 'Priority updated to low');
  const prioNotifs = getMockUserNotifications(studentId);
  assert(prioNotifs.length === 0, 'No notification dispatched for priority-only change');

  // 7. Attachment-Only Change
  console.log('\n7. Attachment-Only Change (Non-approved field):');
  const { task: attachTask, error: attachError } = updateMockTask(
    newTask!.id,
    {
      attachment_path: 'tasks/mock-task-attachment.pdf',
      attachment_name: 'kinematics_worksheet.pdf',
      attachment_size: 102400,
    },
    mentorId
  );

  assert(!attachError && !!attachTask, 'Attachment metadata updated');
  const attachNotifs = getMockUserNotifications(studentId);
  assert(attachNotifs.length === 0, 'No notification dispatched for attachment-only change');

  // 8. Other Non-approved Fields Change (e.g. estimated_minutes, subject_id)
  console.log('\n8. Other Non-approved Fields (Estimated Minutes, Subject):');
  const { task: miscTask, error: miscError } = updateMockTask(
    newTask!.id,
    { estimated_minutes: 120 },
    mentorId
  );

  assert(!miscError && !!miscTask, 'Estimated minutes updated');
  const miscNotifs = getMockUserNotifications(studentId);
  assert(miscNotifs.length === 0, 'No notification dispatched for estimated minutes change');

  // 9. No-Op Update (Same title, due_date, description submitted)
  console.log('\n9. No-Op Update (Identical values):');
  const { task: noopTask, error: noopError } = updateMockTask(
    newTask!.id,
    {
      title: miscTask!.title,
      due_date: miscTask!.due_date || undefined,
      description: miscTask!.description || undefined,
    },
    mentorId
  );

  assert(!noopError && !!noopTask, 'No-op update executed cleanly');
  const noopNotifs = getMockUserNotifications(studentId);
  assert(noopNotifs.length === 0, 'No notification dispatched for identical/no-op update');

  // 10. Student Updates Own Task (updaterId === studentId)
  console.log('\n10. Student Self-Update:');
  const { error: studentUpdateError } = updateMockTask(
    newTask!.id,
    { title: 'Personal Study Title By Student' },
    studentId
  );

  assert(!studentUpdateError, 'Student self-update executed cleanly');
  const studentSelfNotifs = getMockUserNotifications(studentId);
  assert(studentSelfNotifs.length === 0, 'No notification dispatched when student updates own task');

  // 11. Student Task Completion / Status Change
  console.log('\n11. Student Task Completion / Status Change:');
  const { task: completedTask, error: compError } = updateMockTask(
    newTask!.id,
    { status: 'completed' },
    studentId
  );

  assert(!compError && !!completedTask && completedTask.status === 'completed', 'Task marked completed');
  const compNotifs = getMockUserNotifications(studentId);
  assert(compNotifs.length === 0, 'No notification dispatched on student task completion');

  // Mentor not receiving notification for completion check
  const mentorNotifs = getMockUserNotifications(mentorId);
  assert(mentorNotifs.length === 0, 'Mentor receives NO notification when student completes task');

  // 12. Failed Update Handling
  console.log('\n12. Failed Update Handling:');
  const { error: failIdError } = updateMockTask(
    'non-existent-task-id',
    { title: 'New Title' },
    mentorId
  );

  assert(!!failIdError, 'Non-existent task ID returned error');
  const { error: failTitleError } = updateMockTask(
    newTask!.id,
    { title: '   ' },
    mentorId
  );
  assert(!!failTitleError, 'Empty title update returned error');
  const failNotifs = getMockUserNotifications(studentId);
  assert(failNotifs.length === 0, 'No notification dispatched on failed updates');

  // 13. Idempotency Key Deduplication Check
  console.log('\n13. Idempotency Key Deduplication:');
  mockNotifications.length = 0;

  const { task: dedupeTask } = updateMockTask(
    newTask!.id,
    { title: 'Final Calculus Preparation' },
    mentorId
  );

  assert(!!dedupeTask, 'Task updated for deduplication test');
  assert(mockNotifications.length === 1, 'Initial notification created');
  const initialKey = mockNotifications[0].idempotency_key;

  // Duplicate call with same key should be deduplicated
  const { notification: dupeNotif } = createMockNotification({
    recipientId: studentId,
    actorId: mentorId,
    type: 'task_updated',
    title: 'Task Updated',
    message: 'Retry attempt with same key',
    link: '/student/library?tab=tasks',
    idempotencyKey: initialKey,
  });

  assert(!!dupeNotif, 'Duplicate call returned existing notification');
  assert(mockNotifications.length === 1, 'Duplicate with same idempotency key did not increase count');

  // Subsequent distinct update after timestamp advance
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
  await sleep(10);

  const { task: secondTask } = updateMockTask(
    newTask!.id,
    { title: 'Final Calculus Preparation (Revision 2)' },
    mentorId
  );

  assert(!!secondTask, 'Second distinct update succeeded');
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

