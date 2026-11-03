/**
 * PoraPlan — Milestone 11.4 Verification Suite
 * Mentor Payout & Payment History UI
 *
 * Verifies:
 * 1. Architecture, Routes & Navigation Integration
 * 2. Absolute No-Amount Policy Compliance
 * 3. Mentor Service Layer Data Retrieval & Cross-Mentor Isolation
 * 4. Admin Note Sanitization for Mentors
 * 5. Read-Only Enforcement for Mentors
 * 6. Segregation of Student & Mentor Payment Tracks
 * 7. Soft-Delete Exclusion for Mentor Views
 * 8. Admin Oversight & Management Preservation
 */

import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';

import {
  setMockCurrentSession,
  resetMockPaymentStore,
  softDeleteMockMentorPaymentRecord,
} from '../src/lib/mockAuthStore';

import {
  getMyMentorPaymentRecords,
  getMyMentorPaymentRecordById,
  getMyStudentPaymentRecords,
  getPaymentEvents,
  getAdminMentorPaymentRecords,
  createMentorPaymentRecord,
  updateMentorPaymentRecord,
  softDeleteMentorPaymentRecord,
  createStudentPaymentRecord,
  updateStudentPaymentRecord,
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
  console.log(' PoraPlan — Milestone 11.4 Mentor Payout UI Verification');
  console.log('===============================================================\n');

  // --------------------------------------------------------------------------
  // Category A: Static Files & Routing Integration
  // --------------------------------------------------------------------------
  console.log('--- Category A: Files & Routing Integration ---');

  runScenario('MentorPayoutsPage component file exists', () => {
    const filePath = path.resolve(process.cwd(), 'src/pages/dashboard/MentorPayoutsPage.tsx');
    assert(fs.existsSync(filePath), 'MentorPayoutsPage.tsx must exist');
    const content = fs.readFileSync(filePath, 'utf-8');
    assert(content.includes('export const MentorPayoutsPage'), 'Must export MentorPayoutsPage component');
  });

  runScenario('Route /mentor/payouts registered in src/routes/index.tsx for mentor only', () => {
    const routeFile = path.resolve(process.cwd(), 'src/routes/index.tsx');
    const content = fs.readFileSync(routeFile, 'utf-8');
    assert(content.includes('path="mentor/payouts"'), 'Must define path="mentor/payouts"');
    assert(content.includes('<MentorPayoutsPage />'), 'Must mount <MentorPayoutsPage />');
    assert(content.includes("allowedRoles={['mentor']}"), 'Must restrict strictly to mentor role');
    assert(!content.includes("allowedRoles={['mentor', 'admin']}\n              <MentorPayoutsPage />") &&
           !content.includes("allowedRoles={['mentor', 'admin']}>\n              <MentorPayoutsPage />"),
           'Must not include admin in mentor/payouts allowedRoles');
  });

  runScenario('DashboardLayout sidebar contains Payout History link', () => {
    const layoutFile = path.resolve(process.cwd(), 'src/layouts/DashboardLayout.tsx');
    const content = fs.readFileSync(layoutFile, 'utf-8');
    assert(content.includes("label: 'Payout History'"), "Must have label: 'Payout History'");
    assert(content.includes("to: '/mentor/payouts'"), "Must link to: '/mentor/payouts'");
    assert(content.includes('CreditCard'), 'Must use CreditCard icon');
  });

  // --------------------------------------------------------------------------
  // Category B: Absolute No-Amount Policy & Note Sanitization in UI
  // --------------------------------------------------------------------------
  console.log('\n--- Category B: Absolute No-Amount Policy Compliance ---');

  runScenario('MentorPayoutsPage.tsx complies strictly with Absolute No-Amount Policy', () => {
    const filePath = path.resolve(process.cwd(), 'src/pages/dashboard/MentorPayoutsPage.tsx');
    const content = fs.readFileSync(filePath, 'utf-8');

    // Forbidden patterns that imply amount, fees, balances, prices, or currency
    const forbiddenPatterns = [
      /\bamount\b/i,
      /\bbalance\b/i,
      /\bfee\b/i,
      /\bfees\b/i,
      /\bsalary\b/i,
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
      assert(!match, `Forbidden financial pattern found in MentorPayoutsPage.tsx: "${match?.[0]}"`);
    }
  });

  runScenario('MentorPayoutsPage.tsx does not render admin notes or event notes', () => {
    const filePath = path.resolve(process.cwd(), 'src/pages/dashboard/MentorPayoutsPage.tsx');
    const content = fs.readFileSync(filePath, 'utf-8');
    assert(!content.includes('evt.note'), 'MentorPayoutsPage must not render evt.note');
    assert(!content.includes('payment_admin_notes'), 'MentorPayoutsPage must not query or display payment_admin_notes');
  });

  // --------------------------------------------------------------------------
  // Category C: Service Layer Integration & Mentor Isolation
  // --------------------------------------------------------------------------
  console.log('\n--- Category C: Service Layer Integration & Mentor Isolation ---');

  resetMockPaymentStore();

  const mentorA = 'mock-mentor-ppm001';
  const mentorB = 'mock-mentor-ppm002';
  const studentUser = 'mock-student-pp001';
  const adminUser = 'mock-admin-ppa001';

  await runScenario('Mentor A retrieves only their own payout records sorted descending', async () => {
    setMockCurrentSession(mentorA);
    const { records, error } = await getMyMentorPaymentRecords();
    assert.strictEqual(error, null);
    assert.strictEqual(records.length, 3);
    assert(records.every((r) => r.mentor_id === mentorA));
    // Sorted descending by billing_month
    assert.strictEqual(records[0].id, 'mock-mpr-003'); // 2026-11
    assert.strictEqual(records[1].id, 'mock-mpr-002'); // 2026-10
    assert.strictEqual(records[2].id, 'mock-mpr-001'); // 2026-09
  });

  await runScenario('Mentor A cannot access Mentor B payout records', async () => {
    // Admin creates a record for Mentor B
    setMockCurrentSession(adminUser);
    const mprB = await createMentorPaymentRecord({
      mentor_id: mentorB,
      billing_month: '2026-10',
      status: 'paid',
    });
    assert(mprB.record !== null);

    // Mentor A attempts to access Mentor B record
    setMockCurrentSession(mentorA);
    const { record, error } = await getMyMentorPaymentRecordById(mprB.record.id);
    assert.strictEqual(record, null);
    assert(error !== null);
    assert(error.message.includes('Unauthorized') || error.message.includes('not found'));
  });

  await runScenario('Mentor A cannot access Mentor B payout events', async () => {
    setMockCurrentSession(mentorA);
    // mock-pe-005 belongs to mock-mpr-001 (Mentor A), let's test lookup on an unowned mentor payout
    const { events, error } = await getPaymentEvents('mentor', 'mock-mpr-unowned-999');
    assert.strictEqual(events.length, 0);
    assert(error !== null);
  });

  await runScenario('Mentor cannot access Student payment records', async () => {
    setMockCurrentSession(mentorA);
    const { records, error } = await getMyStudentPaymentRecords();
    assert.strictEqual(records.length, 0);
    assert(error !== null);
    assert(error.message.includes('Access denied'));
  });

  await runScenario('Mentor cannot access Student payment events', async () => {
    setMockCurrentSession(mentorA);
    const { events, error } = await getPaymentEvents('student', 'mock-spr-001');
    assert.strictEqual(events.length, 0);
    assert(error !== null);
    assert(error.message.includes('Unauthorized'));
  });

  // --------------------------------------------------------------------------
  // Category D: Admin Note Sanitization for Mentors
  // --------------------------------------------------------------------------
  console.log('\n--- Category D: Admin Note Sanitization ---');

  await runScenario('Mentor A retrieves child payout events with note stripped (null)', async () => {
    setMockCurrentSession(mentorA);
    const { events, error } = await getPaymentEvents('mentor', 'mock-mpr-001');
    assert.strictEqual(error, null);
    assert.strictEqual(events.length, 1);
    assert.strictEqual(events[0].id, 'mock-pe-005');
    assert.strictEqual(events[0].transaction_reference, 'MPR-BK-0926');
    // Note must be stripped to null for non-admin mentor caller
    assert.strictEqual(events[0].note, null, 'Mentor caller must receive note: null');
  });

  await runScenario('Mentor A withMeta payout record retrieval strips event notes', async () => {
    setMockCurrentSession(mentorA);
    const { record, error } = await getMyMentorPaymentRecordById('mock-mpr-001', { withMeta: true });
    assert.strictEqual(error, null);
    assert(record !== null);
    const meta = record as unknown as { events?: { note?: string | null }[] };
    assert(Array.isArray(meta.events) && meta.events.length > 0);
    assert(meta.events.every((e) => e.note === null), 'All embedded event notes must be null for mentor');
  });

  await runScenario('Admin caller preserves event note in service response', async () => {
    setMockCurrentSession(adminUser);
    const { events, error } = await getPaymentEvents('mentor', 'mock-mpr-001');
    assert.strictEqual(error, null);
    assert.strictEqual(events.length, 1);
    // Admin receives the full internal note
    assert.strictEqual(events[0].note, 'September mentor stipend payout', 'Admin must receive event note intact');
  });

  // --------------------------------------------------------------------------
  // Category E: Mentor Read-Only Mutation Protection
  // --------------------------------------------------------------------------
  console.log('\n--- Category E: Mentor Read-Only Enforcement ---');

  await runScenario('Mentor is prohibited from creating payout records', async () => {
    setMockCurrentSession(mentorA);
    const res = await createMentorPaymentRecord({
      mentor_id: mentorA,
      billing_month: '2027-01',
      status: 'pending',
    });
    assert.strictEqual(res.record, null);
    assert(res.error !== null);
    assert(res.error.message.includes('Admin privilege required'));
  });

  await runScenario('Mentor is prohibited from updating payout records', async () => {
    setMockCurrentSession(mentorA);
    const res = await updateMentorPaymentRecord('mock-mpr-003', {
      status: 'paid',
    });
    assert.strictEqual(res.record, null);
    assert(res.error !== null);
    assert(res.error.message.includes('Admin privilege required'));
  });

  await runScenario('Mentor is prohibited from soft-deleting payout records', async () => {
    setMockCurrentSession(mentorA);
    const res = await softDeleteMentorPaymentRecord('mock-mpr-003');
    assert.strictEqual(res.success, false);
    assert(res.error !== null);
    assert(res.error.message.includes('Admin privilege required'));
  });

  await runScenario('Mentor is prohibited from overriding billing dates', async () => {
    setMockCurrentSession(mentorA);
    const res = await overrideBillingStartDate({
      recordType: 'mentor',
      recordId: 'mock-mpr-003',
      newStartDate: '2026-11-20',
      reason: 'Attempted self modification',
    });
    assert.strictEqual(res.success, false);
    assert(res.error !== null);
    assert(res.error.message.includes('Admin privilege required'));
  });

  // --------------------------------------------------------------------------
  // Category F: Payment Track Independence & Role Segregation
  // --------------------------------------------------------------------------
  console.log('\n--- Category F: Track Independence & Role Segregation ---');

  await runScenario('Student payment status update has zero side-effects on mentor payout records', async () => {
    setMockCurrentSession(adminUser);
    // Update student record mock-spr-003
    await updateStudentPaymentRecord('mock-spr-003', { status: 'paid' });

    // Check mentor record mock-mpr-003 (status remains pending)
    setMockCurrentSession(mentorA);
    const { record } = await getMyMentorPaymentRecordById('mock-mpr-003');
    assert(record !== null);
    assert.strictEqual(record.status, 'pending', 'Mentor payout status must not change due to student payment update');
  });

  await runScenario('Student cannot access Mentor payout records or endpoints', async () => {
    setMockCurrentSession(studentUser);
    const { records, error } = await getMyMentorPaymentRecords();
    assert.strictEqual(records.length, 0);
    assert(error !== null);
    assert(error.message.includes('Access denied'));
  });

  await runScenario('Anonymous request without active session is rejected', async () => {
    setMockCurrentSession(null);
    const { records, error } = await getMyMentorPaymentRecords();
    assert.strictEqual(records.length, 0);
    assert(error !== null);
    assert(error.message.includes('Authentication required'));
  });

  await runScenario('Soft-deleted records are hidden from Mentor view', async () => {
    softDeleteMockMentorPaymentRecord('mock-mpr-001');

    setMockCurrentSession(mentorA);
    const { records, error } = await getMyMentorPaymentRecords();
    assert.strictEqual(error, null);
    assert.strictEqual(records.length, 2);
    assert(records.every((r) => r.id !== 'mock-mpr-001'));
  });

  await runScenario('Admin can inspect any mentor payout records for audit', async () => {
    setMockCurrentSession(adminUser);
    const res = await getAdminMentorPaymentRecords({ mentorId: mentorA });
    assert.strictEqual(res.error, null);
    // mock-mpr-003 and mock-mpr-002 are active, mock-mpr-001 is soft-deleted
    assert.strictEqual(res.records.length, 2);

    // With includeDeleted: true
    const resAll = await getAdminMentorPaymentRecords({
      mentorId: mentorA,
      includeDeleted: true,
    });
    assert.strictEqual(resAll.error, null);
    assert.strictEqual(resAll.records.length, 3);
  });

  console.log('\n===============================================================');
  console.log(` Summary: ${passedTests}/${totalTests} scenarios passed.`);
  console.log('===============================================================\n');

  assert(totalTests === 22 && passedTests === 22, 'All 22 verification scenarios must pass');
}

main().catch((err) => {
  console.error('\nVerification suite failed:', err);
  process.exit(1);
});
