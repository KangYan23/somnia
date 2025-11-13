// Simple script to explore SDK methods and get all data
// Run with: npm run debug-sdk

console.log("🔍 Exploring SDK methods...");

// First let's see what methods are available
import { sdk } from '../lib/somnia';

async function exploreSDK() {
  try {
    console.log("📊 SDK streams object methods:");
    console.log(Object.getOwnPropertyNames(sdk.streams));
    console.log("📊 SDK streams prototype methods:");
    console.log(Object.getOwnPropertyNames(Object.getPrototypeOf(sdk.streams)));
    
    // Get schema
    const schemaId = await sdk.streams.idToSchemaId('userRegistration');
    console.log("📋 Schema ID:", schemaId);
    
    const publishers = [
      process.env.PUBLISHER_ADDRESS,
      process.env.WALLET_ADDRESS
    ].filter(Boolean);
    
    console.log("🔍 Testing with publishers:", publishers);
    
    for (const publisher of publishers) {
      console.log(`\n📡 Testing publisher: ${publisher}`);
      
      // Try different methods to get data
      const methods = [
        'getAllData',
        'getAll', 
        'getData',
        'query',
        'queryBySchema',
        'getBySchema'
      ];
      
      for (const method of methods) {
        if (typeof (sdk.streams as any)[method] === 'function') {
          console.log(`✅ Method ${method} is available`);
          try {
            const result = await (sdk.streams as any)[method](schemaId, publisher);
            console.log(`   Result: ${result?.length || 0} records`);
            if (result && result.length > 0) {
              console.log(`   First record type:`, typeof result[0]);
              console.log(`   First record:`, result[0]);
            }
          } catch (e: any) {
            console.log(`   Error: ${e.message}`);
          }
        } else {
          console.log(`❌ Method ${method} not available`);
        }
      }
    }
    
  } catch (error: any) {
    console.error("❌ Error:", error.message);
  }
}

exploreSDK();