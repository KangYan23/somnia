// Simple test to check SDK getByKey behavior
require('dotenv').config();
const { SDK } = require('@somnia-chain/streams');
const { createPublicClient, http } = require('viem');
const crypto = require('crypto');

function hashPhone(phone) {
  return '0x' + crypto.createHash('sha256').update(phone, 'utf8').digest('hex');
}

async function testPhoneLookup() {
  try {
    const publicClient = createPublicClient({
      transport: http(process.env.RPC_URL),
    });
    
    const sdk = new SDK({
      apiUrl: process.env.STREAMS_URL,
      apiKey: process.env.STREAMS_API_KEY,
      publicClient
    });

    const phoneHash = hashPhone('01110851129');
    console.log('Looking for phoneHash:', phoneHash);
    
    const schemaId = await sdk.streams.idToSchemaId('userRegistration');
    console.log('Schema ID:', schemaId);

    // Try different publisher addresses
    const publishers = [
      '0x7dd088dc87f6a9c709fd366222169580fbcf95ec',
      '0x7Dd088Dc87F6A9c709Fd366222169580fbCF95Ec',
      process.env.PUBLISHER_ADDRESS,
      process.env.WALLET_ADDRESS
    ].filter(Boolean);

    for (const publisher of publishers) {
      console.log(`\n=== Trying publisher: ${publisher} ===`);
      
      try {
        const results = await sdk.streams.getByKey(
          schemaId,
          publisher,
          phoneHash
        );

        console.log('Results count:', results?.length || 0);
        
        if (results && results.length > 0 && Array.isArray(results[0])) {
          const returnedPhoneHash = results[0][0]?.value?.value;
          const returnedWallet = results[0][1]?.value?.value;
          
          console.log('Returned phoneHash:', returnedPhoneHash);
          console.log('Returned wallet:', returnedWallet);
          console.log('Match:', phoneHash === returnedPhoneHash ? '✅' : '❌');
          
          if (phoneHash === returnedPhoneHash) {
            console.log('🎉 FOUND THE CORRECT RECORD!');
            break;
          }
        }
      } catch (error) {
        console.log('Error:', error.message);
      }
    }
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testPhoneLookup();