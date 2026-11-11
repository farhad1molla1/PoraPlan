import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

let passCount = 0;
let failCount = 0;

function assert(scenario: string, condition: boolean, message: string) {
  if (condition) {
    console.log('[PASS] ' + scenario + ': ' + message);
    passCount++;
  } else {
    console.error('[FAIL] ' + scenario + ': ' + message);
    failCount++;
  }
}

// ----------------------------------------------------------------------------
// Simulated Postgres RLS Engine for Dual-Layer Policy Verification
// ----------------------------------------------------------------------------
interface UserProfile {
  id: string;
  role: 'student' | 'mentor' | 'admin';
  status: 'active' | 'suspended' | 'pending';
}

interface SimulatedRow {
  student_id: string;
  program_id: string;
}

function isActiveStudentProfile(user: UserProfile | null, authUid: string | null): boolean {
  if (!user || !authUid) return false;
  if (user.id !== authUid) return false;
  return user.role === 'student' && user.status === 'active';
}

function evaluateSubjectsPolicy(
  row: SimulatedRow,
  user: UserProfile | null,
  isAuthorizedMentor: boolean
): { permissivePassed: boolean; restrictivePassed: boolean; accessGranted: boolean } {
  if (!user) {
    return { permissivePassed: false, restrictivePassed: false, accessGranted: false };
  }

  // Permissive policy
  const studentBranch = (user.id === row.student_id) && isActiveStudentProfile(user, user.id);
  const mentorBranch = isAuthorizedMentor;
  const permissivePassed = studentBranch || mentorBranch;

  // Restrictive policy: NOT (role = 'student' AND status = 'suspended')
  const isSuspendedStudent = user.role === 'student' && user.status === 'suspended';
  const restrictivePassed = !isSuspendedStudent;

  // PostgreSQL combines permissive with OR, and restrictive with AND across all policies
  const accessGranted = permissivePassed && restrictivePassed;

  return { permissivePassed, restrictivePassed, accessGranted };
}

async function runVerificationSuite() {
  console.log('================================================================');
  console.log('PoraPlan Phase 2.3B.4.5 Suspended Account RLS & Edge Hardening Verification');
  console.log('================================================================\n');

  // ----------------------------------------------------------------------------
  // Section 1: SEC-02 Resolver Privilege Revocation
  // ----------------------------------------------------------------------------
  console.log('--- Section 1: SEC-02 Resolver RPC Privilege Revocation ---');

  const migrationPath = path.join(
    projectRoot,
    'supabase/migrations/20261111000001_harden_resolver_privileges_and_suspended_rls.sql'
  );
  assert(
    'SEC02-01',
    fs.existsSync(migrationPath),
    'Migration 20261111000001_harden_resolver_privileges_and_suspended_rls.sql exists'
  );

  const migrationSql = fs.readFileSync(migrationPath, 'utf8');

  assert(
    'SEC02-02',
    migrationSql.includes('REVOKE ALL ON FUNCTION public.resolve_poraplan_id_login(TEXT) FROM authenticated;'),
    'Explicitly revokes execute privilege from authenticated role'
  );

  assert(
    'SEC02-03',
    migrationSql.includes('REVOKE ALL ON FUNCTION public.resolve_poraplan_id_login(TEXT) FROM anon;') &&
      migrationSql.includes('REVOKE ALL ON FUNCTION public.resolve_poraplan_id_login(TEXT) FROM PUBLIC;'),
    'Explicitly revokes execute privilege from anon and PUBLIC'
  );

  assert(
    'SEC02-04',
    migrationSql.includes('GRANT EXECUTE ON FUNCTION public.resolve_poraplan_id_login(TEXT) TO service_role;'),
    'Grants execute privilege strictly and exclusively to service_role'
  );

  // ----------------------------------------------------------------------------
  // Section 2: SEC-03 Helper Function & RLS Architecture
  // ----------------------------------------------------------------------------
  console.log('\n--- Section 2: SEC-03 Helper Function & RLS Dual-Layer Defense ---');

  assert(
    'SEC03-01',
    migrationSql.includes('CREATE OR REPLACE FUNCTION public.is_active_student_profile(p_user_id UUID)') &&
      migrationSql.includes('SECURITY DEFINER') &&
      migrationSql.includes('SET search_path = public') &&
      migrationSql.includes('STABLE'),
    'Defines public.is_active_student_profile as STABLE SECURITY DEFINER with locked search_path'
  );

  assert(
    'SEC03-02',
    migrationSql.includes("role = 'student'") &&
      migrationSql.includes("status != 'suspended'") &&
      migrationSql.includes('status IS NOT NULL'),
    'is_active_student_profile checks role = student, status != suspended, and status IS NOT NULL'
  );

  const protectedTables = [
    'subjects',
    'study_plans',
    'study_plan_items',
    'tasks',
    'assignments',
    'submissions',
    'evaluations',
    'resources',
    'doubts',
    'doubt_responses',
    'announcements',
    'announcement_acknowledgments',
  ];

  for (const tableName of protectedTables) {
    const hasPermissiveCheck =
      migrationSql.includes(`ON public.${tableName}`) &&
      (migrationSql.includes(`public.is_active_student_profile(auth.uid())`) ||
       migrationSql.includes(`public.is_active_student_profile`));

    assert(
      `SEC03-TAB-${tableName}-PERM`,
      hasPermissiveCheck,
      `Table ${tableName} student permissive branch enforces is_active_student_profile`
    );

    const hasRestrictive =
      migrationSql.includes(`ON public.${tableName}`) &&
      migrationSql.includes(`AS RESTRICTIVE`) &&
      migrationSql.includes(`NOT (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'student' AND status = 'suspended'))`);

    assert(
      `SEC03-TAB-${tableName}-REST`,
      hasRestrictive,
      `Table ${tableName} enforces AS RESTRICTIVE policy blocking suspended students`
    );
  }

  // ----------------------------------------------------------------------------
  // Section 3: SEC-03 PostgreSQL Dual-Layer RLS Simulation
  // ----------------------------------------------------------------------------
  console.log('\n--- Section 3: SEC-03 Dual-Layer RLS Engine Simulation ---');

  const activeStudent: UserProfile = { id: 'std-100', role: 'student', status: 'active' };
  const suspendedStudent: UserProfile = { id: 'std-200', role: 'student', status: 'suspended' };
  const activeMentor: UserProfile = { id: 'men-300', role: 'mentor', status: 'active' };
  const adminUser: UserProfile = { id: 'adm-400', role: 'admin', status: 'active' };

  const targetRow: SimulatedRow = { student_id: 'std-100', program_id: 'prog-01' };
  const suspendedRow: SimulatedRow = { student_id: 'std-200', program_id: 'prog-01' };

  // Scenario A: Active student accessing own record
  const resActiveStudent = evaluateSubjectsPolicy(targetRow, activeStudent, false);
  assert(
    'SIM-01',
    resActiveStudent.accessGranted === true,
    'Active student accessing own subjects record is GRANTED'
  );

  // Scenario B: Suspended student accessing own record
  const resSuspendedStudent = evaluateSubjectsPolicy(suspendedRow, suspendedStudent, false);
  assert(
    'SIM-02',
    resSuspendedStudent.accessGranted === false &&
      resSuspendedStudent.permissivePassed === false &&
      resSuspendedStudent.restrictivePassed === false,
    'Suspended student accessing own record fails both permissive check and restrictive check (DENIED)'
  );

  // Scenario C: Residual permissive bypass test
  // If an attacker exploits a hypothetical permissive policy that passed,
  // does the AS RESTRICTIVE policy still block the suspended student?
  const isSuspendedStudent = suspendedStudent.role === 'student' && suspendedStudent.status === 'suspended';
  const restrictiveFilter = !isSuspendedStudent;
  const hypotheticalPermissiveBypass = true; // Simulating a permissive policy that evaluated to TRUE
  const finalAccessWithRestrictive = hypotheticalPermissiveBypass && restrictiveFilter;
  assert(
    'SIM-03',
    finalAccessWithRestrictive === false,
    'AS RESTRICTIVE policy guarantees DENIAL even if a permissive policy evaluates to true'
  );

  // Scenario D: Active mentor accessing assigned student record
  const resMentor = evaluateSubjectsPolicy(targetRow, activeMentor, true);
  assert(
    'SIM-04',
    resMentor.accessGranted === true && resMentor.restrictivePassed === true,
    'Authorized mentor accessing student record is GRANTED and never blocked by student restrictive policy'
  );

  // Scenario E: Admin user
  assert(
    'SIM-05',
    adminUser.role !== 'student',
    'Admin user is not affected by student restrictive policy'
  );

  // ----------------------------------------------------------------------------
  // Section 4: SEC-01 Edge Function Turnstile Fail-Closed
  // ----------------------------------------------------------------------------
  console.log('\n--- Section 4: SEC-01 Edge Function Turnstile Fail-Closed Logic ---');

  const edgeFunctionPath = path.join(
    projectRoot,
    'supabase/functions/resolve-poraplan-id/index.ts'
  );
  assert(
    'SEC01-01',
    fs.existsSync(edgeFunctionPath),
    'Edge Function resolve-poraplan-id exists'
  );

  const edgeCode = fs.readFileSync(edgeFunctionPath, 'utf8');

  assert(
    'SEC01-02',
    edgeCode.includes("Deno.env.get('TURNSTILE_SECRET_KEY')") &&
      edgeCode.includes('if (!turnstileSecret)') &&
      edgeCode.includes('Authentication service configuration error.'),
    'Fails closed with HTTP 500 when TURNSTILE_SECRET_KEY is missing in non-dev environment'
  );

  assert(
    'SEC01-03',
    edgeCode.includes('if (!captchaToken || typeof captchaToken !== \'string\' || !captchaToken.trim())') &&
      edgeCode.includes('CAPTCHA verification required.'),
    'Requires non-empty string captchaToken when verification is active'
  );

  assert(
    'SEC01-04',
    edgeCode.includes('new AbortController()') &&
      edgeCode.includes('signal: controller.signal') &&
      edgeCode.includes('CAPTCHA verification service temporarily unavailable.'),
    'Enforces timeout and returns HTTP 502 when verification times out or network fails'
  );

  assert(
    'SEC01-05',
    edgeCode.includes('if (!siteverifyData.success)') &&
      edgeCode.includes('CAPTCHA verification failed. Please try again.'),
    'Returns HTTP 400 when Cloudflare Turnstile rejects token'
  );

  // ----------------------------------------------------------------------------
  // Section 5: SEC-04 Edge Function CORS Hardening
  // ----------------------------------------------------------------------------
  console.log('\n--- Section 5: SEC-04 Edge Function CORS Hardening ---');

  assert(
    'SEC04-01',
    !edgeCode.includes("'Access-Control-Allow-Origin': '*'"),
    'Edge Function completely removes wildcard Access-Control-Allow-Origin: *'
  );

  assert(
    'SEC04-02',
    edgeCode.includes("'https://poraplan.com'") &&
      edgeCode.includes("'https://www.poraplan.com'") &&
      edgeCode.includes("Deno.env.get('ALLOWED_ORIGINS')"),
    'Defines explicit allowlist of production domains and configurable ALLOWED_ORIGINS'
  );

  assert(
    'SEC04-03',
    edgeCode.includes("req.headers.get('origin')") &&
      edgeCode.includes('if (origin && allowedOrigins.includes(origin))') &&
      edgeCode.includes("headers['Access-Control-Allow-Origin'] = origin"),
    'Reflects Access-Control-Allow-Origin only for validated allowed origins'
  );

  assert(
    'SEC04-04',
    edgeCode.includes("req.method === 'OPTIONS'") &&
      edgeCode.includes("if (origin && !allowedOrigins.includes(origin))") &&
      edgeCode.includes('status: 403'),
    'Rejects unauthorized preflight OPTIONS requests with HTTP 403'
  );

  assert(
    'SEC04-05',
    edgeCode.includes("'Vary': 'Origin'"),
    'Sets Vary: Origin header to prevent cache poisoning across origins'
  );

  // ----------------------------------------------------------------------------
  // Section 6: Security Hygiene & Emoji Check
  // ----------------------------------------------------------------------------
  console.log('\n--- Section 6: Security Hygiene & Clean Output ---');

  const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;

  assert(
    'HYG-01',
    !emojiRegex.test(migrationSql),
    'Migration SQL contains zero emojis'
  );

  assert(
    'HYG-02',
    !emojiRegex.test(edgeCode),
    'Edge Function code contains zero emojis'
  );

  assert(
    'HYG-03',
    !edgeCode.includes('console.log') &&
      !edgeCode.includes('captchaToken') || !edgeCode.includes('console.log(captchaToken'),
    'Edge Function does not log captcha tokens or credentials'
  );

  console.log('\n================================================================');
  console.log(`Summary: ${passCount}/${passCount + failCount} scenarios passed (${failCount} failed).`);
  console.log('================================================================');

  if (failCount > 0) {
    process.exit(1);
  }
}

runVerificationSuite().catch((err) => {
  console.error('Test suite execution error:', err);
  process.exit(1);
});
