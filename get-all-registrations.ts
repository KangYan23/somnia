// get-all-registrations.ts - Script to retrieve all registration data from the schema
import { sdk } from './src/lib/somnia';
import { AbiCoder } from 'ethers';

async function getAllRegistrations() {
  try {
    console.log("🔍 Getting all registration data from userRegistration schema...");
    
    // Get schema ID
    const schemaId = await sdk.streams.idToSchemaId('userRegistration');
    if (!schemaId || schemaId === '0x0000000000000000000000000000000000000000000000000000000000000000') {
      console.error("❌ userRegistration schema not found");
      return;
    }
    
    console.log("📊 Schema ID:", schemaId);
    
    // Try different potential publishers
    const potentialPublishers = [
      process.env.PUBLISHER_ADDRESS,
      process.env.WALLET_ADDRESS,
      process.env.PUBLISHER_ADDRESS?.toLowerCase(),
      process.env.WALLET_ADDRESS?.toLowerCase(),
    ].filter(Boolean).filter((addr, idx, arr) => arr.indexOf(addr) === idx);
    
    console.log("🔍 Checking publishers:", potentialPublishers);
    
    let allRegistrations: any[] = [];
    
    for (const publisher of potentialPublishers) {
      console.log(`\n📡 Querying publisher: ${publisher}`);
      
      try {
        // Method 1: Try getAllData if available
        let records: any[] = [];
        try {
          if ((sdk.streams as any).getAllData) {
            records = await (sdk.streams as any).getAllData(schemaId, publisher);
            console.log(`📊 Found ${records?.length || 0} records via getAllData`);
          }
        } catch (e) {
          console.log("getAllData not available or failed, trying alternative...");
        }
        
        // Method 2: If getAllData failed, try other query methods
        if (!records || records.length === 0) {
          console.log("🔍 Trying alternative query methods...");
          
          // Try querying with a dummy key to see if we get any data back
          try {
            const dummyKey = "0x0000000000000000000000000000000000000000000000000000000000000000";
            const testResults = await sdk.streams.getByKey(
              schemaId as `0x${string}`,
              publisher as `0x${string}`,
              dummyKey as `0x${string}`
            );
            if (testResults && testResults.length > 0) {
              records = testResults;
              console.log(`📊 Found ${records.length} records via dummy key query`);
            }
          } catch (e) {
            console.log("Dummy key query failed");
          }
        }
        
        // Process found records
        if (records && records.length > 0) {
          console.log(`\n📋 Processing ${records.length} records from ${publisher}:`);
          
          records.forEach((record: any, index: number) => {
            try {
              let decoded: any = null;
              
              if (Array.isArray(record)) {
                // Already decoded format
                decoded = {
                  phoneHash: record[0]?.value?.value || record[0]?.value || record[0],
                  walletAddress: record[1]?.value?.value || record[1]?.value || record[1],
                  metainfo: record[2]?.value?.value || record[2]?.value || record[2],
                  registeredAt: record[3]?.value?.value || record[3]?.value || record[3]
                };
              } else if (typeof record === 'string') {
                // Raw hex data - decode it
                const abiCoder = new AbiCoder();
                const decodedData = abiCoder.decode(
                  ["bytes32", "address", "string", "uint64"],
                  record
                );
                decoded = {
                  phoneHash: decodedData[0],
                  walletAddress: decodedData[1],
                  metainfo: decodedData[2],
                  registeredAt: Number(decodedData[3])
                };
              } else if (record.data) {
                // Data wrapper format
                const abiCoder = new AbiCoder();
                const decodedData = abiCoder.decode(
                  ["bytes32", "address", "string", "uint64"],
                  record.data
                );
                decoded = {
                  phoneHash: decodedData[0],
                  walletAddress: decodedData[1],
                  metainfo: decodedData[2],
                  registeredAt: Number(decodedData[3])
                };
              }
              
              if (decoded) {
                console.log(`\n📱 Record ${index + 1}:`);
                console.log(`   Phone Hash: ${decoded.phoneHash}`);
                console.log(`   Wallet: ${decoded.walletAddress}`);
                console.log(`   Meta: ${decoded.metainfo || '(empty)'}`);
                console.log(`   Registered: ${new Date(decoded.registeredAt).toISOString()}`);
                console.log(`   Publisher: ${publisher}`);
                
                allRegistrations.push({
                  ...decoded,
                  publisher,
                  recordIndex: index
                });
              }
            } catch (decodeError: any) {
              console.log(`❌ Failed to decode record ${index + 1}:`, decodeError.message);
              console.log(`   Raw data:`, record);
            }
          });
        } else {
          console.log(`❌ No records found for publisher ${publisher}`);
        }
        
      } catch (publisherError: any) {
        console.log(`❌ Error querying publisher ${publisher}:`, publisherError.message);
      }
    }
    
    console.log(`\n📊 SUMMARY:`);
    console.log(`Total registrations found: ${allRegistrations.length}`);
    console.log(`Unique wallets: ${new Set(allRegistrations.map(r => r.walletAddress.toLowerCase())).size}`);
    console.log(`Publishers with data: ${new Set(allRegistrations.map(r => r.publisher)).size}`);
    
    if (allRegistrations.length > 0) {
      console.log(`\n📋 All Registrations:`);
      allRegistrations.forEach((reg, i) => {
        console.log(`${i + 1}. ${reg.walletAddress} (${reg.phoneHash.substring(0, 12)}...) via ${reg.publisher}`);
      });
    } else {
      console.log("\n❌ No registrations found. This could mean:");
      console.log("   - No phone numbers have been registered yet");
      console.log("   - The publishers in env vars don't match the actual publishers");
      console.log("   - The SDK getAllData method isn't available or working");
    }
    
    return allRegistrations;
    
  } catch (error: any) {
    console.error("❌ Error getting all registrations:", error.message);
  }
}

// Run if called directly
getAllRegistrations().then(() => {
  console.log("\n✅ Done");
  process.exit(0);
}).catch(err => {
  console.error("❌ Script failed:", err);
  process.exit(1);
});