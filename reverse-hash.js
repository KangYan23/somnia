// Find which phone produces the hash 0xaaa5f4f92ccb31fb8bc50e43ae3288f62c8bff3b623b914a78df294602f86b59
const crypto = require('crypto');

function hashPhone(phone) {
  return '0x' + crypto.createHash('sha256').update(phone, 'utf8').digest('hex');
}

const targetHash = '0xaaa5f4f92ccb31fb8bc50e43ae3288f62c8bff3b623b914a78df294602f86b59';

// Test the phone number you mentioned
const testPhone = '0177163313';
const computedHash = hashPhone(testPhone);

console.log('Phone:', testPhone);
console.log('Computed hash:', computedHash);
console.log('Target hash:  ', targetHash);
console.log('Match:', computedHash === targetHash);

// Also test some variations
const variations = [
  '177163313',
  '+0177163313', 
  '60177163313',
  '+60177163313'
];

console.log('\nTesting variations:');
variations.forEach(phone => {
  const hash = hashPhone(phone);
  console.log(`${phone} → ${hash} → ${hash === targetHash ? 'MATCH!' : 'no match'}`);
});