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
