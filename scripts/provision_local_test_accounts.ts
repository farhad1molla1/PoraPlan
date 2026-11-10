/**
 * PoraPlan — Local-Only Test Account Provisioning Script
 *
 * This utility allows developers to safely provision test accounts in a
 * local Supabase environment (e.g. Supabase CLI running on localhost).
 *
 * Operational & Security Rules:
 * 1. Strictly rejects non-local Supabase instances (must be 127.0.0.1 or localhost).
 * 2. Requires --confirm flag.
 * 3. Reads SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and passwords strictly from environment variables.
 * 4. Never reads or opens .env files.
 * 5. Never logs or echoes credentials.
 * 6. Never execute this against staging or production environments.
 *
 * Usage (by developer for local verification only):
 *   SUPABASE_URL="http://127.0.0.1:54321" \
 *   SUPABASE_SERVICE_ROLE_KEY="..." \
 *   LOCAL_STUDENT_PASSWORD="..." \
 *   LOCAL_MENTOR_PASSWORD="..." \
 *   LOCAL_ADMIN_PASSWORD="..." \
 *   npx jiti scripts/provision_local_test_accounts.ts --confirm
 */

import { createClient } from '@supabase/supabase-js';
import { validatePasswordPolicy } from '../src/lib/passwordPolicy';

const LOCAL_TARGET_ACCOUNTS = [
  {
    poraplanId: 'PP001',
    fullName: 'Fahim Rahman',
    email: 'student.pp001@poraplan.internal',
    role: 'student',
    passwordEnvVar: 'LOCAL_STUDENT_PASSWORD',
  },
  {
    poraplanId: 'PPM001',
    fullName: 'Dr. Rafiqul Islam',
    email: 'mentor.ppm001@poraplan.internal',
    role: 'mentor',
    passwordEnvVar: 'LOCAL_MENTOR_PASSWORD',
  },
  {
    poraplanId: 'PPA001',
    fullName: 'PoraPlan System Admin',
    email: 'admin.ppa001@poraplan.internal',
    role: 'admin',
    passwordEnvVar: 'LOCAL_ADMIN_PASSWORD',
  },
] as const;

async function runLocalProvisioning() {
  const args = process.argv.slice(2);
  const hasConfirm = args.includes('--confirm');

  if (!hasConfirm) {
    console.error('Error: Local provisioning aborted.');
    console.error('Safety requirement: --confirm flag must be specified.');
    console.error('Usage: npx jiti scripts/provision_local_test_accounts.ts --confirm');
    process.exit(1);
  }

  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Error: Missing required environment variables.');
    console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be provided via the environment.');
    process.exit(1);
  }

  // Strict local safety enforcement: must be localhost or 127.0.0.1
  try {
    const parsedUrl = new URL(supabaseUrl);
    const isLocalhost = parsedUrl.hostname === 'localhost' || parsedUrl.hostname === '127.0.0.1';
    if (!isLocalhost) {
      console.error('CRITICAL ERROR: Refusing to run.');
      console.error('This script is strictly restricted to local development instances.');
      console.error('Target URL hostname "' + parsedUrl.hostname + '" is not localhost or 127.0.0.1.');
      process.exit(1);
    }
  } catch {
    console.error('Error: Invalid SUPABASE_URL format.');
    process.exit(1);
  }

  console.log('--- Starting PoraPlan Local-Only Test Account Provisioning ---');
  console.log('Target instance: ' + supabaseUrl);

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  for (const target of LOCAL_TARGET_ACCOUNTS) {
    const password = process.env[target.passwordEnvVar]?.trim();
    if (!password) {
      console.error('[SKIP] ' + target.poraplanId + ': Missing password environment variable (' + target.passwordEnvVar + ').');
      continue;
    }

    const validation = validatePasswordPolicy(password);
    if (!validation.valid) {
      console.error('[SKIP] ' + target.poraplanId + ': Password policy violation: ' + validation.error);
      continue;
    }

    try {
      // Create or update local user via Auth Admin API
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email: target.email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: target.fullName,
          poraplan_id: target.poraplanId,
          role: target.role,
          status: 'active',
        },
      });

      if (error) {
        console.error('[FAIL] ' + target.poraplanId + ': ' + error.message);
      } else if (data.user) {
        console.log('[PROVISIONED] ' + target.poraplanId + ' (' + target.email + '): Successfully provisioned locally.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      console.error('[ERROR] ' + target.poraplanId + ': ' + msg);
    }
  }

  console.log('Local provisioning finished.');
}

// Only execute when invoked directly from CLI, not when imported by test suites
if (process.argv[1] && process.argv[1].endsWith('provision_local_test_accounts.ts')) {
  runLocalProvisioning().catch((err) => {
    console.error('Fatal error during local provisioning:', err);
    process.exit(1);
  });
}
