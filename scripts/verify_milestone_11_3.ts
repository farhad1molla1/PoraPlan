/**
 * PoraPlan — Milestone 11.3 Verification Suite
 * Student Billing & Payment History UI
 *
 * Verifies:
 * 1. Architecture, Routes & Navigation Integration
 * 2. Absolute No-Amount Policy Compliance
 * 3. Student Service Layer Data Retrieval & Cross-Student Isolation
 * 4. Read-Only Enforcement for Students
 * 5. Soft-Delete Exclusion for Student Views
 * 6. Child Payment Event Retrieval
 * 7. Admin Student Inspection Support
 */

import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';

import {
  setMockCurrentSession,
  resetMockPaymentStore,
  softDeleteMockStudentPaymentRecord,
} from '../src/lib/mockAuthStore';

import {
  getMyStudentPaymentRecords,
  getMyStudentPaymentRecordById,
  getPaymentEvents,
  getAdminStudentPaymentRecords,
  createStudentPaymentRecord,
  updateStudentPaymentRecord,
  softDeleteStudentPaymentRecord,
  overrideBillingStartDate,
} from '../src/lib/payments';

let totalTests = 0;
let passedTests = 0;

function runScenario(description: string, fn: () => void | Promise<void>) {
  totalTests++;
  try {
    const res = fn();
    if (res instanceof Promise) {
      return res
        .then(() => {
          passedTests++;
          console.log(`  [PASS] Scenario ${totalTests}: ${description}`);
        })
        .catch((err) => {
          console.error(`  [FAIL] Scenario ${totalTests}: ${description}`);
          console.error(`         ${err.message}`);
          throw err;
        });
    } else {
      passedTests++;
      console.log(`  [PASS] Scenario ${totalTests}: ${description}`);
    }
  } catch (err: unknown) {
    console.error(`  [FAIL] Scenario ${totalTests}: ${description}`);
    console.error(`         ${err instanceof Error ? err.message : String(err)}`);
    throw err;
  }
}

async function main() {
  console.log('\n===============================================================');
  console.log(' PoraPlan — Milestone 11.3 Student Billing UI Verification');
  console.log('===============================================================\n');

  // --------------------------------------------------------------------------
  // Category A: Static Files & Routing Integration
  // --------------------------------------------------------------------------
  console.log('--- Category A: Files & Routing Integration ---');

  runScenario('StudentBillingPage component file exists', () => {
    const filePath = path.resolve(process.cwd(), 'src/pages/dashboard/StudentBillingPage.tsx');
    assert(fs.existsSync(filePath), 'StudentBillingPage.tsx must exist');
    const content = fs.readFileSync(filePath, 'utf-8');
    assert(content.includes('export const StudentBillingPage'), 'Must export StudentBillingPage component');
  });

  runScenario('Route /student/billing registered in src/routes/index.tsx', () => {
    const routeFile = path.resolve(process.cwd(), 'src/routes/index.tsx');
    const content = fs.readFileSync(routeFile, 'utf-8');
    assert(content.includes('path="student/billing"'), 'Must define path="student/billing"');
    assert(content.includes('<StudentBillingPage />'), 'Must mount <StudentBillingPage />');
    assert(content.includes("allowedRoles={['student', 'admin']}"), 'Must allow student and admin roles');
  });

  runScenario('DashboardLayout sidebar contains Billing & Payments link', () => {
    const layoutFile = path.resolve(process.cwd(), 'src/layouts/DashboardLayout.tsx');
    const content = fs.readFileSync(layoutFile, 'utf-8');
    assert(content.includes("label: 'Billing & Payments'"), "Must have label: 'Billing & Payments'");
    assert(content.includes("to: '/student/billing'"), "Must link to: '/student/billing'");
    assert(content.includes('CreditCard'), 'Must use CreditCard icon');
  });

  // --------------------------------------------------------------------------
  // Category B: Absolute No-Amount Policy Scanner
  // --------------------------------------------------------------------------
  console.log('\n--- Category B: Absolute No-Amount Policy Compliance ---');

  runScenario('StudentBillingPage.tsx complies strictly with Absolute No-Amount Policy', () => {
    const filePath = path.resolve(process.cwd(), 'src/pages/dashboard/StudentBillingPage.tsx');
    const content = fs.readFileSync(filePath, 'utf-8');

    // Forbidden patterns that imply amount, fees, balances, prices, or currency
    const forbiddenPatterns = [
      /\bamount\b/i,
      /\bbalance\b/i,
      /\bfee\b/i,
      /\bfees\b/i,
      /\bprice\b/i,
      /\bcurrency\b/i,
      /\bbdt\b/i,
      /\btaka\b/i,
      /৳/,
      /\bcost\b/i,
      /\btotal_paid\b/i,
      /\bunpaid\b/i,
      /\$(?!\{)/,
      /€|£/,
    ];

    for (const pattern of forbiddenPatterns) {
      const match = content.match(pattern);
      assert(!match, `Forbidden financial pattern found in StudentBillingPage.tsx: "${match?.[0]}"`);
    }
  });

  // --------------------------------------------------------------------------
  // Category C: Service Layer Integration & Student Isolation
  // --------------------------------------------------------------------------
  console.log('\n--- Category C: Service Layer Integration & Student Data ---');

  resetMockPaymentStore();

  const studentA = 'mock-student-pp001';
  const studentB = 'mock-student-pp002';
  const adminUser = 'mock-admin-ppa001';

  await runScenario('Student A retrieves only their own records sorted descending', async () => {
    setMockCurrentSession(studentA);
    const { records, error } = await getMyStudentPaymentRecords();
    assert.strictEqual(error, null);
    assert.strictEqual(records.length, 3);
    assert(records.every((r) => r.student_id === studentA));
    // Verified sorted by cycle_start_date descending
    assert.strictEqual(records[0].id, 'mock-spr-003'); // 2026-11-15
    assert.strictEqual(records[1].id, 'mock-spr-002'); // 2026-10-15
    assert.strictEqual(records[2].id, 'mock-spr-001'); // 2026-09-15
  });

  await runScenario('Student A cannot access Student B payment record', async () => {
    setMockCurrentSession(studentA);
    const { record, error } = await getMyStudentPaymentRecordById('mock-spr-004');
    assert.strictEqual(record, null);
    assert(error !== null, 'Must return error on cross-student record lookup');
    assert(error.message.includes('Unauthorized') || error.message.includes('not found'));
  });

  await runScenario('Student A cannot access Student B payment events', async () => {
    setMockCurrentSession(studentA);
    const { events, error } = await getPaymentEvents('student', 'mock-spr-005');
    assert.strictEqual(events.length, 0);
    assert(error !== null, 'Must return error on cross-student event lookup');
  });

  await runScenario('Student A retrieves their own child payment events', async () => {
    setMockCurrentSession(studentA);
    const { events, error } = await getPaymentEvents('student', 'mock-spr-001');
    assert.strictEqual(error, null);
    assert.strictEqual(events.length, 1);
    assert.strictEqual(events[0].id, 'mock-pe-001');
    assert.strictEqual(events[0].transaction_reference, 'TRX915BKASH01');
  });

  await runScenario('Soft-deleted records are hidden from Student view', async () => {
    // Soft delete mock-spr-001
    softDeleteMockStudentPaymentRecord('mock-spr-001');

    setMockCurrentSession(studentA);
    const { records, error } = await getMyStudentPaymentRecords();
    assert.strictEqual(error, null);
    assert.strictEqual(records.length, 2);
    assert(records.every((r) => r.id !== 'mock-spr-001'));
  });

  // --------------------------------------------------------------------------
  // Category D: Student Read-Only Mutation Protection
  // --------------------------------------------------------------------------
  console.log('\n--- Category D: Student Read-Only Enforcement ---');

  await runScenario('Student is prohibited from creating payment records', async () => {
    setMockCurrentSession(studentA);
    const res = await createStudentPaymentRecord({
      enrollment_id: 'enr-seed-01',
      student_id: studentA,
      cycle_start_date: '2027-12-01',
      cycle_end_date: '2028-01-01',
      next_due_date: '2028-01-01',
      status: 'paid',
    });
    assert.strictEqual(res.record, null);
    assert(res.error !== null);
    assert(res.error.message.includes('Admin privilege required'));
  });

  await runScenario('Student is prohibited from updating payment records', async () => {
    setMockCurrentSession(studentA);
    const res = await updateStudentPaymentRecord('mock-spr-003', {
      status: 'paid',
    });
    assert.strictEqual(res.record, null);
    assert(res.error !== null);
    assert(res.error.message.includes('Admin privilege required'));
  });

  await runScenario('Student is prohibited from soft-deleting payment records', async () => {
    setMockCurrentSession(studentA);
    const res = await softDeleteStudentPaymentRecord('mock-spr-003');
    assert.strictEqual(res.success, false);
    assert(res.error !== null);
    assert(res.error.message.includes('Admin privilege required'));
  });

  await runScenario('Student is prohibited from overriding billing dates', async () => {
    setMockCurrentSession(studentA);
    const res = await overrideBillingStartDate({
      recordType: 'student',
      recordId: 'mock-spr-003',
      newStartDate: '2026-11-20',
      reason: 'Attempted self modification',
    });
    assert.strictEqual(res.success, false);
    assert(res.error !== null);
    assert(res.error.message.includes('Admin privilege required'));
  });

  // --------------------------------------------------------------------------
  // Category E: Admin Inspection Support
  // --------------------------------------------------------------------------
  console.log('\n--- Category E: Admin Student Inspection Support ---');

  await runScenario('Admin can inspect any student records for billing audit', async () => {
    setMockCurrentSession(adminUser);
    const res = await getAdminStudentPaymentRecords({ studentId: studentA });
    assert.strictEqual(res.error, null);
    // mock-spr-003 and mock-spr-002 are active, mock-spr-001 is soft-deleted
    assert.strictEqual(res.records.length, 2);

    // With includeDeleted: true
    const resAll = await getAdminStudentPaymentRecords({
      studentId: studentA,
      includeDeleted: true,
    });
    assert.strictEqual(resAll.error, null);
    assert.strictEqual(resAll.records.length, 3);
  });

  console.log('\n===============================================================');
  console.log(` Summary: ${passedTests}/${totalTests} scenarios passed.`);
  console.log('===============================================================\n');

  assert(totalTests === 14 && passedTests === 14, 'All 14 verification scenarios must pass');
}

main().catch((err) => {
  console.error('\nVerification suite failed:', err);
  process.exit(1);
});
