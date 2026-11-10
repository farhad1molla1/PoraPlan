/**
 * PoraPlan — Unified Password Security Policy
 *
 * Enforces consistent password validation rules across all client and server pathways:
 * 1. Minimum Length: 8 Unicode characters (12–16+ recommended).
 * 2. Maximum Length: 72 characters.
 * 3. Maximum Byte Length: 72 UTF-8 bytes (bcrypt input boundary to prevent silent truncation).
 * 4. Passphrase & Character Freedom: Spaces and Unicode characters (e.g. Bengali) fully supported.
 *    No rigid uppercase/lowercase/number/symbol combinations required.
 * 5. Weak Password Protection: Blocks known trivial, predictable, or repeated-character passwords.
 * 6. Privacy & Safety: Never logs passwords or sends credentials to external services from the browser.
 */

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 72;
export const MAX_PASSWORD_BYTES = 72;
export const RECOMMENDED_PASSWORD_LENGTH = 12;

export const PASSWORD_GUIDANCE_TEXT =
  'Minimum 8 characters (12–16+ recommended). Passphrases with spaces and Unicode supported (max 72 bytes).';

export const COMMON_WEAK_PASSWORDS: ReadonlySet<string> = new Set([
  'password',
  'password123',
  'password1234',
  '12345678',
  '123456789',
  '1234567890',
  'admin123',
  'admin1234',
  'administrator',
  'qwerty123',
  'qwertyuiop',
  'passphrase',
  'letmein123',
  'changeme',
  'changeme123',
  'welcome123',
  'welcome1',
  'poraplan123',
  'poraplan2026',
  'poraplan',
  'student123',
  'mentor123',
  'iloveyou',
  'sunshine',
  'master123',
  'secret123',
]);

export interface PasswordValidationResult {
  valid: boolean;
  error?: string;
  charLength: number;
  byteLength: number;
}

export function getUtf8ByteLength(str: string): number {
  return new TextEncoder().encode(str).length;
}

export function getUnicodeCharacterCount(str: string): number {
  return Array.from(str).length;
}

export function validatePasswordPolicy(password: string | null | undefined): PasswordValidationResult {
  if (!password || password.length === 0) {
    return {
      valid: false,
      error: 'Password cannot be empty.',
      charLength: 0,
      byteLength: 0,
    };
  }

  if (password.trim().length === 0) {
    return {
      valid: false,
      error: 'Password cannot consist entirely of whitespace.',
      charLength: Array.from(password).length,
      byteLength: getUtf8ByteLength(password),
    };
  }

  const charLength = getUnicodeCharacterCount(password);
  const byteLength = getUtf8ByteLength(password);

  if (charLength < MIN_PASSWORD_LENGTH) {
    return {
      valid: false,
      error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters in length.`,
      charLength,
      byteLength,
    };
  }

  if (charLength > MAX_PASSWORD_LENGTH) {
    return {
      valid: false,
      error: `Password must not exceed ${MAX_PASSWORD_LENGTH} characters.`,
      charLength,
      byteLength,
    };
  }

  if (byteLength > MAX_PASSWORD_BYTES) {
    return {
      valid: false,
      error: `Password must not exceed ${MAX_PASSWORD_BYTES} bytes in UTF-8 encoding.`,
      charLength,
      byteLength,
    };
  }

  // Check if all characters are identical (e.g. "aaaaaaaa", "11111111")
  const chars = Array.from(password);
  const allIdentical = chars.every((c) => c === chars[0]);
  if (allIdentical) {
    return {
      valid: false,
      error: 'Password is too simple. Please choose a more varied password.',
      charLength,
      byteLength,
    };
  }

  // Check against common weak passwords (case-insensitive)
  const lower = password.trim().toLowerCase();
  if (COMMON_WEAK_PASSWORDS.has(lower)) {
    return {
      valid: false,
      error: 'This password is too common or easily guessable. Please choose a more secure password.',
      charLength,
      byteLength,
    };
  }

  return {
    valid: true,
    charLength,
    byteLength,
  };
}
