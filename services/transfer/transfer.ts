// Updated to use unified registration utilities
// services/transfer/transfer.ts
import { sdk, walletClient, account } from "../../src/lib/somnia";
import { parseEther } from "viem";
import { createPhoneHash, processRegistrationResult, validatePhoneHash } from "../../src/utils/registration-utils";

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

  // 1) Convert phone ➜ wallet address using unified utilities
  const raw = recipient_phone.trim();
  const withCc = raw.startsWith('+')
    ? raw
    : ((process.env.DEFAULT_COUNTRY_CODE || '').trim() + raw);
  
  const { normalized, phoneHash } = createPhoneHash(withCc);

  const schemaId = await sdk.streams.idToSchemaId("userRegistration");
  if (!schemaId || /^0x0+$/.test(schemaId)) {
    throw new Error("userRegistration schema not found. Run schema registration first.");
  }
  console.log("Transfer: normalized phone=", normalized, " phoneHash=", phoneHash);

  // Query the data stream for phone registration
  let recipientWallet: string | undefined;
  
  try {
    // Try multiple potential publisher addresses since the SDK may have publisher-specific data
    const potentialPublishers = [
      process.env.PUBLISHER_ADDRESS,
      process.env.WALLET_ADDRESS,
      process.env.PUBLISHER_ADDRESS?.toLowerCase(),
      process.env.WALLET_ADDRESS?.toLowerCase()
    ].filter(Boolean).filter((addr, idx, arr) => arr.indexOf(addr) === idx);

    for (const publisher of potentialPublishers) {
      try {
        const results = await sdk.streams.getByKey(
          schemaId as `0x${string}`,
          publisher as `0x${string}`,
          phoneHash as `0x${string}`
        );
        
        if (results && results.length > 0) {
          // Use unified result processing
          const registration = processRegistrationResult(results[0], publisher, 'transfer_query');
          
          if (registration && validatePhoneHash(phoneHash, registration.phoneHash)) {
            recipientWallet = registration.walletAddress;
            console.log(`✅ Found registration with publisher: ${publisher}`);
            break;
          }
        }
      } catch (queryError: any) {
        // Silent continue to next publisher
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
  
  // 2) Create Somnia transaction
  let txHash: `0x${string}`;
  let eventAmountWei: bigint;
  const upper = token.toUpperCase();
  
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