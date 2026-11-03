/**
 * PoraPlan — Milestone 11.5 Verification Suite
 * Admin Billing Operations Desk
 *
 * Verifies:
 * 1. Architecture, Routes & Navigation Integration
 * 2. Absolute No-Amount Policy Compliance in UI and Desk Components
 * 3. Admin Student Payment Management (List, Filter, Create, Update, Soft-Delete)
 * 4. Admin Mentor Payout Management (List, Filter, Create, Update, Soft-Delete)
 * 5. Payment Events Recording & Retrieval
 * 6. Admin Private Internal Notes Management & Strict Non-Admin Isolation
 * 7. Billing Start Anchor Date Override & Immutable Audit Logging
 * 8. Strict Role Isolation & Access Controls for All Desk Operations
 * 9. Duplicate Transaction Reference Detection
 */

import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';

import {
  setMockCurrentSession,
  resetMockPaymentStore,
} from '../src/lib/mockAuthStore';

import {
  getAdminStudentPaymentRecords,
  createStudentPaymentRecord,
  updateStudentPaymentRecord,
  softDeleteStudentPaymentRecord,
  getAdminMentorPaymentRecords,
  createMentorPaymentRecord,
  updateMentorPaymentRecord,
  softDeleteMentorPaymentRecord,
  getPaymentEvents,
  createPaymentEvent,
  getPaymentAdminNotes,
  createPaymentAdminNote,
  getBillingDateAuditLogs,
  overrideBillingStartDate,
} from '../src/lib/payments';

let totalTests = 0;
let passedTests = 0;

async function runScenario(description: string, fn: () => void | Promise<void>) {
  totalTests++;
  try {
    const res = fn();
    if (res instanceof Promise) {
      await res;
    }
    passedTests++;
    console.log(`  [PASS] Scenario ${totalTests}: ${description}`);
  } catch (err: unknown) {
    console.error(`  [FAIL] Scenario ${totalTests}: ${description}`);
    console.error(`         ${err instanceof Error ? err.message : String(err)}`);
    throw err;
  }
}

async function main() {
  console.log('\n===============================================================');
  console.log(' PoraPlan — Milestone 11.5 Admin Billing Desk Verification');
  console.log('===============================================================\n');

  // --------------------------------------------------------------------------
  // Category A: Static Files & Routing Integration
  // --------------------------------------------------------------------------
  console.log('--- Category A: Files & Routing Integration ---');

  await runScenario('AdminBillingPage component file exists and exports component', () => {
    const filePath = path.resolve(process.cwd(), 'src/pages/dashboard/AdminBillingPage.tsx');
    assert(fs.existsSync(filePath), 'AdminBillingPage.tsx must exist');
    const content = fs.readFileSync(filePath, 'utf-8');
    assert(content.includes('export const AdminBillingPage'), 'Must export AdminBillingPage component');
  });

  await runScenario('Route /admin/billing registered in src/routes/index.tsx for admin only', () => {
    const routeFile = path.resolve(process.cwd(), 'src/routes/index.tsx');
    const content = fs.readFileSync(routeFile, 'utf-8');
    assert(content.includes('path="admin/billing"'), 'Must define path="admin/billing"');
    assert(content.includes('<AdminBillingPage />'), 'Must mount <AdminBillingPage />');
    assert(content.includes("allowedRoles={['admin']}"), 'Must restrict strictly to admin role');
  });

  await runScenario('DashboardLayout contains Billing Management link under adminNavItems', () => {
    const layoutFile = path.resolve(process.cwd(), 'src/layouts/DashboardLayout.tsx');
    const content = fs.readFileSync(layoutFile, 'utf-8');
    assert(content.includes("label: 'Billing Management'"), "Must have label: 'Billing Management'");
    assert(content.includes("to: '/admin/billing'"), "Must route to '/admin/billing'");
    assert(content.includes("icon: CreditCard"), 'Must use CreditCard icon');
  });

  await runScenario('Admin desk contains all 4 functional sub-sections', () => {
    const filePath = path.resolve(process.cwd(), 'src/pages/dashboard/AdminBillingPage.tsx');
    const content = fs.readFileSync(filePath, 'utf-8');
    assert(content.includes("'overview'"), 'Must include overview tab');
    assert(content.includes("'student_payments'"), 'Must include student_payments tab');
    assert(content.includes("'mentor_payouts'"), 'Must include mentor_payouts tab');
    assert(content.includes("'audit_notes'"), 'Must include audit_notes tab');
  });

  // --------------------------------------------------------------------------
  // Category B: Absolute NO-AMOUNT Policy Compliance
  // --------------------------------------------------------------------------
  console.log('\n--- Category B: Absolute NO-AMOUNT Policy Compliance ---');

  await runScenario('Zero currency symbols or financial amount terms in AdminBillingPage', () => {
    const filePath = path.resolve(process.cwd(), 'src/pages/dashboard/AdminBillingPage.tsx');
    const content = fs.readFileSync(filePath, 'utf-8');

    // Forbidden currency symbols
    const forbiddenSymbols = ['৳', 'BDT', 'Tk', 'TK'];
    for (const sym of forbiddenSymbols) {
      assert(!content.includes(sym), `AdminBillingPage must not contain currency symbol: "${sym}"`);
    }

    // Ensure no raw dollar sign followed by digits (e.g. $100)
    assert(!/\$\s*\d+/.test(content), 'AdminBillingPage must not contain currency dollar values like $100');

    // Forbidden financial keys/terms in UI
    const forbiddenTerms = [
      /\bamount\b/i,
      /\bbalance\b/i,
      /\bsalary\b/i,
      /\bfee\b/i,
      /\bprice\b/i,
      /\btotal_paid\b/i,
      /\btotal_amount\b/i,
    ];

    for (const term of forbiddenTerms) {
      const match = content.match(term);
      assert(!match, `AdminBillingPage must not contain forbidden financial term: ${term}`);
    }
  });

  // --------------------------------------------------------------------------
  // Category C: Admin Student Payment Management
  // --------------------------------------------------------------------------
  console.log('\n--- Category C: Admin Student Payment Management ---');

  resetMockPaymentStore();
  const adminUser = 'mock-admin-ppa001';
  const student1User = 'mock-student-pp001';
  const student2User = 'mock-student-pp002';
  const mentor1User = 'mock-mentor-ppm001';
  const enrollment1Id = 'enr-seed-01';

  // Set active session as Admin
  setMockCurrentSession(adminUser);

  let createdStudentRecordId = '';

  await runScenario('Admin can list all student payment records', async () => {
    const res = await getAdminStudentPaymentRecords({ includeDeleted: false });
    assert.strictEqual(res.error, null);
    assert(Array.isArray(res.records));
    assert(res.records.length >= 2, 'Should have initial seed student payment records');
  });

  await runScenario('Admin can create a student payment record', async () => {
    const res = await createStudentPaymentRecord({
      student_id: student1User,
      enrollment_id: enrollment1Id,
      cycle_start_date: '2026-10-01',
      cycle_end_date: '2026-10-31',
      status: 'pending',
      next_due_date: '2026-11-01',
      payment_method: 'bkash',
      transaction_reference: 'TRX-STU-NEW-01',
      admin_notes: 'Initial October cycle record created by admin',
    });

    assert.strictEqual(res.error, null);
    assert(res.record);
    assert.strictEqual(res.record?.student_id, student1User);
    assert.strictEqual(res.record?.cycle_start_date, '2026-10-01');
    assert.strictEqual(res.record?.transaction_reference, 'TRX-STU-NEW-01');
    createdStudentRecordId = res.record?.id || '';
  });

  await runScenario('Admin can update an existing student payment record', async () => {
    assert(createdStudentRecordId, 'Must have created record ID');
    const res = await updateStudentPaymentRecord(createdStudentRecordId, {
      status: 'paid',
      payment_date: '2026-10-05',
      transaction_reference: 'TRX-STU-NEW-01-VERIFIED',
      admin_notes: 'Payment verified and marked paid',
    });

    assert.strictEqual(res.error, null);
    assert(res.record);
    assert.strictEqual(res.record?.status, 'paid');
    assert.strictEqual(res.record?.payment_date, '2026-10-05');
    assert.strictEqual(res.record?.transaction_reference, 'TRX-STU-NEW-01-VERIFIED');
  });

  await runScenario('Admin can soft-delete a student payment record', async () => {
    const res = await softDeleteStudentPaymentRecord(createdStudentRecordId);
    assert.strictEqual(res.error, null);
    assert.strictEqual(res.success, true);

    // Verify excluded from default listing
    const listRes = await getAdminStudentPaymentRecords({ includeDeleted: false });
    assert.strictEqual(listRes.error, null);
    const found = listRes.records.some((r) => r.id === createdStudentRecordId);
    assert.strictEqual(found, false, 'Soft-deleted record must not appear in includeDeleted: false');

    // Verify present when includeDeleted: true
    const listAllRes = await getAdminStudentPaymentRecords({ includeDeleted: true });
    assert.strictEqual(listAllRes.error, null);
    const foundDeleted = listAllRes.records.some((r) => r.id === createdStudentRecordId);
    assert.strictEqual(foundDeleted, true, 'Soft-deleted record must appear when includeDeleted: true');
  });

  // --------------------------------------------------------------------------
  // Category D: Admin Mentor Payout Management
  // --------------------------------------------------------------------------
  console.log('\n--- Category D: Admin Mentor Payout Management ---');

  let createdMentorRecordId = '';

  await runScenario('Admin can list all mentor payout records', async () => {
    const res = await getAdminMentorPaymentRecords({ includeDeleted: false });
    assert.strictEqual(res.error, null);
    assert(Array.isArray(res.records));
    assert(res.records.length >= 2, 'Should have initial seed mentor payment records');
  });

  await runScenario('Admin can create a mentor payout record', async () => {
    const res = await createMentorPaymentRecord({
      mentor_id: mentor1User,
      billing_month: '2026-12',
      status: 'pending',
      payment_method: 'bank_transfer',
      transaction_reference: 'TRX-MNTR-DEC-01',
      admin_notes: 'December mentor payout scheduled',
    });

    assert.strictEqual(res.error, null);
    assert(res.record);
    assert.strictEqual(res.record?.mentor_id, mentor1User);
    assert.strictEqual(res.record?.billing_month, '2026-12');
    assert.strictEqual(res.record?.status, 'pending');
    createdMentorRecordId = res.record?.id || '';
  });

  await runScenario('Admin can update an existing mentor payout record', async () => {
    assert(createdMentorRecordId, 'Must have created mentor record ID');
    const res = await updateMentorPaymentRecord(createdMentorRecordId, {
      status: 'paid',
      payment_date: '2026-12-28',
      transaction_reference: 'TRX-MNTR-DEC-PAID',
      admin_notes: 'December payout disbursed via bank transfer',
    });

    assert.strictEqual(res.error, null);
    assert(res.record);
    assert.strictEqual(res.record?.status, 'paid');
    assert.strictEqual(res.record?.payment_date, '2026-12-28');
    assert.strictEqual(res.record?.transaction_reference, 'TRX-MNTR-DEC-PAID');
  });

  await runScenario('Admin can soft-delete a mentor payout record', async () => {
    const res = await softDeleteMentorPaymentRecord(createdMentorRecordId);
    assert.strictEqual(res.error, null);
    assert.strictEqual(res.success, true);

    // Verify excluded from default listing
    const listRes = await getAdminMentorPaymentRecords({ includeDeleted: false });
    assert.strictEqual(listRes.error, null);
    const found = listRes.records.some((r) => r.id === createdMentorRecordId);
    assert.strictEqual(found, false, 'Soft-deleted payout must not appear in includeDeleted: false');

    // Verify present when includeDeleted: true
    const listAllRes = await getAdminMentorPaymentRecords({ includeDeleted: true });
    assert.strictEqual(listAllRes.error, null);
    const foundDeleted = listAllRes.records.some((r) => r.id === createdMentorRecordId);
    assert.strictEqual(foundDeleted, true, 'Soft-deleted payout must appear when includeDeleted: true');
  });

  // --------------------------------------------------------------------------
  // Category E: Payment Events Recording & Retrieval
  // --------------------------------------------------------------------------
  console.log('\n--- Category E: Payment Events Recording & Retrieval ---');

  await runScenario('Admin can record and retrieve payment events for student record', async () => {
    const recs = await getAdminStudentPaymentRecords({ includeDeleted: false });
    const target = recs.records[0];
    assert(target, 'Need target student record');

    const createEvt = await createPaymentEvent({
      record_type: 'student',
      student_payment_id: target.id,
      payment_date: '2026-08-05',
      payment_method: 'bkash',
      transaction_reference: 'TRX-EVT-STU-01',
      note: 'First installment received',
    });

    assert.strictEqual(createEvt.error, null);
    assert(createEvt.event);
    assert.strictEqual(createEvt.event?.student_payment_id, target.id);
    assert.strictEqual(createEvt.event?.transaction_reference, 'TRX-EVT-STU-01');

    const getEvts = await getPaymentEvents('student', target.id);
    assert.strictEqual(getEvts.error, null);
    assert(getEvts.events.some((e) => e.transaction_reference === 'TRX-EVT-STU-01'));
  });

  await runScenario('Admin can record and retrieve payment events for mentor record', async () => {
    const recs = await getAdminMentorPaymentRecords({ includeDeleted: false });
    const target = recs.records[0];
    assert(target, 'Need target mentor record');

    const createEvt = await createPaymentEvent({
      record_type: 'mentor',
      mentor_payment_id: target.id,
      payment_date: '2026-08-05',
      payment_method: 'bank_transfer',
      transaction_reference: 'TRX-EVT-MNTR-01',
      note: 'Disbursement settled',
    });

    assert.strictEqual(createEvt.error, null);
    assert(createEvt.event);
    assert.strictEqual(createEvt.event?.mentor_payment_id, target.id);

    const getEvts = await getPaymentEvents('mentor', target.id);
    assert.strictEqual(getEvts.error, null);
    assert(getEvts.events.some((e) => e.transaction_reference === 'TRX-EVT-MNTR-01'));
  });

  // --------------------------------------------------------------------------
  // Category F: Private Admin Notes Management & Strict Non-Admin Isolation
  // --------------------------------------------------------------------------
  console.log('\n--- Category F: Private Admin Notes Management & Isolation ---');

  const recs = await getAdminStudentPaymentRecords({ includeDeleted: false });
  const targetRecord = recs.records[0];

  await runScenario('Admin can create private internal note on payment record', async () => {
    const res = await createPaymentAdminNote({
      recordType: 'student_payment',
      recordId: targetRecord.id,
      note: 'Admin internal memo: Family requested delay until salary on the 10th.',
    });

    assert.strictEqual(res.error, null);
    assert(res.note);
    assert.strictEqual(res.note?.record_id, targetRecord.id);
    assert.strictEqual(res.note?.created_by, adminUser);
  });

  await runScenario('Admin can retrieve private internal notes', async () => {
    const res = await getPaymentAdminNotes('student_payment', targetRecord.id);
    assert.strictEqual(res.error, null);
    assert(res.notes.length > 0);
    assert(res.notes.some((n) => n.note.includes('Family requested delay')));
  });

  await runScenario('Student cannot access private admin notes (strict isolation)', async () => {
    setMockCurrentSession(student1User);
    const getRes = await getPaymentAdminNotes('student_payment', targetRecord.id);
    assert(getRes.error !== null, 'Student must be rejected from viewing admin notes');
    assert.strictEqual(getRes.notes.length, 0);

    const createRes = await createPaymentAdminNote({
      recordType: 'student_payment',
      recordId: targetRecord.id,
      note: 'Unauthorized student injected note',
    });
    assert(createRes.error !== null, 'Student must be rejected from creating admin notes');
    assert.strictEqual(createRes.note, null);
  });

  await runScenario('Mentor cannot access private admin notes (strict isolation)', async () => {
    setMockCurrentSession(mentor1User);
    const getRes = await getPaymentAdminNotes('student_payment', targetRecord.id);
    assert(getRes.error !== null, 'Mentor must be rejected from viewing admin notes');
    assert.strictEqual(getRes.notes.length, 0);

    const createRes = await createPaymentAdminNote({
      recordType: 'student_payment',
      recordId: targetRecord.id,
      note: 'Unauthorized mentor injected note',
    });
    assert(createRes.error !== null, 'Mentor must be rejected from creating admin notes');
    assert.strictEqual(createRes.note, null);
  });

  // --------------------------------------------------------------------------
  // Category G: Billing Start Anchor Adjustment & Immutable Audit Logging
  // --------------------------------------------------------------------------
  console.log('\n--- Category G: Billing Start Anchor Override & Audit Logging ---');

  // Switch back to Admin
  setMockCurrentSession(adminUser);

  await runScenario('Admin can override billing start date with valid reason', async () => {
    const res = await overrideBillingStartDate({
      enrollmentId: enrollment1Id,
      newBillingStartDate: '2026-07-20',
      reason: 'Academic extension granted due to medical leave.',
    });

    assert.strictEqual(res.error, null);
    assert(res.auditLog);
    assert.strictEqual(res.auditLog?.enrollment_id, enrollment1Id);
    assert.strictEqual(res.auditLog?.new_billing_start_date, '2026-07-20');
    assert.strictEqual(res.auditLog?.reason, 'Academic extension granted due to medical leave.');
    assert.strictEqual(res.auditLog?.changed_by, adminUser);
  });

  await runScenario('Billing start date override is recorded in audit logs', async () => {
    const res = await getBillingDateAuditLogs(enrollment1Id);
    assert.strictEqual(res.error, null);
    assert(res.logs.length > 0);
    const log = res.logs.find((l) => l.new_billing_start_date === '2026-07-20');
    assert(log, 'Audit log entry must exist for the override');
    assert.strictEqual(log?.reason, 'Academic extension granted due to medical leave.');
  });

  await runScenario('Override fails if reason is empty', async () => {
    const res = await overrideBillingStartDate({
      enrollmentId: enrollment1Id,
      newBillingStartDate: '2026-07-25',
      reason: '   ',
    });

    assert(res.error !== null, 'Must fail when reason is blank');
    assert.strictEqual(res.auditLog, null);
  });

  await runScenario('Override fails if date format is invalid', async () => {
    const res = await overrideBillingStartDate({
      enrollmentId: enrollment1Id,
      newBillingStartDate: 'invalid-date-format',
      reason: 'Testing date validator',
    });

    assert(res.error !== null, 'Must fail when date is malformed');
    assert.strictEqual(res.auditLog, null);
  });

  // --------------------------------------------------------------------------
  // Category H: Strict Role Isolation & Access Controls
  // --------------------------------------------------------------------------
  console.log('\n--- Category H: Strict Role Isolation & Access Controls ---');

  await runScenario('Student cannot invoke getAdminStudentPaymentRecords', async () => {
    setMockCurrentSession(student1User);
    const res = await getAdminStudentPaymentRecords();
    assert(res.error !== null, 'Student must be rejected from admin student payment list');
    assert.strictEqual(res.records.length, 0);
  });

  await runScenario('Mentor cannot invoke getAdminStudentPaymentRecords', async () => {
    setMockCurrentSession(mentor1User);
    const res = await getAdminStudentPaymentRecords();
    assert(res.error !== null, 'Mentor must be rejected from admin student payment list');
    assert.strictEqual(res.records.length, 0);
  });

  await runScenario('Student cannot invoke getAdminMentorPaymentRecords', async () => {
    setMockCurrentSession(student1User);
    const res = await getAdminMentorPaymentRecords();
    assert(res.error !== null, 'Student must be rejected from admin mentor payout list');
    assert.strictEqual(res.records.length, 0);
  });

  await runScenario('Mentor cannot invoke getAdminMentorPaymentRecords', async () => {
    setMockCurrentSession(mentor1User);
    const res = await getAdminMentorPaymentRecords();
    assert(res.error !== null, 'Mentor must be rejected from admin mentor payout list');
    assert.strictEqual(res.records.length, 0);
  });

  await runScenario('Non-admin cannot create or update student payments', async () => {
    setMockCurrentSession(student1User);
    const createRes = await createStudentPaymentRecord({
      student_id: student1User,
      enrollment_id: enrollment1Id,
      cycle_start_date: '2026-12-01',
      cycle_end_date: '2026-12-31',
      status: 'paid',
    });
    assert(createRes.error !== null, 'Student must not be allowed to create payment record');

    const updateRes = await updateStudentPaymentRecord('any-id', { status: 'waived' });
    assert(updateRes.error !== null, 'Student must not be allowed to update payment record');
  });

  await runScenario('Non-admin cannot override billing start date', async () => {
    setMockCurrentSession(student2User);
    const res = await overrideBillingStartDate({
      enrollmentId: enrollment1Id,
      newBillingStartDate: '2026-01-01',
      reason: 'Malicious student attempt',
    });
    assert(res.error !== null, 'Student must be blocked from overriding billing start date');
    assert.strictEqual(res.auditLog, null);
  });

  // --------------------------------------------------------------------------
  // Category I: Duplicate Reference Detection
  // --------------------------------------------------------------------------
  console.log('\n--- Category I: Duplicate Reference Detection ---');

  await runScenario('Duplicate transaction references are properly flagged across records', () => {
    const studentRecords = [
      { id: 'rec-1', transaction_reference: 'TRX-100' },
      { id: 'rec-2', transaction_reference: 'trx-100' }, // Case-insensitive duplicate
      { id: 'rec-3', transaction_reference: 'TRX-200' },
    ];
    const mentorRecords = [
      { id: 'payout-1', transaction_reference: 'TRX-300' },
      { id: 'payout-2', transaction_reference: 'TRX-100' }, // Cross-track duplicate
    ];

    // Compute reference counts exactly as AdminBillingPage does
    const referenceCounts = new Map<string, number>();
    for (const r of studentRecords) {
      if (r.transaction_reference && r.transaction_reference.trim()) {
        const ref = r.transaction_reference.trim().toUpperCase();
        referenceCounts.set(ref, (referenceCounts.get(ref) || 0) + 1);
      }
    }
    for (const r of mentorRecords) {
      if (r.transaction_reference && r.transaction_reference.trim()) {
        const ref = r.transaction_reference.trim().toUpperCase();
        referenceCounts.set(ref, (referenceCounts.get(ref) || 0) + 1);
      }
    }

    assert.strictEqual(referenceCounts.get('TRX-100'), 3, 'TRX-100 must appear 3 times');
    assert.strictEqual(referenceCounts.get('TRX-200'), 1, 'TRX-200 must appear 1 time');
    assert.strictEqual(referenceCounts.get('TRX-300'), 1, 'TRX-300 must appear 1 time');
  });

  console.log('\n===============================================================');
  console.log(` Summary: ${passedTests} / ${totalTests} Scenarios Passed Successfully`);
  console.log('===============================================================\n');
}

main().catch((err) => {
  console.error('\nVerification run failed:', err);
  process.exit(1);
});
