// Test the exact same query that the website uses
require('dotenv').config();
const { SDK } = require('@somnia-chain/streams');
const { createPublicClient, http } = require('viem');
const crypto = require('crypto');

function hashPhone(phone) {
  return '0x' + crypto.createHash('sha256').update(phone, 'utf8').digest('hex');
}

function normalizePhone(phone) {
  // Simple normalization - remove spaces, dashes, plus
  return phone.replace(/[\s\-\+]/g, '');
}

async function testWebsiteQuery() {
  try {
    const publicClient = createPublicClient({
      transport: http(process.env.RPC_URL),
    });
    
    const sdk = new SDK({
      apiUrl: process.env.STREAMS_URL,
      apiKey: process.env.STREAMS_API_KEY,
      publicClient
    });

    // Test the exact phone from your message
    const phone = '01110851129';
    const normalized = normalizePhone(phone);
    const phoneHash = hashPhone(normalized);
    
    console.log('=== Testing Website Query Method ===');
    console.log('Original phone:', phone);
    console.log('Normalized phone:', normalized);
    console.log('Phone hash:', phoneHash);
    
    const schemaId = await sdk.streams.idToSchemaId('userRegistration');
    console.log('Schema ID:', schemaId);

    const publisherAddress = process.env.PUBLISHER_ADDRESS || process.env.WALLET_ADDRESS;
    console.log('Publisher address:', publisherAddress);

    // This is EXACTLY what the website does
    const results = await sdk.streams.getByKey(
      schemaId,
      publisherAddress,
      phoneHash
    );

    console.log('\n=== Results ===');
    console.log('Results found:', results?.length || 0);
    console.dir(results, { depth: null });
    
    if (results && results.length > 0 && Array.isArray(results[0])) {
      const returnedPhoneHash = results[0][0]?.value?.value;
      const returnedWallet = results[0][1]?.value?.value;
      
      console.log('\n=== Data Analysis ===');
      console.log('Expected phoneHash:', phoneHash);
      console.log('Returned phoneHash:', returnedPhoneHash);
      console.log('Match:', phoneHash === returnedPhoneHash ? '✅ YES' : '❌ NO');
      console.log('Returned wallet:', returnedWallet);
      
      if (phoneHash === returnedPhoneHash) {
        console.log('\n🎉 PHONE IS REGISTERED! The website query should work.');
      } else {
        console.log('\n❌ Phone hash mismatch - this explains the transfer issue.');
      }
    } else {
      console.log('\n❌ No data returned - phone not found.');
    }
    
  } catch (error) {
    console.error('Query failed:', error);
  }
}

testWebsiteQuery();