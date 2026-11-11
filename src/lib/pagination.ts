/**
 * PoraPlan — Shared Pagination Utilities
 *
 * Implements deterministic range calculations, input normalization,
 * metadata derivation, and compact page-number distribution for
 * Supabase PostgREST offset/range queries.
 *
 * IMPORTANT NOTE ON SUPABASE POSTGREST RANGE:
 * Supabase `.range(from, to)` uses 0-BASED INCLUSIVE ENDPOINTS.
 * - Page 1 (pageSize 20): from = 0,  to = 19  (exactly 20 rows)
 * - Page 2 (pageSize 20): from = 20, to = 39  (exactly 20 rows)
 * - Page 3 (pageSize 20): from = 40, to = 59  (exactly 20 rows)
 * Formula:
 *   from = (page - 1) * pageSize
 *   to   = from + pageSize - 1
 */

import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  MIN_PAGE_SIZE,
  MAX_PAGE_SIZE,
  type PaginationMeta,
  type PaginationParams,
} from '../types/pagination';

/**
 * Normalizes an arbitrary page input into a valid 1-based integer.
 * - Rejects 0, negative numbers, floats, NaN, and non-numeric values.
 * - Always returns an integer >= 1.
 */
export function normalizePage(page: unknown): number {
  if (typeof page !== 'number' || Number.isNaN(page) || !Number.isFinite(page)) {
    return DEFAULT_PAGE;
  }
  const floored = Math.floor(page);
  return floored < 1 ? DEFAULT_PAGE : floored;
}

/**
 * Normalizes an arbitrary page size into a bounded integer.
 * - Rejects 0, negative numbers, floats, NaN, and non-numeric values.
 * - Clamps values between MIN_PAGE_SIZE (1) and MAX_PAGE_SIZE (100).
 */
export function normalizePageSize(
  pageSize: unknown,
  defaultSize = DEFAULT_PAGE_SIZE
): number {
  if (typeof pageSize !== 'number' || Number.isNaN(pageSize) || !Number.isFinite(pageSize)) {
    return defaultSize;
  }
  const floored = Math.floor(pageSize);
  if (floored < MIN_PAGE_SIZE) return MIN_PAGE_SIZE;
  if (floored > MAX_PAGE_SIZE) return MAX_PAGE_SIZE;
  return floored;
}

/**
 * Calculates total available pages from a total record count and page size.
 * - Returns at least 1 page even for empty datasets (page 1 of 1).
 */
export function calculateTotalPages(totalCount: number, pageSize: number): number {
  const safeCount = Math.max(0, Math.floor(totalCount) || 0);
  const safeSize = Math.max(1, Math.floor(pageSize) || DEFAULT_PAGE_SIZE);
  return safeCount === 0 ? 1 : Math.ceil(safeCount / safeSize);
}

export interface RangeCalculationOptions {
  page?: number;
  pageSize?: number;
  totalCount?: number;
  clampToTotal?: boolean;
}

export interface CalculatedRange {
  from: number;
  to: number;
  page: number;
  pageSize: number;
  totalPages?: number;
}

/**
 * Calculates Supabase-compatible inclusive 0-based range endpoints.
 *
 * @param options.page Requested 1-based page index (defaults to 1).
 * @param options.pageSize Requested page size (defaults to 20, max 100).
 * @param options.totalCount Optional total count for upper-bound clamping.
 * @param options.clampToTotal When true, clamps page to totalPages if exceeded.
 */
export function calculatePaginationRange(
  options?: RangeCalculationOptions
): CalculatedRange {
  let page = normalizePage(options?.page);
  const pageSize = normalizePageSize(options?.pageSize);

  let totalPages: number | undefined;

  if (options?.totalCount !== undefined) {
    totalPages = calculateTotalPages(options.totalCount, pageSize);
    if (options.clampToTotal && page > totalPages) {
      page = totalPages;
    }
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  return {
    from,
    to,
    page,
    pageSize,
    totalPages,
  };
}

/**
 * Derives a full PaginationMeta object from input parameters and totalCount.
 */
export function createPaginationMeta(options: {
  page?: number;
  pageSize?: number;
  totalCount: number;
  clampToTotal?: boolean;
}): PaginationMeta {
  const safeTotal = Math.max(0, Math.floor(options.totalCount) || 0);
  const pageSize = normalizePageSize(options.pageSize);
  const totalPages = calculateTotalPages(safeTotal, pageSize);

  let page = normalizePage(options.page);
  if (options.clampToTotal && page > totalPages) {
    page = totalPages;
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const displayStart = safeTotal === 0 ? 0 : from + 1;
  const displayEnd = safeTotal === 0 ? 0 : Math.min(safeTotal, to + 1);

  return {
    page,
    pageSize,
    totalCount: safeTotal,
    totalPages,
    hasPreviousPage: page > 1,
    hasNextPage: page < totalPages,
    from,
    to,
    displayStart,
    displayEnd,
  };
}

/**
 * Generates an accessible, compact array of page numbers and ellipsis tokens
 * for UI pagination controls.
 *
 * Example patterns:
 * - 5 pages: [1, 2, 3, 4, 5]
 * - 20 pages, at page 1: [1, 2, 3, 4, 'ellipsis', 20]
 * - 20 pages, at page 10: [1, 'ellipsis', 9, 10, 11, 'ellipsis', 20]
 * - 20 pages, at page 20: [1, 'ellipsis', 17, 18, 19, 20]
 */
export function getPageNumbers(
  currentPage: number,
  totalPages: number,
  siblingCount = 1
): (number | 'ellipsis')[] {
  const safeCurrent = normalizePage(currentPage);
  const safeTotal = Math.max(1, Math.floor(totalPages) || 1);

  // If total pages is small, show all numbers without ellipsis
  const totalNumbers = siblingCount * 2 + 5; // 1 + siblings + current + siblings + total + 2 ellipses
  if (safeTotal <= totalNumbers) {
    return Array.from({ length: safeTotal }, (_, i) => i + 1);
  }

  const leftSibling = Math.max(safeCurrent - siblingCount, 1);
  const rightSibling = Math.min(safeCurrent + siblingCount, safeTotal);

  const shouldShowLeftEllipsis = leftSibling > 2;
  const shouldShowRightEllipsis = rightSibling < safeTotal - 1;

  // Case 1: No left ellipsis, only right ellipsis
  if (!shouldShowLeftEllipsis && shouldShowRightEllipsis) {
    const leftItemCount = 3 + 2 * siblingCount;
    const leftRange = Array.from({ length: leftItemCount }, (_, i) => i + 1);
    return [...leftRange, 'ellipsis', safeTotal];
  }

  // Case 2: Only left ellipsis, no right ellipsis
  if (shouldShowLeftEllipsis && !shouldShowRightEllipsis) {
    const rightItemCount = 3 + 2 * siblingCount;
    const start = safeTotal - rightItemCount + 1;
    const rightRange = Array.from({ length: rightItemCount }, (_, i) => start + i);
    return [1, 'ellipsis', ...rightRange];
  }

  // Case 3: Both left and right ellipsis
  const middleRange = Array.from(
    { length: rightSibling - leftSibling + 1 },
    (_, i) => leftSibling + i
  );
  return [1, 'ellipsis', ...middleRange, 'ellipsis', safeTotal];
}

/**
 * Helper to reset pagination state to page 1 while preserving current page size.
 * Use when filtering, sorting, or searching changes.
 */
export function resetPaginationToFirstPage(
  current: PaginationParams
): PaginationParams {
  return {
    ...current,
    page: DEFAULT_PAGE,
  };
}

