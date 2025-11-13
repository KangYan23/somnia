// debug-registration.ts - Comprehensive registration diagnostic
import 'dotenv/config';
import { sdk } from './src/lib/somnia';
import { normalizePhone, hashPhone } from './src/lib/phone';
import { AbiCoder } from 'ethers';

async function debugRegistration(phone: string) {
  console.log('='.repeat(80));
  console.log('🔍 COMPREHENSIVE REGISTRATION DIAGNOSTIC');
  console.log('='.repeat(80));
  
  // Step 1: Phone normalization and hashing
  console.log('\n📱 STEP 1: Phone Processing');
  console.log('-'.repeat(40));
  const raw = phone.trim();
  console.log(`Raw input: "${raw}"`);
  
  const withCc = raw.startsWith('+') 
    ? raw 
    : ((process.env.DEFAULT_COUNTRY_CODE || '').trim() + raw);
  console.log(`With country code: "${withCc}"`);
  
  const normalized = normalizePhone(withCc);
  console.log(`Normalized: "${normalized}"`);
  
  const phoneHash = hashPhone(normalized);
  console.log(`Phone hash: ${phoneHash}`);
  
  // Step 2: Environment check
  console.log('\n🔧 STEP 2: Environment Variables');
  console.log('-'.repeat(40));
  console.log(`RPC_URL: ${process.env.RPC_URL ? '✅ Set' : '❌ Missing'}`);
  console.log(`PRIVATE_KEY: ${process.env.PRIVATE_KEY ? '✅ Set' : '❌ Missing'}`);
  console.log(`PUBLISHER_ADDRESS: ${process.env.PUBLISHER_ADDRESS || 'Not set'}`);
  console.log(`WALLET_ADDRESS: ${process.env.WALLET_ADDRESS || 'Not set'}`);
  
  const publisherAddress = process.env.PUBLISHER_ADDRESS || process.env.WALLET_ADDRESS;
  console.log(`Using publisher: ${publisherAddress}`);
  
  // Step 3: Schema verification
  console.log('\n📋 STEP 3: Schema Verification');
  console.log('-'.repeat(40));
  
  let schemaId: string;
  try {
    schemaId = await sdk.streams.idToSchemaId('userRegistration');
    console.log(`Schema ID: ${schemaId}`);
    
    if (!schemaId || /^0x0+$/.test(schemaId)) {
      console.log('❌ Schema not found or invalid');
      return;
    } else {
      console.log('✅ Schema found and valid');
    }
  } catch (error: any) {
    console.log('❌ Schema lookup failed:', error.message);
    return;
  }
  
  // Step 4: Direct data stream query
  console.log('\n💾 STEP 4: Data Stream Query (Single Publisher)');
  console.log('-'.repeat(40));
  
  try {
    console.log(`Querying with:`);
    console.log(`  Schema ID: ${schemaId}`);
    console.log(`  Publisher: ${publisherAddress}`);
    console.log(`  Phone Hash: ${phoneHash}`);
    
    const results = await sdk.streams.getByKey(
      schemaId as `0x${string}`,
      publisherAddress as `0x${string}`,
      phoneHash as `0x${string}`
    );
    
    console.log(`\nQuery results: ${results?.length || 0} records found`);
    
    if (!results || results.length === 0) {
      console.log('❌ No data found for this phone/publisher combination');
    } else {
      console.log('✅ Data found! Analyzing records...');
      
      for (let i = 0; i < results.length; i++) {
        console.log(`\n--- Record ${i + 1} ---`);
        const item = results[i];
        
        if (Array.isArray(item)) {
          console.log('Format: Decoded array');
          
          // Handle BigInt serialization safely
          const safeStringify = (obj: any) => {
            return JSON.stringify(obj, (key, value) =>
              typeof value === 'bigint' ? value.toString() + 'n' : value, 2);
          };
          
          console.log('Raw data:', safeStringify(item));
          
          const returnedPhoneHash = item[0]?.value?.value || item[0]?.value || item[0];
          const returnedWallet = item[1]?.value?.value || item[1]?.value || item[1];
          const returnedMetainfo = item[2]?.value?.value || item[2]?.value || item[2];
          const returnedTimestamp = item[3]?.value?.value || item[3]?.value || item[3];
          
          console.log(`Phone Hash: ${returnedPhoneHash}`);
          console.log(`Wallet: ${returnedWallet}`);
          console.log(`Metainfo: ${returnedMetainfo}`);
          console.log(`Timestamp: ${returnedTimestamp}`);
          
          console.log(`Phone hash match: ${phoneHash === returnedPhoneHash ? '✅' : '❌'}`);
          if (phoneHash !== returnedPhoneHash) {
            console.log('⚠️  Phone hash mismatch detected!');
            console.log(`  Expected: ${phoneHash}`);
            console.log(`  Found:    ${returnedPhoneHash}`);
          }
          
        } else if (typeof item === 'string') {
          console.log('Format: Raw hex string');
          console.log(`Raw hex: ${item}`);
          
          try {
            const abiCoder = new AbiCoder();
            const decoded = abiCoder.decode(
              ['bytes32', 'address', 'string', 'uint64'],
              item
            );
            
            console.log('Decoded data:');
            console.log(`  Phone Hash: ${decoded[0]}`);
            console.log(`  Wallet: ${decoded[1]}`);
            console.log(`  Metainfo: ${decoded[2]}`);
            console.log(`  Timestamp: ${decoded[3]}`);
            
            console.log(`Phone hash match: ${phoneHash === decoded[0] ? '✅' : '❌'}`);
            if (phoneHash !== decoded[0]) {
              console.log('⚠️  Phone hash mismatch detected!');
              console.log(`  Expected: ${phoneHash}`);
              console.log(`  Found:    ${decoded[0]}`);
            }
          } catch (decodeError: any) {
            console.log('❌ Failed to decode hex data:', decodeError.message);
          }
        } else {
          console.log('Format: Unknown');
          console.log('Raw data:', item);
        }
      }
    }
  } catch (error: any) {
    console.log('❌ Query failed:', error.message);
    console.log('Full error:', error);
  }
  
  // Step 5: Multi-publisher search
  console.log('\n🔍 STEP 5: Multi-Publisher Search');
  console.log('-'.repeat(40));
  
  const potentialPublishers = [
    process.env.PUBLISHER_ADDRESS,
    process.env.WALLET_ADDRESS,
    process.env.PUBLISHER_ADDRESS?.toLowerCase(),
    process.env.WALLET_ADDRESS?.toLowerCase()
  ].filter(Boolean).filter((addr, idx, arr) => arr.indexOf(addr) === idx);
  
  console.log(`Testing ${potentialPublishers.length} potential publishers:`);
  
  let foundAny = false;
  for (const publisher of potentialPublishers) {
    console.log(`\n📍 Publisher: ${publisher}`);
    
    try {
      const results = await sdk.streams.getByKey(
        schemaId as `0x${string}`,
        publisher as `0x${string}`,
        phoneHash as `0x${string}`
      );
      
      if (results && results.length > 0) {
        console.log(`✅ Found ${results.length} record(s)`);
        foundAny = true;
        
        // Quick analysis of first record
        const firstItem = results[0];
        if (Array.isArray(firstItem)) {
          const returnedPhoneHash = firstItem[0]?.value?.value || firstItem[0]?.value || firstItem[0];
          console.log(`  Phone hash match: ${phoneHash === returnedPhoneHash ? '✅' : '❌'}`);
        }
      } else {
        console.log('❌ No records');
      }
    } catch (error: any) {
      console.log(`❌ Error: ${error.message}`);
    }
  }
  
  // Step 6: Summary and recommendations
  console.log('\n📊 STEP 6: Summary & Recommendations');
  console.log('-'.repeat(40));
  
  if (foundAny) {
    console.log('✅ Phone registration found in data stream');
    console.log('✅ Query mechanism is working');
    console.log('📝 Check phone hash matches for correct resolution');
  } else {
    console.log('❌ Phone registration NOT found in data stream');
    console.log('📝 Possible issues:');
    console.log('   1. Phone was never registered');
    console.log('   2. Phone was registered with different normalization');
    console.log('   3. Phone was registered by different publisher');
    console.log('   4. Schema ID mismatch');
    console.log('   5. Data stream sync issues');
  }
  
  console.log('\n🔧 Recommended next steps:');
  console.log('1. Verify phone registration via website query');
  console.log('2. Check if phone was registered with different format');
  console.log('3. Test with known working phone number');
  console.log('4. Verify publisher address consistency');
}

// Main execution
async function main() {
  const phoneToTest = process.argv[2] || process.env.TEST_PHONE || '0177163313';
  console.log(`Testing phone: ${phoneToTest}`);
  
  await debugRegistration(phoneToTest);
  
  console.log('\n' + '='.repeat(80));
  console.log('🏁 DIAGNOSTIC COMPLETE');
  console.log('='.repeat(80));
}

main().catch(console.error);