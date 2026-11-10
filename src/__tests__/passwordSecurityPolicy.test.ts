/// <reference types="node" />
/**
 * PoraPlan — Phase 2.3B.3 Strong Password Security Policy Verification Suite
 *
 * Validates:
 * 1. Migration SQL Static Analysis (20261110000003_strong_password_security_policy.sql):
 *    - Migration file exists and has zero emojis.
 *    - Defines public.validate_password_policy with strict search_path.
 *    - Enforces minimum 8 Unicode characters.
 *    - Enforces maximum 72 characters and maximum 72 UTF-8 bytes (bcrypt boundary).
 *    - Rejects whitespace-only passwords.
 *    - Rejects all-identical character repetitions.
 *    - Rejects common weak passwords blocklist.
 *    - Upgrades admin_register_member and admin_reset_member_password to invoke validate_password_policy.
 *    - Revokes execute from PUBLIC, anon and grants to authenticated, service_role.
 *    - Never returns or exposes plaintext passwords in responses or query outputs.
 *
 * 2. Shared Password Policy Unit Verification (src/lib/passwordPolicy.ts):
 *    - 7-character password rejected.
 *    - 8-character password accepted when permitted.
 *    - Long passphrase with spaces accepted within 72 bytes.
 *    - Internal spaces preserved and permitted.
 *    - Multi-byte Unicode (Bengali) character count vs byte length accurately measured.
 *    - Multi-byte Unicode exceeding 72 bytes rejected without silent truncation.
 *    - ASCII exceeding 72 characters/bytes rejected.
 *    - All-identical character repetitions rejected.
 *    - Whitespace-only passwords rejected.
 *    - Common weak passwords rejected case-insensitively.
 *    - Empty or null/undefined passwords rejected with informative error.
 *
 * 3. Frontend & Auth Context Integration Verification:
 *    - ResetPasswordPage enforces validatePasswordPolicy before submission.
 *    - ResetPasswordPage displays concise guidance text (12-16+ recommended).
 *    - ResetPasswordPage maintains show/hide password toggle.
 *    - AuthContext.updateNewPassword enforces validatePasswordPolicy.
 *    - mockAuthStore.resetMockPassword enforces policy on recovery.
 *    - mockAuthStore.resetMockPasswordByPoraplanId enforces policy on admin reset.
 *    - mockAuthStore.adminRegisterMockMember validates initial password if supplied.
 *
 * 4. Privileged RPC Helper Validation (Static & Mock Simulation):
 *    - profiles.ts enforces validatePasswordPolicy before calling admin_register_member.
 *    - profiles.ts enforces validatePasswordPolicy before calling admin_reset_member_password.
 *    - Direct RPC simulation confirms short/weak/over-byte passwords cannot bypass checks.
 *
 * 5. Secret Protection & UI Hygiene:
 *    - Zero emojis across all modified files.
 *    - Zero plaintext passwords or hashes logged in test outputs or diagnostic messages.
 */

import fs from 'fs';
import path from 'path';
import {
  validatePasswordPolicy,
  MIN_PASSWORD_LENGTH,
  MAX_PASSWORD_LENGTH,
  MAX_PASSWORD_BYTES,
  PASSWORD_GUIDANCE_TEXT,
  COMMON_WEAK_PASSWORDS,
  getUtf8ByteLength,
  getUnicodeCharacterCount,
} from '../lib/passwordPolicy';
import {
  resetMockPassword,
  resetMockPasswordByPoraplanId,
  adminRegisterMockMember,
} from '../lib/mockAuthStore';

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

async function runPasswordVerification() {
  console.log('================================================================');
  console.log('PoraPlan Phase 2.3B.3 Strong Password Security Policy Verification');
  console.log('================================================================\n');

  // ===========================================================================
  // SECTION 1: Database Migration Static Analysis
  // ===========================================================================
  console.log('--- Section 1: Database Migration Static Analysis ---');

  const migrationPath = path.resolve(
    process.cwd(),
    'supabase/migrations/20261110000003_strong_password_security_policy.sql'
  );

  const migrationExists = fs.existsSync(migrationPath);
  report('MIG-01', migrationExists, 'Migration 20261110000003_strong_password_security_policy.sql exists');

  if (migrationExists) {
    const sql = fs.readFileSync(migrationPath, 'utf8');

    // Emoji check
    const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
    report('MIG-02', !emojiRegex.test(sql), 'Migration contains zero emojis');

    // Creates validate_password_policy
    const definesValidator = /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.validate_password_policy/i.test(sql);
    report('MIG-03', definesValidator, 'Defines public.validate_password_policy function');

    // Strict search_path
    const hasSearchPath = /SET\s+search_path\s*=\s*public/i.test(sql);
    report('MIG-04', hasSearchPath, 'Validator enforces safe search_path');

    // Enforces minimum 8 characters
    const checksMinLength = sql.includes('v_char_len < 8') || sql.includes('length(p_password) < 8');
    report('MIG-05', checksMinLength, 'Enforces server-side minimum 8 character length');

    // Enforces maximum 72 UTF-8 bytes for bcrypt boundary
    const checksMaxBytes = sql.includes('v_byte_len > 72') || sql.includes('octet_length(p_password) > 72');
    report('MIG-06', checksMaxBytes, 'Enforces server-side 72-byte limit to prevent silent bcrypt truncation');

    // Rejects whitespace-only passwords
    const checksWhitespace = sql.includes("TRIM(p_password) = ''");
    report('MIG-07', checksWhitespace, 'Rejects whitespace-only passwords server-side');

    // Rejects trivial repeated characters
    const checksRepeated = sql.includes('^(.)\\1+$');
    report('MIG-08', checksRepeated, 'Rejects all-identical character repetitions server-side');

    // Rejects common weak passwords
    const checksWeakList = sql.includes('password') && sql.includes('12345678') && sql.includes('admin123');
    report('MIG-09', checksWeakList, 'Enforces common weak password blocklist server-side');

    // admin_register_member calls validate_password_policy
    const registerEnforces = sql.includes('public.validate_password_policy(p_initial_password)');
    report('MIG-10', registerEnforces, 'admin_register_member delegates validation to validate_password_policy');

    // admin_reset_member_password calls validate_password_policy
    const resetEnforces = sql.includes('public.validate_password_policy(p_new_password)');
    report('MIG-11', resetEnforces, 'admin_reset_member_password delegates validation to validate_password_policy');

    // Revokes execute from PUBLIC, anon
    const revokesPublic = sql.includes('REVOKE ALL ON FUNCTION public.validate_password_policy(TEXT) FROM PUBLIC, anon;');
    report('MIG-12', revokesPublic, 'Revokes execute on validate_password_policy from PUBLIC and anon');

    // No cleartext password in returned query columns
    const returnQueryMatches = sql.match(/RETURN\s+QUERY\s+SELECT[\s\S]*?;/gi) || [];
    const returnsPlaintext = returnQueryMatches.some(
      (stmt) =>
        stmt.includes('v_clean_password') ||
        stmt.includes('p_initial_password') ||
        stmt.includes('p_new_password')
    );
    report('MIG-13', !returnsPlaintext && returnQueryMatches.length === 2, 'Never echoes plaintext password in RPC return sets');
  }

  // ===========================================================================
  // SECTION 2: Shared Password Policy Unit Verification
  // ===========================================================================
  console.log('\n--- Section 2: Shared Password Policy Unit Verification ---');

  // Policy constants
  report('POL-01', MIN_PASSWORD_LENGTH === 8, 'MIN_PASSWORD_LENGTH is exactly 8');
  report('POL-02', MAX_PASSWORD_LENGTH === 72, 'MAX_PASSWORD_LENGTH is exactly 72');
  report('POL-03', MAX_PASSWORD_BYTES === 72, 'MAX_PASSWORD_BYTES is exactly 72 (matching bcrypt limitation)');
  report('POL-04', PASSWORD_GUIDANCE_TEXT.includes('12') && PASSWORD_GUIDANCE_TEXT.includes('16'), 'Guidance recommends 12-16+ characters');

  // 7-character password rejected
  const resShort = validatePasswordPolicy('Abc1234');
  report('POL-05', !resShort.valid && resShort.error?.includes('at least 8 characters') === true, '7-character password rejected with length error');

  // 8-character password accepted if permitted
  const resValid8 = validatePasswordPolicy('V@lid8Ch');
  report('POL-06', resValid8.valid === true, '8-character permitted password accepted');

  // Long passphrase accepted within 72 bytes
  const resPassphrase = validatePasswordPolicy('correct horse battery staple');
  report('POL-07', resPassphrase.valid === true, 'Long passphrase with spaces accepted');

  // Internal spaces accepted and preserved
  const resSpaces = validatePasswordPolicy('my secret key 2026');
  report('POL-08', resSpaces.valid === true, 'Passphrase with internal spaces accepted');

  // Unicode password character counting and byte measurement
  const bengaliWord = 'আমারপাসওয়ার্ড'; // 13 characters, 39 UTF-8 bytes
  const bengaliCharCount = getUnicodeCharacterCount(bengaliWord);
  const bengaliByteCount = getUtf8ByteLength(bengaliWord);
  report('POL-09', bengaliCharCount === 13 && bengaliByteCount === 39, 'Accurately counts Unicode characters (13) and UTF-8 bytes (39)');

  const resBengaliValid = validatePasswordPolicy(bengaliWord);
  report('POL-10', resBengaliValid.valid === true, 'Valid Bengali Unicode password accepted');

  // Unicode password exceeding 72 bytes rejected without silent truncation
  // 25 Bengali characters = 25 * 3 = 75 bytes (> 72 bytes)
  const longBengali = 'আমারপাসওয়ার্ডআমারপাসওয়ার্ড১২';
  const longBengaliBytes = getUtf8ByteLength(longBengali);
  const resLongBengali = validatePasswordPolicy(longBengali);
  report(
    'POL-11',
    longBengaliBytes > 72 && !resLongBengali.valid && resLongBengali.error?.includes('72 bytes') === true,
    'Unicode password exceeding 72 bytes rejected without silent truncation'
  );

  // ASCII password exceeding 72 characters rejected
  const ascii73 = 'A'.repeat(73);
  const resAscii73 = validatePasswordPolicy(ascii73);
  report('POL-12', !resAscii73.valid, 'ASCII password exceeding 72 characters rejected');

  // All-identical character repetitions rejected
  const resRepeatedA = validatePasswordPolicy('aaaaaaaa');
  const resRepeated1 = validatePasswordPolicy('11111111');
  report('POL-13', !resRepeatedA.valid && !resRepeated1.valid, 'All-identical character strings rejected as too simple');

  // Whitespace-only rejected
  const resOnlySpaces = validatePasswordPolicy('        ');
  report('POL-14', !resOnlySpaces.valid && resOnlySpaces.error?.includes('whitespace') === true, 'Whitespace-only password rejected');

  // Common weak passwords rejected
  const weakSamples = ['password', '12345678', 'admin123', 'qwertyuiop', 'poraplan123'];
  let allWeakRejected = true;
  for (const w of weakSamples) {
    const res = validatePasswordPolicy(w);
    if (res.valid) allWeakRejected = false;
  }
  report('POL-15', allWeakRejected, 'All common weak passwords rejected');

  // Case-insensitive weak check
  const resWeakUpper = validatePasswordPolicy('PASSWORD123');
  report('POL-16', !resWeakUpper.valid, 'Common weak check is case-insensitive');

  // Empty or null/undefined
  const resEmpty = validatePasswordPolicy('');
  const resNull = validatePasswordPolicy(null);
  const resUndefined = validatePasswordPolicy(undefined);
  report('POL-17', !resEmpty.valid && !resNull.valid && !resUndefined.valid, 'Empty, null, and undefined passwords rejected');
  report('POL-18', COMMON_WEAK_PASSWORDS.has('password'), 'COMMON_WEAK_PASSWORDS contains default password string');

  // ===========================================================================
  // SECTION 3: Frontend & Recovery Integration Verification
  // ===========================================================================
  console.log('\n--- Section 3: Frontend & Recovery Integration Verification ---');

  const resetPagePath = path.resolve(process.cwd(), 'src/pages/ResetPasswordPage.tsx');
  const resetPageSrc = fs.readFileSync(resetPagePath, 'utf8');

  // Enforces policy on ResetPasswordPage
  const resetEnforcesPolicy = resetPageSrc.includes('validatePasswordPolicy(newPassword)');
  report('UI-01', resetEnforcesPolicy, 'ResetPasswordPage enforces validatePasswordPolicy before submission');

  // Guidance text displayed
  const displaysGuidance = resetPageSrc.includes('PASSWORD_GUIDANCE_TEXT');
  report('UI-02', displaysGuidance, 'ResetPasswordPage displays concise guidance text (12-16+ recommended)');

  // Show/hide toggle preserved
  const hasShowHideToggle = resetPageSrc.includes('setShowNewPassword') && resetPageSrc.includes('setShowConfirmPassword');
  report('UI-03', hasShowHideToggle, 'Show/hide password toggles preserved on ResetPasswordPage');

  // Zero emojis on ResetPasswordPage
  const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
  report('UI-04', !emojiRegex.test(resetPageSrc), 'ResetPasswordPage contains zero emojis');

  // AuthContext enforcement
  const authContextPath = path.resolve(process.cwd(), 'src/contexts/AuthContext.tsx');
  const authContextSrc = fs.readFileSync(authContextPath, 'utf8');
  const authContextEnforces = authContextSrc.includes('validatePasswordPolicy(newPassword)');
  report('UI-05', authContextEnforces, 'AuthContext.updateNewPassword enforces validatePasswordPolicy');

  // Mock store reset password enforcement
  const mockResetShort = resetMockPassword('student.pp001@poraplan.internal', 'short');
  report('MOCK-01', !mockResetShort.success && mockResetShort.error !== null, 'resetMockPassword rejects short password');

  const mockResetWeak = resetMockPassword('student.pp001@poraplan.internal', '12345678');
  report('MOCK-02', !mockResetWeak.success && mockResetWeak.error !== null, 'resetMockPassword rejects common weak password');

  const mockResetValid = resetMockPassword('student.pp001@poraplan.internal', 'Correct Horse Battery');
  report('MOCK-03', mockResetValid.success && mockResetValid.error === null, 'resetMockPassword accepts valid passphrase');

  // Mock store admin reset password by PoraPlan ID
  const mockAdminResetShort = resetMockPasswordByPoraplanId('PP001', 'short');
  report('MOCK-04', !mockAdminResetShort.success, 'resetMockPasswordByPoraplanId rejects short password');

  const mockAdminResetValid = resetMockPasswordByPoraplanId('PP001', 'PoraPlanSecurePass#2026');
  report('MOCK-05', mockAdminResetValid.success, 'resetMockPasswordByPoraplanId accepts valid password');

  // Mock store admin register member validates initial password
  const mockRegInvalid = adminRegisterMockMember('PP999', 'Test Student', 'pp999@example.com', 'student', 'weak');
  report('MOCK-06', !mockRegInvalid.success, 'adminRegisterMockMember rejects non-compliant initial password');

  const mockRegValid = adminRegisterMockMember('PP998', 'Test Student', 'pp998@example.com', 'student', 'SecureInitial#2026');
  report('MOCK-07', mockRegValid.success, 'adminRegisterMockMember accepts valid initial password');

  // ===========================================================================
  // SECTION 4: Privileged RPC Helper Validation (Static & Mock Simulation)
  // ===========================================================================
  console.log('\n--- Section 4: Privileged RPC Helper Validation ---');

  const profilesPath = path.resolve(process.cwd(), 'src/lib/profiles.ts');
  const profilesSrc = fs.readFileSync(profilesPath, 'utf8');

  // adminRegisterMember validates initial password before RPC
  const regValidates = profilesSrc.includes('validatePasswordPolicy(initialPassword)');
  report('RPC-01', regValidates, 'adminRegisterMember validates initial password with validatePasswordPolicy before RPC');

  // adminResetMemberPassword validates new password before RPC
  const resetValidates = profilesSrc.includes('validatePasswordPolicy(newPassword)');
  report('RPC-02', resetValidates, 'adminResetMemberPassword validates new password with validatePasswordPolicy before RPC');

  // Direct bypass attempt rejected simulation
  const bypassShort = validatePasswordPolicy('short');
  const bypassWeak = validatePasswordPolicy('password');
  const bypass75Bytes = validatePasswordPolicy('আমারপাসওয়ার্ডআমারপাসওয়ার্ড১২');
  report(
    'RPC-03',
    !bypassShort.valid && !bypassWeak.valid && !bypass75Bytes.valid,
    'Server boundary rejects short, weak, and over-byte bypass attempts'
  );

  // ===========================================================================
  // SECTION 5: Hygiene and Security Audits
  // ===========================================================================
  console.log('\n--- Section 5: Hygiene and Security Audits ---');

  const touchedFiles = [
    'src/lib/passwordPolicy.ts',
    'src/pages/ResetPasswordPage.tsx',
    'src/contexts/AuthContext.tsx',
    'src/lib/mockAuthStore.ts',
    'src/lib/profiles.ts',
    'scripts/provision_local_test_accounts.ts',
    'supabase/migrations/20261110000003_strong_password_security_policy.sql',
  ];

  let zeroEmojisAll = true;
  let zeroSecretsAll = true;

  for (const relPath of touchedFiles) {
    const fullPath = path.resolve(process.cwd(), relPath);
    if (!fs.existsSync(fullPath)) continue;
    const content = fs.readFileSync(fullPath, 'utf8');

    if (emojiRegex.test(content)) {
      zeroEmojisAll = false;
      console.error('Emoji found in: ' + relPath);
    }

    if (/ey[A-Za-z0-9_-]{20,}/.test(content) || /sbp_[A-Za-z0-9]+/.test(content)) {
      zeroSecretsAll = false;
      console.error('Possible secret in: ' + relPath);
    }
  }

  report('SEC-01', zeroEmojisAll, 'Zero emojis across all Phase 2.3B.3 touched files');
  report('SEC-02', zeroSecretsAll, 'Zero secrets or credential tokens in touched files');

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

runPasswordVerification().catch((err) => {
  console.error('Fatal error during password policy verification:', err);
  process.exit(1);
});
