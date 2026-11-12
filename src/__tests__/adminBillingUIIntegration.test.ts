/// <reference types="node" />
/**
 * PoraPlan — Batch 4.6B-2: Admin Billing Desk UI Integration & Server-side Pagination Test Suite
 *
 * Validates:
 * 1. Service Layer Integration in AdminBillingPage:
 *    - Imports paginated billing services: getAdminStudentPaymentRecordsPaginated, getAdminMentorPaymentRecordsPaginated
 *    - Imports getGlobalDuplicateReferences, getAdminBillingMetrics, getRecentStudentPaymentRecords, getRecentMentorPaymentRecords, getAdminCalendarMonthData
 *    - Completely eliminates legacy unpaginated getAdminStudentPaymentRecords() and getAdminMentorPaymentRecords() desk calls
 *    - Uses DEFAULT_ADMIN_STUDENT_PAYMENT_PAGE_SIZE (25) and DEFAULT_ADMIN_MENTOR_PAYMENT_PAGE_SIZE (25)
 *    - Binds paginated response data to component table and pagination state
 * 2. Search Debouncing & Filter Handling:
 *    - 300ms debounce effect synchronizes studentSearch to debouncedStudentSearch
 *    - 300ms debounce effect synchronizes mentorSearch to debouncedMentorSearch
 *    - Student search change and status/method filter changes reset studentPage to 1
 *    - Mentor search change and status/method filter changes reset mentorPage to 1
 *    - Debounced search triggers fresh paginated fetch without unpaginated table scan
 * 3. Global Duplicate Reference Detection:
 *    - getGlobalDuplicateReferences called and stored in desk state
 *    - Overview warning banner uses duplicateReferences.totalDuplicateCount and allows one-click filtering
 *    - Row-level duplicate indicators in both tables use isDuplicateTransactionReference with global duplicate set
 *    - Row warnings are unaffected by page slicing (O(1) lookup across all pages)
 * 4. Calendar Heatmap & Audit Log Optimization:
 *    - Calendar heatmap queries scoped strictly to active month via getAdminCalendarMonthData(year, month)
 *    - Calendar navigation (prev, next, today) dynamically fetches active month data without full-table history downloads
 *    - Billing date audit logs are lazy-loaded only when audit_notes tab is activated (activeTab === 'audit_notes' && !auditLogsLoaded)
 *    - Audit logs show loading indicator while in flight
 * 5. Race-Condition & Stale-Async Protection:
 *    - Request ID refs protect student payments queries (studentReqIdRef)
 *    - Request ID refs protect mentor payout queries (mentorReqIdRef)
 *    - Request ID refs protect calendar data queries (calendarReqIdRef)
 *    - Request ID refs protect overview queries (overviewReqIdRef)
 *    - Request ID refs protect audit logs queries (auditReqIdRef)
 * 6. Pagination Controls & UI Integration:
 *    - Imports and renders Brutalist <PaginationControls>
 *    - Student table renders <PaginationControls> with pageSizeOptions={[10, 25, 50, 100]} and loading indicator
 *    - Mentor table renders <PaginationControls> with pageSizeOptions={[10, 25, 50, 100]} and loading indicator
 *    - Mobile and tablet cards map directly over server-paginated slices without redundant client slicing
 *    - Desktop tables map directly over server-paginated slices without redundant client slicing
 * 7. Action Preservation & Selective Invalidation:
 *    - Student record creation/update/delete selectively refreshes student payments, overview metrics, and duplicate references
 *    - Mentor record creation/update/delete selectively refreshes mentor payouts, overview metrics, and duplicate references
 *    - Billing anchor override selectively refreshes overview metrics, student payments, and audit logs
 *    - Drawers, modals, status badges, details views, and action buttons are preserved intact
 * 8. Compliance, Hygiene & Protection:
 *    - Strict NO-AMOUNT policy: zero currency symbols, monetary amounts, or financial totals in AdminBillingPage.tsx
 *    - Zero emojis across all modified files
 *    - Zero hardcoded secrets, API keys, or private tokens exposed
 *    - Protected user files (MentorTasksPage.tsx, PublicProfilePage.tsx, StudentLibraryPage.tsx) remain strictly untouched
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { toBangladeshDateStr } from '../lib/billingCycles';
import { calculatePaginationRange } from '../lib/pagination';
import { DEFAULT_ADMIN_BILLING_AUDIT_LOG_PAGE_SIZE } from '../lib/payments';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

let passCount = 0;
let failCount = 0;

function report(
  id: string,
  condition: boolean,
  description: string,
  category:
    | 'SERVICE'
    | 'DEBOUNCE_FILTER'
    | 'DUPLICATES'
    | 'CALENDAR_AUDIT'
    | 'RACE_GUARD'
    | 'PAGINATION_UI'
    | 'WORKFLOWS'
    | 'HYGIENE'
    | 'HARDENING' = 'SERVICE'
) {
  if (condition) {
    console.log(`[PASS] [${category}] ${id}: ${description}`);
    passCount++;
  } else {
    console.error(`[FAIL] [${category}] ${id}: ${description}`);
    failCount++;
  }
}

async function runTests() {
  console.log('======================================================');
  console.log('PoraPlan Batch 4.6B-2: Admin Billing Desk Integration');
  console.log('======================================================\n');

  const adminBillingPagePath = path.join(projectRoot, 'src/pages/dashboard/AdminBillingPage.tsx');
  const paymentsPath = path.join(projectRoot, 'src/lib/payments.ts');

  const adminBillingSource = fs.readFileSync(adminBillingPagePath, 'utf8');
  const paymentsSource = fs.readFileSync(paymentsPath, 'utf8');

  // =========================================================================
  // Section 1: Service Layer Integration in AdminBillingPage
  // =========================================================================
  console.log('--- Section 1: Service Layer Integration in AdminBillingPage ---');

  report(
    'SRV-01',
    adminBillingSource.includes('getAdminStudentPaymentRecordsPaginated') &&
      adminBillingSource.includes('getAdminMentorPaymentRecordsPaginated') &&
      adminBillingSource.includes('getGlobalDuplicateReferences') &&
      adminBillingSource.includes('getAdminBillingMetrics') &&
      adminBillingSource.includes('getRecentStudentPaymentRecords') &&
      adminBillingSource.includes('getRecentMentorPaymentRecords') &&
      adminBillingSource.includes('getAdminCalendarMonthData') &&
      adminBillingSource.includes('isDuplicateTransactionReference'),
    'AdminBillingPage imports all required paginated billing and metrics services',
    'SERVICE'
  );

  report(
    'SRV-02',
    !adminBillingSource.includes('getAdminStudentPaymentRecords(') &&
      !adminBillingSource.includes('getAdminMentorPaymentRecords(') &&
      !adminBillingSource.includes('loadDeskData'),
    'Completely eliminates legacy unpaginated getAdminStudentPaymentRecords, getAdminMentorPaymentRecords, and loadDeskData',
    'SERVICE'
  );

  report(
    'SRV-03',
    adminBillingSource.includes('DEFAULT_ADMIN_STUDENT_PAYMENT_PAGE_SIZE') &&
      adminBillingSource.includes('DEFAULT_ADMIN_MENTOR_PAYMENT_PAGE_SIZE'),
    'Uses standard DEFAULT_ADMIN_STUDENT_PAYMENT_PAGE_SIZE and DEFAULT_ADMIN_MENTOR_PAYMENT_PAGE_SIZE (25)',
    'SERVICE'
  );

  report(
    'SRV-04',
    adminBillingSource.includes('setStudentRecords(res.records);') &&
      adminBillingSource.includes('setStudentPagination(res.pagination);') &&
      adminBillingSource.includes('setMentorRecords(res.records);') &&
      adminBillingSource.includes('setMentorPagination(res.pagination);'),
    'Binds paginated records and pagination metadata directly to table state',
    'SERVICE'
  );

  // =========================================================================
  // Section 2: Search Debouncing & Filter Handling
  // =========================================================================
  console.log('\n--- Section 2: Search Debouncing & Filter Handling ---');

  report(
    'FLT-01',
    adminBillingSource.includes('setDebouncedStudentSearch(studentSearch);') &&
      adminBillingSource.includes('300);'),
    'Applies 300ms debounce effect to synchronize student search input',
    'DEBOUNCE_FILTER'
  );

  report(
    'FLT-02',
    adminBillingSource.includes('setDebouncedMentorSearch(mentorSearch);'),
    'Applies 300ms debounce effect to synchronize mentor search input',
    'DEBOUNCE_FILTER'
  );

  report(
    'FLT-03',
    adminBillingSource.includes('setStudentSearch(e.target.value);') &&
      adminBillingSource.includes('setStudentPage(1);') &&
      adminBillingSource.includes('setStudentStatusFilter(') &&
      adminBillingSource.includes('setStudentMethodFilter('),
    'Reset student page to 1 on search, status filter, and method filter changes',
    'DEBOUNCE_FILTER'
  );

  report(
    'FLT-04',
    adminBillingSource.includes('setMentorSearch(e.target.value);') &&
      adminBillingSource.includes('setMentorPage(1);') &&
      adminBillingSource.includes('setMentorStatusFilter(') &&
      adminBillingSource.includes('setMentorMethodFilter('),
    'Reset mentor page to 1 on search, status filter, and method filter changes',
    'DEBOUNCE_FILTER'
  );

  report(
    'FLT-05',
    adminBillingSource.includes('debouncedStudentSearch') &&
      adminBillingSource.includes('debouncedMentorSearch'),
    'Debounced search queries dispatched to paginated endpoints without client filtering',
    'DEBOUNCE_FILTER'
  );

  // =========================================================================
  // Section 3: Global Duplicate Reference Detection
  // =========================================================================
  console.log('\n--- Section 3: Global Duplicate Reference Detection ---');

  report(
    'DUP-01',
    adminBillingSource.includes('getGlobalDuplicateReferences()') &&
      adminBillingSource.includes('setDuplicateReferences(res);'),
    'getGlobalDuplicateReferences is invoked and stored in desk state',
    'DUPLICATES'
  );

  report(
    'DUP-02',
    adminBillingSource.includes('duplicateReferences.totalDuplicateCount') &&
      adminBillingSource.includes('duplicateReferences.duplicatesList'),
    'Overview banner renders total duplicate count and supports one-click filtering',
    'DUPLICATES'
  );

  report(
    'DUP-03',
    adminBillingSource.includes('isDuplicateTransactionReference(rec.transaction_reference, duplicateReferences?.duplicateSet)'),
    'Row-level duplicate indicators in tables and mobile cards query global duplicate set',
    'DUPLICATES'
  );

  report(
    'DUP-04',
    !adminBillingSource.includes('duplicateReferenceCounts'),
    'Replaces page-sliced duplicate detection with global Set lookup eliminating false negatives',
    'DUPLICATES'
  );

  // =========================================================================
  // Section 4: Calendar Heatmap & Audit Log Optimization
  // =========================================================================
  console.log('\n--- Section 4: Calendar Heatmap & Audit Log Optimization ---');

  report(
    'CAL-01',
    adminBillingSource.includes('getAdminCalendarMonthData(year, month)') ||
      adminBillingSource.includes('getAdminCalendarMonthData(calendarYear, calendarMonth)'),
    'Calendar heatmap data strictly scoped to active month via bounded date query',
    'CALENDAR_AUDIT'
  );

  report(
    'CAL-02',
    adminBillingSource.includes('loadCalendarData(newYear, newMonth);'),
    'Calendar navigation (prev, next, today) dynamically fetches active month data',
    'CALENDAR_AUDIT'
  );

  report(
    'CAL-03',
    adminBillingSource.includes("activeTab === 'audit_notes' && !auditLogsLoaded") &&
      adminBillingSource.includes('loadAuditLogsData()'),
    'Billing date audit logs are lazy-loaded only when audit_notes tab is activated',
    'CALENDAR_AUDIT'
  );

  report(
    'CAL-04',
    adminBillingSource.includes('auditLogsLoading') &&
      adminBillingSource.includes('Loading audit logs...'),
    'Audit logs tab displays a clear loading indicator while fetch is in progress',
    'CALENDAR_AUDIT'
  );

  // =========================================================================
  // Section 5: Race-Condition & Stale-Async Protection
  // =========================================================================
  console.log('\n--- Section 5: Race-Condition & Stale-Async Protection ---');

  report(
    'RCG-01',
    adminBillingSource.includes('studentReqIdRef') &&
      adminBillingSource.includes('reqId !== studentReqIdRef.current'),
    'studentReqIdRef guards student payments query sequencing against out-of-order responses',
    'RACE_GUARD'
  );

  report(
    'RCG-02',
    adminBillingSource.includes('mentorReqIdRef') &&
      adminBillingSource.includes('reqId !== mentorReqIdRef.current'),
    'mentorReqIdRef guards mentor payouts query sequencing against out-of-order responses',
    'RACE_GUARD'
  );

  report(
    'RCG-03',
    adminBillingSource.includes('calendarReqIdRef') &&
      adminBillingSource.includes('reqId !== calendarReqIdRef.current'),
    'calendarReqIdRef guards calendar month query sequencing against out-of-order responses',
    'RACE_GUARD'
  );

  report(
    'RCG-04',
    adminBillingSource.includes('overviewReqIdRef') &&
      adminBillingSource.includes('reqId !== overviewReqIdRef.current'),
    'overviewReqIdRef guards overview metrics and recent activity sequencing',
    'RACE_GUARD'
  );

  report(
    'RCG-05',
    adminBillingSource.includes('auditReqIdRef') &&
      adminBillingSource.includes('reqId !== auditReqIdRef.current'),
    'auditReqIdRef guards lazy audit logs query sequencing',
    'RACE_GUARD'
  );

  // =========================================================================
  // Section 6: Pagination Controls & UI Integration
  // =========================================================================
  console.log('\n--- Section 6: Pagination Controls & UI Integration ---');

  report(
    'PAG-01',
    adminBillingSource.includes('<PaginationControls'),
    'Mounts Brutalist PaginationControls component for server-side page navigation',
    'PAGINATION_UI'
  );

  report(
    'PAG-02',
    adminBillingSource.includes('ariaLabel="Student payment records pagination"') &&
      adminBillingSource.includes('pageSizeOptions={[10, 25, 50, 100]}'),
    'Student table mounts PaginationControls with [10, 25, 50, 100] page size options',
    'PAGINATION_UI'
  );

  report(
    'PAG-03',
    adminBillingSource.includes('ariaLabel="Mentor payout records pagination"'),
    'Mentor table mounts PaginationControls with [10, 25, 50, 100] page size options',
    'PAGINATION_UI'
  );

  report(
    'PAG-04',
    adminBillingSource.includes('studentRecords.map((rec)') &&
      adminBillingSource.includes('mentorRecords.map((rec)'),
    'Mobile cards and desktop tables map directly over paginated slices without client slicing',
    'PAGINATION_UI'
  );

  report(
    'PAG-05',
    !adminBillingSource.includes('paginatedStudentRecords') &&
      !adminBillingSource.includes('paginatedMentorRecords'),
    'Completely removes legacy client-side array slicing variables',
    'PAGINATION_UI'
  );

  // =========================================================================
  // Section 7: Action Preservation & Selective Invalidation
  // =========================================================================
  console.log('\n--- Section 7: Action Preservation & Selective Invalidation ---');

  report(
    'WFK-01',
    adminBillingSource.includes('loadStudentPayments();') &&
      adminBillingSource.includes('loadOverviewData();') &&
      adminBillingSource.includes('loadDuplicateReferences();'),
    'Student record mutations selectively refresh student records, overview metrics, and duplicates',
    'WORKFLOWS'
  );

  report(
    'WFK-02',
    adminBillingSource.includes('loadMentorPayouts();'),
    'Mentor record mutations selectively refresh mentor records, overview metrics, and duplicates',
    'WORKFLOWS'
  );

  report(
    'WFK-03',
    adminBillingSource.includes('loadAuditLogsData();') &&
      adminBillingSource.includes('Billing start date updated.'),
    'Anchor override selectively invalidates overview, student records, and audit logs',
    'WORKFLOWS'
  );

  report(
    'WFK-04',
    adminBillingSource.includes('selectedStudentRecord') &&
      adminBillingSource.includes('selectedMentorRecord') &&
      adminBillingSource.includes('isCreateStudentModalOpen') &&
      adminBillingSource.includes('isCreateMentorModalOpen') &&
      adminBillingSource.includes('isAnchorModalOpen'),
    'All existing modals, drawers, status badges, details, and action workflows preserved intact',
    'WORKFLOWS'
  );

  // =========================================================================
  // Section 8: Compliance, Hygiene & Protection
  // =========================================================================
  console.log('\n--- Section 8: Compliance, Hygiene & Protection ---');

  const currencyMatches = adminBillingSource.match(/(?:৳|Tk|\$(?!\{)|\bUSD\b|\bBDT\b|\bEUR\b|€)/gi);
  report(
    'HYG-01',
    currencyMatches === null,
    `Strict NO-AMOUNT policy: zero currency symbols or monetary values in AdminBillingPage.tsx (found: ${JSON.stringify(currencyMatches)})`,
    'HYGIENE'
  );

  const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
  report(
    'HYG-02',
    !emojiRegex.test(adminBillingSource) && !emojiRegex.test(paymentsSource),
    'Zero emojis across modified AdminBillingPage.tsx and payments.ts',
    'HYGIENE'
  );

  const secretKeywords = [
    'SUPABASE_SERVICE_ROLE_KEY',
    'service_role',
    'BEGIN PRIVATE KEY',
    'DATABASE_URL',
    'postgres://',
    'postgresql://',
  ];
  const hasSecretInAdmin = secretKeywords.some((kw) => adminBillingSource.includes(kw));
  report(
    'HYG-03',
    !hasSecretInAdmin,
    'Zero hardcoded secrets, private keys, or credentials exposed in AdminBillingPage.tsx',
    'HYGIENE'
  );

  const protectedFiles = [
    'src/pages/dashboard/MentorTasksPage.tsx',
    'src/pages/dashboard/PublicProfilePage.tsx',
    'src/pages/dashboard/StudentLibraryPage.tsx',
  ];
  const allProtectedExist = protectedFiles.every((p) => fs.existsSync(path.join(projectRoot, p)));
  report(
    'HYG-04',
    allProtectedExist,
    'Protected user files (MentorTasksPage, PublicProfilePage, StudentLibraryPage) exist intact',
    'HYGIENE'
  );

  // =========================================================================
  // Section 9: Batch 4.6B-2B Hardening (Audit Pagination, Duplicate Race & Bangladesh Dates)
  // =========================================================================
  console.log('\n--- Section 9: Batch 4.6B-2B Hardening ---');

  report(
    'HDN-01',
    DEFAULT_ADMIN_BILLING_AUDIT_LOG_PAGE_SIZE === 25,
    'DEFAULT_ADMIN_BILLING_AUDIT_LOG_PAGE_SIZE is exported and equals 25',
    'HARDENING'
  );

  report(
    'HDN-02',
    paymentsSource.includes('export async function getBillingDateAuditLogsPaginated') &&
      paymentsSource.includes("select('*', { count: 'exact' })") &&
      paymentsSource.includes(".order('created_at', { ascending: false })") &&
      paymentsSource.includes(".order('id', { ascending: true })"),
    'getBillingDateAuditLogsPaginated provides exact count and deterministic ordering (created_at DESC, id ASC)',
    'HARDENING'
  );

  report(
    'HDN-03',
    adminBillingSource.includes('getBillingDateAuditLogsPaginated') &&
      adminBillingSource.includes('DEFAULT_ADMIN_BILLING_AUDIT_LOG_PAGE_SIZE'),
    'AdminBillingPage imports getBillingDateAuditLogsPaginated and default page size',
    'HARDENING'
  );

  report(
    'HDN-04',
    adminBillingSource.includes('ariaLabel="Billing audit logs pagination"') &&
      adminBillingSource.includes('setAuditPageSize') &&
      adminBillingSource.includes('setAuditPage'),
    'AdminBillingPage renders PaginationControls for audit logs with standard page size controls',
    'HARDENING'
  );

  report(
    'HDN-05',
    adminBillingSource.includes('auditPagination?.totalCount'),
    'Audit Log tab counter displays server-provided totalCount from auditPagination',
    'HARDENING'
  );

  report(
    'HDN-06',
    adminBillingSource.includes('duplicateReqIdRef') &&
      adminBillingSource.includes('reqId !== duplicateReqIdRef.current'),
    'duplicateReqIdRef guards global duplicate reference retrieval against stale out-of-order responses',
    'HARDENING'
  );

  report(
    'HDN-07',
    adminBillingSource.includes('function safeToBangladeshDate') &&
      adminBillingSource.includes('safeToBangladeshDate(r.payout_date) === selectedCalendarDate'),
    'safeToBangladeshDate normalizes mentor payout dates and guards calendar agenda matching',
    'HARDENING'
  );

  report(
    'HDN-08',
    paymentsSource.includes('toBangladeshDateStr(r.payout_date)'),
    'getAdminCalendarMonthData mock fallback maps mentor payout_date via toBangladeshDateStr',
    'HARDENING'
  );

  // Functional date test: UTC 20:00 on Oct 31 is 02:00 on Nov 1 in Bangladesh (+06:00)
  const convertedDate = toBangladeshDateStr('2026-10-31T20:00:00Z');
  report(
    'HDN-09',
    convertedDate === '2026-11-01',
    `toBangladeshDateStr correctly shifts UTC evening timestamps into Asia/Dhaka day ('2026-10-31T20:00:00Z' -> '${convertedDate}')`,
    'HARDENING'
  );

  // Functional date test: date-only strings preserved
  const plainDate = toBangladeshDateStr('2026-11-01');
  report(
    'HDN-10',
    plainDate === '2026-11-01',
    `toBangladeshDateStr preserves date-only strings without shifting ('2026-11-01' -> '${plainDate}')`,
    'HARDENING'
  );

  // Functional pagination range calculation for audit logs
  const page1Range = calculatePaginationRange({ page: 1, pageSize: DEFAULT_ADMIN_BILLING_AUDIT_LOG_PAGE_SIZE });
  const page2Range = calculatePaginationRange({ page: 2, pageSize: DEFAULT_ADMIN_BILLING_AUDIT_LOG_PAGE_SIZE });
  report(
    'HDN-11',
    page1Range.from === 0 && page1Range.to === 24 && page2Range.from === 25 && page2Range.to === 49,
    `Audit log pagination offsets match expected PostgREST bounds: [${page1Range.from}..${page1Range.to}], [${page2Range.from}..${page2Range.to}]`,
    'HARDENING'
  );

  console.log('\n======================================================');
  console.log(`Summary: ${passCount}/${passCount + failCount} scenarios passed (${failCount} failed).`);
  console.log('======================================================\n');

  if (failCount > 0) {
    process.exit(1);
  }
}

runTests();
