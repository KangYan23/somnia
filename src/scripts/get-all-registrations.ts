// src/scripts/get-all-registrations.ts - Script to retrieve all registration data
import { sdk } from '../lib/somnia';
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
          console.log("getAllData not available or failed");
        }
        
        // Method 2: If getAllData failed, try getting all records by iterating
        if (!records || records.length === 0) {
          console.log("🔍 Trying to query existing data...");
          
          // Get all data for this publisher and schema
          // Some SDKs might have different methods
          try {
            if ((sdk.streams as any).getAll) {
              records = await (sdk.streams as any).getAll(schemaId, publisher);
              console.log(`📊 Found ${records?.length || 0} records via getAll`);
            }
          } catch (e) {
            console.log("getAll method not available");
          }
          
          // Try query method
          if ((!records || records.length === 0) && (sdk.streams as any).query) {
            try {
              records = await (sdk.streams as any).query({
                schemaId: schemaId,
                publisher: publisher
              });
              console.log(`📊 Found ${records?.length || 0} records via query`);
            } catch (e) {
              console.log("query method failed");
            }
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
              
              if (decoded && decoded.phoneHash && decoded.walletAddress) {
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
              } else {
                console.log(`⚠️  Record ${index + 1} missing required fields`);
                console.log(`   Raw:`, record);
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
    
    if (allRegistrations.length > 0) {
      console.log(`Unique wallets: ${new Set(allRegistrations.map(r => r.walletAddress.toLowerCase())).size}`);
      console.log(`Publishers with data: ${new Set(allRegistrations.map(r => r.publisher)).size}`);
      
      console.log(`\n📋 All Registrations:`);
      allRegistrations.forEach((reg, i) => {
        const phoneShort = reg.phoneHash.substring(0, 12) + "...";
        const walletShort = reg.walletAddress.substring(0, 8) + "...";
        console.log(`${i + 1}. ${walletShort} (phone: ${phoneShort}) via ${reg.publisher.substring(0, 8)}...`);
      });
    } else {
      console.log("\n❌ No registrations found. Possible reasons:");
      console.log("   1. No phone numbers registered yet");
      console.log("   2. Publisher addresses in .env don't match actual publishers");
      console.log("   3. SDK query methods not available or not working");
      console.log("   4. Data is stored but with different schema or publisher");
    }
    
    return allRegistrations;
    
  } catch (error: any) {
    console.error("❌ Error getting all registrations:", error.message);
    console.error(error.stack);
  }
}

// Run the script
getAllRegistrations().then(() => {
  console.log("\n✅ Script completed");
  process.exit(0);
}).catch(err => {
  console.error("❌ Script failed:", err);
  process.exit(1);
});