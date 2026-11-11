import React from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Loader2,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  getPageNumbers,
  createPaginationMeta,
} from '../../lib/pagination';
import {
  STANDARD_PAGE_SIZE_OPTIONS,
  type PaginationMeta,
} from '../../types/pagination';

export interface PaginationControlsProps {
  /** Current active 1-based page index */
  currentPage: number;
  /** Total computed pages */
  totalPages: number;
  /** Total matching records (optional, enables detailed "Showing X-Y of Z" summary) */
  totalCount?: number;
  /** Active page size (records per page) */
  pageSize?: number;
  /** Optional array of allowed page sizes (defaults to [10, 20, 50, 100]) */
  pageSizeOptions?: readonly number[];
  /** Callback triggered when user requests a page change */
  onPageChange: (newPage: number) => void;
  /** Callback triggered when user selects a different page size */
  onPageSizeChange?: (newPageSize: number) => void;
  /** Whether data is currently loading (disables buttons to prevent duplicate requests) */
  isLoading?: boolean;
  /** Whether the entire control is disabled */
  disabled?: boolean;
  /** Custom wrapper CSS classes */
  className?: string;
  /** Whether to render the page-size dropdown selector */
  showPageSizeSelector?: boolean;
  /** Whether to render the records/page summary text */
  showSummary?: boolean;
  /** Accessible label for the navigation landmark */
  ariaLabel?: string;
}

/**
 * Reusable, accessible Brutalist Pagination Controls component.
 *
 * Implements:
 * - Desktop numeric page buttons with smart ellipsis
 * - Touch-friendly compact mobile view (Prev, Page X of Y, Next)
 * - Safe loading and disabled states preventing duplicate requests
 * - Zero emojis, fully integrated with light and midnight dark themes
 */
export const PaginationControls: React.FC<PaginationControlsProps> = ({
  currentPage,
  totalPages,
  totalCount,
  pageSize,
  pageSizeOptions = STANDARD_PAGE_SIZE_OPTIONS,
  onPageChange,
  onPageSizeChange,
  isLoading = false,
  disabled = false,
  className,
  showPageSizeSelector = true,
  showSummary = true,
  ariaLabel = 'Pagination Navigation',
}) => {
  const safeTotalPages = Math.max(1, totalPages);
  const safeCurrentPage = Math.min(Math.max(1, currentPage), safeTotalPages);
  const isInteractivityBlocked = disabled || isLoading;

  const hasPrev = safeCurrentPage > 1;
  const hasNext = safeCurrentPage < safeTotalPages;

  // Derive human-readable summary range
  let summaryText = `Page ${safeCurrentPage} of ${safeTotalPages}`;
  if (totalCount !== undefined && pageSize !== undefined) {
    const meta: PaginationMeta = createPaginationMeta({
      page: safeCurrentPage,
      pageSize,
      totalCount,
    });
    if (meta.totalCount === 0) {
      summaryText = '0 records';
    } else {
      summaryText = `Showing ${meta.displayStart}–${meta.displayEnd} of ${meta.totalCount}`;
    }
  }

  const pageNumbers = getPageNumbers(safeCurrentPage, safeTotalPages);

  const handlePageClick = (page: number) => {
    if (isInteractivityBlocked || page === safeCurrentPage) return;
    if (page >= 1 && page <= safeTotalPages) {
      onPageChange(page);
    }
  };

  const handlePageSizeSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (isInteractivityBlocked || !onPageSizeChange) return;
    const newSize = parseInt(e.target.value, 10);
    if (!Number.isNaN(newSize) && newSize > 0) {
      onPageSizeChange(newSize);
    }
  };

  // Base button styling adhering to PoraPlan Brutalist design system
  const navBtnClass =
    'inline-flex items-center justify-center font-mono text-[11px] sm:text-xs font-bold border sm:border-2 border-brand-dark bg-brand-paper dark:bg-brand-dark text-brand-dark dark:text-brand-paper transition-all select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none min-h-[36px] sm:min-h-[34px] px-2.5 sm:px-3 py-1 shadow-none sm:shadow-brutal-xs hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none';

  return (
    <nav
      role="navigation"
      aria-label={ariaLabel}
      className={cn(
        'w-full flex flex-col sm:flex-row items-center justify-between gap-3 p-2.5 sm:p-4 border sm:border-2 border-brand-dark bg-brand-paper dark:bg-brand-dark/50 shadow-none sm:shadow-brutal',
        className
      )}
    >
      {/* Left section: Summary and Page Size Selector */}
      <div className="w-full sm:w-auto flex flex-wrap items-center justify-between sm:justify-start gap-2.5 sm:gap-4 text-xs font-mono">
        {showSummary && (
          <span
            className="text-brand-dark dark:text-brand-paper/90 font-bold uppercase tracking-wider"
            data-testid="pagination-summary"
          >
            {summaryText}
          </span>
        )}

        {showPageSizeSelector && onPageSizeChange && (
          <div className="inline-flex items-center gap-1.5">
            <label
              htmlFor="pagination-page-size"
              className="text-[11px] text-brand-muted uppercase font-bold"
            >
              Per Page:
            </label>
            <select
              id="pagination-page-size"
              value={pageSize || 20}
              onChange={handlePageSizeSelect}
              disabled={isInteractivityBlocked}
              aria-label="Records per page"
              className="font-mono text-xs border sm:border-2 border-brand-dark bg-brand-paper dark:bg-brand-dark text-brand-dark dark:text-brand-paper px-2 py-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal shadow-none sm:shadow-brutal-xs cursor-pointer disabled:opacity-50"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        )}

        {isLoading && (
          <span
            className="inline-flex items-center gap-1 text-[11px] font-mono text-brand-teal animate-pulse"
            aria-live="polite"
          >
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Updating...</span>
          </span>
        )}
      </div>

      {/* Right section: Navigation Controls */}
      <div className="w-full sm:w-auto flex items-center justify-between sm:justify-end gap-1.5 sm:gap-2">
        {/* First Page (Desktop only) */}
        <button
          type="button"
          onClick={() => handlePageClick(1)}
          disabled={!hasPrev || isInteractivityBlocked}
          aria-label="Go to first page"
          title="First Page"
          className={cn(navBtnClass, 'hidden sm:inline-flex px-2')}
        >
          <ChevronsLeft className="w-4 h-4" />
        </button>

        {/* Previous Button */}
        <button
          type="button"
          onClick={() => handlePageClick(safeCurrentPage - 1)}
          disabled={!hasPrev || isInteractivityBlocked}
          aria-label="Go to previous page"
          className={navBtnClass}
        >
          <ChevronLeft className="w-4 h-4 mr-0.5 sm:mr-1" />
          <span>PREV</span>
        </button>

        {/* Compact Mobile Page Indicator (< 640px) */}
        <div className="sm:hidden font-mono text-xs font-bold text-brand-navy dark:text-brand-paper px-2">
          {safeCurrentPage} / {safeTotalPages}
        </div>

        {/* Desktop Page Numbers list (>= 640px) */}
        <div className="hidden sm:inline-flex items-center gap-1">
          {pageNumbers.map((item, index) => {
            if (item === 'ellipsis') {
              return (
                <span
                  key={`ellipsis-${index}`}
                  className="px-2 py-1 font-mono text-xs text-brand-muted select-none"
                  aria-hidden="true"
                >
                  ...
                </span>
              );
            }

            const isCurrent = item === safeCurrentPage;

            return (
              <button
                key={`page-${item}`}
                type="button"
                onClick={() => handlePageClick(item)}
                disabled={isInteractivityBlocked}
                aria-label={`Page ${item}`}
                aria-current={isCurrent ? 'page' : undefined}
                className={cn(
                  'font-mono text-xs font-bold min-w-[34px] h-[34px] border sm:border-2 border-brand-dark flex items-center justify-center transition-all select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal shadow-none sm:shadow-brutal-xs',
                  isCurrent
                    ? 'bg-brand-navy text-white dark:bg-brand-gold dark:text-brand-dark shadow-none hover:translate-x-0 hover:translate-y-0 cursor-default'
                    : 'bg-brand-paper dark:bg-brand-dark text-brand-dark dark:text-brand-paper hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5'
                )}
              >
                {item}
              </button>
            );
          })}
        </div>

        {/* Next Button */}
        <button
          type="button"
          onClick={() => handlePageClick(safeCurrentPage + 1)}
          disabled={!hasNext || isInteractivityBlocked}
          aria-label="Go to next page"
          className={navBtnClass}
        >
          <span>NEXT</span>
          <ChevronRight className="w-4 h-4 ml-0.5 sm:ml-1" />
        </button>

        {/* Last Page (Desktop only) */}
        <button
          type="button"
          onClick={() => handlePageClick(safeTotalPages)}
          disabled={!hasNext || isInteractivityBlocked}
          aria-label="Go to last page"
          title="Last Page"
          className={cn(navBtnClass, 'hidden sm:inline-flex px-2')}
        >
          <ChevronsRight className="w-4 h-4" />
        </button>
      </div>
    </nav>
  );
};

export default PaginationControls;

