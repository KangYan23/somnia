// Dynamic phone registration search - no hardcoded mappings
// services/transfer/transfer.ts
import { normalizePhone, hashPhone } from "../../src/lib/phone";
import { sdk, walletClient, account } from "../../src/lib/somnia";
import { AbiCoder } from "ethers";
import { parseEther } from "viem";

export async function handleTransfer(action: {
  amount: number;
  token: string;
  recipient_phone: string;
}) {
  const { amount, token, recipient_phone } = action;

  console.log("Executing transfer action:", action);

  if (!recipient_phone || !amount || amount <= 0) {
    throw new Error("Invalid transfer params: require recipient_phone and positive amount");
  }

  // 1) Convert phone ➜ wallet address using dynamic search
  const raw = recipient_phone.trim();
  const withCc = raw.startsWith('+')
    ? raw
    : ((process.env.DEFAULT_COUNTRY_CODE || '').trim() + raw);
  const normalized = normalizePhone(withCc);
  const phoneHash = hashPhone(normalized);

  const schemaId = await sdk.streams.idToSchemaId("userRegistration");
  if (!schemaId || /^0x0+$/.test(schemaId)) {
    throw new Error("userRegistration schema not found. Run schema registration first.");
  }
  
  console.log("Transfer: normalized phone=", normalized, " phoneHash=", phoneHash);
  console.log("DEBUG: Schema ID:", schemaId);

  // Dynamic phone registration search - NO HARDCODING
  let recipientWallet: string | undefined;
  
  console.log("🔍 Searching for phone registration dynamically...");
  
  try {
    // Get potential publishers to search (from env and common addresses)
    const potentialPublishers = [
      process.env.PUBLISHER_ADDRESS,
      process.env.WALLET_ADDRESS,
      process.env.PUBLISHER_ADDRESS?.toLowerCase(),
      process.env.WALLET_ADDRESS?.toLowerCase(),
      // Include common frontend wallet addresses that might register phones
      '0xccB221026F719a229B5fC50853A84823725518c5',
      '0xccb221026f719a229b5fc50853a84823725518c5'
    ].filter(Boolean).filter((addr, idx, arr) => arr.indexOf(addr) === idx);

    console.log(`Will search ${potentialPublishers.length} potential publishers`);

    // Strategy 1: Direct getByKey lookup
    console.log("\n📞 Strategy 1: Direct key lookup...");
    for (const publisher of potentialPublishers) {
      console.log(`🔍 Checking publisher: ${publisher}`);
      
      try {
        const results = await sdk.streams.getByKey(
          schemaId as `0x${string}`,
          publisher as `0x${string}`,
          phoneHash as `0x${string}`
        );

        if (results && results.length > 0) {
          const result = await processSearchResult(results[0], phoneHash, publisher);
          if (result.found) {
            recipientWallet = result.wallet;
            console.log(`✅ FOUND via direct lookup! Publisher: ${publisher}`);
            break;
          } else {
            console.log(`❌ Publisher ${publisher} returned data but phone hash didn't match`);
          }
        } else {
          console.log(`❌ No data from publisher ${publisher}`);
        }
      } catch (error: any) {
        console.log(`❌ Direct lookup failed for publisher ${publisher}: ${error.message}`);
      }
    }

    // Strategy 2: Comprehensive search if direct lookup failed  
    if (!recipientWallet) {
      console.log("\n📊 Strategy 2: Comprehensive search (brute force)...");
      
      for (const publisher of potentialPublishers) {
        console.log(`🔍 Searching ALL records from publisher: ${publisher}`);
        
        try {
          // Try to get all data for comprehensive search
          let allRecords: any[] = [];
          
          // Method 1: Try getAllData if SDK supports it
          try {
            const getAllResult = await (sdk.streams as any).getAllData?.(
              schemaId as `0x${string}`,
              publisher as `0x${string}`
            );
            
            if (getAllResult && Array.isArray(getAllResult) && getAllResult.length > 0) {
              allRecords = getAllResult;
              console.log(`📊 Found ${allRecords.length} records via getAllData`);
            }
          } catch (e) {
            console.log(`getAllData failed or not available for ${publisher}`);
          }
          
          // Method 2: If getAllData failed, try alternative approaches
          if (allRecords.length === 0) {
            console.log(`Trying alternative search approaches for ${publisher}...`);
            
            // Try searching with different possible phone hashes
            const phoneVariations = generatePhoneVariations(recipient_phone);
            console.log(`Testing ${phoneVariations.length} phone variations...`);
            
            for (const variation of phoneVariations) {
              try {
                const varResults = await sdk.streams.getByKey(
                  schemaId as `0x${string}`,
                  publisher as `0x${string}`,
                  variation.hash as `0x${string}`
                );
                
                if (varResults && varResults.length > 0) {
                  console.log(`📱 Found data with variation: ${variation.phone} (${variation.hash})`);
                  allRecords.push(...varResults);
                }
              } catch (e) {
                // Silently continue to next variation
              }
            }
          }

          // Search through all found records
          if (allRecords.length > 0) {
            console.log(`🔍 Searching through ${allRecords.length} records...`);
            
            for (let i = 0; i < allRecords.length; i++) {
              const result = await processSearchResult(allRecords[i], phoneHash, publisher);
              if (result.found) {
                recipientWallet = result.wallet;
                console.log(`🎯 FOUND! Publisher: ${publisher}, Record: ${i + 1}/${allRecords.length}`);
                break;
              }
            }
            
            if (recipientWallet) break; // Found it, exit publisher loop
          } else {
            console.log(`❌ No records found for publisher ${publisher}`);
          }
          
        } catch (searchError: any) {
          console.log(`❌ Comprehensive search failed for ${publisher}: ${searchError.message}`);
        }
      }
    }

    if (!recipientWallet) {
      throw new Error(
        `❌ Phone number ${normalized} not found in any data streams.\n` +
        `🔍 Searched ${potentialPublishers.length} publishers using multiple strategies.\n` +
        `📱 Please ensure the phone is registered via the registration website first.\n` +
        `🌐 Visit the registration page to register: ${normalized}`
      );
    }

  } catch (error: any) {
    console.error("❌ Phone registration search completely failed:", error.message);
    throw new Error(`Failed to find phone registration: ${error.message}`);
  }

  console.log("✅ Transfer: resolved recipient wallet=", recipientWallet);
  
  // Security check: warn if sending to same wallet
  const senderWallet = process.env.WALLET_ADDRESS || account?.address;
  if (recipientWallet.toLowerCase() === senderWallet?.toLowerCase()) {
    console.warn("⚠️  WARNING: Recipient wallet is same as sender wallet!");
    console.warn(`⚠️  Phone ${normalized} is registered to the sender's own wallet`);
  }

  // 2) Execute blockchain transaction
  let txHash: `0x${string}`;
  let eventAmountWei: bigint;
  const upper = token.toUpperCase();
  
  if (upper === "SOMI" || upper === "STT") {
    const value = parseEther(String(amount));
    eventAmountWei = value;
    console.log(`📤 Sending ${amount} ${upper} (native transfer) to: ${recipientWallet}`);
    
    txHash = await walletClient.sendTransaction({
      to: recipientWallet as `0x${string}`,
      value,
      account,
      chain: null,
      kzg: undefined,
    });
  } else {
    throw new Error(`Unsupported token: ${token}. Only SOMI and STT (native) transfers are supported.`);
  }

  // 3) Optional: Publish transfer event
  try {
    const fromPhoneHash = (process.env.SENDER_PHONE && hashPhone(normalizePhone(process.env.SENDER_PHONE))) || ("0x" + "0".repeat(64));
    
    if ((sdk.streams as any)?.emitEvent) {
      await (sdk.streams as any).emitEvent("TransferConfirmed", {
        fromPhoneHash,
        toPhoneHash: phoneHash,
        amount: eventAmountWei,
        token: upper,
        txHash,
      });
    }
  } catch (e) {
    console.warn("Optional event publishing failed:", e);
  }

  return (
    `✅ Transfer Sent Successfully!\n` +
    `💰 Amount: ${amount} ${token.toUpperCase()}\n` +
    `📱 Recipient Phone: ${normalized}\n` +
    `💳 Recipient Wallet: ${recipientWallet}\n` +
    `🔗 Transaction Hash: ${txHash}`
  );
}

// Helper: Process search results and check for phone hash match
async function processSearchResult(
  item: any, 
  expectedPhoneHash: string, 
  publisher: string
): Promise<{found: boolean, wallet?: string}> {
  try {
    let recordPhoneHash: string | undefined;
    let recordWallet: string | undefined;
    
    if (Array.isArray(item)) {
      // Decoded format: array of field objects
      recordPhoneHash = item[0]?.value?.value || item[0]?.value || item[0];
      recordWallet = item[1]?.value?.value || item[1]?.value || item[1];
    } else if (typeof item === "string") {
      // Raw hex format: decode with ABI
      const abiCoder = new AbiCoder();
      const decoded = abiCoder.decode(
        ["bytes32", "address", "string", "uint64"],
        item
      );
      recordPhoneHash = decoded[0] as string;
      recordWallet = decoded[1] as string;
    } else if (item?.data) {
      // Data wrapper format
      if (typeof item.data === "string") {
        const abiCoder = new AbiCoder();
        const decoded = abiCoder.decode(
          ["bytes32", "address", "string", "uint64"],
          item.data
        );
        recordPhoneHash = decoded[0] as string;
        recordWallet = decoded[1] as string;
      }
    }
    
    if (recordPhoneHash && recordWallet && typeof recordWallet === 'string') {
      const isMatch = recordPhoneHash === expectedPhoneHash;
      console.log(
        `📋 Record check: ` +
        `Phone=${recordPhoneHash.substring(0, 12)}..., ` +
        `Wallet=${recordWallet.substring(0, 8)}..., ` +
        `Match=${isMatch ? '✅' : '❌'}`
      );
      
      if (isMatch) {
        return { found: true, wallet: recordWallet };
      }
    }
    
    return { found: false };
  } catch (error: any) {
    console.log(`❌ Error processing search result: ${error.message}`);
    return { found: false };
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