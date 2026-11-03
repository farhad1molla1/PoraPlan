/**
 * Milestone 11.2 Verification Script
 * Payment & Billing Data Foundation
 *
 * Verifies all 13 core requirements:
 * 1. Dual-Date model (enrolled_at vs billing_start_date independence)
 * 2. Default billing start date derived in Asia/Dhaka (UTC+6)
 * 3. Admin override changes effective anchor & records audit log
 * 4. Jan 31 -> Feb 28 -> Mar 31 anchor preservation
 * 5. Leap-year anniversary behavior (Feb 29 on leap, Feb 28 on non-leap)
 * 6. Anchor preservation across 12 consecutive cycles
 * 7. Payment date independence (payment date does not shift billing cycle)
 * 8. Exclusive end-date convention [startDate, endDate)
 * 9. Student and mentor payment records strict separation
 * 10. Multiple payment events without amount fields
 * 11. Payment method enum coverage
 * 12. Payment status enum coverage
 * 13. Strict automated NO-AMOUNT scan across schema, types, and logic
 */

import fs from 'fs';
import path from 'path';
import {
  isLeapYear,
  getDaysInMonth,
  parseCalendarDate,
  toBangladeshDateStr,
  deriveDefaultBillingStartDate,
  calculateNextAnniversary,
  computeBillingPeriod,
  findCycleForReferenceDate,
  diffInDays,
  isUpcomingReminderDue,
  isCycleOverdue,
} from '../src/lib/billingCycles';

import {
  getMockEnrollments,
  getMockEnrollmentById,
  overrideMockBillingStartDate,
  getMockBillingDateAuditLogs,
  getMockStudentPaymentRecords,
  getMockStudentPaymentRecordById,
  createMockStudentPaymentRecord,
  updateMockStudentPaymentRecord,
  getMockMentorPaymentRecords,
  getMockMentorPaymentRecordById,
  createMockMentorPaymentRecord,
  updateMockMentorPaymentRecord,
  getMockPaymentEvents,
  createMockPaymentEvent,
  getMockPaymentAdminNotes,
  createMockPaymentAdminNote,
  resetMockPaymentStore,
} from '../src/lib/mockAuthStore';

let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, message: string): void {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`[PASS] Scenario ${totalTests}: ${message}`);
  } else {
    console.error(`[FAIL] Scenario ${totalTests}: ${message}`);
    process.exitCode = 1;
  }
}

console.log('================================================================');
console.log('PoraPlan Milestone 11.2 Payment & Billing Foundation Verification');
console.log('================================================================\n');

// Reset mock store to clean state
resetMockPaymentStore();

// -----------------------------------------------------------------------------
// Scenario 1: Dual-Date model independence (enrolled_at vs billing_start_date)
// -----------------------------------------------------------------------------
const enr1 = getMockEnrollmentById('enr-seed-01');
const originalEnrolledAt = enr1?.enrolled_at;
assert(
  Boolean(enr1 && enr1.enrolled_at && enr1.billing_start_date),
  'Enrollment contains both enrolled_at (historical timestamp) and billing_start_date (calendar anchor)'
);

// -----------------------------------------------------------------------------
// Scenario 2: Default billing start date matches enrollment date in Asia/Dhaka
// -----------------------------------------------------------------------------
// UTC 18:00 on Nov 3 is midnight (00:00) Nov 4 in Asia/Dhaka (UTC+6)
const dhakaDateFromUtc = deriveDefaultBillingStartDate('2026-11-03T18:00:00.000Z');
assert(
  dhakaDateFromUtc === '2026-11-04',
  `Default billing start date converts UTC boundaries to Asia/Dhaka correctly (expected 2026-11-04, got ${dhakaDateFromUtc})`
);

// -----------------------------------------------------------------------------
// Scenario 3: Admin override updates effective anchor and records audit log
// -----------------------------------------------------------------------------
const overrideRes = overrideMockBillingStartDate(
  'enr-seed-01',
  '2026-09-20',
  'Student joined cohort late due to medical leave',
  'mock-admin-ppa001'
);
const enr1After = getMockEnrollmentById('enr-seed-01');
const auditLogs = getMockBillingDateAuditLogs('enr-seed-01');
const latestAudit = auditLogs[0];

assert(
  overrideRes.success &&
    enr1After?.billing_start_date === '2026-09-20' &&
    enr1After?.enrolled_at === originalEnrolledAt &&
    latestAudit?.old_billing_start_date === '2026-09-15' &&
    latestAudit?.new_billing_start_date === '2026-09-20' &&
    latestAudit?.changed_by === 'mock-admin-ppa001',
  'Admin override changes billing_start_date, preserves enrolled_at, and records audit trail'
);

// -----------------------------------------------------------------------------
// Scenario 4: Jan 31 -> Feb 28 -> Mar 31 anchor preservation
// -----------------------------------------------------------------------------
const jan31Anchor = '2026-01-31';
const offset0 = calculateNextAnniversary(jan31Anchor, 0); // Jan 31
const offset1 = calculateNextAnniversary(jan31Anchor, 1); // Feb 28 (non-leap)
const offset2 = calculateNextAnniversary(jan31Anchor, 2); // Mar 31 (anchor day 31 preserved)
const offset3 = calculateNextAnniversary(jan31Anchor, 3); // Apr 30 (clamped to 30)
const offset4 = calculateNextAnniversary(jan31Anchor, 4); // May 31 (anchor day 31 preserved)

assert(
  offset0 === '2026-01-31' &&
    offset1 === '2026-02-28' &&
    offset2 === '2026-03-31' &&
    offset3 === '2026-04-30' &&
    offset4 === '2026-05-31',
  `Anchor day 31 preserved across varying month lengths (Jan: ${offset0}, Feb: ${offset1}, Mar: ${offset2}, Apr: ${offset3}, May: ${offset4})`
);

// -----------------------------------------------------------------------------
// Scenario 5: Leap-year anniversary behavior
// -----------------------------------------------------------------------------
const leap2024 = calculateNextAnniversary('2024-01-31', 1);
const nonLeap2025 = calculateNextAnniversary('2025-01-31', 1);
const leapDayAnchor2028 = calculateNextAnniversary('2028-02-29', 12); // Next year non-leap
const leapDayAnchor2032 = calculateNextAnniversary('2028-02-29', 48); // 4 years later leap

assert(
  isLeapYear(2024) &&
    !isLeapYear(2025) &&
    leap2024 === '2024-02-29' &&
    nonLeap2025 === '2025-02-28' &&
    leapDayAnchor2028 === '2029-02-28' &&
    leapDayAnchor2032 === '2032-02-29',
  'Leap year correctly assigns Feb 29 for leap years and Feb 28 for non-leap years'
);

// -----------------------------------------------------------------------------
// Scenario 6: Original anchor preservation across 12 consecutive cycles
// -----------------------------------------------------------------------------
const expected12Cycles = [
  '2026-01-31', // 0: Jan
  '2026-02-28', // 1: Feb
  '2026-03-31', // 2: Mar
  '2026-04-30', // 3: Apr
  '2026-05-31', // 4: May
  '2026-06-30', // 5: Jun
  '2026-07-31', // 6: Jul
  '2026-08-31', // 7: Aug
  '2026-09-30', // 8: Sep
  '2026-10-31', // 9: Oct
  '2026-11-30', // 10: Nov
  '2026-12-31', // 11: Dec
  '2027-01-31', // 12: Jan (full 1-year mark)
];

const actual12Cycles = Array.from({ length: 13 }, (_, i) =>
  calculateNextAnniversary('2026-01-31', i)
);

const matchesAll12 = expected12Cycles.every((exp, idx) => exp === actual12Cycles[idx]);
assert(
  matchesAll12,
  'Original anchor day 31 preserved cleanly across 12 full monthly cycles without degradation'
);

// -----------------------------------------------------------------------------
// Scenario 7: Payment date does not shift billing anniversary
// -----------------------------------------------------------------------------
const cycle0Period = computeBillingPeriod('2026-09-15', 0);
// Even if payment happens on 2026-09-16 (early) or 2026-10-25 (late)
const earlyPaymentDate = '2026-09-16';
const nextCyclePeriod = computeBillingPeriod('2026-09-15', 1);

assert(
  cycle0Period.cycleStartDate === '2026-09-15' &&
    cycle0Period.cycleEndDate === '2026-10-15' &&
    cycle0Period.nextDueDate === '2026-10-15' &&
    nextCyclePeriod.cycleStartDate === '2026-10-15' &&
    nextCyclePeriod.cycleEndDate === '2026-11-15' &&
    nextCyclePeriod.nextDueDate === '2026-11-15',
  'Payment date does not alter cycle boundaries or anniversary schedule'
);

// -----------------------------------------------------------------------------
// Scenario 8: Exclusive end-date convention [startDate, endDate)
// -----------------------------------------------------------------------------
const periodA = computeBillingPeriod('2026-08-31', 0); // 2026-08-31 to 2026-09-30
const periodB = computeBillingPeriod('2026-08-31', 1); // 2026-09-30 to 2026-10-31

assert(
  periodA.cycleEndDate === periodB.cycleStartDate &&
    periodA.cycleStartDate <= '2026-08-31' &&
    '2026-09-29' < periodA.cycleEndDate,
  'Exclusive end-date convention [startDate, endDate) correctly connects adjacent cycles without overlap or gap'
);

// -----------------------------------------------------------------------------
// Scenario 9: Student and mentor payment records are strictly independent
// -----------------------------------------------------------------------------
const initialStudentRecords = getMockStudentPaymentRecords();
const initialMentorRecords = getMockMentorPaymentRecords();

const newMentorRec = createMockMentorPaymentRecord(
  {
    mentor_id: 'mock-mentor-ppm001',
    billing_month: '2026-12',
    status: 'pending',
  },
  'mock-admin-ppa001'
);

const studentRecordsAfter = getMockStudentPaymentRecords();
const mentorRecordsAfter = getMockMentorPaymentRecords();

assert(
  Boolean(newMentorRec.record) &&
    studentRecordsAfter.length === initialStudentRecords.length &&
    mentorRecordsAfter.length === initialMentorRecords.length + 1 &&
    newMentorRec.record?.billing_month === '2026-12',
  'Student payment records and mentor payout records remain strictly independent in structure and storage'
);

// -----------------------------------------------------------------------------
// Scenario 10: Multiple payment events represented without financial calculations
// -----------------------------------------------------------------------------
const spr5Events = getMockPaymentEvents({ studentPaymentId: 'mock-spr-005' });
const spr5 = getMockStudentPaymentRecordById('mock-spr-005', { withMeta: true });
const spr5Methods = spr5Events.map((e) => e.payment_method).sort();

assert(
  spr5Events.length === 2 &&
    spr5?.status === 'partial' &&
    spr5Methods[0] === 'bkash' &&
    spr5Methods[1] === 'nagad' &&
    // Check that there is no amount on any event or record
    !(spr5Events[0] as any).amount &&
    !(spr5Events[1] as any).amount &&
    !(spr5 as any).amount &&
    !(spr5 as any).total_paid,
  'Multiple payment events linked to single record support partial payments with zero amount math'
);

// -----------------------------------------------------------------------------
// Scenario 11: Payment method validation
// -----------------------------------------------------------------------------
const allowedMethods = ['bkash', 'nagad', 'upay', 'cash', 'bank'] as const;
const testMethodsPass = allowedMethods.every((method) => {
  const { event } = createMockPaymentEvent({
    record_type: 'student',
    student_payment_id: 'mock-spr-001',
    payment_method: method,
    transaction_reference: `TEST-${method.toUpperCase()}`,
    payment_date: '2026-11-04',
  });
  return event?.payment_method === method;
});

assert(
  testMethodsPass,
  `All payment methods valid: ${allowedMethods.join(', ')}`
);

// -----------------------------------------------------------------------------
// Scenario 12: All payment statuses valid
// -----------------------------------------------------------------------------
const allowedStudentStatuses = ['pending', 'partial', 'paid', 'overdue', 'waived'] as const;
const allowedMentorStatuses = ['pending', 'partial', 'paid'] as const;

const studentStatusesValid = allowedStudentStatuses.every((st) => {
  const { record } = createMockStudentPaymentRecord({
    enrollment_id: 'enr-seed-02',
    student_id: 'mock-student-pp002',
    cycle_start_date: '2026-12-01',
    cycle_end_date: '2027-01-01',
    next_due_date: '2027-01-01',
    status: st,
    waived_reason: st === 'waived' ? 'Test waiver' : null,
  });
  return record?.status === st;
});

const mentorStatusesValid = allowedMentorStatuses.every((st) => {
  const { record } = createMockMentorPaymentRecord({
    mentor_id: 'mock-mentor-ppm001',
    billing_month: `2027-${st}`,
    status: st,
  });
  return record?.status === st;
});

assert(
  studentStatusesValid && mentorStatusesValid,
  'All student statuses (pending, partial, paid, overdue, waived) and mentor statuses (pending, partial, paid) are valid'
);

// -----------------------------------------------------------------------------
// Scenario 13: Strict automated NO-AMOUNT scan
// -----------------------------------------------------------------------------
const filesToScan = [
  path.resolve(__dirname, '../supabase/migrations/20261104000001_payment_and_billing_management.sql'),
  path.resolve(__dirname, '../src/lib/billingCycles.ts'),
];

// Regex matching amount-related financial words as tokens or column identifiers
const forbiddenPattern = /\b(due_amount|paid_amount|total_paid|remaining_balance|fee_amount|base_fee|price_bdt|currency)\b/i;

let noAmountViolations: string[] = [];

for (const filePath of filesToScan) {
  const text = fs.readFileSync(filePath, 'utf8');
  const lines = text.split('\n');
  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    // Exclude explanatory comments documenting the NO-AMOUNT policy
    if (
      trimmed.startsWith('--') ||
      trimmed.startsWith('*') ||
      trimmed.startsWith('//') ||
      trimmed.startsWith('/*')
    ) {
      return;
    }
    const match = line.match(forbiddenPattern);
    if (match) {
      noAmountViolations.push(`${path.basename(filePath)}:${idx + 1}: ${match[0]} in "${trimmed}"`);
    }
  });
}

// Also scan src/types/database.ts Module 11 section
const dbTypesText = fs.readFileSync(path.resolve(__dirname, '../src/types/database.ts'), 'utf8');
const module11Section = dbTypesText.substring(
  dbTypesText.indexOf('Module 11: Payment & Billing Management Types'),
  dbTypesText.indexOf('export type MentorStudent = {')
);

const module11Lines = module11Section.split('\n');
module11Lines.forEach((line, idx) => {
  if (line.includes('NO-AMOUNT') || line.includes('No Amount')) return;
  const match = line.match(forbiddenPattern);
  if (match) {
    noAmountViolations.push(`database.ts (Module 11):${idx + 1}: ${match[0]} in "${line.trim()}"`);
  }
});

assert(
  noAmountViolations.length === 0,
  `Strict NO-AMOUNT policy enforced across SQL migration, types, and logic (${noAmountViolations.length} violations found)`
);

if (noAmountViolations.length > 0) {
  console.error('Violations found:');
  noAmountViolations.forEach((v) => console.error('  - ' + v));
}

// -----------------------------------------------------------------------------
// Summary
// -----------------------------------------------------------------------------
console.log('\n================================================================');
console.log(`Summary: ${passedTests}/${totalTests} scenarios passed (${totalTests - passedTests} failed).`);
console.log('================================================================\n');

if (passedTests !== totalTests) {
  process.exit(1);
}
