// src/lib/phone.ts
import crypto from 'crypto';

/**
 * Normalize to E.164-ish: keep only digits and leading '+'
 * Caller must ensure country code is present (ask user to enter in E.164)
 */
export function normalizePhone(raw: string) {
  // remove spaces, parentheses, hyphens. keep leading +
  const trimmed = raw.trim();
  const digits = trimmed.replace(/(?!^\+)[^\d]/g, '');
  return digits;
}

export function hashPhone(normalizedPhone: string) {
  // SHA-256 -> 0x-prefixed hex
  const h = crypto.createHash('sha256').update(normalizedPhone).digest('hex');
  return '0x' + h;
}
