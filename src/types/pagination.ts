/**
 * PoraPlan — Shared Pagination Types & Contract
 *
 * Defines consistent, strongly typed pagination structures for
 * query parameters, metadata, and paginated responses across
 * student, mentor, and admin domains.
 */

export interface PaginationParams {
  /** 1-based page number (defaults to 1) */
  page?: number;
  /** Number of records per page (defaults to 20) */
  pageSize?: number;
}

export interface PaginationMeta {
  /** Current 1-based page index */
  page: number;
  /** Number of items requested per page */
  pageSize: number;
  /** Total matching records in database */
  totalCount: number;
  /** Total computed pages (minimum 1) */
  totalPages: number;
  /** Whether a previous page exists (page > 1) */
  hasPreviousPage: boolean;
  /** Whether a next page exists (page < totalPages) */
  hasNextPage: boolean;
  /** 0-based inclusive start index for Supabase .range(from, to) */
  from: number;
  /** 0-based inclusive end index for Supabase .range(from, to) */
  to: number;
  /** 1-based display start index for UI (e.g. 1 in "Showing 1-20 of 100") */
  displayStart: number;
  /** 1-based display end index for UI (e.g. 20 in "Showing 1-20 of 100") */
  displayEnd: number;
}

/**
 * Generic container for paginated service query results.
 */
export interface PaginatedResult<T> {
  data: T[];
  pagination: PaginationMeta;
  error: Error | null;
}

/** Default 1-based page index */
export const DEFAULT_PAGE = 1;

/** Default number of items per page across PoraPlan list views */
export const DEFAULT_PAGE_SIZE = 20;

/** Minimum allowed page size */
export const MIN_PAGE_SIZE = 1;

/** Maximum allowed page size to prevent denial-of-service / memory exhaustion */
export const MAX_PAGE_SIZE = 100;

/** Standard page-size choices for administrative and high-density tables */
export const STANDARD_PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;

