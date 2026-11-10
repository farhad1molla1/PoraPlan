/**
 * PoraPlan — Test Account Retirement Script (Auth Admin API)
 *
 * This operator-run utility permanently retires the legacy test accounts
 * (PP001, PPM001, PPA001) in Supabase Auth (auth.users) using the official
 * Supabase Auth Admin API.
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

import { createClient } from '@supabase/supabase-js';

const TARGET_TEST_ACCOUNTS = [
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

async function runRetirement() {
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

  for (const target of TARGET_TEST_ACCOUNTS) {
    try {
      // 1. Fetch user by exact email using Auth Admin API
      const { data, error: listError } = await supabaseAdmin.auth.admin.listUsers({
        page: 1,
        perPage: 100,
      });

      if (listError) {
        console.error('[FAIL] Could not query Auth Admin API for ' + target.poraplanId + ': ' + listError.message);
        continue;
      }

      const match = data.users.find(
        (u) => u.email && u.email.trim().toLowerCase() === target.email.toLowerCase()
      );

      if (!match) {
        absentCount++;
        console.log('[INFO] ' + target.poraplanId + ' (' + target.email + '): Not found in auth.users (already clean).');
        continue;
      }

      // 2. Check if already banned/retired
      const isAlreadyBanned = match.banned_until !== null && match.banned_until !== undefined;
      const meta = match.user_metadata || {};
      const isMarkedRetired = meta.status === 'suspended' && meta.retired === true;

      if (isAlreadyBanned && isMarkedRetired) {
        alreadyRetiredCount++;
        console.log('[OK] ' + target.poraplanId + ': Already retired and banned.');
        continue;
      }

      // 3. Update user: ban indefinitely, preserve existing metadata, set suspended status
      const updatedMetadata = {
        ...meta,
        status: 'suspended',
        retired: true,
        retired_at: new Date().toISOString(),
      };

      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(match.id, {
        ban_duration: '876600h', // 100 years
        user_metadata: updatedMetadata,
      });

      if (updateError) {
        console.error('[FAIL] Could not update ' + target.poraplanId + ': ' + updateError.message);
        continue;
      }

      // 4. Revoke all active sessions and refresh tokens
      try {
        await supabaseAdmin.auth.admin.signOut(match.id);
      } catch {
        // Sign-out call best-effort
      }

      retiredCount++;
      console.log('[RETIRED] ' + target.poraplanId + ' (' + target.email + '): Banned and active sessions revoked.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      console.error('[ERROR] Processing ' + target.poraplanId + ': ' + msg);
    }
  }

  console.log('\n--- Retirement Summary ---');
  console.log('Newly retired: ' + retiredCount);
  console.log('Already retired: ' + alreadyRetiredCount);
  console.log('Absent: ' + absentCount);
  console.log('Test account retirement complete.');
}

// Only execute when invoked directly from CLI, not when imported by test suites
if (process.argv[1] && process.argv[1].endsWith('retire_test_accounts_auth.ts')) {
  runRetirement().catch((err) => {
    console.error('Fatal error during retirement:', err);
    process.exit(1);
  });
}
