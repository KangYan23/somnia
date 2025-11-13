// Quick test to verify the exact situation
const crypto = require('crypto');

function hashPhone(phone) {
  return '0x' + crypto.createHash('sha256').update(phone, 'utf8').digest('hex');
}

console.log('=== Phone Hash Analysis ===');

// Test the phone you mentioned
const phone1 = '01110851129';
const hash1 = hashPhone(phone1);
console.log('Phone:', phone1);
console.log('Hash: ', hash1);
console.log('This is what we\'re looking for: 0xeceb6f44e0a6396aa50de30994b95aba3616fa4835cc6ea022bdd7f08e564de0');
console.log('Match:', hash1 === '0xeceb6f44e0a6396aa50de30994b95aba3616fa4835cc6ea022bdd7f08e564de0' ? '✅' : '❌');
console.log('');

// Test the phone that SDK keeps returning
const phone2 = '0177163313';
const hash2 = hashPhone(phone2);
console.log('Phone:', phone2);
console.log('Hash: ', hash2);
console.log('This is what SDK returns:      0xaaa5f4f92ccb31fb8bc50e43ae3288f62c8bff3b623b914a78df294602f86b59');
console.log('Match:', hash2 === '0xaaa5f4f92ccb31fb8bc50e43ae3288f62c8bff3b623b914a78df294602f86b59' ? '✅' : '❌');
console.log('');

console.log('=== Conclusion ===');
console.log('The SDK is consistently returning data for phone ' + phone2);
console.log('Even when we query for phone ' + phone1);
console.log('');
console.log('This means:');
console.log('1. Phone ' + phone1 + ' is NOT registered under your publisher address');
console.log('2. Phone ' + phone2 + ' IS registered under your publisher address');
console.log('3. The SDK has no data for ' + phone1 + ' so it returns a default/fallback record');
console.log('');
console.log('To verify: Check your website query again and make sure you\'re testing phone ' + phone1 + ' exactly');
console.log('If website shows it\'s registered, there might be a different publisher or different environment');