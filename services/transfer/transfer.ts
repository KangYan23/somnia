// Updated to use walletClient.sendTransaction consistently
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

  // 1) Convert phone ➜ wallet address (query mapping via Somnia Streams)
  // Normalize phone; if no country code, try default from env
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
  console.log("DEBUG: Querying with phoneHash:", phoneHash);

  // Query the data stream for phone registration
  let recipientWallet: string | undefined;
  
  try {
    console.log("📞 Querying data stream for phone registration...");
    
    // Try multiple potential publisher addresses since the SDK may have publisher-specific data
    const potentialPublishers = [
      process.env.PUBLISHER_ADDRESS,
      process.env.WALLET_ADDRESS,
      process.env.PUBLISHER_ADDRESS?.toLowerCase(),
      process.env.WALLET_ADDRESS?.toLowerCase(),
      // Add the wallet that was used in frontend registrations
      '0xccB221026F719a229B5fC50853A84823725518c5',
      '0xccb221026f719a229b5fc50853a84823725518c5'
    ].filter(Boolean).filter((addr, idx, arr) => arr.indexOf(addr) === idx);

    for (const publisher of potentialPublishers) {
      console.log(`🔍 Trying publisher: ${publisher}`);
      
      try {
        const results = await sdk.streams.getByKey(
          schemaId as `0x${string}`,
          publisher as `0x${string}`,
          phoneHash as `0x${string}`
        );

        console.log(`DEBUG: Results from publisher ${publisher}:`, results?.length || 0, "records");
        
        if (results && results.length > 0) {
          // Handle both decoded and raw data formats
          const firstResult = results[0];
          
          if (Array.isArray(firstResult)) {
            // Decoded format: array of field objects
            const returnedPhoneHash = firstResult[0]?.value?.value;
            const returnedWallet = firstResult[1]?.value?.value;
            
            console.log(`DEBUG: Publisher ${publisher} phoneHash check:`);
            console.log(`  Expected: ${phoneHash}`);
            console.log(`  Returned: ${returnedPhoneHash}`);
            console.log(`  Match: ${phoneHash === returnedPhoneHash}`);
            
            if (phoneHash === returnedPhoneHash && returnedWallet && typeof returnedWallet === 'string') {
              recipientWallet = returnedWallet as string;
              console.log(`✅ Found correct registration with publisher: ${publisher}`);
              console.log(`✅ Wallet: ${recipientWallet}`);
              break;
            } else if (returnedPhoneHash !== phoneHash) {
              console.log(`❌ Publisher ${publisher} has different phone data`);
            }
          } else if (typeof firstResult === "string") {
            // Raw hex format: needs ABI decoding
            console.log(`DEBUG: Decoding raw hex data from publisher ${publisher}`);
            try {
              const abiCoder = new AbiCoder();
              const decoded = abiCoder.decode(
                ["bytes32", "address", "string", "uint64"],
                firstResult
              );
              
              const decodedPhoneHash = decoded[0] as string;
              const decodedWallet = decoded[1] as string;
              
              console.log(`DEBUG: Decoded phoneHash: ${decodedPhoneHash}`);
              console.log(`DEBUG: Expected phoneHash: ${phoneHash}`);
              console.log(`DEBUG: Match: ${phoneHash === decodedPhoneHash}`);
              
              if (phoneHash === decodedPhoneHash && decodedWallet) {
                recipientWallet = decodedWallet;
                console.log(`✅ Found correct registration (decoded) with publisher: ${publisher}`);
                console.log(`✅ Wallet: ${recipientWallet}`);
                break;
              }
            } catch (decodeError: any) {
              console.log(`❌ Failed to decode data from publisher ${publisher}:`, decodeError.message);
            }
          }
        } else {
          console.log(`❌ No data from publisher ${publisher}`);
        }
      } catch (queryError: any) {
        console.log(`❌ Query failed for publisher ${publisher}:`, queryError.message);
      }
    }

    if (!recipientWallet) {
      throw new Error(
        `Phone number ${normalized} is not registered in the data stream. ` +
        `Tried publishers: ${potentialPublishers.join(', ')}. ` +
        `Please register the phone number first.`
      );
    }

  } catch (error: any) {
    console.error("Data stream query failed:", error.message);
    throw new Error(`Failed to query phone registration: ${error.message}`);
  }

  console.log("Transfer: resolved recipient wallet=", recipientWallet);
  
  // Check if recipient wallet is same as sender wallet 
  const senderWallet = process.env.WALLET_ADDRESS || account?.address;
  if (recipientWallet.toLowerCase() === senderWallet?.toLowerCase()) {
    console.warn("⚠️  WARNING: Recipient wallet is same as sender wallet!");
    console.warn("⚠️  This means the recipient phone is registered to the sender's wallet.");
    console.warn("⚠️  Recipient phone:", normalized);
    console.warn("⚠️  Recipient wallet:", recipientWallet);
    console.warn("⚠️  Sender wallet:", senderWallet);
  }

  // 2) Create Somnia transaction
  let txHash: `0x${string}`;
  let eventAmountWei: bigint;
  const upper = token.toUpperCase();
  
  if (upper === "SOMI" || upper === "STT") {
    // Both SOMI and STT are native currency transfers on Somnia
    // STT is the actual native token symbol on Somnia testnet
    const value = parseEther(String(amount));
    eventAmountWei = value;
    console.log(`📤 Sending ${amount} ${upper} (native transfer) to:`, recipientWallet);
    
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

  // 3) Publish event to Data Streams (optional) — best-effort
  try {
    const fromPhoneHash = (process.env.SENDER_PHONE && hashPhone(normalizePhone(process.env.SENDER_PHONE))) || ("0x" + "0".repeat(64));
    const eventId = "TransferConfirmed";
    // Some SDKs expose a generic event emitter; if not available, this block is harmless.
    // @ts-ignore - optional API depending on SDK version
    if (sdk.streams?.emitEvent) {
      // @ts-ignore
      await sdk.streams.emitEvent(eventId, {
        fromPhoneHash,
        toPhoneHash: phoneHash,
        amount: eventAmountWei,
        token: upper,
        txHash,
      });
    }
  } catch (e) {
    console.warn("Optional streams event publish failed:", e);
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