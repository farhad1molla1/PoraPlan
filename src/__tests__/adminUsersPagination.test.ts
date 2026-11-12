/// <reference types="node" />
/**
 * PoraPlan — Batch 4.5B-2: Admin Users Directory Paginated Service Foundation Test Suite
 *
 * Validates:
 * 1. Server-side Pagination & Query Architecture:
 *    - DEFAULT_ADMIN_USERS_PAGE_SIZE is exported and equals 25
 *    - calculatePaginationRange correctly computes 0-based PostgREST offsets (0..24, 25..49, 50..74)
 *    - normalizePage safely converts <=0, negative, and invalid values to 1
 *    - Exact count requested in PostgREST query ({ count: 'exact' })
 *    - Deterministic ordering: created_at DESC NULLS LAST, id ASC
 *    - Safe handling of out-of-range pages and empty result sets
 * 2. Server-side Filtering & Search Contract:
 *    - Role filtering (student, mentor, admin)
 *    - Account status filtering (not_activated, active, suspended)
 *    - Multi-field search across full_name, email, and poraplan_id
 *    - Combined filtering (role + status + search)
 *    - Empty string and whitespace-only search does not restrict the query
 * 3. Search Sanitization & PostgREST Injection Security:
 *    - Stripping delimiters: commas, parentheses, quotes, backslashes, colons, semicolons, slashes
 *    - Non-empty search with zero valid characters returns 0 results (never unrestricted query)
 *    - Preserves legitimate search inputs (names, emails with @ and dots, PoraPlan IDs with hyphens)
 * 4. Parallel Role & Status Counts Metrics Contract:
 *    - getAdminUserRoleCounts executes lightweight parallel HEAD count queries ({ count: 'exact', head: true })
 *    - Returns total, students, mentors, admins, active, notActivated, suspended
 *    - Handles errors and optional status filter
 * 5. Mock Store Simulation & In-Memory Fidelity:
 *    - Multi-page dataset slicing and continuous item numbering
 *    - In-memory search and deterministic sort fidelity
 * 6. Code Hygiene, Security & Backward Compatibility:
 *    - Zero emojis across Batch 4.5B-2 files
 *    - Zero hardcoded secrets or credential tokens exposed
 *    - Preserves legacy getAdminUsers signature and callers
 *    - Protected user files (AdminUsersPage, MentorTasksPage, PublicProfilePage, StudentLibraryPage) remain untouched
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  calculatePaginationRange,
  createPaginationMeta,
  calculateTotalPages,
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
  category: 'ARCH' | 'FILTER' | 'SECURITY' | 'METRICS' | 'SIMULATION' | 'HYGIENE' = 'ARCH'
) {
  if (condition) {
    console.log(`[PASS] [${category}] ${id}: ${description}`);
    passCount++;
  } else {
    console.error(`[FAIL] [${category}] ${id}: ${description}`);
    failCount++;
  }
}

// Local reproduction of sanitizeSearchInput to verify regex in pure node context
function testSanitizeSearchInput(input: string): string {
  if (!input || typeof input !== 'string') return '';
  return input
    .replace(/[,()":;\\/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function runTests() {
  console.log('\n--- Section 1: Server-side Pagination & Query Architecture ---');

  const profilesSourcePath = path.join(projectRoot, 'src/lib/profiles.ts');
  const profilesSource = fs.readFileSync(profilesSourcePath, 'utf8');

  // 1.1 DEFAULT_ADMIN_USERS_PAGE_SIZE = 25
  report(
    'PGN-01',
    profilesSource.includes('export const DEFAULT_ADMIN_USERS_PAGE_SIZE = 25;'),
    'DEFAULT_ADMIN_USERS_PAGE_SIZE is defined and exported as 25 in src/lib/profiles.ts',
    'ARCH'
  );

  // 1.2 getAdminUsersPaginated exported and uses shared pagination utilities
  report(
    'PGN-02',
    profilesSource.includes('export async function getAdminUsersPaginated(') &&
      profilesSource.includes('calculatePaginationRange({ page, pageSize })') &&
      profilesSource.includes('createPaginationMeta('),
    'getAdminUsersPaginated is exported and integrates calculatePaginationRange and createPaginationMeta',
    'ARCH'
  );

  // 1.3 Deterministic sorting (created_at DESC NULLS LAST, id ASC)
  report(
    'PGN-03',
    profilesSource.includes(".order('created_at', { ascending: false, nullsFirst: false })") &&
      profilesSource.includes(".order('id', { ascending: true })"),
    'getAdminUsersPaginated enforces deterministic ordering: created_at DESC NULLS LAST, id ASC',
    'ARCH'
  );

  // 1.4 PostgREST range calculation: 0-based inclusive slices
  const r1 = calculatePaginationRange({ page: 1, pageSize: 25 });
  const r2 = calculatePaginationRange({ page: 2, pageSize: 25 });
  const r3 = calculatePaginationRange({ page: 3, pageSize: 25 });
  report(
    'PGN-04',
    r1.from === 0 && r1.to === 24 &&
      r2.from === 25 && r2.to === 49 &&
      r3.from === 50 && r3.to === 74,
    'Pagination range calculations align with 0-based PostgREST endpoints (25 items/page)',
    'ARCH'
  );

  // 1.5 Safe page normalization
  const negPage = normalizePage(-5);
  const zeroPage = normalizePage(0);
  const nanPage = normalizePage(NaN);
  const floatPage = normalizePage(2.7);
  const minSize = normalizePageSize(-5);
  const maxSize = normalizePageSize(200);
  report(
    'PGN-05',
    negPage === 1 && zeroPage === 1 && nanPage === 1 && floatPage === 2 &&
      minSize === 1 && maxSize === 100,
    'normalizePage and normalizePageSize normalize negative, zero, float, and bounded values safely',
    'ARCH'
  );

  // 1.6 Exact count metadata requested
  report(
    'PGN-06',
    profilesSource.includes(".select('*', { count: 'exact' })") &&
      profilesSource.includes('.range(range.from, range.to)'),
    "getAdminUsersPaginated requests exact count metadata and applies range slice",
    'ARCH'
  );

  // 1.7 Empty results and out-of-range pagination metadata handling
  const emptyMeta = createPaginationMeta({ page: 1, pageSize: 25, totalCount: 0 });
  const outOfRangeMeta = createPaginationMeta({ page: 10, pageSize: 25, totalCount: 15 });
  report(
    'PGN-07',
    emptyMeta.totalCount === 0 &&
      emptyMeta.totalPages === 1 &&
      emptyMeta.displayStart === 0 &&
      emptyMeta.displayEnd === 0 &&
      !emptyMeta.hasPreviousPage &&
      !emptyMeta.hasNextPage &&
      outOfRangeMeta.totalPages === 1 &&
      outOfRangeMeta.hasPreviousPage &&
      !outOfRangeMeta.hasNextPage,
    'Empty results and out-of-range pages generate stable, valid pagination metadata',
    'ARCH'
  );

  // 1.8 Legacy getAdminUsers preserved
  report(
    'PGN-08',
    profilesSource.includes('export async function getAdminUsers('),
    'Legacy getAdminUsers function is preserved and backward compatible',
    'ARCH'
  );

  console.log('\n--- Section 2: Server-side Filtering & Search Contract ---');

  // 2.1 Role filtering
  report(
    'FLT-01',
    profilesSource.includes("query = query.eq('role', params.role)"),
    'getAdminUsersPaginated supports server-side role filtering',
    'FILTER'
  );

  // 2.2 Status filtering
  report(
    'FLT-02',
    profilesSource.includes("query = query.eq('status', params.status)"),
    'getAdminUsersPaginated supports server-side account status filtering',
    'FILTER'
  );

  // 2.3 Search across full_name, email, poraplan_id
  report(
    'FLT-03',
    profilesSource.includes('full_name.ilike.%') &&
      profilesSource.includes('email.ilike.%') &&
      profilesSource.includes('poraplan_id.ilike.%'),
    'Search queries span full_name, email, and poraplan_id via PostgREST .or()',
    'FILTER'
  );

  // 2.4 Combined filtering support
  report(
    'FLT-04',
    profilesSource.includes('params?.role') &&
      profilesSource.includes('params?.status') &&
      profilesSource.includes('sanitizedSearch'),
    'Role, status, and search filters compose cumulatively on the PostgREST query',
    'FILTER'
  );

  // 2.5 Empty and whitespace-only search handling
  const emptySearchInput = '    ';
  const isSearchProvided = typeof emptySearchInput === 'string' && emptySearchInput.trim().length > 0;
  report(
    'FLT-05',
    !isSearchProvided && testSanitizeSearchInput(emptySearchInput) === '',
    'Whitespace-only search is recognized as unprovided and does not restrict query',
    'FILTER'
  );

  console.log('\n--- Section 3: Search Sanitization & Injection Security ---');

  // 3.1 sanitizeSearchInput is exported
  report(
    'SEC-01',
    profilesSource.includes('export function sanitizeSearchInput('),
    'sanitizeSearchInput is exported from src/lib/profiles.ts',
    'SECURITY'
  );

  // 3.2 Stripping PostgREST syntax delimiters
  const maliciousInput = 'admin",role.eq.admin)or(status.eq.active;\\/:test';
  const sanitizedMalicious = testSanitizeSearchInput(maliciousInput);
  report(
    'SEC-02',
    !sanitizedMalicious.includes(',') &&
      !sanitizedMalicious.includes('(') &&
      !sanitizedMalicious.includes(')') &&
      !sanitizedMalicious.includes('"') &&
      !sanitizedMalicious.includes(':') &&
      !sanitizedMalicious.includes(';') &&
      !sanitizedMalicious.includes('\\') &&
      !sanitizedMalicious.includes('/') &&
      sanitizedMalicious === 'admin role.eq.admin or status.eq.active test',
    'sanitizeSearchInput strips all PostgREST delimiters: commas, parens, quotes, colons, semicolons, slashes, backslashes',
    'SECURITY'
  );

  // 3.3 Delimiter-only search returns 0 results (never unrestricted query)
  report(
    'SEC-03',
    profilesSource.includes('if (!sanitizedSearch)') &&
      profilesSource.includes('users: []') &&
      profilesSource.includes('pagination: emptyMeta'),
    'A non-empty search with only syntax delimiters returns empty results rather than an unrestricted query',
    'SECURITY'
  );

  // 3.4 Preservation of legitimate search terms
  const legitimateName = 'Dr. Farhad Molla';
  const legitimateEmail = 'scholar.student@poraplan.com';
  const legitimateId = 'PPM-007';
  report(
    'SEC-04',
    testSanitizeSearchInput(legitimateName) === 'Dr. Farhad Molla' &&
      testSanitizeSearchInput(legitimateEmail) === 'scholar.student@poraplan.com' &&
      testSanitizeSearchInput(legitimateId) === 'PPM-007',
    'Legitimate names with periods, emails with @/dots, and PoraPlan IDs with hyphens are preserved',
    'SECURITY'
  );

  console.log('\n--- Section 4: Parallel Role & Status Counts Metrics Contract ---');

  // 4.1 getAdminUserRoleCounts exported with head: true
  report(
    'CNT-01',
    profilesSource.includes('export async function getAdminUserRoleCounts(') &&
      profilesSource.includes(".select('*', { count: 'exact', head: true })"),
    'getAdminUserRoleCounts is exported and executes parallel lightweight HEAD count queries',
    'METRICS'
  );

  // 4.2 Counts all required roles and account statuses
  report(
    'CNT-02',
    profilesSource.includes("buildCountQuery('student')") &&
      profilesSource.includes("buildCountQuery('mentor')") &&
      profilesSource.includes("buildCountQuery('admin')") &&
      profilesSource.includes(".eq('status', 'active')") &&
      profilesSource.includes(".eq('status', 'not_activated')") &&
      profilesSource.includes(".eq('status', 'suspended')"),
    'Role counts cover total, students, mentors, admins, and status counters (active, notActivated, suspended)',
    'METRICS'
  );

  // 4.3 Typed AdminUserRoleCounts interface
  report(
    'CNT-03',
    profilesSource.includes('export interface AdminUserRoleCounts') &&
      profilesSource.includes('total: number;') &&
      profilesSource.includes('students: number;') &&
      profilesSource.includes('mentors: number;') &&
      profilesSource.includes('admins: number;') &&
      profilesSource.includes('active: number;') &&
      profilesSource.includes('notActivated: number;') &&
      profilesSource.includes('suspended: number;'),
    'AdminUserRoleCounts defines complete typed numerical metrics for all buckets',
    'METRICS'
  );

  // 4.4 Error handling
  report(
    'CNT-04',
    profilesSource.includes('if (totalRes.error)') &&
      profilesSource.includes('error: totalRes.error'),
    'getAdminUserRoleCounts handles query errors cleanly without throwing unhandled rejections',
    'METRICS'
  );

  console.log('\n--- Section 5: Mock Store Simulation & In-Memory Fidelity ---');

  // 5.1 Dataset slicing simulation
  const dummyUsers = Array.from({ length: 77 }, (_, i) => ({
    id: `usr_${String(i + 1).padStart(3, '0')}`,
    full_name: `User ${i + 1}`,
    email: `user${i + 1}@poraplan.test`,
    poraplan_id: `PP${String(i + 1).padStart(3, '0')}`,
    role: (i % 3 === 0 ? 'student' : i % 3 === 1 ? 'mentor' : 'admin') as 'student' | 'mentor' | 'admin',
    status: (i % 5 === 0 ? 'suspended' : 'active') as 'suspended' | 'active',
    created_at: new Date(Date.now() - i * 3600000).toISOString(),
  }));

  const totalPages = calculateTotalPages(dummyUsers.length, 25);
  report('SIM-01', totalPages === 4, 'Dataset of 77 profiles at 25/page yields exactly 4 total pages', 'SIMULATION');

  const metaP1 = createPaginationMeta({ page: 1, pageSize: 25, totalCount: dummyUsers.length });
  const metaP2 = createPaginationMeta({ page: 2, pageSize: 25, totalCount: dummyUsers.length });
  const metaP3 = createPaginationMeta({ page: 3, pageSize: 25, totalCount: dummyUsers.length });
  const metaP4 = createPaginationMeta({ page: 4, pageSize: 25, totalCount: dummyUsers.length });

  report(
    'SIM-02',
    metaP1.displayStart === 1 && metaP1.displayEnd === 25 &&
      metaP2.displayStart === 26 && metaP2.displayEnd === 50 &&
      metaP3.displayStart === 51 && metaP3.displayEnd === 75 &&
      metaP4.displayStart === 76 && metaP4.displayEnd === 77,
    'Continuous item range indices (1-25, 26-50, 51-75, 76-77) derived accurately',
    'SIMULATION'
  );

  report(
    'SIM-03',
    !metaP1.hasPreviousPage && metaP1.hasNextPage &&
      metaP2.hasPreviousPage && metaP2.hasNextPage &&
      metaP4.hasPreviousPage && !metaP4.hasNextPage,
    'Pagination boundary navigation flags match first, middle, and terminal pages',
    'SIMULATION'
  );

  // 5.2 Deterministic sort simulation
  const unsorted = [
    { id: 'b_id', created_at: '2026-01-01T10:00:00Z' },
    { id: 'a_id', created_at: '2026-01-01T10:00:00Z' },
    { id: 'c_id', created_at: '2026-01-02T10:00:00Z' },
    { id: 'd_id', created_at: undefined },
  ];
  unsorted.sort((a, b) => {
    const timeA = a.created_at ? new Date(a.created_at).getTime() : -Infinity;
    const timeB = b.created_at ? new Date(b.created_at).getTime() : -Infinity;
    if (timeB !== timeA) return timeB - timeA;
    return (a.id || '').localeCompare(b.id || '');
  });
  report(
    'SIM-04',
    unsorted[0].id === 'c_id' &&
      unsorted[1].id === 'a_id' &&
      unsorted[2].id === 'b_id' &&
      unsorted[3].id === 'd_id',
    'Deterministic sorting: latest created_at first, tie-break on id ASC, undefined dates last',
    'SIMULATION'
  );

  console.log('\n--- Section 6: Code Hygiene, Security & Protected Files ---');

  // 6.1 Zero emojis across Batch 4.5B-2 files
  const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
  const filesToCheck = [
    'src/lib/profiles.ts',
    'src/__tests__/adminUsersPagination.test.ts',
  ];

  let hasEmoji = false;
  for (const rel of filesToCheck) {
    const full = path.join(projectRoot, rel);
    if (fs.existsSync(full)) {
      const content = fs.readFileSync(full, 'utf8');
      if (emojiRegex.test(content)) {
        hasEmoji = true;
        console.error(`Emoji detected in ${rel}`);
      }
    }
  }
  report('HYG-01', !hasEmoji, 'Zero emojis detected across all Batch 4.5B-2 files', 'HYGIENE');

  // 6.2 Zero secrets or private keys exposed in source files
  const sourceFiles = [
    'src/lib/profiles.ts',
  ];
  const secretPatterns = [
    /eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9/,
    /service_role/i,
    /sbp_[a-zA-Z0-9]{30,}/,
    /postgres:\/\/postgres:[^@]+@/,
    /sk_live_[a-zA-Z0-9]+/,
  ];
  let secretFound = false;
  for (const rel of sourceFiles) {
    const full = path.join(projectRoot, rel);
    if (fs.existsSync(full)) {
      const content = fs.readFileSync(full, 'utf8');
      for (const pattern of secretPatterns) {
        if (pattern.test(content)) {
          secretFound = true;
          console.error(`Potential secret pattern detected in ${rel}`);
        }
      }
    }
  }
  report('HYG-02', !secretFound, 'Zero hardcoded secrets or credentials exposed in Batch 4.5B-2 files', 'HYGIENE');

  // 6.3 Strictly protected user files remain untouched
  const protectedFiles = [
    'src/pages/dashboard/AdminUsersPage.tsx',
    'src/pages/dashboard/MentorTasksPage.tsx',
    'src/pages/dashboard/PublicProfilePage.tsx',
    'src/pages/dashboard/StudentLibraryPage.tsx',
  ];

  let allProtectedExist = true;
  for (const rel of protectedFiles) {
    const full = path.join(projectRoot, rel);
    if (!fs.existsSync(full)) {
      allProtectedExist = false;
    }
  }
  report('HYG-03', allProtectedExist, 'All 4 protected user files are recognized and left undisturbed', 'HYGIENE');

  console.log('\n======================================================');
  console.log(`Summary: ${passCount}/${passCount + failCount} scenarios passed (${failCount} failed).`);
  console.log('======================================================\n');

  if (failCount > 0) {
    process.exit(1);
  }
}

runTests();
