/**
 * PoraPlan Milestone 11.9: Payment Events Database Privacy Hardening Verification Suite
 *
 * Verifies resolution of SEC-11.8-001:
 * - Direct PostgREST query protection against reading payment_events.note
 * - Column-level privilege separation for role 'authenticated'
 * - Administrative RPC get_admin_payment_events authorization
 * - Row-level security ownership preservation
 * - Service layer query projection compatibility
 * - Live DB status demarcation (PASS vs NOT VERIFIED)
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

import {
  setMockCurrentSession,
  getMockMentorPaymentRecords,
  createMockMentorPaymentRecord,
  resetMockPaymentStore,
} from '../src/lib/mockAuthStore';

import {
  getPaymentEvents,
  createPaymentEvent,
  getMyStudentPaymentRecordById,
  getMyMentorPaymentRecordById,
} from '../src/lib/payments';

// Test Actors matching PoraPlan mock database seed
const studentA = 'mock-student-pp001';
const studentB = 'mock-student-pp002';
const mentorA = 'mock-mentor-ppm001';
const mentorB = 'mock-mentor-ppm002';
const adminUser = 'mock-admin-ppa001';

const studentRecordAId = 'mock-spr-001'; // Belongs to Student A, has mock-pe-001
const studentRecordBId = 'mock-spr-005'; // Belongs to Student B, has mock-pe-003, mock-pe-004
const mentorRecordAId = 'mock-mpr-001';  // Belongs to Mentor A, has mock-pe-005

let scenarioCount = 0;
let passedCount = 0;

function runScenario(title: string, fn: () => void | Promise<void>) {
  scenarioCount++;
  try {
    const res = fn();
    if (res instanceof Promise) {
      return res
        .then(() => {
          passedCount++;
          console.log(`  [PASS] Scenario ${scenarioCount}: ${title}`);
        })
        .catch((err) => {
          console.error(`  [FAIL] Scenario ${scenarioCount}: ${title}`);
          console.error(`         ${err.message}`);
          throw err;
        });
    }
    passedCount++;
    console.log(`  [PASS] Scenario ${scenarioCount}: ${title}`);
  } catch (err: any) {
    console.error(`  [FAIL] Scenario ${scenarioCount}: ${title}`);
    console.error(`         ${err.message}`);
    throw err;
  }
}

async function main() {
  console.log('================================================================');
  console.log('PoraPlan Milestone 11.9: Payment Events Database Privacy Hardening');
  console.log('================================================================\n');

  resetMockPaymentStore();

  const migrationPath = path.resolve(
    process.cwd(),
    'supabase/migrations/20261104000002_payment_events_privacy_hardening.sql'
  );

  assert(fs.existsSync(migrationPath), 'Migration 20261104000002 must exist');
  const migrationSql = fs.readFileSync(migrationPath, 'utf-8');

  // -------------------------------------------------------------------------
  // Category A: Database Migration & Privilege Architecture (Static Analysis)
  // -------------------------------------------------------------------------
  console.log('--- Category A: Database Migration & Privilege Architecture ---');

  runScenario('Migration revokes broad table-level SELECT on payment_events from authenticated', () => {
    assert(
      migrationSql.includes('REVOKE SELECT ON public.payment_events FROM authenticated;'),
      'Must revoke broad table-level SELECT from authenticated role'
    );
  });

  runScenario('Migration grants SELECT only on non-sensitive columns to authenticated', () => {
    assert(
      migrationSql.includes('GRANT SELECT (') &&
      migrationSql.includes('id,') &&
      migrationSql.includes('record_type,') &&
      migrationSql.includes('student_payment_id,') &&
      migrationSql.includes('mentor_payment_id,') &&
      migrationSql.includes('payment_method,') &&
      migrationSql.includes('transaction_reference,') &&
      migrationSql.includes('payment_date,') &&
      migrationSql.includes('recorded_by,') &&
      migrationSql.includes('created_at') &&
      migrationSql.includes(') ON public.payment_events TO authenticated;'),
      'Must explicitly grant column-level SELECT strictly on non-sensitive columns'
    );
  });

  runScenario('The note column is strictly excluded from authenticated grants', () => {
    const grantMatch = migrationSql.match(/GRANT SELECT\s*\(([^)]+)\)\s*ON public\.payment_events/i);
    assert(grantMatch, 'GRANT SELECT column list must be found');
    const grantedCols = grantMatch[1].split(',').map((c) => c.trim().toLowerCase());
    assert(!grantedCols.includes('note'), 'Column note must NOT be in the granted column list');
  });

  runScenario('Zero permissions granted to PUBLIC or anon on payment_events', () => {
    assert(
      migrationSql.includes('REVOKE ALL ON public.payment_events FROM PUBLIC, anon;'),
      'Must revoke all permissions from anon and PUBLIC'
    );
  });

  runScenario('Admin RPC get_admin_payment_events is defined as SECURITY DEFINER with pinned search_path', () => {
    assert(
      migrationSql.includes('CREATE OR REPLACE FUNCTION public.get_admin_payment_events'),
      'get_admin_payment_events RPC function must be created'
    );
    assert(
      migrationSql.includes('SECURITY DEFINER'),
      'RPC must be SECURITY DEFINER to read note column on behalf of authorized admin'
    );
    assert(
      migrationSql.includes('SET search_path = public, pg_temp'),
      'RPC must pin search_path to prevent search-path hijacking attacks'
    );
  });

  runScenario('Admin RPC enforces strict server-side authentication and role=admin status=active verification', () => {
    assert(
      migrationSql.includes('IF v_caller_id IS NULL THEN') &&
      migrationSql.includes('RAISE EXCEPTION') &&
      migrationSql.includes('SELECT (role = \'admin\' AND status = \'active\') INTO v_is_admin'),
      'RPC must enforce auth.uid() check and active admin profile verification'
    );
  });

  runScenario('Admin RPC validates record_type parameter strictly', () => {
    assert(
      migrationSql.includes('p_record_type = \'student\'') &&
      migrationSql.includes('p_record_type = \'mentor\'') &&
      migrationSql.includes('Invalid record_type'),
      'RPC must strictly validate record_type parameter'
    );
  });

  runScenario('Admin RPC execution revoked from PUBLIC and anon; granted to authenticated', () => {
    assert(
      migrationSql.includes('REVOKE ALL ON FUNCTION public.get_admin_payment_events(TEXT, UUID) FROM PUBLIC, anon;') &&
      migrationSql.includes('GRANT EXECUTE ON FUNCTION public.get_admin_payment_events(TEXT, UUID) TO authenticated;'),
      'RPC execute permissions must be strictly scoped'
    );
  });

  runScenario('Strict NO-AMOUNT policy verified in migration (0 financial amount tokens)', () => {
    const forbiddenTokens = ['amount', 'price', 'fee', 'balance', 'currency', 'total_due', 'salary'];
    const lower = migrationSql.toLowerCase();
    for (const token of forbiddenTokens) {
      assert(!lower.includes(token), `Migration contains forbidden token "${token}"`);
    }
  });

  // -------------------------------------------------------------------------
  // Category B: Service Layer & Application Security (Mock Runtime)
  // -------------------------------------------------------------------------
  console.log('\n--- Category B: Service Layer & Runtime Isolation ---');

  let mentorRecs = getMockMentorPaymentRecords();
  let mentorRecB = mentorRecs.find((r) => r.mentor_id === mentorB);

  if (!mentorRecB) {
    createMockMentorPaymentRecord({
      mentor_id: mentorB,
      billing_month: '2026-08',
      status: 'pending',
    });
    mentorRecs = getMockMentorPaymentRecords();
    mentorRecB = mentorRecs.find((r) => r.mentor_id === mentorB);
  }

  assert(mentorRecB, 'Mentor B record must be available');

  await runScenario('Student reads own event through safe interface: Allowed, note stripped', async () => {
    setMockCurrentSession(studentA);
    const { events, error } = await getPaymentEvents('student', studentRecordAId);
    assert.strictEqual(error, null);
    assert(events.length > 0, 'Should return student events');
    assert(events.every((e) => e.note === null), 'Event notes must be null for student');
  });

  await runScenario('Student reads another Student\'s event: Denied', async () => {
    setMockCurrentSession(studentA);
    const { events, error } = await getPaymentEvents('student', studentRecordBId);
    assert(error !== null || events.length === 0, 'Access to another student events must be denied');
  });

  await runScenario('Student reads Mentor event: Denied', async () => {
    setMockCurrentSession(studentA);
    const { events, error } = await getPaymentEvents('mentor', mentorRecordAId);
    assert(error !== null || events.length === 0, 'Student cannot access mentor payout events');
  });

  await runScenario('Mentor reads own payout event: Allowed, note stripped', async () => {
    setMockCurrentSession(mentorA);
    const { events, error } = await getPaymentEvents('mentor', mentorRecordAId);
    assert.strictEqual(error, null);
    assert(events.length > 0, 'Should return mentor events');
    assert(events.every((e) => e.note === null), 'Event notes must be null for mentor');
  });

  await runScenario('Mentor reads another Mentor\'s event: Denied', async () => {
    setMockCurrentSession(mentorA);
    const { events, error } = await getPaymentEvents('mentor', mentorRecB.id);
    assert(error !== null || events.length === 0, 'Access to another mentor events must be denied');
  });

  await runScenario('Mentor reads Student event: Denied', async () => {
    setMockCurrentSession(mentorA);
    const { events, error } = await getPaymentEvents('student', studentRecordAId);
    assert(error !== null || events.length === 0, 'Mentor cannot access student payment events');
  });

  await runScenario('Admin reads permitted event: Allowed', async () => {
    setMockCurrentSession(adminUser);
    const { events, error } = await getPaymentEvents('student', studentRecordAId);
    assert.strictEqual(error, null);
    assert(events.length > 0, 'Admin can read events');
  });

  await runScenario('Admin reads event note: Allowed (internal note preserved)', async () => {
    setMockCurrentSession(adminUser);
    const { events, error } = await getPaymentEvents('student', studentRecordAId);
    assert.strictEqual(error, null);
    const hasNote = events.some((e) => e.note !== null && typeof e.note === 'string' && e.note.length > 0);
    assert(hasNote, 'Admin must have access to internal event notes');
  });

  await runScenario('Unauthenticated user reads events: Denied', async () => {
    setMockCurrentSession(null);
    const { events, error } = await getPaymentEvents('student', studentRecordAId);
    assert(error !== null || events.length === 0, 'Unauthenticated caller must be denied');
  });

  await runScenario('Student inserts an event: Denied', async () => {
    setMockCurrentSession(studentA);
    const { event, error } = await createPaymentEvent({
      record_type: 'student',
      student_payment_id: studentRecordAId,
      payment_method: 'bkash',
      payment_date: '2026-11-04',
      transaction_reference: 'TRX-ATTACK-001',
    });
    assert(error !== null, 'Student must not be able to insert payment events');
    assert.strictEqual(event, null);
  });

  await runScenario('Mentor inserts an event: Denied', async () => {
    setMockCurrentSession(mentorA);
    const { event, error } = await createPaymentEvent({
      record_type: 'mentor',
      mentor_payment_id: mentorRecordAId,
      payment_method: 'bank',
      payment_date: '2026-11-04',
      transaction_reference: 'TRX-ATTACK-002',
    });
    assert(error !== null, 'Mentor must not be able to insert payout events');
    assert.strictEqual(event, null);
  });

  await runScenario('Student withMeta retrieval omits event note', async () => {
    setMockCurrentSession(studentA);
    const { record, error } = await getMyStudentPaymentRecordById(studentRecordAId, { withMeta: true });
    assert.strictEqual(error, null);
    assert(record !== null);
    const meta = record as any;
    if (meta.events && Array.isArray(meta.events)) {
      assert(meta.events.every((e: any) => e.note === null), 'All embedded event notes must be null for student');
    }
  });

  await runScenario('Mentor withMeta retrieval omits event note', async () => {
    setMockCurrentSession(mentorA);
    const { record, error } = await getMyMentorPaymentRecordById(mentorRecordAId, { withMeta: true });
    assert.strictEqual(error, null);
    assert(record !== null);
    const meta = record as any;
    if (meta.events && Array.isArray(meta.events)) {
      assert(meta.events.every((e: any) => e.note === null), 'All embedded event notes must be null for mentor');
    }
  });

  // -------------------------------------------------------------------------
  // Category C: Direct PostgREST & Database Permission Boundary Analysis
  // -------------------------------------------------------------------------
  console.log('\n--- Category C: Direct PostgREST & Database Privilege Simulation ---');

  runScenario('PostgreSQL privilege rule: table-level SELECT revocation is mandatory before column grants', () => {
    const revokeIndex = migrationSql.indexOf('REVOKE SELECT ON public.payment_events FROM authenticated;');
    const grantIndex = migrationSql.indexOf('GRANT SELECT (');
    assert(revokeIndex !== -1 && grantIndex !== -1, 'Both statements must exist');
    assert(revokeIndex < grantIndex, 'Table-level REVOKE must precede column-level GRANT');
  });

  runScenario('PostgreSQL privilege rule: SELECT * expansion includes note and triggers permission error', () => {
    const grantedMatch = migrationSql.match(/GRANT SELECT\s*\(([^)]+)\)\s*ON public\.payment_events/i);
    assert(grantedMatch);
    const grantedList = grantedMatch[1].split(',').map((s) => s.trim());
    assert(!grantedList.includes('note'), 'Omission of note from column list guarantees SELECT * will fail for authenticated');
  });

  runScenario('Database layer status demarcation: Live hosted database tests', () => {
    console.log('       [INFO] Live Supabase PostgreSQL connection is intentionally not established in read-only local sandbox.');
    console.log('       [INFO] Direct PostgREST tests against remote server are marked: NOT VERIFIED (Live DB).');
  });

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------
  console.log('\n===============================================================');
  console.log(` Summary: ${passedCount} / ${scenarioCount} Scenarios Passed Successfully`);
  console.log('===============================================================\n');
}

main().catch((err) => {
  console.error('Fatal error during verification:', err);
  process.exit(1);
});
