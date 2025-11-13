// Find which phone matches the returned hash
const crypto = require('crypto');

function normalizePhone(raw) {
  const trimmed = raw.trim();
  const digits = trimmed.replace(/(?!^\+)[^\d]/g, '');
  return digits;
}

function hashPhone(normalizedPhone) {
  const h = crypto.createHash('sha256').update(normalizedPhone).digest('hex');
  return '0x' + h;
}

const returnedHash = '0xaaa5f4f92ccb31fb8bc50e43ae3288f62c8bff3b623b914a78df294602f86b59';

// Test common phone formats
const testPhones = [
  '601110851129',  // Full international
  '1110851129',    // Without country code
  '+601110851129', // With plus
  '01110851129',   // Local format
  '6010851129',    // Different format
  '601136228183',  // Second user
  '1136228183',    // Second user without country
];

console.log('Looking for phone that matches hash:', returnedHash);

for (const phone of testPhones) {
  const normalized = normalizePhone(phone);
  const hash = hashPhone(normalized);
  console.log(`${phone} → ${normalized} → ${hash}`);
  
  if (hash === returnedHash) {
    console.log(`🎯 MATCH FOUND! Phone: ${phone}, Normalized: ${normalized}`);
  }
}