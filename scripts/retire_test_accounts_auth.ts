/**
 * PoraPlan — Test Account Retirement Script (Auth Admin API)
 *
 * This operator-run utility permanently retires legacy test accounts
 * (PP001, PPM001, PPA001) in Supabase Auth (auth.users) using the official
 * Supabase Auth Admin API.
 *
 * Auth & Token Lifecycle Distinctions:
 * 1. Account Ban & Prevention of Future Authentication:
 *    Applied via `supabaseAdmin.auth.admin.updateUserById(userId, { ban_duration: '876600h', user_metadata: ... })`.
 *    Setting ban_duration instructs GoTrue to immediately reject all future login attempts
 *    and prevent refresh-token exchanges.
 *
 * 2. Refresh-Token & Session Revocation:
 *    The GoTrue Admin API contract for session revocation is:
 *      supabaseAdmin.auth.admin.signOut(jwt: string, scope?: 'global' | 'local' | 'others')
 *    Crucially, this method requires an active user access-token JWT string, NOT a user UUID.
 *    Because administrative operators run headless with service-role credentials and do NOT
 *    possess active user JWTs, calling admin.signOut(userId) is invalid and unsupported.
 *    If immediate administrative deletion of active session rows is required prior to natural TTL,
 *    operators can execute via Supabase Dashboard SQL Editor:
 *      DELETE FROM auth.sessions WHERE user_id = '<user_uuid>';
 *
 * 3. Existing Access-Token JWT Expiry:
 *    Already-issued access-token JWTs are cryptographically signed, stateless tokens.
 *    No Auth Admin API call can remotely destroy an already-issued stateless JWT prior to its
 *    natural TTL expiration (typically up to 1 hour).
 *    In PoraPlan, immediate access revocation is guaranteed at the database authorization layer:
 *    Migration 20261110000002_retire_test_account_provisioning.sql sets profiles.status = 'suspended'.
 *    All Row Level Security (RLS) policies and authenticated RPCs strictly enforce
 *    status != 'suspended', so any inbound API request bearing an unexpired JWT is immediately
 *    rejected by PostgreSQL.
 *
 * Operational & Security Rules:
 * 1. Requires explicit flags: --confirm AND --enable-retirement.
 * 2. Reads SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY strictly from environment variables.
 * 3. Never reads or opens .env files.
 * 4. Never logs or echoes credentials, tokens, or password hashes.
 * 5. Targets ONLY exact test IDs and emails. Never wildcards or touches @auth.poraplan.internal.
 * 6. Preserves existing roles, historical records, and unrelated user metadata.
 * 7. Idempotent: can be safely re-run without unintended side effects.
 *
 * Usage (by authorized operator only):
 *   SUPABASE_URL="https://your-project.supabase.co" \
 *   SUPABASE_SERVICE_ROLE_KEY="..." \
 *   npx jiti scripts/retire_test_accounts_auth.ts --confirm --enable-retirement
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const TARGET_TEST_ACCOUNTS = [
  {
    poraplanId: 'PP001',
    email: 'student.pp001@poraplan.internal',
    expectedRole: 'student',
  },
  {
    poraplanId: 'PPM001',
    email: 'mentor.ppm001@poraplan.internal',
    expectedRole: 'mentor',
  },
  {
    poraplanId: 'PPA001',
    email: 'admin.ppa001@poraplan.internal',
    expectedRole: 'admin',
  },
] as const;

export interface AccountRetirementResult {
  poraplanId: string;
  email: string;
  status: 'retired' | 'already_retired' | 'absent' | 'failed';
  message: string;
}

export async function retireTargetAccount(
  supabaseAdmin: SupabaseClient,
  target: { poraplanId: string; email: string; expectedRole: string }
): Promise<AccountRetirementResult> {
  // 1. Fetch user by exact email using Auth Admin API
  const { data, error: listError } = await supabaseAdmin.auth.admin.listUsers({
    page: 1,
    perPage: 100,
  });

  if (listError) {
    return {
      poraplanId: target.poraplanId,
      email: target.email,
      status: 'failed',
      message: 'Could not query Auth Admin API: ' + listError.message,
    };
  }

  const match = data.users.find(
    (u) => u.email && u.email.trim().toLowerCase() === target.email.toLowerCase()
  );

  if (!match) {
    return {
      poraplanId: target.poraplanId,
      email: target.email,
      status: 'absent',
      message: 'Not found in auth.users (already clean).',
    };
  }

  // 2. Check if already banned/retired
  const isAlreadyBanned = match.banned_until !== null && match.banned_until !== undefined;
  const meta = match.user_metadata || {};
  const isMarkedRetired = meta.status === 'suspended' && meta.retired === true;

  if (isAlreadyBanned && isMarkedRetired) {
    return {
      poraplanId: target.poraplanId,
      email: target.email,
      status: 'already_retired',
      message: 'Already retired and banned.',
    };
  }

  // 3. Update user: ban indefinitely (100 years = 876600h), preserve metadata, set suspended status
  const updatedMetadata = {
    ...meta,
    status: 'suspended',
    retired: true,
    retired_at: new Date().toISOString(),
  };

  const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(match.id, {
    ban_duration: '876600h',
    user_metadata: updatedMetadata,
  });

  if (updateError) {
    return {
      poraplanId: target.poraplanId,
      email: target.email,
      status: 'failed',
      message: 'Could not update user: ' + updateError.message,
    };
  }

  // NOTE: supabaseAdmin.auth.admin.signOut requires a valid JWT string: signOut(jwt: string).
  // Passing a user UUID (match.id) violates the API contract.
  // Account ban prevents new logins & refresh tokens; database status='suspended' blocks active JWTs.

  return {
    poraplanId: target.poraplanId,
    email: target.email,
    status: 'retired',
    message: 'Banned in GoTrue. Existing access-token JWTs expire within TTL (up to 1 hour) and are blocked by database RLS.',
  };
}

export async function runRetirement(): Promise<void> {
  const args = process.argv.slice(2);
  const hasConfirm = args.includes('--confirm');
  const hasEnableRetirement = args.includes('--enable-retirement');

  if (!hasConfirm || !hasEnableRetirement) {
    console.error('Error: Operation aborted.');
    console.error('Safety requirement: Both --confirm and --enable-retirement flags must be specified.');
    console.error('Usage: npx jiti scripts/retire_test_accounts_auth.ts --confirm --enable-retirement');
    process.exit(1);
  }

  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Error: Missing required environment variables.');
    console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be provided via the environment.');
    console.error('Do not commit credentials or save them in files.');
    process.exit(1);
  }

  console.log('--- Starting PoraPlan Test Account Retirement ---');
  console.log('Target accounts: PP001, PPM001, PPA001');

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  let retiredCount = 0;
  let alreadyRetiredCount = 0;
  let absentCount = 0;
  let failedCount = 0;

  for (const target of TARGET_TEST_ACCOUNTS) {
    try {
      const result = await retireTargetAccount(supabaseAdmin, target);

      switch (result.status) {
        case 'retired':
          retiredCount++;
          console.log('[RETIRED] ' + result.poraplanId + ' (' + result.email + '): ' + result.message);
          break;
        case 'already_retired':
          alreadyRetiredCount++;
          console.log('[OK] ' + result.poraplanId + ': ' + result.message);
          break;
        case 'absent':
          absentCount++;
          console.log('[INFO] ' + result.poraplanId + ' (' + result.email + '): ' + result.message);
          break;
        case 'failed':
          failedCount++;
          console.error('[FAIL] ' + result.poraplanId + ': ' + result.message);
          break;
      }
    } catch (err: unknown) {
      failedCount++;
      const msg = err instanceof Error ? err.message : 'Unknown error';
      console.error('[ERROR] Processing ' + target.poraplanId + ': ' + msg);
    }
  }

  console.log('\n--- Retirement Summary ---');
  console.log('Newly retired: ' + retiredCount);
  console.log('Already retired: ' + alreadyRetiredCount);
  console.log('Absent: ' + absentCount);
  console.log('Failed: ' + failedCount);
  console.log('Test account retirement execution complete.');

  if (failedCount > 0) {
    process.exit(1);
  }
}

// Only execute when invoked directly from CLI, not when imported by test suites
if (process.argv[1] && process.argv[1].endsWith('retire_test_accounts_auth.ts')) {
  runRetirement().catch((err) => {
    console.error('Fatal error during retirement:', err);
    process.exit(1);
  });
}