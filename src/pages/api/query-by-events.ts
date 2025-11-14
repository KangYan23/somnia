// src/pages/api/query-by-events.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { sdk } from '../../lib/somnia';
import { normalizePhone, hashPhone } from '../../lib/phone';
import { AbiCoder } from 'ethers';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'method not allowed' });
  }

  try {
    const phone = (req.method === 'GET' ? req.query.phone : req.body?.phone) as string;
    const getAllData = (req.method === 'GET' ? req.query.all : req.body?.all) as string;
    
    // Special mode: get ALL registration data
    if (getAllData === 'true') {
      console.log("🔍 Getting ALL registration data...");
      
      const schemaId = await sdk.streams.idToSchemaId('userRegistration');
      if (!schemaId || schemaId === '0x0000000000000000000000000000000000000000000000000000000000000000') {
        return res.status(500).json({ 
          error: 'userRegistration schema not found',
          found: false,
          registrations: []
        });
      }

      const potentialPublishers = [
        process.env.PUBLISHER_ADDRESS,
        process.env.WALLET_ADDRESS,
        process.env.PUBLISHER_ADDRESS?.toLowerCase(),
        process.env.WALLET_ADDRESS?.toLowerCase()
      ].filter(Boolean).filter((addr, idx, arr) => arr.indexOf(addr) === idx);

      let allRegistrations: any[] = [];

      for (const publisher of potentialPublishers) {
        console.log(`📡 Checking publisher: ${publisher}`);
        try {
          // Try different SDK methods to get all data
          let records: any[] = [];
          
          // Method 1: getAllData
          if ((sdk.streams as any).getAllData) {
            try {
              records = await (sdk.streams as any).getAllData(schemaId, publisher);
              console.log(`Found ${records?.length || 0} records via getAllData`);
            } catch (e) {
              console.log("getAllData failed");
            }
          }
          
          // Method 2: getAll 
          if ((!records || records.length === 0) && (sdk.streams as any).getAll) {
            try {
              records = await (sdk.streams as any).getAll(schemaId, publisher);
              console.log(`Found ${records?.length || 0} records via getAll`);
            } catch (e) {
              console.log("getAll failed");
            }
          }
          
          // Process records
          if (records && records.length > 0) {
            for (const record of records) {
              try {
                let registration: any = null;
                
                if (Array.isArray(record)) {
                  // Decoded format: array of field objects
                  registration = {
                    phoneHash: record[0]?.value?.value || record[0]?.value || record[0],
                    walletAddress: record[1]?.value?.value || record[1]?.value || record[1],
                    metainfo: record[2]?.value?.value || record[2]?.value || record[2] || '',
                    registeredAt: Number(record[3]?.value?.value || record[3]?.value || record[3] || 0)
                  };
                } else if (typeof record === "string") {
                  // Raw hex format: decode using AbiCoder (following event-decoder.ts pattern)
                  const abiCoder = new AbiCoder();
                  const decodedData = abiCoder.decode(["bytes32", "address", "string", "uint64"], record);
                  registration = {
                    phoneHash: decodedData[0],
                    walletAddress: decodedData[1],
                    metainfo: decodedData[2],
                    registeredAt: Number(decodedData[3])
                  };
                } else if (record.data) {
                  // Data wrapper format: decode the inner data
                  const abiCoder = new AbiCoder();
                  const decodedData = abiCoder.decode(["bytes32", "address", "string", "uint64"], record.data);
                  registration = {
                    phoneHash: decodedData[0],
                    walletAddress: decodedData[1],
                    metainfo: decodedData[2],
                    registeredAt: Number(decodedData[3])
                  };
                }
                
                if (registration && registration.phoneHash && registration.walletAddress) {
                  allRegistrations.push({
                    ...registration,
                    registeredAtISO: new Date(registration.registeredAt).toISOString(),
                    publisher,
                    source: 'all_data_query'
                  });
                }
              } catch (e: any) {
                console.log("Failed to decode record:", e.message);
              }
            }
          }
        } catch (e: any) {
          console.log(`Error querying publisher ${publisher}:`, e.message);
        }
      }

      return res.json({
        found: allRegistrations.length > 0,
        mode: 'all_registrations',
        count: allRegistrations.length,
        registrations: allRegistrations,
        searchedPublishers: potentialPublishers
      });
    }
    
    if (!phone) {
      return res.status(400).json({ error: 'phone parameter required (or use ?all=true to get all registrations)' });
    }

    // normalize & hash using phone.ts utilities
    const normalized = normalizePhone(phone);
    const phoneHash = hashPhone(normalized);

    console.log(`Querying data stream for phone: ${normalized}`);
    console.log(`Phone hash: ${phoneHash}`);

    // Get the schema ID for userRegistration
    const schemaId = await sdk.streams.idToSchemaId('userRegistration');
    if (!schemaId || schemaId === '0x0000000000000000000000000000000000000000000000000000000000000000') {
      return res.status(500).json({ 
        error: 'userRegistration schema not found. Register schema first.',
        found: false,
        phone: normalized,
        phoneHash,
        registrations: []
      });
    }

    console.log(`Schema ID: ${schemaId}`);

    // Query data stream by phoneHash (the key in the schema)
    // Try multiple potential publisher addresses since data might be published under different accounts
    const potentialPublishers = [
      process.env.PUBLISHER_ADDRESS,
      process.env.WALLET_ADDRESS,
      process.env.PUBLISHER_ADDRESS?.toLowerCase(),
      process.env.WALLET_ADDRESS?.toLowerCase()
    ].filter(Boolean).filter((addr, idx, arr) => arr.indexOf(addr) === idx);

    let allRegistrations: any[] = [];

    console.log("📞 Querying data stream for phone registration...");

    for (const publisher of potentialPublishers) {
      console.log(`🔍 Querying publisher: ${publisher}`);
      
      try {
        const results = await sdk.streams.getByKey(
          schemaId as `0x${string}`,
          publisher as `0x${string}`,
          phoneHash as `0x${string}`
        );

        console.log(`Results from publisher ${publisher}:`, results?.length || 0, "records");
        
        if (results && results.length > 0) {
          for (const item of results) {
            try {
              let registration: any = null;

              if (Array.isArray(item)) {
                // Decoded format: array of field objects
                const decodedPhoneHash = item[0]?.value?.value || item[0]?.value;
                const decodedWallet = item[1]?.value?.value || item[1]?.value;
                const decodedMetainfo = item[2]?.value?.value || item[2]?.value || '';
                const decodedRegisteredAt = item[3]?.value?.value || item[3]?.value;
                
                console.log(`Publisher ${publisher} phoneHash check:`);
                console.log(`  Expected: ${phoneHash}`);
                console.log(`  Returned: ${decodedPhoneHash}`);
                console.log(`  Match: ${phoneHash === decodedPhoneHash}`);
                
                if (phoneHash === decodedPhoneHash && decodedWallet && typeof decodedWallet === 'string') {
                  registration = {
                    phoneHash: decodedPhoneHash,
                    walletAddress: decodedWallet,
                    metainfo: decodedMetainfo,
                    registeredAt: Number(decodedRegisteredAt || 0),
                    registeredAtISO: decodedRegisteredAt ? new Date(Number(decodedRegisteredAt)).toISOString() : null,
                    publisher,
                    source: 'data_stream_decoded'
                  };
                }
              } else if (typeof item === "string") {
                // Raw hex format: needs ABI decoding
                console.log(`Decoding raw hex data from publisher ${publisher}`);
                try {
                  const abiCoder = new AbiCoder();
                  const decoded = abiCoder.decode(
                    ["bytes32", "address", "string", "uint64"],
                    item
                  );
                  
                  const decodedPhoneHash = decoded[0] as string;
                  const decodedWallet = decoded[1] as string;
                  const decodedMetainfo = decoded[2] as string;
                  const decodedRegisteredAt = decoded[3] as bigint;
                  
                  console.log(`Decoded phoneHash: ${decodedPhoneHash}`);
                  console.log(`Expected phoneHash: ${phoneHash}`);
                  console.log(`Match: ${phoneHash === decodedPhoneHash}`);
                  
                  if (phoneHash === decodedPhoneHash && decodedWallet) {
                    registration = {
                      phoneHash: decodedPhoneHash,
                      walletAddress: decodedWallet,
                      metainfo: decodedMetainfo,
                      registeredAt: Number(decodedRegisteredAt),
                      registeredAtISO: new Date(Number(decodedRegisteredAt)).toISOString(),
                      publisher,
                      source: 'data_stream_raw'
                    };
                  }
                } catch (decodeError: any) {
                  console.log(`Failed to decode data from publisher ${publisher}:`, decodeError.message);
                }
              }

              if (registration) {
                allRegistrations.push(registration);
                console.log(`✅ Found registration with publisher: ${publisher}`);
              }
            } catch (itemError: any) {
              console.log(`Error processing item from publisher ${publisher}:`, itemError.message);
            }
          }
        } else {
          console.log(`No data from publisher ${publisher}`);
        }
      } catch (queryError: any) {
        console.log(`Query failed for publisher ${publisher}:`, queryError.message);
      }
    }

    console.log(`Found ${allRegistrations.length} total registrations for phone ${normalized}`);

    if (allRegistrations.length === 0) {
      return res.json({
        found: false,
        phone: normalized,
        phoneHash,
        registrations: [],
        searchedPublishers: potentialPublishers
      });
    }

    return res.json({
      found: true,
      phone: normalized,
      phoneHash,
      count: allRegistrations.length,
      registrations: allRegistrations,
      searchedPublishers: potentialPublishers
    });

  } catch (err: any) {
    console.error('Query error:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
}

// Helper: Generate phone number variations for comprehensive search
function generatePhoneVariations(phone: string): Array<{phone: string, hash: string}> {
  const variations: string[] = [];
  const clean = phone.replace(/\D/g, ''); // Remove all non-digits
  
  // Add original
  variations.push(phone);
  
  // Add with/without country codes
  if (clean.length > 10) {
    variations.push(clean); // Full number
    variations.push(clean.substring(2)); // Without country code
    variations.push(clean.substring(3)); // Without country code (different format)
  }
  
  // Add with + prefix
  if (!phone.startsWith('+')) {
    variations.push('+' + clean);
  }
  
  // Add Malaysian formats if applicable
  if (clean.startsWith('60')) {
    variations.push('0' + clean.substring(2)); // Malaysian domestic format
  }
  
  // Convert to normalized phone + hash pairs
  return variations.map(v => {
    const normalized = normalizePhone(v);
    return {
      phone: normalized,
      hash: hashPhone(normalized)
    };
  }).filter((v, idx, arr) => arr.findIndex(x => x.hash === v.hash) === idx); // Remove duplicates
}
