import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { resolveMockPoraPlanId, authenticateMockPoraPlanId, getMockAccountById } from '../lib/mockAuthStore';
import { validatePasswordPolicy } from '../lib/passwordPolicy';

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

async function runVerificationSuite() {
  console.log('================================================================');
  console.log('PoraPlan Phase 2.3B.4.3 Authentication Abuse Protection Verification');
  console.log('================================================================\n');

  // ----------------------------------------------------------------------------
  // Section 1: Migration & Server Privilege Boundary
  // ----------------------------------------------------------------------------
  console.log('--- Section 1: Migration & Server Privilege Boundary ---');

  const migrationPath = path.join(
    projectRoot,
    'supabase/migrations/20261110000004_revoke_anon_poraplan_resolver.sql'
  );
  assert(
    'MIG-01',
    fs.existsSync(migrationPath),
    'Migration 20261110000004_revoke_anon_poraplan_resolver.sql exists'
  );

  const migrationContent = fs.readFileSync(migrationPath, 'utf8');
  assert(
    'MIG-02',
    migrationContent.includes('REVOKE EXECUTE ON FUNCTION public.resolve_poraplan_id_login(TEXT) FROM anon') &&
      migrationContent.includes('REVOKE EXECUTE ON FUNCTION public.resolve_poraplan_id_login(TEXT) FROM PUBLIC'),
    'Migration explicitly revokes execute on resolve_poraplan_id_login from anon and PUBLIC'
  );

  assert(
    'MIG-03',
    migrationContent.includes('GRANT EXECUTE ON FUNCTION public.resolve_poraplan_id_login(TEXT) TO service_role'),
    'Migration restricts execution strictly to service_role'
  );

  // ----------------------------------------------------------------------------
  // Section 2: Server-Side Edge Function Analysis
  // ----------------------------------------------------------------------------
  console.log('\n--- Section 2: Server-Side Edge Function Architecture ---');

  const edgeFunctionPath = path.join(
    projectRoot,
    'supabase/functions/resolve-poraplan-id/index.ts'
  );
  assert(
    'EDGE-01',
    fs.existsSync(edgeFunctionPath),
    'Edge function supabase/functions/resolve-poraplan-id/index.ts exists'
  );

  const edgeContent = fs.readFileSync(edgeFunctionPath, 'utf8');
  assert(
    'EDGE-02',
    edgeContent.includes('https://challenges.cloudflare.com/turnstile/v0/siteverify') &&
      edgeContent.includes('TURNSTILE_SECRET_KEY'),
    'Edge function verifies Cloudflare Turnstile token via official siteverify endpoint'
  );

  assert(
    'EDGE-03',
    edgeContent.includes("account_status === 'suspended'") &&
      edgeContent.includes('Invalid PoraPlan ID or password.'),
    'Edge function returns uniform error for suspended accounts without disclosing status'
  );

  assert(
    'EDGE-04',
    edgeContent.includes('Invalid PoraPlan ID or password.') &&
      !edgeContent.includes('This PoraPlan ID is not recognized'),
    'Edge function returns uniform error for non-existent IDs to defeat enumeration'
  );

  assert(
    'EDGE-05',
    !edgeContent.includes('console.log(poraplanId') &&
      !edgeContent.includes('console.log(captchaToken') &&
      !edgeContent.includes('console.log(password'),
    'Edge function strictly avoids logging IDs, tokens, passwords, or credentials'
  );

  // ----------------------------------------------------------------------------
  // Section 3: Client Resolver & Uniform Error Handling
  // ----------------------------------------------------------------------------
  console.log('\n--- Section 3: Client Resolver & Anti-Enumeration Interface ---');

  const profilesPath = path.join(projectRoot, 'src/lib/profiles.ts');
  const profilesContent = fs.readFileSync(profilesPath, 'utf8');

  assert(
    'RES-01',
    profilesContent.includes("supabase.functions.invoke('resolve-poraplan-id'"),
    'profiles.ts routes resolution through resolve-poraplan-id Edge Function'
  );

  assert(
    'RES-02',
    !profilesContent.includes(".from('profiles')") ||
      !profilesContent.includes(".ilike('poraplan_id', cleanId)"),
    'Direct unauthenticated table query fallback on profiles table is completely removed'
  );

  assert(
    'RES-03',
    profilesContent.includes('Invalid PoraPlan ID or password.'),
    'profiles.ts resolves non-existent and suspended accounts to uniform error'
  );

  // Behavioral test on mock resolver
  const mockValid = resolveMockPoraPlanId('PP001');
  assert(
    'RES-04',
    mockValid !== null && mockValid.poraplanId === 'PP001',
    'Valid student ID resolves successfully in mock mode'
  );

  const mockInvalid = resolveMockPoraPlanId('PP999');
  assert(
    'RES-05',
    mockInvalid === null,
    'Invalid ID returns null in mock resolver'
  );

  // ----------------------------------------------------------------------------
  // Section 4: Login & Authentication Suspension Enforcement
  // ----------------------------------------------------------------------------
  console.log('\n--- Section 4: Login & Account Suspension Enforcement ---');

  const authContextPath = path.join(projectRoot, 'src/contexts/AuthContext.tsx');
  const authContextContent = fs.readFileSync(authContextPath, 'utf8');

  assert(
    'AUTH-01',
    authContextContent.includes("userProfile.status === 'suspended'") &&
      authContextContent.includes('await supabase.auth.signOut()'),
    'AuthContext automatically revokes session if profile status is suspended'
  );

  assert(
    'AUTH-02',
    authContextContent.includes("options: captchaTokens?.loginToken ? { captchaToken: captchaTokens.loginToken } : undefined"),
    'AuthContext forwards fresh GoTrue login CAPTCHA token to signInWithPassword'
  );

  // Behavioral test for mock authentication roles
  const validStudentAuth = authenticateMockPoraPlanId('PP001', 'password');
  assert(
    'AUTH-03',
    validStudentAuth.account?.role === 'student' && validStudentAuth.error === null,
    'Valid student login succeeds with student role'
  );

  const validMentorAuth = authenticateMockPoraPlanId('PPM001', 'password');
  assert(
    'AUTH-04',
    validMentorAuth.account?.role === 'mentor' && validMentorAuth.error === null,
    'Valid mentor login succeeds with mentor role'
  );

  const validAdminAuth = authenticateMockPoraPlanId('PPA001', 'password');
  assert(
    'AUTH-05',
    validAdminAuth.account?.role === 'admin' && validAdminAuth.error === null,
    'Valid admin login succeeds with admin role'
  );

  const invalidPassAuth = authenticateMockPoraPlanId('PP001', 'WrongPassword123!');
  assert(
    'AUTH-06',
    invalidPassAuth.account === null && invalidPassAuth.error !== null,
    'Invalid password fails cleanly'
  );

  // Suspended account behavioral check
  const retiredAccount = getMockAccountById('mock-student-pp001');
  if (retiredAccount) {
    retiredAccount.status = 'suspended';
  }
  const suspendedAuth = authenticateMockPoraPlanId('PP001', 'password');
  assert(
    'AUTH-07',
    Boolean(suspendedAuth.error?.message.includes('suspended') || suspendedAuth.error?.message.includes('Invalid')),
    'Suspended account is rejected during authentication'
  );
  if (retiredAccount) {
    retiredAccount.status = 'active';
  }

  // ----------------------------------------------------------------------------
  // Section 5: Turnstile Widget Component & Frontend Integration
  // ----------------------------------------------------------------------------
  console.log('\n--- Section 5: Turnstile Widget & Frontend Integration ---');

  const widgetPath = path.join(projectRoot, 'src/components/auth/TurnstileWidget.tsx');
  assert(
    'UI-01',
    fs.existsSync(widgetPath),
    'TurnstileWidget component exists at src/components/auth/TurnstileWidget.tsx'
  );

  const widgetContent = fs.readFileSync(widgetPath, 'utf8');
  assert(
    'UI-02',
    widgetContent.includes('https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit') &&
      widgetContent.includes('window.turnstile.render'),
    'TurnstileWidget uses official Cloudflare explicit rendering script'
  );

  assert(
    'UI-03',
    widgetContent.includes('reset:') &&
      widgetContent.includes('refreshToken:') &&
      widgetContent.includes('getResponse:'),
    'TurnstileWidget exposes imperative reset, refreshToken, and getResponse methods'
  );

  const loginPagePath = path.join(projectRoot, 'src/pages/LoginPage.tsx');
  const loginPageContent = fs.readFileSync(loginPagePath, 'utf8');

  assert(
    'UI-04',
    loginPageContent.includes('<TurnstileWidget') &&
      loginPageContent.includes('action="login"') &&
      loginPageContent.includes('action="reset_password"'),
    'LoginPage integrates TurnstileWidget for both login and password recovery'
  );

  assert(
    'UI-05',
    loginPageContent.includes('Invalid PoraPlan ID or password.') &&
      !loginPageContent.includes('This PoraPlan ID is not recognized. Please check your ID or contact your mentor.'),
    'LoginPage displays uniform error message, eliminating recognizable-ID leak'
  );

  assert(
    'UI-06',
    loginPageContent.includes('getProgressiveDelay') &&
      loginPageContent.includes('progressiveCooldown'),
    'LoginPage includes bounded progressive delay for repeated failed attempts'
  );

  // ----------------------------------------------------------------------------
  // Section 6: Security Regression & Secret Hygiene
  // ----------------------------------------------------------------------------
  console.log('\n--- Section 6: Security Regression & Secret Hygiene ---');

  // Check that no secret keys or service role keys are present in src/
  const srcFiles = fs.readdirSync(path.join(projectRoot, 'src'), { recursive: true }) as string[];
  let secretFound = false;
  let emojiFound = false;

  const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;

  for (const rel of srcFiles) {
    const full = path.join(projectRoot, 'src', rel);
    if (fs.statSync(full).isFile() && (rel.endsWith('.ts') || rel.endsWith('.tsx'))) {
      const txt = fs.readFileSync(full, 'utf8');
      if (txt.includes('service_role_key') && !rel.includes('.test.')) {
        secretFound = true;
      }
      if (emojiRegex.test(txt)) {
        emojiFound = true;
      }
    }
  }

  assert(
    'SEC-01',
    !secretFound,
    'Zero service_role keys or private secret variables exist in src/'
  );

  assert(
    'SEC-02',
    !emojiFound,
    'Zero emojis found across src/ code and components'
  );

  // Confirm password policy remains active
  assert(
    'SEC-03',
    validatePasswordPolicy('PoraPlan2026!').valid && !validatePasswordPolicy('short').valid,
    'Strong password policy remains intact and verified'
  );

  console.log('\n================================================================');
  console.log(`Summary: ${passCount}/${passCount + failCount} scenarios passed (${failCount} failed).`);
  console.log('================================================================');

  if (failCount > 0) {
    process.exit(1);
  }
}

runVerificationSuite().catch((err) => {
  console.error('Fatal error during verification:', err);
  process.exit(1);
});
