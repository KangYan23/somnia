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

/**
 * Strip country code from phone number
 * Handles both +6 and 60 prefixes
 * Returns phone without country code, with leading 0 (e.g., "01110851129")
 * 
 * WhatsApp sends: "601110851129" (country code 60, no leading 0)
 * We store: "01110851129" (no country code, with leading 0)
 */
export function stripCountryCode(phone: string): string {
  const normalized = normalizePhone(phone);
  // Default to +60 for Malaysia (not +6)
  const defaultCc = (process.env.DEFAULT_COUNTRY_CODE || '+60').trim();
  
  // Extract country code digits: "+6" -> "6", "+60" -> "60"
  const ccDigits = defaultCc.replace(/[^0-9]/g, '');
  const ccWithPlus = defaultCc.startsWith('+') ? defaultCc : `+${defaultCc}`;
  
  let phoneWithoutCc: string = normalized;
  
  // Handle multiple possible country code formats
  // Try to remove country code patterns in order: +60, 60, +6, 6
  const patterns = [
    '+60',  // Malaysia full country code with +
    '60',   // Malaysia full country code without +
    '+6',   // Short country code with +
    '6'     // Short country code without +
  ];
  
  // Remove country code patterns until none match
  let changed = true;
  while (changed) {
    changed = false;
    for (const pattern of patterns) {
      if (phoneWithoutCc.startsWith(pattern)) {
        phoneWithoutCc = phoneWithoutCc.substring(pattern.length);
        changed = true;
        break; // Restart checking from the beginning
      }
    }
  }
  
  // If the phone doesn't start with 0, add it
  // WhatsApp sends "601110851129" -> remove "60" -> "1110851129" -> add "0" -> "01110851129"
  // Or "+60601110851129" -> remove "+60" and "60" -> "1110851129" -> add "0" -> "01110851129"
  if (!phoneWithoutCc.startsWith('0') && phoneWithoutCc.length > 0) {
    phoneWithoutCc = '0' + phoneWithoutCc;
  }
  
  return phoneWithoutCc;
}

/**
 * Add country code to phone number for WhatsApp sending
 * Returns phone with country code (e.g., "+601110851129")
 * 
 * Phone numbers from data stream are stored WITHOUT country code (e.g., "01110851129")
 * This function adds the country code correctly, handling leading zeros.
 */
export function addCountryCodeForWhatsApp(phone: string): string {
  const normalized = normalizePhone(phone);
  // Default to +60 for Malaysia (not +6)
  const defaultCc = (process.env.DEFAULT_COUNTRY_CODE || '+60').trim();
  const ccWithPlus = defaultCc.startsWith('+') ? defaultCc : `+${defaultCc}`;
  const ccDigits = defaultCc.replace(/[^0-9]/g, ''); // Extract digits: "+60" -> "60"
  
  // If already has country code with +, return as-is
  if (normalized.startsWith(ccWithPlus)) {
    return normalized;
  }
  
  // If already has country code digits (without +), just add +
  if (normalized.startsWith(ccDigits)) {
    return `+${normalized}`;
  }
  
  // Phone from data stream might have leading 0 (e.g., "01110851129")
  // Remove leading 0 before adding country code
  // Example: "01110851129" -> remove "0" -> "1110851129" -> add "+60" -> "+601110851129"
  let phoneToAdd = normalized;
  if (phoneToAdd.startsWith('0')) {
    phoneToAdd = phoneToAdd.substring(1); // Remove leading 0: "01110851129" -> "1110851129"
  }
  
  // Add country code
  return `${ccWithPlus}${phoneToAdd}`;
}

export function hashPhone(normalizedPhone: string) {
  // SHA-256 -> 0x-prefixed hex
  const h = crypto.createHash('sha256').update(normalizedPhone).digest('hex');
  return '0x' + h;
}
