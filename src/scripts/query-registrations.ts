// src/scripts/query-registrations.ts
import 'dotenv/config';
import { sdk } from '../lib/somnia.ts';
import { hashPhone } from '../lib/phone.ts';
import { AbiCoder } from 'ethers';

async function queryRegistration(phone: string) {
  try {
    const phoneHash = hashPhone(phone);
    console.log(`\nQuerying registration for phone: ${phone}`);
    console.log(`Phone hash: ${phoneHash}`);

    // Get the schema ID for userRegistration
    const schemaId = await sdk.streams.idToSchemaId('userRegistration');
    if (!schemaId || schemaId === '0x0000000000000000000000000000000000000000000000000000000000000000') {
      console.log('Schema not found. Register schema first.');
      return;
    }
    console.log(`Schema ID: ${schemaId}`);

    // Query data by phoneHash (the key in your schema)
    // getByKey requires: schemaId, publisher address, key
    const publisherAddress = process.env.PUBLISHER_ADDRESS || process.env.WALLET_ADDRESS;
    
    if (!publisherAddress) {
      console.error('PUBLISHER_ADDRESS or WALLET_ADDRESS must be set in environment.');
      console.log('Set one of these in your .env file to query data.');
      return;
    }

    const results = await sdk.streams.getByKey(
      schemaId as `0x${string}`, 
      publisherAddress as `0x${string}`,
      phoneHash as `0x${string}`
    );
    
    if (!results || results.length === 0) {
      console.log('No registration found for this phone number.');
      return;
    }

    console.log(`\nFound ${results.length} registration(s):`);
    const abiCoder = new AbiCoder();
    
    for (let i = 0; i < results.length; i++) {
      const item = results[i];
      console.log(`\n--- Registration ${i + 1} ---`);

      // Decode the data
      // item can be Hex string (raw) or SchemaDecodedItem[] (decoded)
      try {
        let dataHex: string;
        
        if (typeof item === 'string') {
          dataHex = item;
          console.log('Raw data:', dataHex);
        } else if (Array.isArray(item)) {
          // Already decoded by SDK
          const decoded = item as any[];
          console.log('\nDecoded fields (from SDK):');
          console.log('  Phone Hash:', decoded[0]?.value || decoded[0]);
          console.log('  Wallet Address:', decoded[1]?.value || decoded[1]);
          console.log('  Metainfo:', decoded[2]?.value || decoded[2] || '(empty)');
          console.log('  Registered At:', new Date(Number(decoded[3]?.value || decoded[3])).toISOString());
          continue;
        } else {
          console.log('Unknown item format:', item);
          continue;
        }
        
        // Manual decode
        const decoded = abiCoder.decode(
          ['bytes32', 'address', 'string', 'uint64'],
          dataHex
        );
        console.log('\nDecoded fields:');
        console.log('  Phone Hash:', decoded[0]);
        console.log('  Wallet Address:', decoded[1]);
        console.log('  Metainfo:', decoded[2] || '(empty)');
        console.log('  Registered At:', new Date(Number(decoded[3])).toISOString());
      } catch (e: any) {
        console.error('Failed to decode:', e?.message || e);
      }
    }
  } catch (err: any) {
    console.error('Query error:', err.message || err);
  }
}

// Main execution
const phoneToQuery = process.env.QUERY_PHONE || '+60123456789';
queryRegistration(phoneToQuery).then(() => {
  console.log('\nQuery complete.');
  process.exit(0);
}).catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
