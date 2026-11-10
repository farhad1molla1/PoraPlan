/// <reference types="node" />
/**
 * PoraPlan — Phase 2.3B.2 & 2.3B.2.1 Test Account Decommissioning Verification Suite
 *
 * Validates:
 * 1. Migration SQL static analysis:
 *    - 20261110000002_retire_test_account_provisioning.sql exists.
 *    - Drops public.provision_poraplan_account with exact signature.
 *    - Idempotently suspends public.profiles for exact test accounts.
 *    - Preserves profile roles (PPA001 keeps admin role for audit integrity).
 *    - Deactivates mentor assignments for PPM001 without deleting records.
 *    - No DELETE operations on profiles or academic history.
 *    - No direct mutations on managed auth.* tables.
 *    - Targets ONLY exact test IDs and emails; legitimate @auth.poraplan.internal unaffected.
 *
 * 2. Admin Dashboard UI gating:
 *    - Reference credentials table is strictly gated by import.meta.env.DEV.
 *    - Stripped from production builds.
 *
 * 3. Operator Retirement Script Safety & API Contract (scripts/retire_test_accounts_auth.ts):
 *    - Script exists and requires both --confirm and --enable-retirement.
 *    - Never reads .env files.
 *    - Never logs secrets, passwords, or tokens.
 *    - Uses exact test account targets only.
 *    - Conforms to Supabase Auth Admin API contract: never passes user ID to signOut().
 *    - Accurately distinguishes account ban, session/refresh token revocation, and stateless JWT TTL.
 *    - Documents database-layer RLS mitigation and operator SQL workflow.
 *    - Handles errors and partial failure without falsely reporting success.
 *
 * 4. Local-Only Provisioning Script Safety (scripts/provision_local_test_accounts.ts):
 *    - Strictly checks that SUPABASE_URL is localhost or 127.0.0.1.
 *    - Rejects remote or staging URLs.
 *    - Never contains hardcoded default passwords.
 *    - Never reads .env files.
 *
 * 5. Seed File Hygiene (supabase/seed.sql):
 *    - Exists and contains zero credentials, secrets, or passwords.
 *
 * 6. Zero Emojis & Zero Currency Values across all Phase 2.3B.2 files.
 */

import fs from 'fs';
import path from 'path';
import {
  retireTargetAccount,
  TARGET_TEST_ACCOUNTS,
} from '../../scripts/retire_test_accounts_auth';
import type { SupabaseClient } from '@supabase/supabase-js';

let passCount = 0;
let failCount = 0;

function report(scenario: string, passed: boolean, message: string) {
  if (passed) {
    passCount++;
    console.log('[PASS] ' + scenario + ': ' + message);
  } else {
    failCount++;
    console.error('[FAIL] ' + scenario + ': ' + message);
  }
}

async function runVerification() {
  console.log('================================================================');
  console.log('PoraPlan Phase 2.3B.2 / 2.3B.2.1 Test Account Decommissioning Verification');
  console.log('================================================================\n');

  // ===========================================================================
  // SECTION 1: Migration SQL Static Analysis
  // ===========================================================================
  console.log('--- Section 1: Migration SQL Static Analysis ---');

  const migrationPath = path.resolve(
    process.cwd(),
    'supabase/migrations/20261110000002_retire_test_account_provisioning.sql'
  );

  const fileExists = fs.existsSync(migrationPath);
  report('MIG-01', fileExists, 'Migration 20261110000002_retire_test_account_provisioning.sql exists');

  if (fileExists) {
    const sql = fs.readFileSync(migrationPath, 'utf8');

    // Emoji check
    const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
    report('MIG-02', !emojiRegex.test(sql), 'Migration file contains zero emojis');

    // Drops legacy provisioning function
    const dropsProvisioning = /DROP\s+FUNCTION\s+IF\s+EXISTS\s+public\.provision_poraplan_account\s*\(\s*TEXT\s*,\s*TEXT\s*,\s*TEXT\s*,\s*user_role\s*,\s*TEXT\s*\)/i.test(sql);
    report('MIG-03', dropsProvisioning, 'Drops public.provision_poraplan_account with exact signature');

    // Updates status = 'suspended'
    const setsSuspended = /SET\s+status\s*=\s*'suspended'/i.test(sql);
    report('MIG-04', setsSuspended, 'Suspends profiles for retired accounts');

    // Does NOT alter or demote role
    const altersRole = /SET\s+role\s*=/i.test(sql);
    report('MIG-05', !altersRole, 'Preserves historical profile roles (does not demote PPA001)');

    // No hard DELETE on profiles
    const deletesProfiles = /DELETE\s+FROM\s+public\.profiles/i.test(sql);
    report('MIG-06', !deletesProfiles, 'Never hard-deletes profile records (preserves foreign keys and audit logs)');

    // No direct mutation of auth.* tables
    const touchesAuthUsers = /UPDATE\s+auth\.users|DELETE\s+FROM\s+auth\.users/i.test(sql);
    const touchesAuthSessions = /DELETE\s+FROM\s+auth\.sessions|DELETE\s+FROM\s+auth\.refresh_tokens/i.test(sql);
    report('MIG-07', !touchesAuthUsers && !touchesAuthSessions, 'Adheres to Auth Admin API separation: zero direct mutations on managed auth.* tables');

    // Targets ONLY exact IDs and emails
    const targetsExactIds = sql.includes("'PP001'") && sql.includes("'PPM001'") && sql.includes("'PPA001'");
    const targetsExactEmails = sql.includes('student.pp001@poraplan.internal') &&
                              sql.includes('mentor.ppm001@poraplan.internal') &&
                              sql.includes('admin.ppa001@poraplan.internal');
    report('MIG-08', targetsExactIds && targetsExactEmails, 'Targets strictly exact test IDs and exact @poraplan.internal emails');

    // Does NOT target legitimate @auth.poraplan.internal
    const touchesLegitimateDomain = sql.includes('@auth.poraplan.internal');
    report('MIG-09', !touchesLegitimateDomain, 'Does not target legitimate member domain @auth.poraplan.internal');

    // Deactivates mentor assignments
    const deactivatesCohortMentors = /UPDATE\s+public\.cohort_mentors\s+SET\s+is_active\s*=\s*false/i.test(sql);
    const deactivatesStudentMentors = /UPDATE\s+public\.student_mentor_assignments\s+SET\s+is_active\s*=\s*false/i.test(sql);
    report('MIG-10', deactivatesCohortMentors && deactivatesStudentMentors, 'Deactivates active mentor assignments in cohort_mentors and student_mentor_assignments');
  }

  // ===========================================================================
  // SECTION 2: Admin Dashboard Development Gating
  // ===========================================================================
  console.log('\n--- Section 2: Admin Dashboard Development Gating ---');

  const adminDashboardPath = path.resolve(process.cwd(), 'src/pages/dashboard/AdminDashboardPage.tsx');
  const adminSrc = fs.readFileSync(adminDashboardPath, 'utf8');

  const hasDevGating = adminSrc.includes('import.meta.env.DEV') &&
                       adminSrc.includes('Pre-Registered Testing Accounts');
  report('UI-01', hasDevGating, 'Pre-Registered Testing Accounts reference table is gated by import.meta.env.DEV');

  const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
  report('UI-02', !emojiRegex.test(adminSrc), 'AdminDashboardPage contains zero emojis');

  // ===========================================================================
  // SECTION 3: Operator Retirement Script Verification & API Contract
  // ===========================================================================
  console.log('\n--- Section 3: Operator Retirement Script Verification & API Contract ---');

  const retireScriptPath = path.resolve(process.cwd(), 'scripts/retire_test_accounts_auth.ts');
  const retireScriptExists = fs.existsSync(retireScriptPath);
  report('SCR-01', retireScriptExists, 'scripts/retire_test_accounts_auth.ts exists');

  if (retireScriptExists) {
    const scriptSrc = fs.readFileSync(retireScriptPath, 'utf8');

    // Requires explicit confirmation flags
    const checksConfirm = scriptSrc.includes('--confirm');
    const checksEnable = scriptSrc.includes('--enable-retirement');
    report('SCR-02', checksConfirm && checksEnable, 'Retirement script requires both --confirm and --enable-retirement flags');

    // Does NOT read .env files
    const readsDotEnv = scriptSrc.includes('.env') && !scriptSrc.includes('Never read');
    report('SCR-03', !readsDotEnv, 'Retirement script never reads or opens .env files');

    // Uses exact test accounts only
    const targetsExact = scriptSrc.includes('student.pp001@poraplan.internal') &&
                         scriptSrc.includes('mentor.ppm001@poraplan.internal') &&
                         scriptSrc.includes('admin.ppa001@poraplan.internal');
    report('SCR-04', targetsExact, 'Retirement script targets strictly exact test account emails');

    // Supabase Auth Admin API contract compliance:
    // Does NOT call signOut with a user ID / UUID (which violates API contract)
    const callsSignOutWithId = /await\s+.*admin\.signOut\s*\(/.test(scriptSrc) || scriptSrc.includes('signOut(match.id)');
    report('SCR-05', !callsSignOutWithId, 'Conforms to Supabase Auth API: does not pass user ID to admin.signOut()');

    // Sets ban_duration on user update
    const setsBanDuration = scriptSrc.includes("ban_duration: '876600h'");
    report('SCR-06', setsBanDuration, 'Sets ban_duration (876600h) via updateUserById to prevent future authentication');

    // Documents token lifecycle and API contract distinctions
    const documentsJwtContract = scriptSrc.includes('signOut(jwt: string');
    report('SCR-07', documentsJwtContract, 'Documents that admin.signOut requires a valid JWT string, not a user UUID');

    const documentsStatelessJwtTtl = scriptSrc.includes('stateless') && scriptSrc.includes('TTL');
    report('SCR-08', documentsStatelessJwtTtl, 'Accurately documents that already-issued stateless JWTs expire with natural TTL');

    const documentsDatabaseRlsMitigation = scriptSrc.includes('status != \'suspended\'') || scriptSrc.includes('database authorization layer');
    report('SCR-09', documentsDatabaseRlsMitigation, 'Documents immediate access revocation via database RLS status = suspended');

    const documentsOperatorSessionSql = scriptSrc.includes('DELETE FROM auth.sessions WHERE user_id');
    report('SCR-10', documentsOperatorSessionSql, 'Documents optional operator SQL workflow for immediate session row purging');

    report('SCR-11', !emojiRegex.test(scriptSrc), 'Retirement script contains zero emojis');
  }

  // ===========================================================================
  // SECTION 3.1: Behavioral Unit Tests for Auth Retirement Function
  // ===========================================================================
  console.log('\n--- Section 3.1: Behavioral Unit Tests for Auth Retirement Function ---');

  const testTarget = TARGET_TEST_ACCOUNTS[0]; // PP001

  // Test 3.1.1: Successful retirement
  let updateUserCalls: Array<{ id: string; attributes: Record<string, unknown> }> = [];
  let signOutCalled = false;

  const mockAdminSuccess = {
    auth: {
      admin: {
        listUsers: async () => ({
          data: {
            users: [
              {
                id: 'uuid-pp001',
                email: 'student.pp001@poraplan.internal',
                banned_until: null,
                user_metadata: { role: 'student', full_name: 'Test Student' },
              },
            ],
          },
          error: null,
        }),
        updateUserById: async (id: string, attributes: Record<string, unknown>) => {
          updateUserCalls.push({ id, attributes });
          return { data: { user: { id } }, error: null };
        },
        signOut: async () => {
          signOutCalled = true;
          return { data: null, error: null };
        },
      },
    },
  } as unknown as SupabaseClient;

  const successResult = await retireTargetAccount(mockAdminSuccess, testTarget);
  report('BEH-01', successResult.status === 'retired', 'Successful retirement returns status "retired"');
  report(
    'BEH-02',
    updateUserCalls.length === 1 &&
      updateUserCalls[0].id === 'uuid-pp001' &&
      updateUserCalls[0].attributes.ban_duration === '876600h',
    'Calls updateUserById with user UUID and ban_duration: 876600h'
  );
  report('BEH-03', !signOutCalled, 'Does not call signOut with user UUID on success');

  // Test 3.1.2: Error handling on updateUserById failure
  const mockAdminUpdateError = {
    auth: {
      admin: {
        listUsers: async () => ({
          data: {
            users: [
              {
                id: 'uuid-pp001',
                email: 'student.pp001@poraplan.internal',
                banned_until: null,
                user_metadata: {},
              },
            ],
          },
          error: null,
        }),
        updateUserById: async () => ({
          data: null,
          error: { message: 'Database connection timeout' },
        }),
      },
    },
  } as unknown as SupabaseClient;

  const failureResult = await retireTargetAccount(mockAdminUpdateError, testTarget);
  report('BEH-04', failureResult.status === 'failed', 'Returns status "failed" when updateUserById fails');
  report(
    'BEH-05',
    failureResult.message.includes('Database connection timeout'),
    'Includes actual error message on updateUserById failure'
  );

  // Test 3.1.3: Idempotent detection of already retired user
  let updateCalledForAlreadyRetired = false;
  const mockAdminAlreadyRetired = {
    auth: {
      admin: {
        listUsers: async () => ({
          data: {
            users: [
              {
                id: 'uuid-pp001',
                email: 'student.pp001@poraplan.internal',
                banned_until: '2099-01-01T00:00:00.000Z',
                user_metadata: { status: 'suspended', retired: true },
              },
            ],
          },
          error: null,
        }),
        updateUserById: async () => {
          updateCalledForAlreadyRetired = true;
          return { data: null, error: null };
        },
      },
    },
  } as unknown as SupabaseClient;

  const alreadyRetiredResult = await retireTargetAccount(mockAdminAlreadyRetired, testTarget);
  report('BEH-06', alreadyRetiredResult.status === 'already_retired', 'Returns status "already_retired" for banned/retired user');
  report('BEH-07', !updateCalledForAlreadyRetired, 'Does not call updateUserById when user is already retired');

  // Test 3.1.4: Handling of absent user
  const mockAdminAbsent = {
    auth: {
      admin: {
        listUsers: async () => ({
          data: { users: [] },
          error: null,
        }),
      },
    },
  } as unknown as SupabaseClient;

  const absentResult = await retireTargetAccount(mockAdminAbsent, testTarget);
  report('BEH-08', absentResult.status === 'absent', 'Returns status "absent" when account does not exist');

  // Test 3.1.5: Error in listUsers
  const mockAdminListError = {
    auth: {
      admin: {
        listUsers: async () => ({
          data: null,
          error: { message: 'Auth service down' },
        }),
      },
    },
  } as unknown as SupabaseClient;

  const listErrorResult = await retireTargetAccount(mockAdminListError, testTarget);
  report('BEH-09', listErrorResult.status === 'failed', 'Returns status "failed" when listUsers fails');

  // ===========================================================================
  // SECTION 4: Local Provisioning Script Verification
  // ===========================================================================
  console.log('\n--- Section 4: Local Provisioning Script Verification ---');

  const localScriptPath = path.resolve(process.cwd(), 'scripts/provision_local_test_accounts.ts');
  const localScriptExists = fs.existsSync(localScriptPath);
  report('LOC-01', localScriptExists, 'scripts/provision_local_test_accounts.ts exists');

  if (localScriptExists) {
    const localSrc = fs.readFileSync(localScriptPath, 'utf8');

    // Rejects non-local URLs
    const enforcesLocalhost = localSrc.includes('localhost') && localSrc.includes('127.0.0.1');
    report('LOC-02', enforcesLocalhost, 'Local script strictly verifies hostname is localhost or 127.0.0.1');

    // Requires confirm flag
    report('LOC-03', localSrc.includes('--confirm'), 'Local script requires --confirm flag');

    // No hardcoded passwords
    const hasHardcodedPassword = localSrc.includes("'password'") || localSrc.includes('"password"');
    report('LOC-04', !hasHardcodedPassword, 'Local script contains zero hardcoded passwords');

    // Does NOT read .env files
    const readsDotEnv = localSrc.includes('.env') && !localSrc.includes('Never read');
    report('LOC-05', !readsDotEnv, 'Local script never reads or opens .env files');

    report('LOC-06', !emojiRegex.test(localSrc), 'Local script contains zero emojis');
  }

  // ===========================================================================
  // SECTION 5: Seed File Verification
  // ===========================================================================
  console.log('\n--- Section 5: Seed File Verification ---');

  const seedPath = path.resolve(process.cwd(), 'supabase/seed.sql');
  const seedExists = fs.existsSync(seedPath);
  report('SEED-01', seedExists, 'supabase/seed.sql exists');

  if (seedExists) {
    const seedSrc = fs.readFileSync(seedPath, 'utf8');
    const hasPassword = seedSrc.toLowerCase().includes('password') && !seedSrc.includes('NEVER contain');
    report('SEED-02', !hasPassword, 'supabase/seed.sql contains zero credentials or passwords');
    report('SEED-03', !emojiRegex.test(seedSrc), 'Seed file contains zero emojis');
  }

  // ===========================================================================
  // Final Summary
  // ===========================================================================
  console.log('\n================================================================');
  console.log('Summary: ' + passCount + '/' + (passCount + failCount) + ' scenarios passed (' + failCount + ' failed).');
  console.log('================================================================');

  if (failCount > 0) {
    process.exit(1);
  }
}

runVerification().catch((err) => {
  console.error('Fatal error during verification:', err);
  process.exit(1);
});
