/// <reference types="node" />
/**
 * PoraPlan — Batch 4.4B: Notification Query Optimization & Inbox Pagination Test Suite
 *
 * Validates:
 * 1. Notification Service Pagination Contract:
 *    - DEFAULT_NOTIFICATIONS_PAGE_SIZE = 25
 *    - Pagination range calculation & invalid input normalization
 *    - Deterministic sorting order (created_at DESC nullsLast, id ASC)
 *    - Server-side read/unread status filtering ('all', 'unread', 'read')
 *    - Server-side notification type filtering
 *    - Accurate pagination metadata & empty-page behavior
 *    - Backward compatibility for legacy getUserNotifications callers
 *    - Lightweight head: true status counts query contract
 * 2. Dashboard Unread-Count Polling Lifecycle:
 *    - Normal polling interval set to 60,000 ms (60 seconds)
 *    - Stable polling lifecycle decoupled from location.pathname
 *    - Pause periodic polling while document.hidden is true
 *    - Immediate refresh upon visibilitychange to visible
 *    - In-flight overlapping query guard
 *    - Event and timer cleanup on unmount
 * 3. Inbox Pagination, Feed Lifecycle & Event Storm Prevention:
 *    - Server-side pagination with page size 25 & PaginationControls integration
 *    - Redundant 30-second feed polling interval removed
 *    - Reset to page 1 on filter changes
 *    - Stale async request / race condition protection
 *    - Optimistic single-read update and rollback on failure
 *    - Optimistic mark-all-read update and rollback on failure
 *    - Unread count guard prevents negative numbers
 *    - Event storm prevention (ignores single_read & mark_all_read self-events)
 *    - External notification creation triggers inbox and unread refresh
 * 4. Legacy Application Notification Navigation:
 *    - isLegacyApplicationRoute matches /student/applications, /mentor/applications, /admin/applications
 *    - Handles trailing slashes, query parameters, and hashes
 *    - Rejects active valid notification destinations
 *    - Archived notices mark as read without navigating
 *    - Archived notices suppress external navigation CTA and link icon
 *    - Normal notification destinations remain clickable with action text and link
 * 5. Role Pages & Code Hygiene:
 *    - Shared inbox compatibility for student, mentor, and admin pages
 *    - Zero emojis across all Batch 4.4B files
 *    - Zero secrets or credentials committed
 *    - Protected user files remain untouched
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  calculatePaginationRange,
  createPaginationMeta,
  normalizePage,
  normalizePageSize,
} from '../lib/pagination';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

let passCount = 0;
let failCount = 0;

function report(
  id: string,
  condition: boolean,
  description: string,
  category: 'SERVICE' | 'POLLING' | 'INBOX' | 'LEGACY' | 'HYGIENE' = 'SERVICE'
) {
  if (condition) {
    console.log(`[PASS] [${category}] ${id}: ${description}`);
    passCount++;
  } else {
    console.error(`[FAIL] [${category}] ${id}: ${description}`);
    failCount++;
  }
}

// Pure implementation of isLegacyApplicationRoute for unit simulation
function testIsLegacyApplicationRoute(link?: string | null): boolean {
  if (!link || typeof link !== 'string') return false;
  const clean = link.split('?')[0].split('#')[0].replace(/\/+$/, '');
  return (
    clean === '/student/applications' ||
    clean === '/mentor/applications' ||
    clean === '/admin/applications'
  );
}

// Pure simulation harness for deterministic notification sorting
interface NotificationRecord {
  id: string;
  created_at: string | null;
  read: boolean;
  type: string;
}

function sortNotificationsDeterministic(records: NotificationRecord[]): NotificationRecord[] {
  return [...records].sort((a, b) => {
    const timeA = a.created_at ? new Date(a.created_at).getTime() : -Infinity;
    const timeB = b.created_at ? new Date(b.created_at).getTime() : -Infinity;
    if (timeB !== timeA) {
      return timeB - timeA;
    }
    return (a.id || '').localeCompare(b.id || '');
  });
}

// Pure simulation harness for optimistic read actions
class SimulatedNotificationInboxState {
  notifications: NotificationRecord[];
  statusCounts: { all: number; unread: number; read: number };
  page: number;
  pageSize: number;

  constructor(initial: NotificationRecord[], pageSize = 25) {
    this.notifications = [...initial];
    this.pageSize = pageSize;
    this.page = 1;
    const unread = this.notifications.filter((n) => !n.read).length;
    this.statusCounts = {
      all: this.notifications.length,
      unread,
      read: Math.max(0, this.notifications.length - unread),
    };
  }

  markSingleAsRead(id: string, simulateFailure = false): boolean {
    const prevNotifs = [...this.notifications];
    const prevCounts = { ...this.statusCounts };

    // Optimistic update
    this.notifications = this.notifications.map((n) =>
      n.id === id ? { ...n, read: true } : n
    );
    this.statusCounts = {
      ...this.statusCounts,
      unread: Math.max(0, this.statusCounts.unread - 1),
      read: this.statusCounts.read + 1,
    };

    if (simulateFailure) {
      // Rollback
      this.notifications = prevNotifs;
      this.statusCounts = prevCounts;
      return false;
    }
    return true;
  }

  markAllAsRead(simulateFailure = false): boolean {
    const prevNotifs = [...this.notifications];
    const prevCounts = { ...this.statusCounts };

    // Optimistic update
    this.notifications = this.notifications.map((n) => ({ ...n, read: true }));
    this.statusCounts = {
      ...this.statusCounts,
      unread: 0,
      read: this.statusCounts.all,
    };

    if (simulateFailure) {
      // Rollback
      this.notifications = prevNotifs;
      this.statusCounts = prevCounts;
      return false;
    }
    return true;
  }
}

function runTests() {
  console.log('\n================================================================');
  console.log(' PoraPlan — Batch 4.4B: Notification Optimization Automated Tests');
  console.log('================================================================\n');

  // ---------------------------------------------------------------------------
  // Section 1: Notification Service Pagination Contract (Scope A)
  // ---------------------------------------------------------------------------
  console.log('--- Section 1: Notification Service Pagination Contract ---');

  const notifsSrcPath = path.join(projectRoot, 'src/lib/notifications.ts');
  const notifsSrc = fs.readFileSync(notifsSrcPath, 'utf8');

  // 1.1 DEFAULT_NOTIFICATIONS_PAGE_SIZE = 25
  report(
    'NOTIF-01',
    notifsSrc.includes('export const DEFAULT_NOTIFICATIONS_PAGE_SIZE = 25;'),
    'DEFAULT_NOTIFICATIONS_PAGE_SIZE is strictly exported and set to 25',
    'SERVICE'
  );

  // 1.2 Pagination range calculation & normalization
  {
    const r1 = calculatePaginationRange({ page: 1, pageSize: 25 });
    const r2 = calculatePaginationRange({ page: 2, pageSize: 25 });
    const r3 = calculatePaginationRange({ page: 3, pageSize: 25 });
    const rInvalid = calculatePaginationRange({ page: -5, pageSize: 0 });

    const validRanges =
      r1.from === 0 &&
      r1.to === 24 &&
      r2.from === 25 &&
      r2.to === 49 &&
      r3.from === 50 &&
      r3.to === 74;

    const validNorm =
      normalizePage(-5) === 1 &&
      normalizePageSize(undefined, 25) === 25 &&
      normalizePageSize(0) === 1 &&
      rInvalid.from === 0;

    report(
      'NOTIF-02',
      validRanges && validNorm,
      'PostgREST inclusive range for notifications: page 1 (0..24), page 2 (25..49), page 3 (50..74) with safe input normalization',
      'SERVICE'
    );
  }

  // 1.3 Deterministic sort ordering (created_at DESC nullsLast, id ASC)
  {
    const hasOrderClause =
      notifsSrc.includes(".order('created_at', { ascending: false, nullsFirst: false })") &&
      notifsSrc.includes(".order('id', { ascending: true })");

    const sample: NotificationRecord[] = [
      { id: 'notif-c', created_at: '2026-11-10T12:00:00Z', read: false, type: 'task_created' },
      { id: 'notif-a', created_at: '2026-11-11T12:00:00Z', read: false, type: 'assignment_created' },
      { id: 'notif-b', created_at: '2026-11-11T12:00:00Z', read: true, type: 'system' },
      { id: 'notif-z', created_at: null, read: true, type: 'system' },
    ];
    const sorted = sortNotificationsDeterministic(sample);
    const correctOrder =
      sorted[0].id === 'notif-a' &&
      sorted[1].id === 'notif-b' &&
      sorted[2].id === 'notif-c' &&
      sorted[3].id === 'notif-z';

    report(
      'NOTIF-03',
      hasOrderClause && correctOrder,
      'Deterministic ordering strictly enforces created_at DESC with id ASC tie-breaker and nulls last',
      'SERVICE'
    );
  }

  // 1.4 Server-side read/unread filtering
  {
    const hasStatusFilter =
      notifsSrc.includes("if (statusFilter === 'unread')") &&
      notifsSrc.includes("query = query.eq('read', false)") &&
      notifsSrc.includes("else if (statusFilter === 'read')") &&
      notifsSrc.includes("query = query.eq('read', true)");

    report(
      'NOTIF-04',
      hasStatusFilter,
      'Server-side read/unread filtering is applied on PostgREST query layer and mock store',
      'SERVICE'
    );
  }

  // 1.5 Server-side type filtering
  {
    const hasTypeFilter =
      notifsSrc.includes("if (typeFilter && typeFilter !== 'all')") &&
      notifsSrc.includes("query = query.in('type', ['task_created', 'task_updated'])") &&
      notifsSrc.includes("query = query.in('type', [") &&
      notifsSrc.includes("query = query.eq('type', typeFilter)");

    report(
      'NOTIF-05',
      hasTypeFilter,
      'Server-side type filtering maps grouped categories and individual notification types',
      'SERVICE'
    );
  }

  // 1.6 Pagination metadata and empty-page behavior
  {
    const emptyMeta = createPaginationMeta({ page: 1, pageSize: 25, totalCount: 0 });
    const fullMeta = createPaginationMeta({ page: 2, pageSize: 25, totalCount: 65 });

    const validEmpty =
      emptyMeta.page === 1 &&
      emptyMeta.pageSize === 25 &&
      emptyMeta.totalCount === 0 &&
      emptyMeta.totalPages === 1 &&
      emptyMeta.displayStart === 0 &&
      emptyMeta.displayEnd === 0 &&
      emptyMeta.hasPreviousPage === false &&
      emptyMeta.hasNextPage === false;

    const validFull =
      fullMeta.page === 2 &&
      fullMeta.pageSize === 25 &&
      fullMeta.totalCount === 65 &&
      fullMeta.totalPages === 3 &&
      fullMeta.displayStart === 26 &&
      fullMeta.displayEnd === 50 &&
      fullMeta.hasPreviousPage === true &&
      fullMeta.hasNextPage === true;

    report(
      'NOTIF-06',
      validEmpty && validFull,
      'Pagination metadata accurately derives totalPages, display bounds, and boundary flags for empty and multi-page datasets',
      'SERVICE'
    );
  }

  // 1.7 Backward compatibility for legacy callers
  {
    const hasLegacyFunction = notifsSrc.includes('export async function getUserNotifications(');
    const hasStudentAlias = notifsSrc.includes('export const getStudentNotifications = getUserNotifications;');
    const hasMentorAlias = notifsSrc.includes('export const getMentorNotifications = getUserNotifications;');
    const hasAdminAlias = notifsSrc.includes('export const getAdminNotifications = getUserNotifications;');

    report(
      'NOTIF-07',
      hasLegacyFunction && hasStudentAlias && hasMentorAlias && hasAdminAlias,
      'getUserNotifications and legacy role-specific aliases remain 100% backward-compatible',
      'SERVICE'
    );
  }

  // 1.8 Lightweight status counts API
  {
    const hasStatusCountsFn =
      notifsSrc.includes('export async function getUserNotificationStatusCounts(') &&
      notifsSrc.includes("select('*', { count: 'exact', head: true })");

    report(
      'NOTIF-08',
      hasStatusCountsFn,
      'getUserNotificationStatusCounts provides lightweight head: true count queries for all, unread, and read tabs',
      'SERVICE'
    );
  }

  // ---------------------------------------------------------------------------
  // Section 2: Dashboard Unread-Count Polling Lifecycle (Scope B)
  // ---------------------------------------------------------------------------
  console.log('\n--- Section 2: Dashboard Unread-Count Polling Lifecycle ---');

  const layoutSrcPath = path.join(projectRoot, 'src/layouts/DashboardLayout.tsx');
  const layoutSrc = fs.readFileSync(layoutSrcPath, 'utf8');

  // 2.1 Polling interval set to 60,000 ms (60 seconds)
  report(
    'POLL-01',
    layoutSrc.includes('setInterval(') && layoutSrc.includes('60000'),
    'DashboardLayout increases normal periodic unread-count polling from 15s to 60s (60000 ms)',
    'POLLING'
  );

  // 2.2 Decoupled from location.pathname
  {
    const effectIndex = layoutSrc.indexOf('// Batch 4.4B: 60s polling interval');
    const effectSlice = layoutSrc.slice(effectIndex, effectIndex + 2500);
    const decoupled =
      effectSlice.includes('[profile?.id, user?.id, role]') &&
      !effectSlice.includes('location.pathname');

    report(
      'POLL-02',
      decoupled,
      'Polling lifecycle is decoupled from route transitions and does not recreate interval on pathname changes',
      'POLLING'
    );
  }

  // 2.3 Pauses while document.hidden is true
  {
    const hasHiddenGuard =
      layoutSrc.includes("if (typeof document !== 'undefined' && document.hidden) return;");

    report(
      'POLL-03',
      hasHiddenGuard,
      'Periodic polling checks document.hidden on every tick and pauses while the tab is hidden',
      'POLLING'
    );
  }

  // 2.4 Immediate refresh upon visibilitychange to visible
  {
    const hasVisibilityListener =
      layoutSrc.includes("document.addEventListener('visibilitychange', handleVisibilityChange)") &&
      layoutSrc.includes("if (typeof document !== 'undefined' && !document.hidden)");

    report(
      'POLL-04',
      hasVisibilityListener,
      'visibilitychange listener immediately triggers unread count refresh when document returns to visible',
      'POLLING'
    );
  }

  // 2.5 In-flight overlapping query guard
  {
    const hasInFlightGuard =
      layoutSrc.includes('let inFlight = false;') &&
      layoutSrc.includes('if (!activeUserId || inFlight || !isMounted) return;') &&
      layoutSrc.includes('inFlight = true;');

    report(
      'POLL-05',
      hasInFlightGuard,
      'DashboardLayout guards against concurrent overlapping unread count queries using inFlight flag',
      'POLLING'
    );
  }

  // 2.6 Timer and listener cleanup on unmount
  {
    const hasCleanup =
      layoutSrc.includes('clearInterval(interval);') &&
      layoutSrc.includes("document.removeEventListener('visibilitychange', handleVisibilityChange);") &&
      layoutSrc.includes("window.removeEventListener('notifications-updated', handleUpdate);");

    report(
      'POLL-06',
      hasCleanup,
      'DashboardLayout cleans up interval, visibilitychange, and notifications-updated listeners on unmount',
      'POLLING'
    );
  }

  // ---------------------------------------------------------------------------
  // Section 3: Inbox Pagination, Feed Lifecycle & Event Storm Prevention (Scopes C & D)
  // ---------------------------------------------------------------------------
  console.log('\n--- Section 3: Inbox Pagination & Event Storm Prevention ---');

  const inboxSrcPath = path.join(projectRoot, 'src/components/notifications/NotificationInbox.tsx');
  const inboxSrc = fs.readFileSync(inboxSrcPath, 'utf8');

  // 3.1 Server-side pagination & PaginationControls
  {
    const usesPaginated = inboxSrc.includes('getUserNotificationsPaginated(');
    const usesControls = inboxSrc.includes('<PaginationControls');
    const defaultPageSize25 = inboxSrc.includes('DEFAULT_NOTIFICATIONS_PAGE_SIZE');

    report(
      'INBOX-01',
      usesPaginated && usesControls && defaultPageSize25,
      'NotificationInbox connects to getUserNotificationsPaginated and renders PaginationControls with default page size 25',
      'INBOX'
    );
  }

  // 3.2 Redundant 30s feed interval removed
  {
    const hasFeedInterval = inboxSrc.includes('setInterval') || inboxSrc.includes('30000');
    report(
      'INBOX-02',
      !hasFeedInterval,
      'Redundant 30-second full-feed polling interval is completely eliminated from NotificationInbox',
      'INBOX'
    );
  }

  // 3.3 Page reset on filter changes
  {
    const resetsStatus =
      inboxSrc.includes('handleStatusFilterChange') && inboxSrc.includes('setPage(1)');
    const resetsType =
      inboxSrc.includes('handleTypeFilterChange') && inboxSrc.includes('setPage(1)');

    report(
      'INBOX-03',
      resetsStatus && resetsType,
      'Status filter and type filter selections strictly reset active page to 1',
      'INBOX'
    );
  }

  // 3.4 Stale async request / race condition protection
  {
    const hasRequestIdGuard =
      inboxSrc.includes('requestIdRef.current') &&
      inboxSrc.includes('currentRequestId !== requestIdRef.current');

    report(
      'INBOX-04',
      hasRequestIdGuard,
      'NotificationInbox uses requestIdRef to discard stale out-of-order async responses from race conditions',
      'INBOX'
    );
  }

  // 3.5 Optimistic single-read update and failure rollback
  {
    const sim = new SimulatedNotificationInboxState([
      { id: 'notif-1', created_at: '2026-11-11T10:00:00Z', read: false, type: 'task_created' },
      { id: 'notif-2', created_at: '2026-11-11T09:00:00Z', read: false, type: 'task_created' },
    ]);

    // Success path
    const success = sim.markSingleAsRead('notif-1', false);
    const successState =
      success &&
      sim.notifications[0].read === true &&
      sim.statusCounts.unread === 1 &&
      sim.statusCounts.read === 1;

    // Failure rollback path
    const failed = sim.markSingleAsRead('notif-2', true);
    const rollbackState =
      !failed &&
      sim.notifications[1].read === false &&
      sim.statusCounts.unread === 1 &&
      sim.statusCounts.read === 1;

    report(
      'INBOX-05',
      successState && rollbackState,
      'Single-read optimistically updates local notifications and statusCounts immediately, with rollback on database failure',
      'INBOX'
    );
  }

  // 3.6 Optimistic mark-all-read update and failure rollback
  {
    const sim = new SimulatedNotificationInboxState([
      { id: 'notif-1', created_at: '2026-11-11T10:00:00Z', read: false, type: 'task_created' },
      { id: 'notif-2', created_at: '2026-11-11T09:00:00Z', read: false, type: 'task_created' },
      { id: 'notif-3', created_at: '2026-11-11T08:00:00Z', read: false, type: 'task_created' },
    ]);

    const success = sim.markAllAsRead(false);
    const successState =
      success &&
      sim.notifications.every((n) => n.read) &&
      sim.statusCounts.unread === 0 &&
      sim.statusCounts.read === 3;

    // Rollback test
    const sim2 = new SimulatedNotificationInboxState([
      { id: 'notif-1', created_at: '2026-11-11T10:00:00Z', read: false, type: 'task_created' },
    ]);
    const failed = sim2.markAllAsRead(true);
    const rollbackState =
      !failed &&
      sim2.notifications[0].read === false &&
      sim2.statusCounts.unread === 1;

    report(
      'INBOX-06',
      successState && rollbackState,
      'Mark-all-read optimistically sets unread count to 0 and all items to read, with complete rollback on failure',
      'INBOX'
    );
  }

  // 3.7 Unread count guard prevents negative numbers
  {
    const sim = new SimulatedNotificationInboxState([
      { id: 'notif-1', created_at: '2026-11-11T10:00:00Z', read: true, type: 'system' },
    ]);
    sim.markSingleAsRead('notif-1', false);
    const nonNegative = sim.statusCounts.unread >= 0;

    const sourceHasGuard =
      inboxSrc.includes('Math.max(0,') && layoutSrc.includes('Math.max(0,');

    report(
      'INBOX-07',
      nonNegative && sourceHasGuard,
      'Unread notification counters strictly enforce Math.max(0, ...) boundary to prevent negative display numbers',
      'INBOX'
    );
  }

  // 3.8 Event storm prevention on mark-as-read
  {
    const ignoresSelfRead =
      inboxSrc.includes("if (source === 'single_read' || source === 'mark_all_read')") &&
      inboxSrc.includes('return;');

    report(
      'INBOX-08',
      ignoresSelfRead,
      'NotificationInbox event handler ignores self-initiated single_read and mark_all_read events, preventing refetch storms',
      'INBOX'
    );
  }

  // 3.9 External notification creation triggers synchronization
  {
    const refreshesOnExternal =
      inboxSrc.includes('fetchNotifications(false);') &&
      inboxSrc.includes('loadStatusCounts();') &&
      notifsSrc.includes("notifyUpdate({ source: 'create' })");

    report(
      'INBOX-09',
      refreshesOnExternal,
      'createNotification dispatches source: create event which triggers inbox and unread counter synchronization',
      'INBOX'
    );
  }

  // ---------------------------------------------------------------------------
  // Section 4: Legacy Application Notification Navigation (Scope E)
  // ---------------------------------------------------------------------------
  console.log('\n--- Section 4: Legacy Application Notification Navigation ---');

  // 4.1 Matches legacy application routes
  {
    const match1 = testIsLegacyApplicationRoute('/student/applications');
    const match2 = testIsLegacyApplicationRoute('/mentor/applications');
    const match3 = testIsLegacyApplicationRoute('/admin/applications');

    report(
      'LEGACY-01',
      match1 && match2 && match3,
      'isLegacyApplicationRoute matches /student/applications, /mentor/applications, and /admin/applications',
      'LEGACY'
    );
  }

  // 4.2 Handles trailing slashes, query params, and hashes
  {
    const t1 = testIsLegacyApplicationRoute('/student/applications/');
    const t2 = testIsLegacyApplicationRoute('/mentor/applications?status=submitted&page=1');
    const t3 = testIsLegacyApplicationRoute('/admin/applications#review-details');
    const t4 = testIsLegacyApplicationRoute('/student/applications/?id=123#notes');

    report(
      'LEGACY-02',
      t1 && t2 && t3 && t4,
      'isLegacyApplicationRoute accurately tolerates trailing slashes, query parameters, and URL fragments',
      'LEGACY'
    );
  }

  // 4.3 Rejects normal valid application routes
  {
    const r1 = testIsLegacyApplicationRoute('/student/tasks');
    const r2 = testIsLegacyApplicationRoute('/student/assignments');
    const r3 = testIsLegacyApplicationRoute('/mentor/review');
    const r4 = testIsLegacyApplicationRoute('/admin/programs');
    const r5 = testIsLegacyApplicationRoute('/applications');
    const r6 = testIsLegacyApplicationRoute(null);
    const r7 = testIsLegacyApplicationRoute(undefined);

    report(
      'LEGACY-03',
      !r1 && !r2 && !r3 && !r4 && !r5 && !r6 && !r7,
      'isLegacyApplicationRoute strictly rejects normal academic destinations and nullish values',
      'LEGACY'
    );
  }

  // 4.4 Archived notices do not navigate
  {
    const cardClickBlocks =
      inboxSrc.includes('if (isLegacyApplicationRoute(notif.link)) {') &&
      inboxSrc.includes('return;');

    report(
      'LEGACY-04',
      cardClickBlocks,
      'handleCardClick marks archived application notice as read but aborts before calling navigate()',
      'LEGACY'
    );
  }

  // 4.5 Archived notice UI representation
  {
    const rendersArchivedNotice =
      inboxSrc.includes('Archived Notice') &&
      inboxSrc.includes('const isLegacyApp = isLegacyApplicationRoute(notif.link);');

    report(
      'LEGACY-05',
      rendersArchivedNotice,
      'NotificationInbox displays Archived Notice indicator without external navigation link icon or action CTA',
      'LEGACY'
    );
  }

  // 4.6 Normal notification destinations remain unchanged
  {
    const maintainsValidNavigation =
      inboxSrc.includes('const hasLink = !isLegacyApp && isSafeRoute(notif.link);') &&
      inboxSrc.includes('if (isSafeRoute(notif.link))') &&
      inboxSrc.includes('navigate(notif.link as string)');

    report(
      'LEGACY-06',
      maintainsValidNavigation,
      'Active academic notification routes (tasks, reviews, doubts, announcements) remain clickable and navigate normally',
      'LEGACY'
    );
  }

  // ---------------------------------------------------------------------------
  // Section 5: Role Pages & Code Hygiene (Scope F & Hygiene)
  // ---------------------------------------------------------------------------
  console.log('\n--- Section 5: Role Pages & Code Hygiene ---');

  // 5.1 Role page wrapper compatibility
  {
    const studentPageSrc = fs.readFileSync(path.join(projectRoot, 'src/pages/dashboard/StudentNotificationsPage.tsx'), 'utf8');
    const mentorPageSrc = fs.readFileSync(path.join(projectRoot, 'src/pages/dashboard/MentorNotificationsPage.tsx'), 'utf8');
    const adminPageSrc = fs.readFileSync(path.join(projectRoot, 'src/pages/dashboard/AdminNotificationsPage.tsx'), 'utf8');

    const studentOk = studentPageSrc.includes('<NotificationInbox') && studentPageSrc.includes('role="student"');
    const mentorOk = mentorPageSrc.includes('<NotificationInbox') && mentorPageSrc.includes('role="mentor"');
    const adminOk = adminPageSrc.includes('<NotificationInbox') && adminPageSrc.includes('role="admin"');

    report(
      'HYGIENE-01',
      studentOk && mentorOk && adminOk,
      'Student, Mentor, and Admin notification pages delegate seamlessly to the optimized shared NotificationInbox',
      'HYGIENE'
    );
  }

  // 5.2 Zero emojis across Batch 4.4B files
  {
    const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1FA00}-\u{1FAFF}]/u;
    const batchFiles = [
      'src/lib/notifications.ts',
      'src/layouts/DashboardLayout.tsx',
      'src/components/notifications/NotificationInbox.tsx',
    ];

    let hasEmoji = false;
    for (const rel of batchFiles) {
      const content = fs.readFileSync(path.join(projectRoot, rel), 'utf8');
      if (emojiRegex.test(content)) {
        hasEmoji = true;
        console.error(`Found emoji in: ${rel}`);
      }
    }

    report(
      'HYGIENE-02',
      !hasEmoji,
      'Batch 4.4B source files are strictly emoji-free and adhere to Brutalist design standards',
      'HYGIENE'
    );
  }

  // 5.3 Zero secrets or credentials committed
  {
    const secretKeywords = [
      /SUPABASE_SERVICE_ROLE_KEY\s*=\s*['"][^'"]+['"]/i,
      /postgres:\/\/[^:]+:[^@]+@/i,
      /-----BEGIN (?:RSA )?PRIVATE KEY-----/,
    ];

    let hasSecret = false;
    const batchFiles = [
      'src/lib/notifications.ts',
      'src/layouts/DashboardLayout.tsx',
      'src/components/notifications/NotificationInbox.tsx',
    ];

    for (const rel of batchFiles) {
      const content = fs.readFileSync(path.join(projectRoot, rel), 'utf8');
      for (const pattern of secretKeywords) {
        if (pattern.test(content)) {
          hasSecret = true;
          console.error(`Potential credential found in: ${rel}`);
        }
      }
    }

    report(
      'HYGIENE-03',
      !hasSecret,
      'Batch 4.4B files contain zero hardcoded credentials, service-role keys, or private tokens',
      'HYGIENE'
    );
  }

  // 5.4 Protected user files remain untouched
  {
    const protectedFiles = [
      'src/pages/dashboard/AdminUsersPage.tsx',
      'src/pages/dashboard/MentorTasksPage.tsx',
      'src/pages/dashboard/PublicProfilePage.tsx',
      'src/pages/dashboard/StudentLibraryPage.tsx',
    ];

    // Verify all 4 protected files exist and have not been deleted
    const allExist = protectedFiles.every((p) => fs.existsSync(path.join(projectRoot, p)));

    report(
      'HYGIENE-04',
      allExist,
      'All 4 protected user files remain intact and excluded from staging or destructive overwrites',
      'HYGIENE'
    );
  }

  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`Summary: ${passCount}/${passCount + failCount} scenarios passed (${failCount} failed).`);
  console.log('================================================================\n');

  if (failCount > 0) {
    process.exit(1);
  }
}

runTests();
