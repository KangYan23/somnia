// get-all-registrations.js - Script to retrieve all registration data from the schema
const { sdk } = require('./src/lib/somnia');
const { AbiCoder } = require('ethers');

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
    
    let allRegistrations = [];
    
    for (const publisher of potentialPublishers) {
      console.log(`\n📡 Querying publisher: ${publisher}`);
      
      try {
        // Method 1: Try getAllData if available
        let records = [];
        try {
          if (sdk.streams.getAllData) {
            records = await sdk.streams.getAllData(schemaId, publisher);
            console.log(`📊 Found ${records?.length || 0} records via getAllData`);
          }
        } catch (e) {
          console.log("getAllData not available or failed, trying alternative...");
        }
        
        // Method 2: If getAllData failed, try getting by common keys
        if (!records || records.length === 0) {
          console.log("🔍 Trying to enumerate records...");
          
          // You could try querying with different keys if you know some phone hashes
          // For now, let's try a different approach - check if there are any query methods
          
          if (sdk.streams.queryBySchema) {
            records = await sdk.streams.queryBySchema(schemaId, publisher);
            console.log(`📊 Found ${records?.length || 0} records via queryBySchema`);
          }
        }
        
        // Process found records
        if (records && records.length > 0) {
          console.log(`\n📋 Processing ${records.length} records from ${publisher}:`);
          
          records.forEach((record, index) => {
            try {
              let decoded = null;
              
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
                console.log(`   Meta: ${decoded.metainfo}`);
                console.log(`   Registered: ${new Date(decoded.registeredAt).toISOString()}`);
                console.log(`   Publisher: ${publisher}`);
                
                allRegistrations.push({
                  ...decoded,
                  publisher,
                  recordIndex: index
                });
              }
            } catch (decodeError) {
              console.log(`❌ Failed to decode record ${index + 1}:`, decodeError.message);
              console.log(`   Raw data:`, record);
            }
          });
        } else {
          console.log(`❌ No records found for publisher ${publisher}`);
        }
        
      } catch (publisherError) {
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
    }
    
    return allRegistrations;
    
  } catch (error) {
    console.error("❌ Error getting all registrations:", error);
  }
}

// Run if called directly
if (require.main === module) {
  getAllRegistrations().then(() => {
    console.log("\n✅ Done");
    process.exit(0);
  }).catch(err => {
    console.error("❌ Script failed:", err);
    process.exit(1);
  });
}

module.exports = { getAllRegistrations };