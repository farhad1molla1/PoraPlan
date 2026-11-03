/**
 * PoraPlan — Billing Cycle & Anniversary Calculation Utility
 * Module 11: Payment & Billing Management
 *
 * All dates follow Bangladesh Standard Time (Asia/Dhaka, UTC+6).
 *
 * NOTE ON POLICY:
 * This subsystem operates under a strict NO-AMOUNT policy.
 * There are NO fee amounts, prices, remaining balances, or currency operations.
 * It manages cycle dates, anniversary anchors, and operational statuses only.
 */

const BANGLADESH_TIMEZONE = 'Asia/Dhaka';

const dhakaDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: BANGLADESH_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export interface CalendarDateParts {
  year: number;
  month: number; // 1-12
  day: number;   // 1-31
}

export interface BillingPeriod {
  cycleIndex: number;
  cycleStartDate: string; // YYYY-MM-DD (inclusive start)
  cycleEndDate: string;   // YYYY-MM-DD (exclusive end / start of next cycle)
  nextDueDate: string;    // YYYY-MM-DD (payment renewal due date)
}

/**
 * Validates whether a calendar year is a leap year in the Gregorian calendar.
 */
export function isLeapYear(year: number): boolean {
  if (!Number.isInteger(year)) return false;
  return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
}

/**
 * Returns the maximum days in a specific calendar month, accounting for leap years.
 * @param year - Gregorian year (e.g., 2026)
 * @param month - Calendar month (1-indexed: 1 = Jan, 12 = Dec)
 */
export function getDaysInMonth(year: number, month: number): number {
  switch (month) {
    case 1:  // January
    case 3:  // March
    case 5:  // May
    case 7:  // July
    case 8:  // August
    case 10: // October
    case 12: // December
      return 31;
    case 4:  // April
    case 6:  // June
    case 9:  // September
    case 11: // November
      return 30;
    case 2:  // February
      return isLeapYear(year) ? 29 : 28;
    default:
      throw new Error(`Invalid month: ${month}. Must be an integer between 1 and 12.`);
  }
}

/**
 * Parses and strictly validates a 'YYYY-MM-DD' calendar date string.
 */
export function parseCalendarDate(dateStr: string): CalendarDateParts {
  if (typeof dateStr !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    throw new Error(`Invalid calendar date string format: "${dateStr}". Expected "YYYY-MM-DD".`);
  }
  const parts = dateStr.split('-').map(Number);
  const year = parts[0];
  const month = parts[1];
  const day = parts[2];

  if (month < 1 || month > 12) {
    throw new Error(`Invalid month in calendar date: ${month} (from "${dateStr}").`);
  }

  const maxDays = getDaysInMonth(year, month);
  if (day < 1 || day > maxDays) {
    throw new Error(`Invalid day in calendar date: ${day} for month ${month}/${year} (max ${maxDays}).`);
  }

  return { year, month, day };
}

/**
 * Validates whether a given string is a valid calendar date 'YYYY-MM-DD'.
 */
export function isValidCalendarDate(dateStr: string): boolean {
  try {
    parseCalendarDate(dateStr);
    return true;
  } catch {
    return false;
  }
}

/**
 * Converts a Date object or timestamp string to a calendar date string (YYYY-MM-DD)
 * anchored in Bangladesh Standard Time (Asia/Dhaka, UTC+6).
 */
export function toBangladeshDateStr(date?: string | Date | null): string {
  if (!date) {
    return dhakaDateFormatter.format(new Date());
  }

  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    // Already in YYYY-MM-DD calendar format
    parseCalendarDate(date);
    return date;
  }

  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) {
    throw new Error(`Invalid date supplied to toBangladeshDateStr: "${date}"`);
  }

  return dhakaDateFormatter.format(d);
}

/**
 * Derives the default billing start date from an enrollment timestamp.
 * By default, this is the student's enrollment date in Bangladesh Standard Time.
 */
export function deriveDefaultBillingStartDate(enrolledAt: string | Date): string {
  return toBangladeshDateStr(enrolledAt);
}

/**
 * Calculates the exact anniversary date for a given cycle offset,
 * strictly preserving the original anchor day across variable-length months.
 *
 * Example:
 * Anchor: 2026-01-31
 * - Cycle 0 (offset 0): 2026-01-31
 * - Cycle 1 (offset 1): 2026-02-28 (clamped to end of Feb)
 * - Cycle 2 (offset 2): 2026-03-31 (recovers anchor day 31)
 * - Cycle 3 (offset 3): 2026-04-30 (clamped to end of Apr)
 *
 * @param anchorStartDate - Base anchor date in 'YYYY-MM-DD'
 * @param cycleOffset - Non-negative integer representing monthly cycles elapsed (0 = initial)
 */
export function calculateNextAnniversary(anchorStartDate: string, cycleOffset: number): string {
  if (!Number.isInteger(cycleOffset) || cycleOffset < 0) {
    throw new Error(`cycleOffset must be a non-negative integer. Received: ${cycleOffset}`);
  }

  const { year: y0, month: m0, day: anchorDay } = parseCalendarDate(anchorStartDate);

  if (cycleOffset === 0) {
    return `${y0}-${String(m0).padStart(2, '0')}-${String(anchorDay).padStart(2, '0')}`;
  }

  const zeroBasedMonth = (m0 - 1) + cycleOffset;
  const targetYear = y0 + Math.floor(zeroBasedMonth / 12);
  const targetMonth = ((zeroBasedMonth % 12) + 12) % 12 + 1;

  const maxDays = getDaysInMonth(targetYear, targetMonth);
  const targetDay = Math.min(anchorDay, maxDays);

  return `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`;
}

/**
 * Computes the full boundaries for a specific billing cycle.
 * Convention: [cycleStartDate, cycleEndDate) — the cycleStartDate is inclusive,
 * and cycleEndDate is the exclusive boundary (identical to the start of the next cycle).
 * The nextDueDate is set to cycleEndDate.
 *
 * Note: Payment timing does NOT alter cycle boundaries or next due dates.
 *
 * @param anchorStartDate - The student's effective billing start anchor (YYYY-MM-DD)
 * @param cycleIndex - Zero-based cycle index (0 = first month, 1 = second month, etc.)
 */
export function computeBillingPeriod(anchorStartDate: string, cycleIndex: number): BillingPeriod {
  if (!Number.isInteger(cycleIndex) || cycleIndex < 0) {
    throw new Error(`cycleIndex must be a non-negative integer. Received: ${cycleIndex}`);
  }

  const cycleStartDate = calculateNextAnniversary(anchorStartDate, cycleIndex);
  const cycleEndDate = calculateNextAnniversary(anchorStartDate, cycleIndex + 1);
  const nextDueDate = cycleEndDate;

  return {
    cycleIndex,
    cycleStartDate,
    cycleEndDate,
    nextDueDate,
  };
}

/**
 * Finds the active billing period containing a given reference date.
 * If referenceDate is before the anchor start date, returns cycle 0.
 *
 * @param anchorStartDate - The student's effective billing start anchor (YYYY-MM-DD)
 * @param referenceDate - The reference date to check against (defaults to today in Bangladesh time)
 */
export function findCycleForReferenceDate(
  anchorStartDate: string,
  referenceDate?: string | Date | null
): BillingPeriod {
  const refStr = toBangladeshDateStr(referenceDate);

  if (refStr < anchorStartDate) {
    return computeBillingPeriod(anchorStartDate, 0);
  }

  // Bounded scan up to 1200 months (100 years)
  for (let k = 0; k < 1200; k++) {
    const period = computeBillingPeriod(anchorStartDate, k);
    if (refStr >= period.cycleStartDate && refStr < period.cycleEndDate) {
      return period;
    }
    if (period.cycleStartDate > refStr) {
      return period;
    }
  }

  return computeBillingPeriod(anchorStartDate, 0);
}

/**
 * Calculates calendar day difference between two YYYY-MM-DD date strings (dateB - dateA).
 * Positive if dateB > dateA.
 */
export function diffInDays(dateA: string, dateB: string): number {
  const parsedA = parseCalendarDate(dateA);
  const parsedB = parseCalendarDate(dateB);

  const utcMsA = Date.UTC(parsedA.year, parsedA.month - 1, parsedA.day);
  const utcMsB = Date.UTC(parsedB.year, parsedB.month - 1, parsedB.day);

  return Math.round((utcMsB - utcMsA) / (1000 * 60 * 60 * 24));
}

/**
 * Checks whether an upcoming renewal reminder is due.
 * Returns true if the reference date is within `daysBefore` days of `nextDueDate`.
 *
 * @param nextDueDate - YYYY-MM-DD
 * @param referenceDate - Current or evaluation date (defaults to today in BD time)
 * @param daysBefore - Window before due date (default: 3 days)
 */
export function isUpcomingReminderDue(
  nextDueDate: string,
  referenceDate?: string | Date | null,
  daysBefore: number = 3
): boolean {
  const refStr = toBangladeshDateStr(referenceDate);
  const daysUntilDue = diffInDays(refStr, nextDueDate);
  return daysUntilDue >= 0 && daysUntilDue <= daysBefore;
}

/**
 * Checks whether a billing cycle is past its due date.
 *
 * @param nextDueDate - YYYY-MM-DD
 * @param referenceDate - Current or evaluation date (defaults to today in BD time)
 */
export function isCycleOverdue(
  nextDueDate: string,
  referenceDate?: string | Date | null
): boolean {
  const refStr = toBangladeshDateStr(referenceDate);
  return refStr > nextDueDate;
}

/**
 * Formats a calendar date string (YYYY-MM-DD) into a standard human-readable format.
 * Example: '2026-11-04' -> '04 Nov 2026'
 */
export function formatCalendarDate(dateStr: string): string {
  const { year, month, day } = parseCalendarDate(dateStr);
  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];
  return `${String(day).padStart(2, '0')} ${monthNames[month - 1]} ${year}`;
}
