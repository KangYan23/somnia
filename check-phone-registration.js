// Check phone registration directly
const { SDK } = require('@somnia-chain/streams');
const { createPublicClient, createWalletClient, http } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const { somniaTestnet } = require('viem/chains');
const crypto = require('crypto');

// Load env
require('dotenv/config');

function normalizePhone(raw) {
  const trimmed = raw.trim();
  const digits = trimmed.replace(/(?!^\+)[^\d]/g, '');
  return digits;
}

function hashPhone(normalizedPhone) {
  const h = crypto.createHash('sha256').update(normalizedPhone).digest('hex');
  return '0x' + h;
}

async function checkRegistration() {
  try {
    const privateKey = `0x${process.env.PRIVATE_KEY.trim().replace(/^0x/, '')}`;
    const account = privateKeyToAccount(privateKey);
    
    const publicClient = createPublicClient({ chain: somniaTestnet, transport: http(process.env.RPC_URL) });
    const walletClient = createWalletClient({ chain: somniaTestnet, account, transport: http(process.env.RPC_URL) });
    
    const sdk = new SDK({
      public: publicClient,
      wallet: walletClient
    });

    const schemaId = await sdk.streams.idToSchemaId('userRegistration');
    console.log('Schema ID:', schemaId);
    
    const publisherAddress = process.env.PUBLISHER_ADDRESS || process.env.WALLET_ADDRESS;
    console.log('Publisher:', publisherAddress);
    
    // Test both phones
    const phones = ['01110851129', '601110851129'];
    
    for (const phone of phones) {
      const normalized = normalizePhone(phone);
      const phoneHash = hashPhone(normalized);
      
      console.log(`\n--- Testing ${phone} ---`);
      console.log('Normalized:', normalized);
      console.log('PhoneHash:', phoneHash);
      
      try {
        const results = await sdk.streams.getByKey(schemaId, publisherAddress, phoneHash);
        console.log('Results length:', results?.length || 0);
        
        if (results && results.length > 0) {
          console.log('Found registration!');
          const first = results[0];
          if (Array.isArray(first)) {
            const returnedHash = first[0]?.value?.value;
            const wallet = first[1]?.value?.value;
            console.log('Returned phoneHash:', returnedHash);
            console.log('Wallet:', wallet);
            console.log('Hash match:', phoneHash === returnedHash);
          }
        } else {
          console.log('No registration found');
        }
      } catch (e) {
        console.error('Query error:', e.message);
      }
    }
  } catch (e) {
    console.error('Setup error:', e.message);
  }
}

checkRegistration();