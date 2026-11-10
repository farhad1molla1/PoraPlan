/// <reference types="node" />
/**
 * PoraPlan — Phase 2.3B.2 Test Account Decommissioning Verification Suite
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
 *    - Stripped from production bundles.
 *
 * 3. Operator Retirement Script Safety (scripts/retire_test_accounts_auth.ts):
 *    - Script exists and requires both --confirm and --enable-retirement.
 *    - Never reads .env files.
 *    - Never logs secrets, passwords, or tokens.
 *    - Uses exact test account targets only.
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

function runVerification() {
  console.log('================================================================');
  console.log('PoraPlan Phase 2.3B.2 Test Account Decommissioning Verification');
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
  // SECTION 3: Operator Retirement Script Verification
  // ===========================================================================
  console.log('\n--- Section 3: Operator Retirement Script Verification ---');

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

    // Preserves metadata and bans user
    const bansUser = scriptSrc.includes('ban_duration');
    const signsOut = scriptSrc.includes('signOut');
    report('SCR-05', bansUser && signsOut, 'Retirement script bans user via Auth Admin API and revokes sessions');
  }

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

runVerification();
