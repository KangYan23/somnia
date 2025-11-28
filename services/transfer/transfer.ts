

import { hashPhone, stripCountryCode } from "../../src/lib/phone";
import { sdk, walletClient, account, publicClient } from "../../src/lib/somnia";
import { decodeUserRegistration } from "../../src/lib/transaction";
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

  if (!recipient_phone || !amount || amount <= 0) {
    throw new Error("Invalid transfer params: require recipient_phone and positive amount");
  }

  // Convert phone ➜ wallet address
  const normalized = stripCountryCode(recipient_phone.trim());
  const phoneHash = hashPhone(normalized);

  const schemaId = await sdk.streams.idToSchemaId("userRegistration");
  if (!schemaId || /^0x0+$/.test(schemaId)) {
    throw new Error("userRegistration schema not found. Run schema registration first.");
  }

  // Query the data stream for phone registration
  const publisherAddress = process.env.PUBLISHER_ADDRESS || process.env.WALLET_ADDRESS;
  if (!publisherAddress) {
    throw new Error("PUBLISHER_ADDRESS or WALLET_ADDRESS environment variable is required");
  }
  
  const results = await sdk.streams.getByKey(
    schemaId as `0x${string}`,
    publisherAddress as `0x${string}`,
    phoneHash as `0x${string}`
  );
  
  if (!results || results.length === 0) {
    throw new Error(`Phone number ${normalized} is not registered. Please register first.`);
  }

  const firstResult = results[0];
  const registration = decodeUserRegistration(firstResult);
  
  if (!registration) {
    throw new Error(`Failed to decode registration data for phone ${normalized}`);
  }
  
  if (registration.phoneHash.toLowerCase() !== phoneHash.toLowerCase()) {
    throw new Error(`Registration data mismatch for phone ${normalized}`);
  }
  
  const recipientWallet = registration.walletAddress;
  
  // Normalize sender phone if provided
  const fromPhoneNormalized = sender_phone ? stripCountryCode(sender_phone) : "";
  const fromPhoneHash = sender_phone 
    ? (hashPhone(fromPhoneNormalized) as `0x${string}`)
    : ("0x" + "0".repeat(64)) as `0x${string}`;
  
  const upper = token.toUpperCase();
  const eventAmountWei = parseEther(String(amount));
  
  // STEP 1: Create TransferIntentCreated event
  try {
    const intentEncodedData = encodeAbiParameters(
      [
        { type: 'string' },   // fromPhone
        { type: 'string' },   // toPhone
        { type: 'uint256' },  // amount
        { type: 'string' }    // token
      ] as AbiParameter[],
      [fromPhoneNormalized, normalized, eventAmountWei, upper] as any
    );

    await sdk.streams.emitEvents([
      {
        id: 'TransferIntentCreated',
        argumentTopics: [fromPhoneHash, phoneHash as `0x${string}`],
        data: intentEncodedData
      }
    ]);
  } catch (intentError: any) {
    console.warn("⚠️ Failed to emit TransferIntentCreated event:", intentError.message);
  }
  
  // STEP 2: Perform blockchain transfer
  if (upper !== "SOMI" && upper !== "STT") {
    throw new Error(`Unsupported token: ${token}. Only SOMI and STT (native) transfers are supported.`);
  }
  
  const txHash = await walletClient.sendTransaction({
    to: recipientWallet as `0x${string}`,
    value: eventAmountWei,
    account,
    chain: null,
    kzg: undefined,
  });
  
  console.log(`⏳ Transfer sent: ${txHash}`);
  
  // Wait for transaction confirmation
  const receipt = await publicClient.waitForTransactionReceipt({ 
    hash: txHash,
    timeout: 120_000
  });
  
  if (receipt.status === 'reverted') {
    throw new Error(`Transfer transaction reverted: ${txHash}`);
  }
  
  if (receipt.status !== 'success') {
    throw new Error(`Transfer transaction failed: ${txHash} (status: ${receipt.status})`);
  }
  
  console.log(`✅ Transfer confirmed: ${txHash}`);
  
  // Small delay to ensure nonce is updated
  await new Promise(resolve => setTimeout(resolve, 1000));

  // STEP 3: Store transfer record and emit TransferConfirmed event
  try {
    // Store transfer record in data stream
    const transferSchemaId = await sdk.streams.idToSchemaId("transferHistory");
    if (transferSchemaId && !/^0x0+$/.test(transferSchemaId)) {
      const timestamp = BigInt(Math.floor(Date.now() / 1000));
      const abiCoder = new AbiCoder();
      const transferDataHex = abiCoder.encode(
        ["bytes32", "bytes32", "string", "string", "uint256", "string", "bytes32", "uint64"],
        [fromPhoneHash, phoneHash, fromPhoneNormalized, normalized, eventAmountWei, upper, txHash, timestamp]
      ) as `0x${string}`;
      
      await sdk.streams.set([{
        id: txHash,
        schemaId: transferSchemaId as `0x${string}`,
        data: transferDataHex
      }]);
    }
    
    // Emit TransferConfirmed event with retry logic
    const confirmedEncodedData = encodeAbiParameters(
      [
        { type: 'string' },   // fromPhone
        { type: 'string' },   // toPhone
        { type: 'uint256' },  // amount
        { type: 'string' },   // token
        { type: 'bytes32' }    // txHash
      ] as AbiParameter[],
      [fromPhoneNormalized, normalized, eventAmountWei, upper, txHash] as any
    );

    const maxRetries = 3;
    let eventEmitted = false;
    
    for (let retryCount = 0; retryCount < maxRetries && !eventEmitted; retryCount++) {
      try {
        if (retryCount > 0) {
          await new Promise(resolve => setTimeout(resolve, 2000 * retryCount));
        }
        
        await sdk.streams.emitEvents([{
          id: 'TransferConfirmed',
          argumentTopics: [fromPhoneHash, phoneHash as `0x${string}`],
          data: confirmedEncodedData
        }]);
        
        eventEmitted = true;
      } catch (emitError: any) {
        const isNonceError = emitError.message?.toLowerCase().includes('nonce');
        if (!isNonceError || retryCount === maxRetries - 1) {
          console.error("❌ Failed to emit TransferConfirmed event:", emitError.message);
          break;
        }
      }
    }
    
    if (!eventEmitted) {
      console.warn("⚠️ TransferConfirmed event not emitted - notifications may not be sent");
    }
  } catch (e: any) {
    console.error("❌ Failed to store record or emit event:", e.message);
  }

  // Transfer completed - notifications will be sent via events
  // Return null to avoid sending duplicate message to user
  return null;
}
