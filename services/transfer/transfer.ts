// services/transfer/transfer.ts
import { normalizePhone, hashPhone } from "../../src/lib/phone";
import { sdk, walletClient, account, publicClient } from "../../src/lib/somnia";
import { AbiCoder } from "ethers";
import { parseEther, encodeAbiParameters } from "viem";
import type { AbiParameter } from "viem";

export async function handleTransfer(action: {
  amount: number;
  token: string;
  recipient_phone: string;
  sender_phone?: string; // Add sender phone parameter
}) {
  const { amount, token, recipient_phone, sender_phone } = action;

  console.log("Executing transfer action:", action);

  if (!recipient_phone || !amount || amount <= 0) {
    throw new Error("Invalid transfer params: require recipient_phone and positive amount");
  }

  // 1) Convert phone ➜ wallet address using phone.ts utilities
  // IMPORTANT: Don't add country code when querying - registration might be without it
  // If user provides phone with country code, strip it before querying
  const raw = recipient_phone.trim();
  let normalized = normalizePhone(raw);
  
  // Remove country code if present (registration might be stored without it)
  const defaultCc = (process.env.DEFAULT_COUNTRY_CODE || '').trim();
  if (defaultCc && normalized.startsWith(defaultCc)) {
    // Strip country code before querying
    normalized = normalized.substring(defaultCc.length);
    console.log(`   Stripped country code for query: "${normalizePhone(raw)}" → "${normalized}"`);
  }
  
  const phoneHash = hashPhone(normalized);

  const schemaId = await sdk.streams.idToSchemaId("userRegistration");
  if (!schemaId || /^0x0+$/.test(schemaId)) {
    throw new Error("userRegistration schema not found. Run schema registration first.");
  }
  console.log("Transfer: normalized phone=", normalized, " phoneHash=", phoneHash);

  // Query the data stream for phone registration
  let recipientWallet: string | undefined;
  
  try {
    // Use explicit publisher address - no guessing
    const publisherAddress = process.env.PUBLISHER_ADDRESS || process.env.WALLET_ADDRESS;
    
    if (!publisherAddress) {
      throw new Error("PUBLISHER_ADDRESS or WALLET_ADDRESS environment variable is required");
    }

    console.log(`Querying registration with publisher: ${publisherAddress}`);
    
    const results = await sdk.streams.getByKey(
      schemaId as `0x${string}`,
      publisherAddress as `0x${string}`,
      phoneHash as `0x${string}`
    );
    
    if (!results || results.length === 0) {
      throw new Error(
        `Phone number ${normalized} is not registered in the data stream. ` +
        `Publisher: ${publisherAddress}. Please register the phone number first.`
      );
    }

    const firstResult = results[0];
    
    if (Array.isArray(firstResult)) {
      // Decoded format: array of field objects
      const returnedPhoneHash = firstResult[0]?.value?.value;
      const returnedWallet = firstResult[1]?.value?.value;
      
      if (phoneHash === returnedPhoneHash && returnedWallet && typeof returnedWallet === 'string') {
        recipientWallet = returnedWallet as string;
        console.log(`✅ Found registration: ${recipientWallet}`);
      } else {
        throw new Error(`Registration data mismatch for phone ${normalized}`);
      }
    } else if (typeof firstResult === "string") {
      // Raw hex format: decode using AbiCoder (following event-decoder.ts pattern)
      const abiCoder = new AbiCoder();
      const decoded = abiCoder.decode(
        ["bytes32", "address", "string", "uint64"],
        firstResult
      );
      
      const decodedPhoneHash = decoded[0] as string;
      const decodedWallet = decoded[1] as string;
      
      if (phoneHash === decodedPhoneHash && decodedWallet) {
        recipientWallet = decodedWallet;
        console.log(`✅ Found registration (decoded): ${recipientWallet}`);
      } else {
        throw new Error(`Registration data mismatch for phone ${normalized}`);
      }
    } else {
      throw new Error(`Unexpected registration data format for phone ${normalized}`);
    }

  } catch (error: any) {
    console.error("Data stream query failed:", error.message);
    throw new Error(`Failed to query phone registration: ${error.message}`);
  }

  console.log("Transfer: resolved recipient wallet=", recipientWallet);
  
  // 2) Create Somnia transaction
  let txHash: `0x${string}`;
  let eventAmountWei: bigint;
  const upper = token.toUpperCase();
  
  // Track transaction success - only emit event if transaction succeeds
  let transactionSucceeded = false;
  
  if (upper === "SOMI" || upper === "STT") {
    const value = parseEther(String(amount));
    eventAmountWei = value;
    
    txHash = await walletClient.sendTransaction({
      to: recipientWallet as `0x${string}`,
      value,
      account,
      chain: null,
      kzg: undefined,
    });
    
    console.log("⏳ Waiting for transfer transaction to be confirmed...");
    console.log("   Tx Hash:", txHash);
    
    // Wait for transaction confirmation to ensure nonce is updated
    // This prevents "nonce too low" errors when emitting the event
    // CRITICAL: Only emit event if transaction succeeds
    let receipt: any = null;
    
    try {
      receipt = await publicClient.waitForTransactionReceipt({ 
        hash: txHash,
        timeout: 120_000 // 2 minutes timeout
      });
      
      if (receipt.status === 'reverted') {
        console.error("❌ Transfer transaction REVERTED!");
        console.error("   Tx Hash:", txHash);
        console.error("   Block:", receipt.blockNumber);
        throw new Error(`Transfer transaction reverted: ${txHash}`);
      }
      
      if (receipt.status === 'success') {
        transactionSucceeded = true;
        console.log("✅ Transfer transaction confirmed!");
        console.log("   Block:", receipt.blockNumber);
        console.log("   Status:", receipt.status);
        
        // Small delay to ensure nonce is fully updated on-chain
        // Some networks need a moment for the nonce to propagate
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Verify nonce is updated before proceeding
        const currentNonce = await publicClient.getTransactionCount({ 
          address: account.address,
          blockTag: 'pending' 
        });
        console.log("   Current account nonce (pending):", currentNonce);
      } else {
        console.error("❌ Transfer transaction failed with unknown status:", receipt.status);
        throw new Error(`Transfer transaction failed: ${txHash} (status: ${receipt.status})`);
      }
      
    } catch (waitError: any) {
      console.error("❌ Error waiting for transaction confirmation:", waitError.message);
      console.error("   Transaction may have failed or timed out");
      console.error("   Event will NOT be emitted - recipient will NOT be notified");
      // Don't continue - transaction failed, so no event should be emitted
      throw waitError; // Re-throw to prevent event emission
    }
  } else {
    throw new Error(`Unsupported token: ${token}. Only SOMI and STT (native) transfers are supported.`);
  }

  // 3) Store transfer record in data stream AND emit event
  // ONLY proceed if transaction succeeded
  if (!transactionSucceeded) {
    throw new Error("Transaction did not succeed - cannot emit event or store transfer record");
  }
  
  try {
    // Normalize sender phone if provided
    let fromPhoneNormalized: string;
    let fromPhoneHash: `0x${string}`;
    
    if (sender_phone) {
      const raw = sender_phone.trim();
      const withCc = raw.startsWith('+')
        ? raw
        : ((process.env.DEFAULT_COUNTRY_CODE || '').trim() + raw);
      fromPhoneNormalized = normalizePhone(withCc);
      fromPhoneHash = hashPhone(fromPhoneNormalized) as `0x${string}`;
    } else {
      fromPhoneNormalized = "";
      fromPhoneHash = ("0x" + "0".repeat(64)) as `0x${string}`;
    }
    
    console.log("📡 Storing transfer record and emitting event...");
    console.log("Sender phone:", fromPhoneNormalized || "Unknown");
    console.log("Recipient phone:", normalized);
    
    // Store transfer record in data stream
    try {
      const transferSchemaId = await sdk.streams.idToSchemaId("transferHistory");
      if (!transferSchemaId || /^0x0+$/.test(transferSchemaId)) {
        console.warn("⚠️ transferHistory schema not found - transfer record not stored. Run schema registration first.");
      } else {
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        
        // Encode transfer data using ABI encoding
        const abiCoder = new AbiCoder();
        const transferDataHex = abiCoder.encode(
          ["bytes32", "bytes32", "string", "string", "uint256", "string", "bytes32", "uint64"],
          [
            fromPhoneHash,      // bytes32 fromPhoneHash
            phoneHash,          // bytes32 toPhoneHash
            fromPhoneNormalized, // string fromPhone
            normalized,         // string toPhone
            eventAmountWei,    // uint256 amount
            upper,              // string token
            txHash,             // bytes32 txHash
            timestamp           // uint64 timestamp
          ]
        ) as `0x${string}`;
        
        // Use txHash as dataId (unique identifier for each transfer)
        const dataId = txHash as `0x${string}`;
        
        console.log("💾 Storing transfer record to data stream...");
        console.log("  Data ID (txHash):", dataId);
        console.log("  From:", fromPhoneNormalized || "Unknown");
        console.log("  To:", normalized);
        console.log("  Amount:", eventAmountWei.toString(), upper);
        
        const storeResult = await sdk.streams.set([
          {
            id: dataId,
            schemaId: transferSchemaId as `0x${string}`,
            data: transferDataHex
          }
        ]);
        
        console.log("✅ Transfer record stored to data stream:", storeResult);
        console.log("🔗 Data Stream Reference:");
        console.log("   Schema: 'transferHistory'");
        console.log("   Data ID (key):", dataId);
        console.log("   Use this txHash to query the data stream: getByKey('transferHistory', publisher, txHash)");
      }
    } catch (storeError: any) {
      console.warn("⚠️ Failed to store transfer record in data stream:", storeError.message);
      // Don't throw - continue with event emission
    }
    
    
    // Emit TransferConfirmed event
    const encodedData = encodeAbiParameters(
      [
        { type: 'string' },   // fromPhone
        { type: 'string' },   // toPhone
        { type: 'uint256' },  // amount
        { type: 'string' },   // token
        { type: 'bytes32' }   // txHash
      ] as AbiParameter[],
      [fromPhoneNormalized, normalized, eventAmountWei, upper, txHash] as any
    );

    // Emit event with correct format
    let eventEmitted = false;
    
    // Retry logic for event emission (in case of nonce issues)
    const maxRetries = 3;
    let retryCount = 0;
    
    while (!eventEmitted && retryCount < maxRetries) {
      try {
        if (retryCount > 0) {
          console.log(`🔄 Retrying event emission (attempt ${retryCount + 1}/${maxRetries})...`);
          // Wait a bit longer and check nonce again
          await new Promise(resolve => setTimeout(resolve, 2000 * retryCount));
          const retryNonce = await publicClient.getTransactionCount({ 
            address: account.address,
            blockTag: 'pending' 
          });
          console.log("   Current nonce before retry:", retryNonce);
        } else {
          console.log("📤 Attempting to emit TransferConfirmed event...");
        }
        
        console.log("   Event ID: TransferConfirmed");
        console.log("   From phone hash:", fromPhoneHash);
        console.log("   To phone hash:", phoneHash);
        console.log("   Encoded data length:", encodedData.length);
        
        if (sdk.streams?.emitEvents) {
          const eventTx = await sdk.streams.emitEvents([
            {
              id: 'TransferConfirmed', // event schema ID
              argumentTopics: [
                fromPhoneHash,  // indexed fromPhoneHash
                phoneHash as `0x${string}`  // indexed toPhoneHash
              ],
              data: encodedData // ABI-encoded non-indexed fields
            }
          ]);
          
          console.log("✅ TransferConfirmed event emitted successfully!");
          console.log("   Event transaction:", eventTx);
          eventEmitted = true;
        } else {
          console.error("❌ sdk.streams.emitEvents not available - cannot emit event");
          console.error("   SDK streams object:", Object.keys(sdk.streams || {}));
          break; // Don't retry if method doesn't exist
        }
      } catch (emitError: any) {
        retryCount++;
        const isNonceError = emitError.message?.toLowerCase().includes('nonce');
        
        if (isNonceError && retryCount < maxRetries) {
          console.warn(`⚠️ Nonce error on attempt ${retryCount}, will retry...`);
          console.warn("   Error:", emitError.message);
          // Continue to retry
        } else {
          console.error("❌ Event emission failed!");
          console.error("   Error:", emitError.message);
          if (retryCount >= maxRetries) {
            console.error(`   Failed after ${maxRetries} attempts`);
          }
          // Don't throw - transfer already completed successfully
          break;
        }
      }
    }
    
    if (!eventEmitted) {
      console.warn("⚠️ WARNING: Event not emitted - transfer completed but recipient will NOT be notified");
      console.warn("   Check: 1) TransferConfirmed schema registered? 2) SDK streams available? 3) Network connection?");
    }
    
  } catch (e: any) {
    console.error("❌ Failed to emit event:", e.message);
    // Don't throw - transfer already completed successfully
  }

  // 4) Return tx result
  return (
    `Transfer Sent\n` +
    `Amount: ${amount} ${token.toUpperCase()}\n` +
    `Recipient Phone: ${normalized}\n` +
    `Recipient Wallet: ${recipientWallet}\n` +
    `Tx Hash: ${txHash}`
  );
}