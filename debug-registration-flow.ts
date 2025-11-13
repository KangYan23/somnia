// debug-registration-flow.ts - Test the complete registration flow
import 'dotenv/config';
import { sdk } from './src/lib/somnia';
import { normalizePhone, hashPhone } from './src/lib/phone';
import { AbiCoder, hexlify, randomBytes } from 'ethers';

// Simulate the registration process from register.ts
async function testRegistrationFlow(phone: string, walletAddress: string) {
  console.log('🔄 TESTING COMPLETE REGISTRATION FLOW');
  console.log('='.repeat(80));
  
  console.log('\n📱 Step 1: Phone Processing');
  console.log('-'.repeat(40));
  console.log(`Input phone: "${phone}"`);
  console.log(`Input wallet: "${walletAddress}"`);
  
  // Normalize & hash (same as register.ts)
  const normalized = normalizePhone(phone);
  const phoneHash = hashPhone(normalized);
  const ts = Date.now();
  
  console.log(`Normalized phone: "${normalized}"`);
  console.log(`Phone hash: ${phoneHash}`);
  console.log(`Timestamp: ${ts}`);
  
  console.log('\n📋 Step 2: Schema Validation');
  console.log('-'.repeat(40));
  
  // Get schema ID (same as register.ts)
  const schemaIdRaw = await sdk.streams.idToSchemaId('userRegistration') as `0x${string}` | null;
  if (!schemaIdRaw) {
    console.log('❌ Schema not registered');
    return;
  }
  const schemaId = schemaIdRaw as `0x${string}`;
  console.log(`✅ Schema ID: ${schemaId}`);
  
  console.log('\n🔧 Step 3: Data Encoding');
  console.log('-'.repeat(40));
  
  // Encode data (same as register.ts)
  function abiEncodeUserRegistration(phoneHash: string, wallet: string, metainfo: string, ts: number) {
    const abiCoder = new AbiCoder();
    return abiCoder.encode(['bytes32','address','string','uint64'], [phoneHash, wallet, metainfo, BigInt(ts)]);
  }
  
  const dataHex = abiEncodeUserRegistration(phoneHash, walletAddress, '', ts) as `0x${string}`;
  const dataId = hexlify(randomBytes(32)) as `0x${string}`;
  
  console.log(`Data hex length: ${dataHex.length}`);
  console.log(`Data ID: ${dataId}`);
  console.log(`Data hex: ${dataHex.substring(0, 100)}...`);
  
  console.log('\n📡 Step 4: Event Preparation');
  console.log('-'.repeat(40));
  
  // Prepare event (same as register.ts)
  const argumentTopics = [phoneHash as `0x${string}`];
  const abiCoder = new AbiCoder();
  const eventData = abiCoder.encode(['address', 'uint64'], [walletAddress, BigInt(ts)]) as `0x${string}`;
  
  console.log(`Event topics: ${argumentTopics}`);
  console.log(`Event data length: ${eventData.length}`);
  console.log(`Event data: ${eventData.substring(0, 100)}...`);
  
  console.log('\n🚀 Step 5: Publishing to Data Stream');
  console.log('-'.repeat(40));
  
  try {
    console.log('Calling sdk.streams.setAndEmitEvents...');
    
    const tx = await sdk.streams.setAndEmitEvents(
      [
        { id: dataId as `0x${string}`, schemaId, data: dataHex }
      ],
      [
        {
          id: 'UserRegistrationBroadcast',
          argumentTopics: argumentTopics as any,
          data: eventData
        }
      ]
    );
    
    console.log('✅ Registration successful!');
    console.log(`Transaction hash: ${tx}`);
    
    // Wait a moment for data to be indexed
    console.log('\n⏳ Waiting for data stream indexing...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    console.log('\n🔍 Step 6: Verification Query');
    console.log('-'.repeat(40));
    
    // Query back the data to verify it was stored correctly
    const publisherAddress = process.env.PUBLISHER_ADDRESS || process.env.WALLET_ADDRESS;
    console.log(`Querying with publisher: ${publisherAddress}`);
    
    const results = await sdk.streams.getByKey(
      schemaId as `0x${string}`,
      publisherAddress as `0x${string}`,
      phoneHash as `0x${string}`
    );
    
    if (results && results.length > 0) {
      console.log(`✅ Verification: Found ${results.length} record(s)`);
      
      const item = results[0];
      if (Array.isArray(item)) {
        const storedPhoneHash = item[0]?.value?.value || item[0]?.value;
        const storedWallet = item[1]?.value?.value || item[1]?.value;
        
        console.log(`Stored phone hash: ${storedPhoneHash}`);
        console.log(`Stored wallet: ${storedWallet}`);
        console.log(`Phone hash match: ${phoneHash === storedPhoneHash ? '✅' : '❌'}`);
        console.log(`Wallet match: ${walletAddress.toLowerCase() === storedWallet.toLowerCase() ? '✅' : '❌'}`);
      }
    } else {
      console.log('❌ Verification: No data found after registration');
    }
    
    return tx;
    
  } catch (error: any) {
    console.log('❌ Registration failed:', error.message);
    console.log('Full error:', error);
    return null;
  }
}

async function main() {
  const testPhone = process.argv[2] || '+60123456789';
  const testWallet = process.argv[3] || process.env.WALLET_ADDRESS || '0x7Dd088Dc87F6A9c709Fd366222169580fbCF95Ec';
  
  console.log(`Testing registration for:`);
  console.log(`Phone: ${testPhone}`);
  console.log(`Wallet: ${testWallet}`);
  
  await testRegistrationFlow(testPhone, testWallet);
  
  console.log('\n' + '='.repeat(80));
  console.log('🏁 REGISTRATION FLOW TEST COMPLETE');
  console.log('='.repeat(80));
}

main().catch(console.error);