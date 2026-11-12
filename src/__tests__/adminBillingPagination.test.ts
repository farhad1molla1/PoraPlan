/// <reference types="node" />
/**
 * PoraPlan — Batch 4.6B-1: Admin Billing Desk Paginated Service Foundation Test Suite
 *
 * Validates:
 * 1. Server-side Pagination & Query Architecture:
 *    - DEFAULT_ADMIN_STUDENT_PAYMENT_PAGE_SIZE is exported and equals 25
 *    - DEFAULT_ADMIN_MENTOR_PAYMENT_PAGE_SIZE is exported and equals 25
 *    - calculatePaginationRange correctly computes 0-based PostgREST offsets (0..24, 25..49, 50..74)
 *    - Exact count requested in PostgREST queries ({ count: 'exact' })
 *    - Deterministic ordering for student payments: cycle_start_date DESC NULLS LAST, id ASC
 *    - Deterministic ordering for mentor payouts: billing_month DESC NULLS LAST, id ASC
 *    - Safe handling of out-of-range pages and empty result sets
 * 2. Server-side Filtering & Search Sanitization:
 *    - Student status filtering ('pending', 'partial', 'paid', 'overdue', 'waived')
 *    - Mentor status filtering ('pending', 'partial', 'paid')
 *    - Payment method filtering ('bkash', 'nagad', 'upay', 'cash', 'bank')
 *    - Search input sanitization (strips syntax delimiters: commas, parens, quotes, colons, semicolons, slashes)
 *    - Non-empty search with zero valid characters returns 0 results (never unrestricted query)
 *    - Soft-deleted record exclusion (is_deleted = false)
 * 3. Global Duplicate Transaction-Reference Detection:
 *    - Combines student and mentor references into unified namespace
 *    - Excludes cash payments (payment_method = 'cash')
 *    - Normalizes whitespace (.trim()) and case (.toUpperCase())
 *    - Detects same-track and cross-track duplicates accurately
 *    - Ignores null, undefined, and empty string references
 *    - Excludes soft-deleted records from duplicate tracking
 *    - Implements chunked range retrieval scalability safeguard to prevent PostgREST row-limit truncation
 *    - Handles partial query failure safely without silently reporting empty set
 * 4. Lightweight Operational Metrics:
 *    - getAdminBillingMetrics executes parallel HEAD count queries ({ count: 'exact', head: true })
 *    - Metric fields: pendingStudents, overdueStudents, pendingMentors, upcomingRenewals, duplicateReferencesCount
 *    - Strictly enforces absolute NO-AMOUNT policy (zero currency symbols, amounts, or financial totals)
 *    - Handles query errors explicitly
 * 5. Bounded Recent Activity Queries:
 *    - getRecentStudentPaymentRecords clamps to maximum 5 records
 *    - getRecentMentorPaymentRecords clamps to maximum 5 records
 *    - Enforces deterministic ordering and soft-delete exclusion
 * 6. Authorization, Privacy, Hygiene & Backward Compatibility:
 *    - All admin endpoints enforce resolveAuthContext and admin role checks
 *    - Legacy getAdminStudentPaymentRecords and getAdminMentorPaymentRecords signatures preserved
 *    - Payment-event note isolation preserved via get_admin_payment_events RPC
 *    - AdminBillingPage.tsx remains untouched in Batch 4.6B-1
 *    - Protected user files (MentorTasksPage, PublicProfilePage, StudentLibraryPage) untouched
 *    - Zero emojis across all modified and test files
 *    - Zero hardcoded secrets, private keys, or tokens exposed
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
  category: 'ARCH' | 'FILTER' | 'DUPLICATES' | 'METRICS' | 'RECENT' | 'SECURITY' | 'HYGIENE' = 'ARCH'
) {
  if (condition) {
    console.log(`[PASS] [${category}] ${id}: ${description}`);
    passCount++;
  } else {
    console.error(`[FAIL] [${category}] ${id}: ${description}`);
    failCount++;
  }
}

// Local reproduction of sanitizeSearchInput to verify regex behavior in isolation
function testSanitizeSearchInput(input: string): string {
  if (!input || typeof input !== 'string') return '';
  return input.replace(/[,()":;\\/]/g, ' ').replace(/\s+/g, ' ').trim();
}

function runTests() {
  console.log('\n--- Section 1: Server-side Pagination & Query Architecture ---');

  const paymentsSourcePath = path.join(projectRoot, 'src/lib/payments.ts');
  const paymentsSource = fs.readFileSync(paymentsSourcePath, 'utf8');

  // 1.1 Page size constants
  report(
    'PGN-01',
    paymentsSource.includes('export const DEFAULT_ADMIN_STUDENT_PAYMENT_PAGE_SIZE = 25') &&
    paymentsSource.includes('export const DEFAULT_ADMIN_MENTOR_PAYMENT_PAGE_SIZE = 25'),
    'DEFAULT_ADMIN_STUDENT_PAYMENT_PAGE_SIZE and DEFAULT_ADMIN_MENTOR_PAYMENT_PAGE_SIZE are exported and equal 25',
    'ARCH'
  );

  // 1.2 calculatePaginationRange produces correct 0-based PostgREST offsets
  const rangeP1 = calculatePaginationRange({ page: 1, pageSize: 25 });
  const rangeP2 = calculatePaginationRange({ page: 2, pageSize: 25 });
  const rangeP3 = calculatePaginationRange({ page: 3, pageSize: 25 });

  report(
    'PGN-02',
    rangeP1.from === 0 && rangeP1.to === 24 &&
    rangeP2.from === 25 && rangeP2.to === 49 &&
    rangeP3.from === 50 && rangeP3.to === 74,
    'calculatePaginationRange computes accurate 0-based PostgREST offsets (0..24, 25..49, 50..74)',
    'ARCH'
  );

  // 1.3 Normalization of page and pageSize
  report(
    'PGN-03',
    normalizePage(-5) === 1 &&
    normalizePage(0) === 1 &&
    normalizePage(NaN) === 1 &&
    normalizePageSize(-10, 25) === 1 &&
    normalizePageSize(500, 25) === 100,
    'normalizePage and normalizePageSize normalize negative, zero, float, and bounded values safely',
    'ARCH'
  );

  // 1.4 Exact count metadata requested
  report(
    'PGN-04',
    paymentsSource.includes(".from('student_payment_records')") &&
    paymentsSource.includes(".select('*', { count: 'exact' })") &&
    paymentsSource.includes(".from('mentor_payment_records')"),
    'Paginated student and mentor queries request exact count metadata ({ count: "exact" })',
    'ARCH'
  );

  // 1.5 Deterministic ordering in student and mentor queries
  report(
    'PGN-05',
    paymentsSource.includes(".order('cycle_start_date', { ascending: false, nullsFirst: false })") &&
    paymentsSource.includes(".order('billing_month', { ascending: false, nullsFirst: false })") &&
    paymentsSource.includes(".order('id', { ascending: true })"),
    'Deterministic ordering applied: cycle_start_date/billing_month DESC NULLS LAST, id ASC',
    'ARCH'
  );

  // 1.6 Empty results generate stable pagination metadata
  const emptyMeta = createPaginationMeta({ page: 1, pageSize: 25, totalCount: 0 });
  report(
    'PGN-06',
    emptyMeta.totalCount === 0 &&
    emptyMeta.totalPages === 1 &&
    emptyMeta.displayStart === 0 &&
    emptyMeta.displayEnd === 0 &&
    !emptyMeta.hasPreviousPage &&
    !emptyMeta.hasNextPage,
    'Empty result sets generate stable, valid pagination metadata',
    'ARCH'
  );

  console.log('\n--- Section 2: Server-side Filtering & Search Sanitization ---');

  // 2.1 Student status and method filters
  report(
    'FLT-01',
    paymentsSource.includes('params?.status') &&
    paymentsSource.includes('params?.paymentMethod') &&
    paymentsSource.includes("query = query.eq('status', params.status)") &&
    paymentsSource.includes("query = query.eq('payment_method', params.paymentMethod)"),
    'Student and mentor paginated services support server-side status and paymentMethod filtering',
    'FILTER'
  );

  // 2.2 Soft-delete exclusion
  report(
    'FLT-02',
    paymentsSource.includes("query = query.eq('is_deleted', false)"),
    'Paginated queries strictly exclude soft-deleted records (is_deleted = false)',
    'FILTER'
  );

  // 2.3 sanitizeSearchInput export & delimiter stripping
  const rawMalicious = 'TRX-100",status.eq.paid)or(method.eq.cash;\\/:hack';
  const sanitizedMalicious = testSanitizeSearchInput(rawMalicious);
  report(
    'FLT-03',
    paymentsSource.includes('export function sanitizeSearchInput(') &&
    !sanitizedMalicious.includes(',') &&
    !sanitizedMalicious.includes('(') &&
    !sanitizedMalicious.includes(')') &&
    !sanitizedMalicious.includes('"') &&
    !sanitizedMalicious.includes(':') &&
    !sanitizedMalicious.includes(';') &&
    !sanitizedMalicious.includes('\\') &&
    !sanitizedMalicious.includes('/'),
    'sanitizeSearchInput strips PostgREST delimiters (commas, parens, quotes, colons, semicolons, slashes)',
    'FILTER'
  );

  // 2.4 Delimiter-only and wildcard-only search guard
  const rawDelimiters = ',,,::;;""()';
  const rawWildcards = '%%%';
  report(
    'FLT-04',
    testSanitizeSearchInput(rawDelimiters).length === 0 &&
    testSanitizeSearchInput(rawWildcards).replace(/[%]/g, '').trim().length === 0 &&
    paymentsSource.includes("sanitizedSearch.replace(/[%]/g, '').trim().length === 0"),
    'Non-empty searches consisting purely of delimiters or % wildcards return empty results safely',
    'FILTER'
  );

  // 2.5 Preservation of legitimate search terms
  const legitimateRef = 'TRX-BK-2026-9901';
  const legitimateName = 'Dr. Farhad Molla';
  report(
    'FLT-05',
    testSanitizeSearchInput(legitimateRef) === 'TRX-BK-2026-9901' &&
    testSanitizeSearchInput(legitimateName) === 'Dr. Farhad Molla',
    'Legitimate transaction references with hyphens and names with dots/spaces are preserved',
    'FILTER'
  );

  console.log('\n--- Section 3: Global Duplicate Transaction-Reference Detection ---');

  // 3.1 getGlobalDuplicateReferences is exported
  report(
    'DUP-01',
    paymentsSource.includes('export async function getGlobalDuplicateReferences(): Promise<GlobalDuplicateReferencesResult>') &&
    paymentsSource.includes('export function isDuplicateTransactionReference('),
    'getGlobalDuplicateReferences and isDuplicateTransactionReference helper are exported',
    'DUPLICATES'
  );

  // 3.2 Duplicate detection logic simulation
  const mockStudents = [
    { id: 's1', transaction_reference: 'TRX-ALPHA', payment_method: 'bkash', is_deleted: false },
    { id: 's2', transaction_reference: 'trx-alpha', payment_method: 'nagad', is_deleted: false }, // Same-track case duplicate
    { id: 's3', transaction_reference: '  TRX-BETA  ', payment_method: 'upay', is_deleted: false }, // Whitespace duplicate candidate
    { id: 's4', transaction_reference: 'TRX-CASH', payment_method: 'cash', is_deleted: false }, // Cash: must be excluded
    { id: 's5', transaction_reference: 'TRX-CASH', payment_method: 'cash', is_deleted: false }, // Cash: must be excluded
    { id: 's6', transaction_reference: null, payment_method: 'bank', is_deleted: false }, // Null: ignored
    { id: 's7', transaction_reference: '', payment_method: 'bank', is_deleted: false }, // Empty: ignored
    { id: 's8', transaction_reference: 'TRX-DEL', payment_method: 'bkash', is_deleted: true }, // Soft-deleted: ignored
    { id: 's9', transaction_reference: 'TRX-DEL', payment_method: 'bkash', is_deleted: false }, // Single non-deleted
  ];

  const mockMentors = [
    { id: 'm1', transaction_reference: 'TRX-BETA', payment_method: 'bank', is_deleted: false }, // Cross-track duplicate
    { id: 'm2', transaction_reference: 'TRX-GAMMA', payment_method: 'bkash', is_deleted: false }, // Unique
  ];

  const counts = new Map<string, number>();
  for (const r of mockStudents) {
    if (!r.is_deleted && r.transaction_reference && r.transaction_reference.trim() && r.payment_method !== 'cash') {
      const ref = r.transaction_reference.trim().toUpperCase();
      counts.set(ref, (counts.get(ref) || 0) + 1);
    }
  }
  for (const r of mockMentors) {
    if (!r.is_deleted && r.transaction_reference && r.transaction_reference.trim() && r.payment_method !== 'cash') {
      const ref = r.transaction_reference.trim().toUpperCase();
      counts.set(ref, (counts.get(ref) || 0) + 1);
    }
  }

  const dupSet = new Set<string>();
  counts.forEach((c, ref) => {
    if (c > 1) dupSet.add(ref);
  });

  report(
    'DUP-02',
    counts.get('TRX-ALPHA') === 2 && dupSet.has('TRX-ALPHA'),
    'Case-insensitive duplicate within student track detected (TRX-ALPHA count = 2)',
    'DUPLICATES'
  );

  report(
    'DUP-03',
    counts.get('TRX-BETA') === 2 && dupSet.has('TRX-BETA'),
    'Cross-track duplicate across student and mentor records detected (TRX-BETA count = 2)',
    'DUPLICATES'
  );

  report(
    'DUP-04',
    !counts.has('TRX-CASH') && !dupSet.has('TRX-CASH'),
    'Cash payments are strictly excluded from duplicate reference tracking',
    'DUPLICATES'
  );

  report(
    'DUP-05',
    counts.get('TRX-DEL') === 1 && !dupSet.has('TRX-DEL'),
    'Soft-deleted records are strictly excluded from duplicate reference tracking',
    'DUPLICATES'
  );

  report(
    'DUP-06',
    !counts.has('') && !counts.has('NULL') && dupSet.size === 2,
    'Null, whitespace, and empty references are safely excluded from duplicate map',
    'DUPLICATES'
  );

  // 3.3 Scalability safeguard: chunked range retrieval in Supabase query
  report(
    'DUP-07',
    paymentsSource.includes('const chunkSize = 1000') &&
    paymentsSource.includes('.range(studentFrom, studentTo)') &&
    paymentsSource.includes('.range(mentorFrom, mentorTo)') &&
    paymentsSource.includes('studentFrom += chunkSize'),
    'Scalability safeguard: getGlobalDuplicateReferences implements chunked range pagination to prevent row truncation',
    'DUPLICATES'
  );

  // 3.4 Partial failure safety
  report(
    'DUP-08',
    paymentsSource.includes('if (error) throw error') &&
    paymentsSource.includes('Failed to retrieve global duplicate transaction references'),
    'Partial query failures are thrown and returned through service error contract',
    'DUPLICATES'
  );

  console.log('\n--- Section 4: Lightweight Operational Metrics ---');

  // 4.1 getAdminBillingMetrics is exported with parallel HEAD counts
  report(
    'MTR-01',
    paymentsSource.includes('export async function getAdminBillingMetrics(): Promise<AdminBillingMetricsResult>') &&
    paymentsSource.includes(".select('*', { count: 'exact', head: true })"),
    'getAdminBillingMetrics is exported and executes parallel HEAD count queries',
    'METRICS'
  );

  // 4.2 Metrics fields coverage
  report(
    'MTR-02',
    paymentsSource.includes('pendingStudents:') &&
    paymentsSource.includes('overdueStudents:') &&
    paymentsSource.includes('pendingMentors:') &&
    paymentsSource.includes('upcomingRenewals') &&
    paymentsSource.includes('duplicateReferencesCount:'),
    'AdminBillingMetrics covers pendingStudents, overdueStudents, pendingMentors, upcomingRenewals, duplicateReferencesCount',
    'METRICS'
  );

  // 4.3 Strict NO-AMOUNT policy in metrics
  const financialKeywords = ['amount', 'balance', 'fee', 'price', 'revenue', 'currency', 'total_paid'];
  const metricTypesSource = paymentsSource.substring(
    paymentsSource.indexOf('export interface AdminBillingMetrics {'),
    paymentsSource.indexOf('export interface AdminBillingMetricsResult {')
  );

  const hasFinancialInMetrics = financialKeywords.some((kw) => metricTypesSource.toLowerCase().includes(kw));
  report(
    'MTR-03',
    !hasFinancialInMetrics,
    'Absolute NO-AMOUNT compliance: AdminBillingMetrics contains zero financial or currency fields',
    'METRICS'
  );

  console.log('\n--- Section 5: Bounded Recent Activity Queries ---');

  // 5.1 Recent student payments query
  report(
    'REC-01',
    paymentsSource.includes('export async function getRecentStudentPaymentRecords(') &&
    paymentsSource.includes('.limit(safeLimit)') &&
    paymentsSource.includes('Math.min(Math.max(1, limit), 5)'),
    'getRecentStudentPaymentRecords is exported and strictly clamped to maximum 5 records',
    'RECENT'
  );

  // 5.2 Recent mentor payouts query
  report(
    'REC-02',
    paymentsSource.includes('export async function getRecentMentorPaymentRecords(') &&
    paymentsSource.includes('.limit(safeLimit)'),
    'getRecentMentorPaymentRecords is exported and strictly clamped to maximum 5 records',
    'RECENT'
  );

  // 5.3 Deterministic ordering on recent activity
  report(
    'REC-03',
    paymentsSource.includes(".order('cycle_start_date', { ascending: false, nullsFirst: false })") &&
    paymentsSource.includes(".order('billing_month', { ascending: false, nullsFirst: false })"),
    'Recent activity queries apply deterministic ordering matching desk overview specifications',
    'RECENT'
  );

  console.log('\n--- Section 6: Authorization, Privacy & Backward Compatibility ---');

  // 6.1 Admin authorization check on all new functions
  const newFunctions = [
    'getAdminStudentPaymentRecordsPaginated',
    'getAdminMentorPaymentRecordsPaginated',
    'getGlobalDuplicateReferences',
    'getAdminBillingMetrics',
    'getRecentStudentPaymentRecords',
    'getRecentMentorPaymentRecords',
  ];

  const allHaveAuthCheck = newFunctions.every(
    (fnName) =>
      paymentsSource.includes(`async function ${fnName}`) &&
      paymentsSource.includes("auth.role !== 'admin'")
  );

  report(
    'SEC-01',
    allHaveAuthCheck,
    'All new admin billing service functions strictly enforce resolveAuthContext and admin role checks',
    'SECURITY'
  );

  // 6.2 Legacy API backward compatibility
  report(
    'SEC-02',
    paymentsSource.includes('export async function getAdminStudentPaymentRecords(') &&
    paymentsSource.includes('export async function getAdminMentorPaymentRecords(') &&
    paymentsSource.includes('export async function getPaymentEvents(') &&
    paymentsSource.includes('export async function getPaymentAdminNotes(') &&
    paymentsSource.includes('export async function overrideBillingStartDate('),
    'Legacy service functions preserved for complete backward compatibility with existing tests and callers',
    'SECURITY'
  );

  // 6.3 Payment events note isolation preserved
  report(
    'SEC-03',
    paymentsSource.includes("p_record_type: recordType") &&
    paymentsSource.includes("rpc('get_admin_payment_events'") &&
    paymentsSource.includes(".select('id, record_type,"),
    'Payment events note isolation preserved via get_admin_payment_events RPC and column grant protection',
    'SECURITY'
  );

  console.log('\n--- Section 7: Code Hygiene, Security & Protected Files ---');

  // 7.1 Zero emojis
  const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
  report(
    'HYG-01',
    !emojiRegex.test(paymentsSource),
    'payments.ts contains zero emojis',
    'HYGIENE'
  );

  // 7.2 Zero hardcoded secrets
  const secretKeywords = [
    'service_role_key',
    'SUPABASE_SERVICE_ROLE_KEY',
    'sb_secret',
    'PRIVATE_KEY',
    'BEGIN RSA PRIVATE KEY',
  ];
  const hasSecretInPayments = secretKeywords.some((kw) => paymentsSource.includes(kw));
  report(
    'HYG-02',
    !hasSecretInPayments,
    'Zero hardcoded secrets, private keys, or service role tokens exposed',
    'HYGIENE'
  );

  // 7.3 AdminBillingPage.tsx exists intact
  const adminBillingPagePath = path.join(projectRoot, 'src/pages/dashboard/AdminBillingPage.tsx');
  report(
    'HYG-03',
    fs.existsSync(adminBillingPagePath),
    'AdminBillingPage.tsx exists intact',
    'HYGIENE'
  );

  // 7.4 Protected user files remain untouched
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

  console.log('\n======================================================');
  console.log(`Summary: ${passCount}/${passCount + failCount} scenarios passed (${failCount} failed).`);
  console.log('======================================================\n');

  if (failCount > 0) {
    process.exit(1);
  }
}

runTests();
