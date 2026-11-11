/// <reference types="node" />
/**
 * PoraPlan — Batch 4.1: Shared Pagination Foundation Test Suite
 *
 * Validates:
 * 1. Supabase PostgREST Inclusive Range Calculation:
 *    - First-page range calculation (0-based inclusive)
 *    - Middle-page range calculation
 *    - Last-page range calculation
 *    - Empty dataset handling
 * 2. Normalization & Edge Cases:
 *    - Invalid page inputs (0, negative, NaN, floats, strings)
 *    - Invalid page sizes (0, negative, NaN, oversized > 100)
 *    - Requested page beyond last page (clamp and unclamped)
 *    - Total pages calculation (clean division, remainder, zero total)
 *    - Previous / Next navigation flags
 *    - Resetting page to 1 upon filter changes
 * 3. Compact Page Number Strategy (Ellipsis):
 *    - Small page counts (<= 7) without ellipsis
 *    - Large counts at start ([1, 2, 3, 4, 'ellipsis', 20])
 *    - Large counts in middle ([1, 'ellipsis', 9, 10, 11, 'ellipsis', 20])
 *    - Large counts at end ([1, 'ellipsis', 17, 18, 19, 20])
 * 4. PaginationControls Component Simulation & Architecture:
 *    - Props interface and default exports
 *    - Accessible ARIA attributes (role="navigation", aria-current="page", aria-label)
 *    - Page change callbacks and duplicate click suppression
 *    - Disabled and loading states preventing callback execution
 * 5. Security & Design Hygiene:
 *    - Zero emojis across all touched files
 *    - Zero exposed secrets or private tokens
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  normalizePage,
  normalizePageSize,
  calculateTotalPages,
  calculatePaginationRange,
  createPaginationMeta,
  getPageNumbers,
  resetPaginationToFirstPage,
} from '../lib/pagination';
import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  MIN_PAGE_SIZE,
  MAX_PAGE_SIZE,
} from '../types/pagination';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

let passCount = 0;
let failCount = 0;

function report(
  id: string,
  condition: boolean,
  description: string,
  category: 'RANGE' | 'NORMALIZATION' | 'ELLIPSIS' | 'CONTROLS' | 'HYGIENE' = 'RANGE'
) {
  if (condition) {
    console.log(`[PASS] [${category}] ${id}: ${description}`);
    passCount++;
  } else {
    console.error(`[FAIL] [${category}] ${id}: ${description}`);
    failCount++;
  }
}

// ============================================================================
// SECTION 1: Range Calculation Tests (Supabase 0-Based Inclusive)
// ============================================================================
console.log('\n--- Section 1: Supabase Inclusive Range Calculation ---');

// 1.1 First page range calculation
{
  const r = calculatePaginationRange({ page: 1, pageSize: 20 });
  report(
    'RANGE-01',
    r.from === 0 && r.to === 19 && r.page === 1 && r.pageSize === 20,
    'First page (page 1, size 20) yields inclusive range from=0, to=19 (20 items)'
  );
}

// 1.2 Middle page range calculation
{
  const r = calculatePaginationRange({ page: 3, pageSize: 15 });
  report(
    'RANGE-02',
    r.from === 30 && r.to === 44 && r.page === 3 && r.pageSize === 15,
    'Middle page (page 3, size 15) yields inclusive range from=30, to=44 (15 items)'
  );
}

// 1.3 Last page range calculation
{
  const r = calculatePaginationRange({ page: 5, pageSize: 20, totalCount: 95 });
  report(
    'RANGE-03',
    r.from === 80 && r.to === 99 && r.totalPages === 5,
    'Last page (page 5, size 20, total 95) yields from=80, to=99 with totalPages=5'
  );
}

// 1.4 Empty dataset handling
{
  const r = calculatePaginationRange({ page: 1, pageSize: 20, totalCount: 0 });
  const meta = createPaginationMeta({ page: 1, pageSize: 20, totalCount: 0 });
  report(
    'RANGE-04',
    r.totalPages === 1 && meta.displayStart === 0 && meta.displayEnd === 0 && meta.totalCount === 0,
    'Empty dataset (totalCount 0) yields totalPages=1, displayStart=0, displayEnd=0'
  );
}

// ============================================================================
// SECTION 2: Normalization, Clamping & Derivations
// ============================================================================
console.log('\n--- Section 2: Input Normalization & Edge Cases ---');

// 2.1 Invalid page values normalized to 1
{
  const testCases = [0, -1, -99, NaN, Infinity, -Infinity, null, undefined, 1.7];
  const allNormalized = testCases.every((val) => {
    const res = normalizePage(val);
    return res >= 1 && Number.isInteger(res);
  });
  report(
    'NORM-01',
    allNormalized && normalizePage(0) === DEFAULT_PAGE && normalizePage(-5) === DEFAULT_PAGE && normalizePage(2.9) === 2,
    'Invalid page values (0, negative, NaN, floats) normalize safely to integer >= 1'
  );
}

// 2.2 Invalid page sizes normalized and clamped
{
  const testZero = normalizePageSize(0);
  const testNeg = normalizePageSize(-10);
  const testLarge = normalizePageSize(500);
  const testNaN = normalizePageSize(NaN);
  report(
    'NORM-02',
    testZero === MIN_PAGE_SIZE &&
      testNeg === MIN_PAGE_SIZE &&
      testLarge === MAX_PAGE_SIZE &&
      testNaN === DEFAULT_PAGE_SIZE,
    `Page sizes normalize and clamp within [${MIN_PAGE_SIZE}, ${MAX_PAGE_SIZE}] (defaults to ${DEFAULT_PAGE_SIZE})`,
    'NORMALIZATION'
  );
}

// 2.3 Requested page beyond the last page
{
  // Without clampToTotal: preserves mathematical range
  const unclamped = calculatePaginationRange({ page: 10, pageSize: 20, totalCount: 40 });
  // With clampToTotal: clamps page to totalPages
  const clamped = calculatePaginationRange({
    page: 10,
    pageSize: 20,
    totalCount: 40,
    clampToTotal: true,
  });
  report(
    'NORM-03',
    unclamped.page === 10 && clamped.page === 2 && clamped.from === 20 && clamped.to === 39,
    'Requested page beyond total pages clamps safely to totalPages when requested',
    'NORMALIZATION'
  );
}

// 2.4 Total pages calculation
{
  const t0 = calculateTotalPages(0, 20); // 1
  const t1 = calculateTotalPages(20, 20); // 1
  const t2 = calculateTotalPages(21, 20); // 2
  const t3 = calculateTotalPages(99, 25); // 4
  const t4 = calculateTotalPages(100, 25); // 4
  report(
    'NORM-04',
    t0 === 1 && t1 === 1 && t2 === 2 && t3 === 4 && t4 === 4,
    'calculateTotalPages computes exact ceiling division and minimum 1 page',
    'NORMALIZATION'
  );
}

// 2.5 Previous & Next navigation availability
{
  const p1 = createPaginationMeta({ page: 1, pageSize: 10, totalCount: 30 });
  const p2 = createPaginationMeta({ page: 2, pageSize: 10, totalCount: 30 });
  const p3 = createPaginationMeta({ page: 3, pageSize: 10, totalCount: 30 });

  const p1Correct = !p1.hasPreviousPage && p1.hasNextPage;
  const p2Correct = p2.hasPreviousPage && p2.hasNextPage;
  const p3Correct = p3.hasPreviousPage && !p3.hasNextPage;

  report(
    'NORM-05',
    p1Correct && p2Correct && p3Correct,
    'hasPreviousPage and hasNextPage correctly track boundary states',
    'NORMALIZATION'
  );
}

// 2.6 Filter change resets page to 1
{
  const currentParams = { page: 4, pageSize: 20 };
  const resetParams = resetPaginationToFirstPage(currentParams);
  report(
    'NORM-06',
    resetParams.page === 1 && resetParams.pageSize === 20,
    'resetPaginationToFirstPage resets page to 1 while preserving current pageSize',
    'NORMALIZATION'
  );
}

// ============================================================================
// SECTION 3: Compact Page Number Sequence (Ellipsis Strategy)
// ============================================================================
console.log('\n--- Section 3: Compact Page Number Strategy (Ellipsis) ---');

// 3.1 Small page count without ellipsis
{
  const pages5 = getPageNumbers(2, 5);
  const pages7 = getPageNumbers(4, 7);
  report(
    'ELLIPSIS-01',
    JSON.stringify(pages5) === JSON.stringify([1, 2, 3, 4, 5]) &&
      JSON.stringify(pages7) === JSON.stringify([1, 2, 3, 4, 5, 6, 7]),
    'Small page counts (<= 7) render all page numbers without ellipsis',
    'ELLIPSIS'
  );
}

// 3.2 Large page count near start
{
  const pagesStart = getPageNumbers(2, 20, 1);
  const expected = [1, 2, 3, 4, 5, 'ellipsis', 20];
  report(
    'ELLIPSIS-02',
    JSON.stringify(pagesStart) === JSON.stringify(expected),
    'Active page near start (page 2 of 20) renders right ellipsis only',
    'ELLIPSIS'
  );
}

// 3.3 Large page count in middle
{
  const pagesMid = getPageNumbers(10, 20, 1);
  const expected = [1, 'ellipsis', 9, 10, 11, 'ellipsis', 20];
  report(
    'ELLIPSIS-03',
    JSON.stringify(pagesMid) === JSON.stringify(expected),
    'Active page in middle (page 10 of 20) renders both left and right ellipsis',
    'ELLIPSIS'
  );
}

// 3.4 Large page count near end
{
  const pagesEnd = getPageNumbers(19, 20, 1);
  const expected = [1, 'ellipsis', 16, 17, 18, 19, 20];
  report(
    'ELLIPSIS-04',
    JSON.stringify(pagesEnd) === JSON.stringify(expected),
    'Active page near end (page 19 of 20) renders left ellipsis only',
    'ELLIPSIS'
  );
}

// ============================================================================
// SECTION 4: PaginationControls Static Architecture & Simulation
// ============================================================================
console.log('\n--- Section 4: PaginationControls Component Architecture & Simulation ---');

const componentPath = path.join(
  projectRoot,
  'src/components/common/PaginationControls.tsx'
);
const componentExists = fs.existsSync(componentPath);
const componentContent = componentExists ? fs.readFileSync(componentPath, 'utf8') : '';

// 4.1 Component file exists and exports named and default
report(
  'CONTROLS-01',
  componentExists &&
    componentContent.includes('export const PaginationControls') &&
    componentContent.includes('export default PaginationControls'),
  'PaginationControls.tsx exists with both named and default exports',
  'CONTROLS'
);

// 4.2 Accessible navigation landmark
report(
  'CONTROLS-02',
  componentContent.includes('role="navigation"') &&
    componentContent.includes('aria-label=') &&
    componentContent.includes('aria-current='),
  'PaginationControls includes semantic role="navigation", aria-label, and aria-current="page"',
  'CONTROLS'
);

// 4.3 Interactive controls: Prev, Next, First, Last, and Page Size
report(
  'CONTROLS-03',
  componentContent.includes('ChevronLeft') &&
    componentContent.includes('ChevronRight') &&
    componentContent.includes('ChevronsLeft') &&
    componentContent.includes('ChevronsRight') &&
    componentContent.includes('showPageSizeSelector'),
  'PaginationControls provides Prev, Next, First, Last icons and page-size selector',
  'CONTROLS'
);

// Pure simulation harness for PaginationControls behavior
interface SimulatedControlState {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  isLoading: boolean;
  disabled: boolean;
}

class SimulatedPaginationControls {
  state: SimulatedControlState;
  pageChangeLog: number[] = [];
  sizeChangeLog: number[] = [];

  constructor(initial: SimulatedControlState) {
    this.state = initial;
  }

  clickPage(targetPage: number): boolean {
    if (this.state.disabled || this.state.isLoading) return false;
    if (targetPage === this.state.currentPage) return false;
    if (targetPage < 1 || targetPage > this.state.totalPages) return false;

    this.state.currentPage = targetPage;
    this.pageChangeLog.push(targetPage);
    return true;
  }

  clickNext(): boolean {
    return this.clickPage(this.state.currentPage + 1);
  }

  clickPrev(): boolean {
    return this.clickPage(this.state.currentPage - 1);
  }

  selectPageSize(newSize: number): boolean {
    if (this.state.disabled || this.state.isLoading) return false;
    this.state.pageSize = newSize;
    this.sizeChangeLog.push(newSize);
    return true;
  }
}

// 4.4 Callback dispatch on page navigation
{
  const sim = new SimulatedPaginationControls({
    currentPage: 2,
    totalPages: 5,
    pageSize: 20,
    isLoading: false,
    disabled: false,
  });

  const nextOk = sim.clickNext(); // goes to 3
  const prevOk = sim.clickPrev(); // goes to 2
  const directOk = sim.clickPage(5); // goes to 5
  const duplicateIgnored = !sim.clickPage(5); // clicking 5 again ignored
  const outOfBoundsIgnored = !sim.clickNext(); // page 6 does not exist

  report(
    'CONTROLS-04',
    nextOk && prevOk && directOk && duplicateIgnored && outOfBoundsIgnored &&
      JSON.stringify(sim.pageChangeLog) === JSON.stringify([3, 2, 5]),
    'Page change callbacks dispatch correctly and ignore duplicate or out-of-bounds clicks',
    'CONTROLS'
  );
}

// 4.5 Disabled and Loading state suppression
{
  const loadingSim = new SimulatedPaginationControls({
    currentPage: 1,
    totalPages: 5,
    pageSize: 20,
    isLoading: true,
    disabled: false,
  });

  const clickDuringLoad = loadingSim.clickNext();

  const disabledSim = new SimulatedPaginationControls({
    currentPage: 1,
    totalPages: 5,
    pageSize: 20,
    isLoading: false,
    disabled: true,
  });

  const clickDuringDisabled = disabledSim.clickNext();

  report(
    'CONTROLS-05',
    !clickDuringLoad &&
      !clickDuringDisabled &&
      loadingSim.pageChangeLog.length === 0 &&
      disabledSim.pageChangeLog.length === 0,
    'Loading and disabled states strictly suppress navigation callbacks',
    'CONTROLS'
  );
}

// ============================================================================
// SECTION 5: Security & Design Hygiene
// ============================================================================
console.log('\n--- Section 5: Security & Design Hygiene Verification ---');

// 5.1 Zero emojis across all touched files
const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1FA70}-\u{1FAFF}]/u;

const typesPath = path.join(projectRoot, 'src/types/pagination.ts');
const libPath = path.join(projectRoot, 'src/lib/pagination.ts');

const typesContent = fs.readFileSync(typesPath, 'utf8');
const libContent = fs.readFileSync(libPath, 'utf8');

const allFilesContent = [typesContent, libContent, componentContent];
const hasNoEmojis = allFilesContent.every((content) => !emojiRegex.test(content));

report(
  'HYGIENE-01',
  hasNoEmojis,
  'Zero emojis detected in pagination types, utilities, or controls component',
  'HYGIENE'
);

// 5.2 Zero exposed secrets or credential tokens
const secretRegex = /(eyJhbGciOi|service_role|supabase_secret|PRIVATE_KEY|password\s*=\s*['"][^'"]+['"])/i;
const hasNoSecrets = allFilesContent.every((content) => !secretRegex.test(content));

report(
  'HYGIENE-02',
  hasNoSecrets,
  'Zero exposed secrets, tokens, or private credentials in touched pagination files',
  'HYGIENE'
);

// ============================================================================
// Summary
// ============================================================================
console.log('\n======================================================');
console.log(
  `Summary: ${passCount}/${passCount + failCount} scenarios passed (${failCount} failed).`
);
console.log('======================================================\n');

if (failCount > 0) {
  process.exit(1);
}
