/**
 * Academic Library URL Tab & Routing Foundation
 * Prepared for Milestone 2 (Data & Service Foundation).
 *
 * Supports Academic Library tab parameters:
 * - resources
 * - tasks
 * - assignments
 */

export type AcademicLibraryTab = 'resources' | 'tasks' | 'assignments';

export const ACADEMIC_LIBRARY_TABS: readonly AcademicLibraryTab[] = [
  'resources',
  'tasks',
  'assignments',
] as const;

export const DEFAULT_ACADEMIC_LIBRARY_TAB: AcademicLibraryTab = 'resources';

/**
 * Validate whether a string is a recognized Academic Library tab identifier.
 */
export function isValidLibraryTab(tab: unknown): tab is AcademicLibraryTab {
  return typeof tab === 'string' && ACADEMIC_LIBRARY_TABS.includes(tab as AcademicLibraryTab);
}

/**
 * Parses and sanitizes a tab query parameter from the URL or URLSearchParams.
 * Falls back to 'resources' if absent or invalid.
 */
export function parseLibraryTab(tabParam: string | null | undefined): AcademicLibraryTab {
  if (!tabParam) return DEFAULT_ACADEMIC_LIBRARY_TAB;
  const normalized = tabParam.trim().toLowerCase();
  if (isValidLibraryTab(normalized)) {
    return normalized;
  }
  return DEFAULT_ACADEMIC_LIBRARY_TAB;
}

/**
 * Helper to construct a URL with the designated library tab parameter.
 */
export function getLibraryTabUrl(
  basePath: string,
  tab: AcademicLibraryTab = DEFAULT_ACADEMIC_LIBRARY_TAB
): string {
  const [path, search] = basePath.split('?');
  const params = new URLSearchParams(search || '');
  params.set('tab', tab);
  return `${path}?${params.toString()}`;
}

/**
 * Formats a Date object to a 'YYYY-MM-DD' calendar date string using
 * local year, month, and day components, avoiding UTC-induced timezone shifts.
 */
export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export type LibraryDatePreset =
  | 'all'
  | 'today'
  | 'this_week'
  | 'this_month'
  | 'specific_date'
  | 'custom_range';

/**
 * Computes scheduled date boundaries (YYYY-MM-DD) for Library task browsing presets.
 * Accepts an optional reference `today` Date for deterministic timezone testing.
 */
export function computeLibraryDateRange(
  preset: LibraryDatePreset,
  options?: {
    today?: Date;
    selectedSpecificDate?: string;
    customStartDate?: string;
    customEndDate?: string;
  }
): { startDate?: string; endDate?: string } {
  const today = options?.today || new Date();
  const todayStr = formatLocalDate(today);

  switch (preset) {
    case 'today':
      return { startDate: todayStr, endDate: todayStr };

    case 'this_week': {
      const day = today.getDay(); // 0 is Sunday
      const diffToMonday = (day + 6) % 7;
      const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - diffToMonday);
      const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
      return {
        startDate: formatLocalDate(monday),
        endDate: formatLocalDate(sunday),
      };
    }

    case 'this_month': {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      return {
        startDate: formatLocalDate(firstDay),
        endDate: formatLocalDate(lastDay),
      };
    }

    case 'specific_date':
      return options?.selectedSpecificDate
        ? { startDate: options.selectedSpecificDate, endDate: options.selectedSpecificDate }
        : {};

    case 'custom_range':
      return {
        startDate: options?.customStartDate || undefined,
        endDate: options?.customEndDate || undefined,
      };

    case 'all':
    default:
      return {};
  }
}
