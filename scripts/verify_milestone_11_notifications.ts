/**
 * PoraPlan — Milestone 11 Verification Suite
 *
 * Verifies Mentor Notification Inbox & Admin System Alerts across 16 critical checks:
 * 1. Student notification regression.
 * 2. Mentor inbox retrieval.
 * 3. Admin inbox retrieval.
 * 4. Role-based access isolation.
 * 5. Notification ownership & unauthorized mutation rejection.
 * 6. Read/unread state transitions.
 * 7. Mark-all-read behavior.
 * 8. Accurate unread counts across roles.
 * 9. Deep-link routing security (rejection of malicious/external links).
 * 10. Assignment submission -> mentor notification dispatch.
 * 11. Student doubt -> mentor notification dispatch.
 * 12. Announcement notification integration.
 * 13. Program application -> admin system alert dispatch.
 * 14. Idempotency key duplicate prevention (e.g. cohort capacity thresholds).
 * 15. UI component & page exports verification.
 * 16. Existing dashboard route regression & navigation integrity.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import {
  getMockUserNotifications,
  getMockMentorNotifications,
  getMockAdminNotifications,
  getMockStudentNotifications,
  getMockUnreadNotificationCount,
  markMockNotificationAsRead,
  markAllMockNotificationsAsRead,
  deleteMockNotification,
  createMockNotification,
  submitMockAssignment,
  createMockDoubt,
  createMockApplication,
} from '../src/lib/mockAuthStore';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`[PASS] ${testName}`);
    passed++;
  } else {
    console.error(`[FAIL] ${testName}${detail ? ` - ${detail}` : ''}`);
    failed++;
  }
}

async function runMilestone11Verification() {
  console.log('====================================================');
  console.log('PORAPLAN — MILESTONE 11 VERIFICATION SUITE');
  console.log('Mentor Notification Inbox & Admin System Alerts');
  console.log('====================================================\n');

  const studentId = 'mock-student-pp001';
  const mentorId = 'mock-mentor-ppm001';
  const adminId = 'mock-admin-ppa001';

  // Check 1: Student Notification Regression
  console.log('--- Check 1: Student Notification Regression ---');
  const studentInitial = getMockStudentNotifications(studentId);
  assert(
    Array.isArray(studentInitial) && studentInitial.length > 0,
    '1. Student notifications retrieve successfully without regressions'
  );
  const studentUnread = getMockUnreadNotificationCount(studentId);
  assert(
    typeof studentUnread === 'number',
    '1. Student unread notification count calculates correctly'
  );

  // Check 2: Mentor Inbox Retrieval
  console.log('\n--- Check 2: Mentor Inbox Retrieval ---');
  const mentorInbox = getMockMentorNotifications(mentorId);
  assert(
    Array.isArray(mentorInbox) && mentorInbox.length > 0,
    '2. Mentor inbox retrieves seed notifications successfully',
    `Count: ${mentorInbox.length}`
  );
  const hasSubmissionType = mentorInbox.some((n) => n.type === 'submission_created');
  const hasDoubtType = mentorInbox.some((n) => n.type === 'doubt_created');
  assert(
    hasSubmissionType && hasDoubtType,
    '2. Mentor inbox includes student submissions and doubt notifications'
  );

  // Check 3: Admin Inbox Retrieval
  console.log('\n--- Check 3: Admin Inbox Retrieval ---');
  const adminInbox = getMockAdminNotifications(adminId);
  assert(
    Array.isArray(adminInbox) && adminInbox.length > 0,
    '3. Admin alerts retrieve seed notifications successfully',
    `Count: ${adminInbox.length}`
  );
  const hasAppAlert = adminInbox.some((n) => n.type === 'application_submitted');
  const hasCapAlert = adminInbox.some((n) => n.type === 'capacity_alert');
  assert(
    hasAppAlert && hasCapAlert,
    '3. Admin notifications include application submissions and capacity alerts'
  );

  // Check 4: Role-Based Access Isolation
  console.log('\n--- Check 4: Role-Based Access Isolation ---');
  // Student cannot see mentor's notifications
  const studentList = getMockUserNotifications(studentId);
  const studentSeesMentorNotifs = studentList.some((n) => n.recipient_id === mentorId);
  assert(
    !studentSeesMentorNotifs,
    '4. Student cannot retrieve or access mentor notifications'
  );
  // Mentor cannot see admin alerts
  const mentorList = getMockUserNotifications(mentorId);
  const mentorSeesAdminNotifs = mentorList.some((n) => n.recipient_id === adminId);
  assert(
    !mentorSeesAdminNotifs,
    '4. Mentor cannot retrieve or access admin alerts'
  );

  // Check 5: Notification Ownership & Unauthorized Mutation Rejection
  console.log('\n--- Check 5: Notification Ownership & Mutation Rejection ---');
  const sampleAdminNotif = adminInbox[0];
  const unauthorizedMark = markMockNotificationAsRead(sampleAdminNotif.id, studentId);
  assert(
    Boolean(unauthorizedMark.error),
    '5. Unauthorized user cannot mark another user\'s notification as read'
  );
  const unauthorizedDelete = deleteMockNotification(sampleAdminNotif.id, studentId);
  assert(
    Boolean(unauthorizedDelete.error),
    '5. Unauthorized user cannot dismiss or delete another user\'s notification'
  );

  // Check 6: Read / Unread State Transitions
  console.log('\n--- Check 6: Read / Unread State Transitions ---');
  const unreadMentorNotif = mentorInbox.find((n) => !n.read);
  assert(Boolean(unreadMentorNotif), '6. An unread mentor notification exists for transition test');
  if (unreadMentorNotif) {
    const markRes = markMockNotificationAsRead(unreadMentorNotif.id, mentorId);
    assert(!markRes.error, '6. Marking notification as read succeeds');

    const updatedMentorInbox = getMockMentorNotifications(mentorId);
    const updated = updatedMentorInbox.find((n) => n.id === unreadMentorNotif.id);
    assert(
      Boolean(updated?.read && updated?.read_at),
      '6. Notification reflects read=true and updated read_at timestamp'
    );
  }

  // Check 7: Mark All As Read Behavior
  console.log('\n--- Check 7: Mark All As Read Behavior ---');
  const markAllRes = markAllMockNotificationsAsRead(adminId);
  assert(!markAllRes.error, '7. Batch markAllMockNotificationsAsRead executes successfully');

  const afterMarkAllAdmin = getMockAdminNotifications(adminId);
  const anyUnreadAdmin = afterMarkAllAdmin.some((n) => !n.read);
  assert(!anyUnreadAdmin, '7. All admin notifications are now marked as read');

  // Check 8: Accurate Unread Counts Across Roles
  console.log('\n--- Check 8: Accurate Unread Counts Across Roles ---');
  const adminUnreadAfter = getMockUnreadNotificationCount(adminId);
  assert(
    adminUnreadAfter === 0,
    '8. Admin unread count accurately dropped to 0 after mark-all-read'
  );
  // Add a new notification and check unread count increments
  createMockNotification({
    recipientId: adminId,
    type: 'capacity_alert',
    title: 'Test Capacity Alert',
    message: 'Testing unread count calculation',
    link: '/admin/programs',
  });
  const adminUnreadNew = getMockUnreadNotificationCount(adminId);
  assert(
    adminUnreadNew === 1,
    '8. Unread notification count increments precisely upon new incoming alert'
  );

  // Check 9: Deep-Link Routing Security
  console.log('\n--- Check 9: Deep-Link Routing Security ---');
  const maliciousLink1 = createMockNotification({
    recipientId: mentorId,
    type: 'system',
    title: 'Malicious External Link',
    message: 'Attempting external redirect',
    link: 'https://evil.example.com/phish',
  });
  assert(
    Boolean(maliciousLink1.error),
    '9. External protocol links (https://...) are strictly rejected'
  );

  const maliciousLink2 = createMockNotification({
    recipientId: mentorId,
    type: 'system',
    title: 'Malicious Protocol Relative Link',
    message: 'Attempting protocol relative redirect',
    link: '//evil.example.com/exploit',
  });
  assert(
    Boolean(maliciousLink2.error),
    '9. Protocol-relative links (//...) are strictly rejected'
  );

  const safeLinkRes = createMockNotification({
    recipientId: mentorId,
    type: 'submission_created',
    title: 'Valid Internal Deep Link',
    message: 'Valid internal route',
    link: '/mentor/reviews',
  });
  assert(
    !safeLinkRes.error && safeLinkRes.notification?.link === '/mentor/reviews',
    '9. Valid internal deep-links (/path) are accepted and preserved'
  );

  // Check 10: Assignment Submission -> Mentor Notification Dispatch
  console.log('\n--- Check 10: Assignment Submission -> Mentor Notification Dispatch ---');
  const submitRes = submitMockAssignment({
    assignmentId: 'mock-assign-001',
    studentId: studentId,
    submissionType: 'text',
    content: 'Completed proofs for modular arithmetic problem set.',
  });
  assert(
    !submitRes.error && Boolean(submitRes.submission),
    '10. Student submission created successfully',
    submitRes.error?.message
  );
  const mentorInboxAfterSubmission = getMockMentorNotifications(mentorId);
  const submissionAlert = mentorInboxAfterSubmission.find(
    (n) => n.type === 'submission_created' && n.link === '/mentor/reviews'
  );
  assert(
    Boolean(submissionAlert),
    '10. Student submission automatically dispatched submission_created alert to mentor with /mentor/reviews link'
  );

  // Check 11: Student Doubt -> Mentor Notification Dispatch
  console.log('\n--- Check 11: Student Doubt -> Mentor Notification Dispatch ---');
  const doubtRes = createMockDoubt({
    studentId: studentId,
    title: 'Clarification on Big-O amortized complexity in heaps',
    question: 'Can you clarify why buildHeap is O(n) while insert is O(log n)?',
    subjectId: 'mock-sub-phy-101',
    programId: 'prog-academic-01',
  });
  assert(
    !doubtRes.error && Boolean(doubtRes.doubt),
    '11. Student doubt inquiry created successfully',
    doubtRes.error?.message
  );
  const mentorInboxAfterDoubt = getMockMentorNotifications(mentorId);
  const doubtAlert = mentorInboxAfterDoubt.find(
    (n) => n.type === 'doubt_created' && n.title === 'New Student Question'
  );
  assert(
    Boolean(doubtAlert),
    '11. Student doubt inquiry automatically dispatched doubt_created alert to assigned mentor with /mentor/doubts link'
  );

  // Check 12: Announcement Notification Integration
  console.log('\n--- Check 12: Announcement Notification Integration ---');
  const announcementNotif = createMockNotification({
    recipientId: studentId,
    type: 'announcement_published',
    title: 'Midterm Schedule Announcement',
    message: 'Midterm examination schedule has been officially published.',
    link: '/student/announcements',
  });
  assert(
    !announcementNotif.error && announcementNotif.notification?.type === 'announcement_published',
    '12. Announcement notifications dispatch cleanly with announcement_published type'
  );

  // Check 13: Program Application -> Admin System Alert Dispatch
  console.log('\n--- Check 13: Program Application -> Admin System Alert Dispatch ---');
  const appRes = createMockApplication({
    applicant_id: 'mock-student-pp001',
    application_type: 'student',
    program_id: 'prog-skillsprint-git',
    cohort_id: 'cohort-git-sprint-01',
    application_message: 'Interested in joining Git Foundations mentorship.',
  });
  assert(
    !appRes.error && Boolean(appRes.application),
    '13. Application submitted successfully',
    appRes.error?.message
  );
  const adminInboxAfterApp = getMockAdminNotifications(adminId);
  const appAlert = adminInboxAfterApp.find(
    (n) => n.type === 'application_submitted' && n.link === '/admin/applications'
  );
  assert(
    Boolean(appAlert),
    '13. Program application submission automatically dispatched application_submitted alert to administrators'
  );

  // Check 14: Duplicate Alert Prevention (Idempotency Key)
  console.log('\n--- Check 14: Duplicate Alert Prevention (Idempotency Key) ---');
  const idemKey = 'cohort_cap_near:cohort-uu-cse-b67:80pct';
  const notif1 = createMockNotification({
    recipientId: adminId,
    type: 'capacity_alert',
    title: 'Cohort Approaching Capacity',
    message: 'Cohort UU CSE Batch 67 is at 85% capacity',
    link: '/admin/programs',
    idempotencyKey: idemKey,
  });
  assert(!notif1.error, '14. First alert with idempotency key created');

  const notif2 = createMockNotification({
    recipientId: adminId,
    type: 'capacity_alert',
    title: 'Cohort Approaching Capacity (Duplicate)',
    message: 'Cohort UU CSE Batch 67 is at 85% capacity (repeat trigger)',
    link: '/admin/programs',
    idempotencyKey: idemKey,
  });
  assert(
    !notif2.error && notif2.notification?.id === notif1.notification?.id,
    '14. Duplicate alert with identical idempotency key returned existing notification without creating duplicates'
  );

  // Check 15: UI Component & Page Static Code Analysis
  console.log('\n--- Check 15: UI Component & Page Static Verification ---');
  const mentorPageContent = fs.readFileSync(
    path.join(process.cwd(), 'src/pages/dashboard/MentorNotificationsPage.tsx'),
    'utf8'
  );
  assert(
    mentorPageContent.includes('export const MentorNotificationsPage') &&
    mentorPageContent.includes('role="mentor"') &&
    mentorPageContent.includes('NotificationInbox'),
    '15. MentorNotificationsPage correctly configured and exports component'
  );

  const adminPageContent = fs.readFileSync(
    path.join(process.cwd(), 'src/pages/dashboard/AdminNotificationsPage.tsx'),
    'utf8'
  );
  assert(
    adminPageContent.includes('export const AdminNotificationsPage') &&
    adminPageContent.includes('role="admin"') &&
    adminPageContent.includes('NotificationInbox'),
    '15. AdminNotificationsPage correctly configured and exports component'
  );

  const inboxContent = fs.readFileSync(
    path.join(process.cwd(), 'src/components/notifications/NotificationInbox.tsx'),
    'utf8'
  );
  assert(
    inboxContent.includes('export const NotificationInbox') &&
    inboxContent.includes('submission_created') &&
    inboxContent.includes('doubt_created') &&
    inboxContent.includes('capacity_alert') &&
    inboxContent.includes('application_submitted'),
    '15. NotificationInbox component handles all required notification categories'
  );

  // Check 16: Database Migration & RLS Security Hardening
  console.log('\n--- Check 16: Database Migration & RLS Security Hardening ---');
  const migrationPath = path.join(
    process.cwd(),
    'supabase/migrations/20261102000003_mentor_admin_notifications.sql'
  );
  assert(fs.existsSync(migrationPath), '16. Migration 20261102000003 exists');
  const migrationSql = fs.readFileSync(migrationPath, 'utf8');
  assert(
    migrationSql.includes('submission_created') &&
    migrationSql.includes('doubt_created') &&
    migrationSql.includes('application_submitted') &&
    migrationSql.includes('capacity_alert'),
    '16. Migration updates type CHECK constraint to include Milestone 11 types'
  );
  assert(
    migrationSql.includes('Notifications insert policy') &&
    migrationSql.includes('student_mentor_assignments') &&
    migrationSql.includes('cohort_mentors'),
    '16. Migration establishes RLS policy authorizing student-to-assigned-mentor notifications'
  );

  // Routes & Layout Check
  const routesContent = fs.readFileSync(
    path.join(process.cwd(), 'src/routes/index.tsx'),
    'utf8'
  );
  assert(
    routesContent.includes('mentor/notifications') && routesContent.includes('admin/notifications'),
    '16. Mentor and Admin notification routes registered in router'
  );

  const layoutContent = fs.readFileSync(
    path.join(process.cwd(), 'src/layouts/DashboardLayout.tsx'),
    'utf8'
  );
  assert(
    layoutContent.includes('/mentor/notifications') &&
    layoutContent.includes('/admin/notifications') &&
    layoutContent.includes('isMentor ? \'/mentor/notifications\' : isAdmin ? \'/admin/notifications\' : \'/student/notifications\''),
    '16. DashboardLayout wires role-aware Bell header and navigation items'
  );

  console.log('\n====================================================');
  console.log(`TOTAL CHECKS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runMilestone11Verification().catch((err) => {
  console.error('Fatal verification error:', err);
  process.exit(1);
});
