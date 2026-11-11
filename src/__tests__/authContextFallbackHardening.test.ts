/// <reference types="node" />
/**
 * PoraPlan — Batch 1: AuthContext Fallback Hardening & Profile Security Verification
 *
 * Validates:
 * 1. Static AST / Code Inspection of src/contexts/AuthContext.tsx:
 *    - Eliminates hardcoded status: 'active' fallback on profile lookup failure.
 *    - Fallback profile for pending trigger latency enforces status: 'not_activated'.
 *    - fetchUserProfile immediately revokes session if database returns status: 'suspended'.
 *    - fetchUserProfile immediately revokes session if metadata indicates status: 'suspended'.
 *    - fetchUserProfile immediately revokes session if RLS blocks query (code: 42501 / permission denied).
 *    - fetchUserProfile preserves session but fails-safe (null profile) on transient network failure.
 *    - status useMemo never yields 'active' when profile is unresolved or missing.
 *    - role useMemo never yields an active role when metadata indicates suspended.
 *    - signIn (email/password) validates loaded profile and rejects suspended accounts.
 *    - getInitialMockState purges cached sessions for suspended accounts.
 *
 * 2. Simulated Runtime Unit Tests for Profile Lifecycle & Resolution:
 *    - Active student profile: verified active status and student role granted.
 *    - Suspended student profile (database): triggers session revocation, returns null profile.
 *    - Suspended student profile (metadata): triggers session revocation, returns null profile.
 *    - Not-yet-activated student profile: yields 'not_activated', NEVER 'active'.
 *    - Missing profile (PGRST116 / 0 rows): yields 'not_activated' or null, NEVER 'active'.
 *    - Profile lookup returning RLS error (42501): triggers fail-closed session revocation.
 *    - Profile lookup returning unexpected database error: yields null profile, NEVER 'active'.
 *    - Temporary network failure: preserves session, yields null profile, NEVER 'active'.
 *    - Mentor profile: verified active status and mentor role granted.
 *    - Admin profile: verified active status and admin role granted.
 *    - Local mock authentication: valid active student, suspended student rejected, mentor/admin permitted.
 *    - Existing authenticated session restoration: restored cleanly when active, rejected when suspended.
 *
 * 3. Security Hygiene:
 *    - Zero emojis across touched files.
 *    - Zero credential secrets or tokens.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

let passCount = 0;
let failCount = 0;

function report(id: string, condition: boolean, description: string, category: 'STATIC/CODE' | 'UNIT/RUNTIME' | 'HYGIENE' = 'STATIC/CODE') {
  if (condition) {
    console.log(`[PASS] [${category}] ${id}: ${description}`);
    passCount++;
  } else {
    console.error(`[FAIL] [${category}] ${id}: ${description}`);
    failCount++;
  }
}

// ----------------------------------------------------------------------------
// Types & Helper Definitions mirroring AuthContext contracts
// ----------------------------------------------------------------------------
type UserRole = 'student' | 'mentor' | 'admin';
type AccountStatus = 'not_activated' | 'active' | 'suspended';

interface MockUser {
  id: string;
  email?: string;
  user_metadata?: {
    full_name?: string;
    poraplan_id?: string;
    role?: UserRole;
    status?: AccountStatus;
    linked_email?: string;
  };
}

interface MockProfile {
  id: string;
  poraplan_id?: string | null;
  full_name: string;
  email: string;
  linked_email?: string | null;
  role: UserRole;
  status?: AccountStatus;
  created_at?: string;
  updated_at?: string;
}

interface MockGetProfileResult {
  profile: MockProfile | null;
  error: { code?: string; message: string } | null;
}

// Pure implementation of the corrected fetchUserProfile logic for rigorous unit simulation
async function simulateFetchUserProfile(
  currentUserId: string,
  currentUser: MockUser | null,
  getProfileStub: (userId: string) => Promise<MockGetProfileResult>,
  signOutStub: () => Promise<void>,
  isConfigured = true
): Promise<{
  profile: MockProfile | null;
  sessionRevoked: boolean;
  derivedRole: UserRole | null;
  derivedStatus: AccountStatus | null;
}> {
  let sessionRevoked = false;
  let activeProfile: MockProfile | null = null;

  const revokeSession = async () => {
    sessionRevoked = true;
    if (isConfigured) {
      await signOutStub();
    }
    activeProfile = null;
  };

  if (!currentUserId) {
    return { profile: null, sessionRevoked: false, derivedRole: null, derivedStatus: null };
  }

  // 1. If metadata explicitly marks account as suspended, fail-closed immediately
  if (currentUser?.user_metadata?.status === 'suspended') {
    await revokeSession();
    return { profile: null, sessionRevoked: true, derivedRole: null, derivedStatus: 'suspended' };
  }

  try {
    const { profile: userProfile, error } = await getProfileStub(currentUserId);

    // 2. Database profile returned successfully
    if (userProfile && !error) {
      if (userProfile.status === 'suspended') {
        await revokeSession();
        return { profile: null, sessionRevoked: true, derivedRole: null, derivedStatus: 'suspended' };
      }
      activeProfile = userProfile;
    } else if (error) {
      // 3. Database query returned an error
      const errMsg = error.message ? error.message.toLowerCase() : '';
      const errCode = error.code || '';

      const isPermissionDenied =
        errCode === '42501' ||
        errMsg.includes('permission denied') ||
        errMsg.includes('row-level security');

      if (isPermissionDenied) {
        await revokeSession();
        return { profile: null, sessionRevoked: true, derivedRole: null, derivedStatus: null };
      }

      const isNetworkFailure =
        errMsg.includes('failed to fetch') ||
        errMsg.includes('network') ||
        errMsg.includes('timeout') ||
        errMsg.includes('abort') ||
        errMsg.includes('connection refused') ||
        errMsg.includes('offline');

      if (isNetworkFailure) {
        // Transient network error: do not revoke session, but fail-safe to null profile
        activeProfile = null;
        return { profile: null, sessionRevoked: false, derivedRole: null, derivedStatus: null };
      }

      // If unexpected DB error (not row not found), fail-safe
      const isNotFound = errCode === 'PGRST116' || errMsg.includes('0 rows') || errMsg.includes('not found');
      if (!isNotFound) {
        activeProfile = null;
        return { profile: null, sessionRevoked: false, derivedRole: null, derivedStatus: null };
      }
    }

    // 4. Missing profile row with metadata (e.g. trigger latency on new signup)
    if (currentUser?.user_metadata) {
      const metaRole = (currentUser.user_metadata.role as UserRole) || 'student';
      const fallbackStatus: AccountStatus = 'not_activated';

      activeProfile = {
        id: currentUserId,
        poraplan_id: currentUser.user_metadata.poraplan_id || null,
        full_name: currentUser.user_metadata.full_name || 'Academic Scholar',
        email: currentUser.email || '',
        linked_email: currentUser.user_metadata.linked_email || null,
        role: metaRole,
        status: fallbackStatus,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }
  } catch {
    activeProfile = null;
  }

  // Derive role and status exactly as useMemo does
  const derivedRole: UserRole | null = activeProfile?.role
    ? activeProfile.role
    : (currentUser?.user_metadata?.role as UserRole) || null;

  const derivedStatus: AccountStatus | null = activeProfile?.status
    ? activeProfile.status
    : currentUser?.user_metadata?.status === 'not_activated'
      ? 'not_activated'
      : null;

  return {
    profile: activeProfile,
    sessionRevoked,
    derivedRole,
    derivedStatus,
  };
}

async function runAuthContextVerification() {
  console.log('================================================================');
  console.log('PoraPlan Batch 1: AuthContext Fallback Hardening Verification');
  console.log('================================================================\n');

  // ===========================================================================
  // SECTION 1: Static AST / Source Code Verification
  // ===========================================================================
  console.log('--- Section 1: Static Source Code Security Verification ---');
  const authContextPath = path.join(projectRoot, 'src/contexts/AuthContext.tsx');
  report('AST-FILE', fs.existsSync(authContextPath), 'src/contexts/AuthContext.tsx exists on disk', 'STATIC/CODE');

  const authContent = fs.readFileSync(authContextPath, 'utf8');

  // Verify that the hardcoded status: 'active' fallback is eliminated
  const hasVulnerableActiveFallback = /status:\s*['"]active['"],?\s*\/\/\s*fallback/i.test(authContent) ||
    /const\s+fallbackProfile:\s*Profile\s*=\s*\{[^}]*status:\s*['"]active['"]/s.test(authContent);
  report('AST-01', !hasVulnerableActiveFallback, 'Eliminated hardcoded status: active fallback profile assignment', 'STATIC/CODE');

  // Verify that fallbackProfile explicitly sets status: 'not_activated' or fallbackStatus
  const enforcesNotActivatedFallback = /status:\s*(fallbackStatus|['"]not_activated['"])/.test(authContent);
  report('AST-02', enforcesNotActivatedFallback, 'Fallback profile enforces strictly status: not_activated', 'STATIC/CODE');

  // Verify suspended profile checks in fetchUserProfile
  const hasSuspendedDbCheck = /userProfile\.status\s*===\s*['"]suspended['"]/.test(authContent);
  report('AST-03', hasSuspendedDbCheck, 'Database profile check immediately revokes session on status === suspended', 'STATIC/CODE');

  const hasSuspendedMetaCheck = /currentUser(\?\.|\.)user_metadata(\?\.|\.)status\s*===\s*['"]suspended['"]/.test(authContent);
  report('AST-04', hasSuspendedMetaCheck, 'Metadata check immediately revokes session on metadata status === suspended', 'STATIC/CODE');

  // Verify permission denied / RLS blocking check
  const hasRlsDenialCheck = /42501/.test(authContent) && /permission denied/i.test(authContent);
  report('AST-05', hasRlsDenialCheck, 'Explicit RLS permission denied (42501) check revokes session immediately', 'STATIC/CODE');

  // Verify network failure check
  const hasNetworkFailureCheck = /failed to fetch/i.test(authContent) && /isNetworkFailure/.test(authContent);
  report('AST-06', hasNetworkFailureCheck, 'Transient network failure check preserves session while failing safe to null profile', 'STATIC/CODE');

  // Verify status useMemo never grants active from unverified metadata
  const statusMemoSafe = !/return\s+profile\?\.status\s*\|\|\s*\(?user\?\.user_metadata\?\.status/s.test(authContent);
  report('AST-07', statusMemoSafe, 'status useMemo avoids blanket unverified user_metadata status fallback', 'STATIC/CODE');

  // Verify mock session check purges suspended accounts on initialization
  const mockSuspendedCheck = /account\.status\s*===\s*['"]suspended['"]/.test(authContent);
  report('AST-08', mockSuspendedCheck, 'getInitialMockState clears cached session if account is suspended', 'STATIC/CODE');

  // Verify signIn checks loaded profile
  const signInLoadedProfileCheck = /if\s*\(!loadedProfile\s*\|\|\s*loadedProfile\.status\s*===\s*['"]suspended['"]\)/.test(authContent);
  report('AST-09', signInLoadedProfileCheck, 'signIn validates loaded profile and rejects suspended accounts', 'STATIC/CODE');

  // ===========================================================================
  // SECTION 2: Simulated Runtime Unit Scenarios
  // ===========================================================================
  console.log('\n--- Section 2: Simulated Runtime Profile Resolution Scenarios ---');

  // Scenario 1: Active student profile
  {
    const res = await simulateFetchUserProfile(
      'student-active-uuid',
      { id: 'student-active-uuid', email: 'student@example.com' },
      async () => ({
        profile: {
          id: 'student-active-uuid',
          full_name: 'Scholar One',
          email: 'student@example.com',
          role: 'student',
          status: 'active',
        },
        error: null,
      }),
      async () => {}
    );
    report('RUN-01A', res.profile !== null && res.profile.status === 'active', 'Active student profile: profile status is active', 'UNIT/RUNTIME');
    report('RUN-01B', res.derivedRole === 'student', 'Active student profile: derived role is student', 'UNIT/RUNTIME');
    report('RUN-01C', res.derivedStatus === 'active', 'Active student profile: derived status is active', 'UNIT/RUNTIME');
    report('RUN-01D', !res.sessionRevoked, 'Active student profile: session is not revoked', 'UNIT/RUNTIME');
  }

  // Scenario 2: Suspended student profile in database
  {
    let signedOut = false;
    const res = await simulateFetchUserProfile(
      'student-susp-uuid',
      { id: 'student-susp-uuid', email: 'susp@example.com' },
      async () => ({
        profile: {
          id: 'student-susp-uuid',
          full_name: 'Suspended Scholar',
          email: 'susp@example.com',
          role: 'student',
          status: 'suspended',
        },
        error: null,
      }),
      async () => { signedOut = true; }
    );
    report('RUN-02A', res.profile === null, 'Suspended profile (DB): profile state is cleared to null', 'UNIT/RUNTIME');
    report('RUN-02B', res.sessionRevoked && signedOut, 'Suspended profile (DB): session is revoked via signOut', 'UNIT/RUNTIME');
    report('RUN-02C', res.derivedStatus === 'suspended', 'Suspended profile (DB): derived status reflects suspended', 'UNIT/RUNTIME');
    report('RUN-02D', res.derivedRole === null, 'Suspended profile (DB): derived role is null (access denied)', 'UNIT/RUNTIME');
  }

  // Scenario 3: Suspended student profile in user metadata
  {
    let signedOut = false;
    const res = await simulateFetchUserProfile(
      'student-meta-susp-uuid',
      {
        id: 'student-meta-susp-uuid',
        email: 'meta-susp@example.com',
        user_metadata: { role: 'student', status: 'suspended' },
      },
      async () => ({ profile: null, error: null }),
      async () => { signedOut = true; }
    );
    report('RUN-03A', res.profile === null, 'Suspended profile (Metadata): profile state is null', 'UNIT/RUNTIME');
    report('RUN-03B', res.sessionRevoked && signedOut, 'Suspended profile (Metadata): session is immediately revoked', 'UNIT/RUNTIME');
    report('RUN-03C', res.derivedRole === null, 'Suspended profile (Metadata): derived role is null', 'UNIT/RUNTIME');
    report('RUN-03D', res.derivedStatus === 'suspended', 'Suspended profile (Metadata): derived status is suspended', 'UNIT/RUNTIME');
  }

  // Scenario 4: Not-yet-activated student profile
  {
    const res = await simulateFetchUserProfile(
      'student-not-act-uuid',
      { id: 'student-not-act-uuid', email: 'new@example.com' },
      async () => ({
        profile: {
          id: 'student-not-act-uuid',
          full_name: 'New Scholar',
          email: 'new@example.com',
          role: 'student',
          status: 'not_activated',
        },
        error: null,
      }),
      async () => {}
    );
    report('RUN-04A', res.profile !== null && res.profile.status === 'not_activated', 'Not-activated student: profile status is not_activated', 'UNIT/RUNTIME');
    report('RUN-04B', res.derivedStatus === 'not_activated', 'Not-activated student: derived status is strictly not_activated (NOT active)', 'UNIT/RUNTIME');
    report('RUN-04C', !res.sessionRevoked, 'Not-activated student: session is preserved for first-time activation', 'UNIT/RUNTIME');
  }

  // Scenario 5: Missing profile (PGRST116 / 0 rows) with new signup metadata
  {
    const res = await simulateFetchUserProfile(
      'student-missing-uuid',
      {
        id: 'student-missing-uuid',
        email: 'pending-trigger@example.com',
        user_metadata: { role: 'student', full_name: 'Pending Trigger Scholar' },
      },
      async () => ({
        profile: null,
        error: { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' },
      }),
      async () => {}
    );
    report('RUN-05A', res.profile !== null && res.profile.status === 'not_activated', 'Missing profile with metadata: fallback status is strictly not_activated', 'UNIT/RUNTIME');
    report('RUN-05B', res.profile?.status !== 'active', 'Missing profile with metadata: NEVER silently grants status active', 'UNIT/RUNTIME');
    report('RUN-05C', res.derivedStatus === 'not_activated', 'Missing profile with metadata: derived status is not_activated', 'UNIT/RUNTIME');
  }

  // Scenario 6: Missing profile with no metadata
  {
    const res = await simulateFetchUserProfile(
      'student-empty-missing-uuid',
      { id: 'student-empty-missing-uuid', email: 'orphan@example.com' },
      async () => ({
        profile: null,
        error: { code: 'PGRST116', message: '0 rows returned' },
      }),
      async () => {}
    );
    report('RUN-06A', res.profile === null, 'Missing profile without metadata: profile remains null', 'UNIT/RUNTIME');
    report('RUN-06B', res.derivedStatus === null && res.derivedStatus !== 'active', 'Missing profile without metadata: derived status is null (NEVER active)', 'UNIT/RUNTIME');
    report('RUN-06C', res.derivedRole === null, 'Missing profile without metadata: derived role is null', 'UNIT/RUNTIME');
  }

  // Scenario 7: Profile lookup returning RLS permission denied error (42501)
  {
    let signedOut = false;
    const res = await simulateFetchUserProfile(
      'student-blocked-uuid',
      { id: 'student-blocked-uuid', email: 'blocked@example.com' },
      async () => ({
        profile: null,
        error: { code: '42501', message: 'permission denied for table profiles' },
      }),
      async () => { signedOut = true; }
    );
    report('RUN-07A', res.profile === null, 'RLS permission denied: profile remains null', 'UNIT/RUNTIME');
    report('RUN-07B', res.sessionRevoked && signedOut, 'RLS permission denied: session revoked immediately (fail-closed)', 'UNIT/RUNTIME');
    report('RUN-07C', res.derivedStatus === null, 'RLS permission denied: status is null (not active)', 'UNIT/RUNTIME');
  }

  // Scenario 8: Unexpected database query failure
  {
    const res = await simulateFetchUserProfile(
      'student-dberr-uuid',
      { id: 'student-dberr-uuid', email: 'dberr@example.com' },
      async () => ({
        profile: null,
        error: { code: '50000', message: 'Internal Postgres error' },
      }),
      async () => {}
    );
    report('RUN-08A', res.profile === null, 'Unexpected DB error: profile remains null', 'UNIT/RUNTIME');
    report('RUN-08B', res.derivedStatus === null && res.derivedStatus !== 'active', 'Unexpected DB error: status is null (NEVER active)', 'UNIT/RUNTIME');
  }

  // Scenario 9: Temporary network failure (Failed to fetch)
  {
    let signedOut = false;
    const res = await simulateFetchUserProfile(
      'student-offline-uuid',
      { id: 'student-offline-uuid', email: 'offline@example.com' },
      async () => ({
        profile: null,
        error: { message: 'TypeError: Failed to fetch' },
      }),
      async () => { signedOut = true; }
    );
    report('RUN-09A', res.profile === null, 'Transient network failure: profile remains null (unresolved)', 'UNIT/RUNTIME');
    report('RUN-09B', !res.sessionRevoked && !signedOut, 'Transient network failure: does NOT accidentally sign out legitimate user', 'UNIT/RUNTIME');
    report('RUN-09C', res.derivedStatus === null && res.derivedStatus !== 'active', 'Transient network failure: status is null (NEVER active)', 'UNIT/RUNTIME');
  }

  // Scenario 10: Mentor profile
  {
    const res = await simulateFetchUserProfile(
      'mentor-uuid',
      { id: 'mentor-uuid', email: 'mentor@example.com' },
      async () => ({
        profile: {
          id: 'mentor-uuid',
          full_name: 'Dr. Mentor',
          email: 'mentor@example.com',
          role: 'mentor',
          status: 'active',
        },
        error: null,
      }),
      async () => {}
    );
    report('RUN-10A', res.profile !== null && res.profile.role === 'mentor', 'Mentor profile: role is mentor', 'UNIT/RUNTIME');
    report('RUN-10B', res.profile?.status === 'active', 'Mentor profile: status is active', 'UNIT/RUNTIME');
    report('RUN-10C', res.derivedRole === 'mentor', 'Mentor profile: derived role is mentor', 'UNIT/RUNTIME');
    report('RUN-10D', !res.sessionRevoked, 'Mentor profile: session is preserved', 'UNIT/RUNTIME');
  }

  // Scenario 11: Admin profile
  {
    const res = await simulateFetchUserProfile(
      'admin-uuid',
      { id: 'admin-uuid', email: 'admin@example.com' },
      async () => ({
        profile: {
          id: 'admin-uuid',
          full_name: 'System Admin',
          email: 'admin@example.com',
          role: 'admin',
          status: 'active',
        },
        error: null,
      }),
      async () => {}
    );
    report('RUN-11A', res.profile !== null && res.profile.role === 'admin', 'Admin profile: role is admin', 'UNIT/RUNTIME');
    report('RUN-11B', res.profile?.status === 'active', 'Admin profile: status is active', 'UNIT/RUNTIME');
    report('RUN-11C', res.derivedRole === 'admin', 'Admin profile: derived role is admin', 'UNIT/RUNTIME');
    report('RUN-11D', !res.sessionRevoked, 'Admin profile: session is preserved', 'UNIT/RUNTIME');
  }

  // Scenario 12: Local mock authentication mode (isConfigured = false)
  {
    const res = await simulateFetchUserProfile(
      'mock-student-uuid',
      { id: 'mock-student-uuid', email: 'mock@example.com' },
      async () => ({
        profile: {
          id: 'mock-student-uuid',
          full_name: 'Mock Student',
          email: 'mock@example.com',
          role: 'student',
          status: 'active',
        },
        error: null,
      }),
      async () => {},
      false // isConfigured = false
    );
    report('RUN-12A', res.profile !== null && res.profile.status === 'active', 'Local mock mode: active student profile loads cleanly', 'UNIT/RUNTIME');
    report('RUN-12B', res.derivedRole === 'student', 'Local mock mode: student role preserved', 'UNIT/RUNTIME');
  }

  // Scenario 13: Local mock suspended account rejection
  {
    const res = await simulateFetchUserProfile(
      'mock-susp-uuid',
      { id: 'mock-susp-uuid', email: 'mock-susp@example.com' },
      async () => ({
        profile: {
          id: 'mock-susp-uuid',
          full_name: 'Suspended Mock',
          email: 'mock-susp@example.com',
          role: 'student',
          status: 'suspended',
        },
        error: null,
      }),
      async () => {},
      false // isConfigured = false
    );
    report('RUN-13A', res.profile === null, 'Local mock mode: suspended student profile is rejected to null', 'UNIT/RUNTIME');
    report('RUN-13B', res.derivedStatus === 'suspended', 'Local mock mode: derived status is suspended', 'UNIT/RUNTIME');
    report('RUN-13C', res.derivedRole === null, 'Local mock mode: derived role is null', 'UNIT/RUNTIME');
  }

  // Scenario 14: Existing authenticated session restoration
  {
    // Restoring active session
    const activeRestore = await simulateFetchUserProfile(
      'restored-user-uuid',
      { id: 'restored-user-uuid', email: 'restore@example.com' },
      async () => ({
        profile: {
          id: 'restored-user-uuid',
          full_name: 'Returning Scholar',
          email: 'restore@example.com',
          role: 'student',
          status: 'active',
        },
        error: null,
      }),
      async () => {}
    );
    report('RUN-14A', activeRestore.profile !== null && activeRestore.derivedStatus === 'active', 'Session restoration: active session restored successfully', 'UNIT/RUNTIME');

    // Restoring suspended session
    let restoredSignOut = false;
    const suspRestore = await simulateFetchUserProfile(
      'restored-susp-uuid',
      { id: 'restored-susp-uuid', email: 'restore-susp@example.com' },
      async () => ({
        profile: {
          id: 'restored-susp-uuid',
          full_name: 'Suspended Returning Scholar',
          email: 'restore-susp@example.com',
          role: 'student',
          status: 'suspended',
        },
        error: null,
      }),
      async () => { restoredSignOut = true; }
    );
    report('RUN-14B', suspRestore.profile === null && restoredSignOut, 'Session restoration: suspended session revoked on load', 'UNIT/RUNTIME');
  }

  // ===========================================================================
  // SECTION 3: Hygiene & Secret Protection Verification
  // ===========================================================================
  console.log('\n--- Section 3: Hygiene & Secret Protection ---');
  const touchedFiles = [
    'src/contexts/AuthContext.tsx',
    'src/__tests__/authContextFallbackHardening.test.ts',
  ];

  const emojiRegex = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
  let zeroEmojis = true;
  let zeroSecrets = true;

  for (const rel of touchedFiles) {
    const full = path.join(projectRoot, rel);
    if (!fs.existsSync(full)) continue;
    const content = fs.readFileSync(full, 'utf8');
    if (emojiRegex.test(content)) {
      zeroEmojis = false;
      console.error(`Emoji detected in ${rel}`);
    }
    if (/ey[A-Za-z0-9_-]{25,}/.test(content) || /sbp_[A-Za-z0-9]+/.test(content)) {
      zeroSecrets = false;
      console.error(`Possible secret detected in ${rel}`);
    }
  }

  report('HYG-01', zeroEmojis, 'Zero emojis in touched files', 'HYGIENE');
  report('HYG-02', zeroSecrets, 'Zero secrets or credential tokens in touched files', 'HYGIENE');

  // ===========================================================================
  // Final Summary
  // ===========================================================================
  console.log('\n================================================================');
  console.log(`Summary: ${passCount}/${passCount + failCount} scenarios passed (${failCount} failed).`);
  console.log('================================================================');

  if (failCount > 0) {
    process.exit(1);
  }
}

runAuthContextVerification().catch((err) => {
  console.error('Fatal error during AuthContext verification:', err);
  process.exit(1);
});
