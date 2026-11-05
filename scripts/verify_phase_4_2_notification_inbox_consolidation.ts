/**
 * PoraPlan — Phase 4.2: Notification Inbox Consolidation Verification Suite
 *
 * Verifies:
 * 1. Shared Inbox Consolidation across Student, Mentor, and Admin roles
 * 2. Notification Metadata mapping for all types, specifically newly surfaced types:
 *    - submission_created
 *    - doubt_created
 *    - application_submitted
 *    - capacity_alert
 * 3. Consistent styling, no emojis, valid badge variants
 * 4. Reliable Inbox Refresh & Polling lifecycle (events, 30s interval, cleanup, in-flight guard)
 * 5. Role-specific data isolation and read/unread actions
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  createMockNotification,
  getMockUserNotifications,
  markMockNotificationAsRead,
  markAllMockNotificationsAsRead,
  deleteMockNotification,
} from '../src/lib/mockAuthStore';
import { getNotificationTypeMeta } from '../src/lib/notificationMeta';
import type { NotificationType } from '../src/types/database';
import type { BadgeVariant } from '../src/components/common/Badge';

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

const VALID_BADGE_VARIANTS: BadgeVariant[] = ['gold', 'teal', 'navy', 'paper', 'muted', 'danger'];

// Unicode emoji range regex
const EMOJI_REGEX = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;

async function runSuite() {
  console.log('\n================================================================');
  console.log(' PoraPlan — Phase 4.2: Notification Inbox Consolidation Verification');
  console.log('================================================================\n');

  // ---------------------------------------------------------------------------
  // Suite 1: Shared Inbox Consolidation Static Architecture Audit
  // ---------------------------------------------------------------------------
  console.log('--- Suite 1: Shared Inbox Consolidation Architecture ---');

  const studentPageSrc = readFileSync(
    resolve(__dirname, '../src/pages/dashboard/StudentNotificationsPage.tsx'),
    'utf8'
  );
  assert(
    studentPageSrc.includes("import { NotificationInbox } from '../../components/notifications/NotificationInbox'"),
    'StudentNotificationsPage imports the shared NotificationInbox component'
  );
  assert(
    studentPageSrc.includes('<NotificationInbox') && studentPageSrc.includes('role="student"'),
    'StudentNotificationsPage delegates rendering directly to NotificationInbox with role="student"'
  );
  assert(
    studentPageSrc.split('\n').length <= 25,
    'StudentNotificationsPage is consolidated from ~558 lines into a concise role wrapper'
  );

  const mentorPageSrc = readFileSync(
    resolve(__dirname, '../src/pages/dashboard/MentorNotificationsPage.tsx'),
    'utf8'
  );
  assert(
    mentorPageSrc.includes('<NotificationInbox') && mentorPageSrc.includes('role="mentor"'),
    'MentorNotificationsPage preserves existing role="mentor" delegation'
  );

  const adminPageSrc = readFileSync(
    resolve(__dirname, '../src/pages/dashboard/AdminNotificationsPage.tsx'),
    'utf8'
  );
  assert(
    adminPageSrc.includes('<NotificationInbox') && adminPageSrc.includes('role="admin"'),
    'AdminNotificationsPage preserves existing role="admin" delegation'
  );

  // ---------------------------------------------------------------------------
  // Suite 2: Notification Metadata Consistency (Phase 3.5 Missing Types)
  // ---------------------------------------------------------------------------
  console.log('\n--- Suite 2: Notification Metadata Consistency & Completeness ---');

  // 1. submission_created
  const subMetaStudent = getNotificationTypeMeta('submission_created', 'student');
  assert(subMetaStudent.label === 'Submission', 'submission_created maps to label "Submission"');
  assert(subMetaStudent.actionText === 'View Submission', 'submission_created provides student action "View Submission"');
  assert(VALID_BADGE_VARIANTS.includes(subMetaStudent.badgeVariant), 'submission_created uses valid badgeVariant');
  assert(!EMOJI_REGEX.test(subMetaStudent.label) && !EMOJI_REGEX.test(subMetaStudent.actionText), 'submission_created is emoji-free');

  const subMetaMentor = getNotificationTypeMeta('submission_created', 'mentor');
  assert(subMetaMentor.actionText === 'Review Submission', 'submission_created provides mentor action "Review Submission"');

  // 2. doubt_created
  const doubtMeta = getNotificationTypeMeta('doubt_created', 'student');
  assert(doubtMeta.label === 'New Doubt', 'doubt_created maps to label "New Doubt"');
  assert(doubtMeta.actionText === 'Open Doubt', 'doubt_created provides action "Open Doubt"');
  assert(VALID_BADGE_VARIANTS.includes(doubtMeta.badgeVariant), 'doubt_created uses valid badgeVariant');
  assert(!EMOJI_REGEX.test(doubtMeta.label), 'doubt_created is emoji-free');

  // 3. application_submitted
  const appMetaStudent = getNotificationTypeMeta('application_submitted', 'student');
  assert(appMetaStudent.label === 'Application', 'application_submitted maps to label "Application"');
  assert(appMetaStudent.actionText === 'View Application', 'application_submitted provides student action "View Application"');
  assert(VALID_BADGE_VARIANTS.includes(appMetaStudent.badgeVariant), 'application_submitted uses valid badgeVariant');
  assert(!EMOJI_REGEX.test(appMetaStudent.label), 'application_submitted is emoji-free');

  const appMetaAdmin = getNotificationTypeMeta('application_submitted', 'admin');
  assert(appMetaAdmin.actionText === 'Review Application', 'application_submitted provides admin action "Review Application"');

  // 4. capacity_alert
  const capMetaStudent = getNotificationTypeMeta('capacity_alert', 'student');
  assert(capMetaStudent.label === 'Capacity Alert', 'capacity_alert maps to label "Capacity Alert"');
  assert(capMetaStudent.actionText === 'View Details', 'capacity_alert provides student action "View Details"');
  assert(VALID_BADGE_VARIANTS.includes(capMetaStudent.badgeVariant), 'capacity_alert uses valid badgeVariant');
  assert(!EMOJI_REGEX.test(capMetaStudent.label), 'capacity_alert is emoji-free');

  const capMetaAdmin = getNotificationTypeMeta('capacity_alert', 'admin');
  assert(capMetaAdmin.actionText === 'View Cohorts', 'capacity_alert provides admin action "View Cohorts"');

  // 5. Existing notification types regression test
  const existingTypes: NotificationType[] = [
    'task_created',
    'task_updated',
    'assignment_created',
    'assignment_updated',
    'assignment_deadline_reminder',
    'submission_reviewed',
    'doubt_replied',
    'evaluation_published',
    'announcement_published',
    'plan_updated',
    'resource_published',
    'system',
  ];

  for (const t of existingTypes) {
    const meta = getNotificationTypeMeta(t, 'student');
    assert(Boolean(meta.label && meta.icon && meta.badgeVariant && meta.actionText), `Metadata intact for existing type: ${t}`);
    assert(VALID_BADGE_VARIANTS.includes(meta.badgeVariant), `Valid badge variant for existing type: ${t}`);
    assert(!EMOJI_REGEX.test(meta.label) && !EMOJI_REGEX.test(meta.actionText), `Emoji-free text for existing type: ${t}`);
  }

  // ---------------------------------------------------------------------------
  // Suite 3: Reliable Inbox Refresh & Polling Lifecycle
  // ---------------------------------------------------------------------------
  console.log('\n--- Suite 3: Reliable Inbox Refresh & Polling Lifecycle ---');

  const inboxSrc = readFileSync(
    resolve(__dirname, '../src/components/notifications/NotificationInbox.tsx'),
    'utf8'
  );

  // 1. Event listener setup & cleanup
  assert(
    inboxSrc.includes("window.addEventListener('notifications-updated', handleUpdate)"),
    'Inbox registers notifications-updated event listener'
  );
  assert(
    inboxSrc.includes("window.removeEventListener('notifications-updated', handleUpdate)"),
    'Inbox cleans up notifications-updated event listener on unmount'
  );

  // 2. 30-second fallback polling
  assert(
    inboxSrc.includes('setInterval(') && inboxSrc.includes('30000'),
    'Inbox establishes 30-second fallback polling interval'
  );
  assert(
    inboxSrc.includes('clearInterval(intervalId)'),
    'Inbox clears 30-second fallback polling interval on unmount'
  );

  // 3. Overlapping request prevention & mount guard
  assert(
    inboxSrc.includes('inFlightRef.current') && inboxSrc.includes('if (inFlightRef.current) return;'),
    'Inbox guards against overlapping concurrent refresh requests using inFlightRef'
  );
  assert(
    inboxSrc.includes('isMountedRef.current = false'),
    'Inbox guards against state updates after unmount using isMountedRef'
  );

  // 4. Stable effect dependencies
  assert(
    inboxSrc.includes('[fetchNotifications]') && inboxSrc.includes('useCallback(') && inboxSrc.includes('[userId]'),
    'fetchNotifications is memoized strictly on userId to prevent duplicate interval churn on rerenders'
  );

  // 5. Manual refresh button preservation
  assert(
    inboxSrc.includes('fetchNotifications(true)') && inboxSrc.includes('Refresh'),
    'Manual refresh button triggers active refresh with loading state'
  );

  // 6. Header unread-count polling preservation in DashboardLayout
  const layoutSrc = readFileSync(
    resolve(__dirname, '../src/layouts/DashboardLayout.tsx'),
    'utf8'
  );
  assert(
    layoutSrc.includes('setInterval(fetchUnread, 15000)'),
    'DashboardLayout preserves independent 15-second unread-count header polling'
  );
  assert(
    layoutSrc.includes("window.addEventListener('notifications-updated', handleUpdate)"),
    'DashboardLayout listens to notifications-updated to refresh bell badge immediately'
  );

  // ---------------------------------------------------------------------------
  // Suite 4: Role-Specific Data Isolation & Action Execution
  // ---------------------------------------------------------------------------
  console.log('\n--- Suite 4: Role-Specific Data Isolation & Action Execution ---');

  // Seed a test notification for mock student
  const testNotifRes = createMockNotification({
    recipientId: 'mock-student-pp001',
    actorId: 'mock-mentor-ppm001',
    type: 'task_created',
    title: 'Phase 4.2 Inbox Verification Task',
    message: 'Testing shared inbox role isolation and actions.',
    link: '/student/library?tab=tasks',
    idempotencyKey: `p42_test_notif:${Date.now()}`,
  });
  assert(Boolean(testNotifRes.notification?.id), 'Test notification created for student');
  const testNotifId = testNotifRes.notification!.id;

  // Student inbox fetches student's notifications
  const studentList = getMockUserNotifications('mock-student-pp001');
  const foundInStudent = studentList.some((n) => n.id === testNotifId);
  assert(foundInStudent, 'Notification appears in student notification list');

  // Mentor inbox for another user does not leak student's notification
  const mentorList = getMockUserNotifications('mock-mentor-ppm001');
  const foundInMentor = mentorList.some((n) => n.id === testNotifId);
  assert(!foundInMentor, 'Notification is strictly isolated and does not leak to mentor inbox');

  // Mark as read action
  const markRes = markMockNotificationAsRead(testNotifId, 'mock-student-pp001');
  assert(markRes.notification?.read === true, 'markNotificationAsRead succeeds for student notification');

  // Mark all as read action
  const markAllRes = markAllMockNotificationsAsRead('mock-student-pp001');
  assert(markAllRes.error === null, 'markAllNotificationsAsRead succeeds cleanly for student');

  // Delete notification action
  const delRes = deleteMockNotification(testNotifId, 'mock-student-pp001');
  assert(delRes.success === true, 'deleteNotification removes notification cleanly from inbox');

  const afterDelList = getMockUserNotifications('mock-student-pp001');
  assert(!afterDelList.some((n) => n.id === testNotifId), 'Deleted notification is no longer in inbox');

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
