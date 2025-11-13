// Updated to use walletClient.sendTransaction consistently
// services/transfer/transfer.ts
import { normalizePhone, hashPhone } from "../../src/lib/phone.ts";
import { sdk, walletClient } from "../../src/lib/somnia.ts";
import { AbiCoder } from "ethers";
import { parseEther, parseUnits, encodeFunctionData, createPublicClient, http, decodeEventLog } from "viem";
import { somniaTestnet } from "viem/chains";

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
  // Normalize phone; if no country code, try default from env and drop leading 0 from national format
  const raw = recipient_phone.trim();
  let e164 = raw;
  if (!e164.startsWith('+')) {
    let cc = (process.env.DEFAULT_COUNTRY_CODE || '').trim();
    if (cc && !cc.startsWith('+')) cc = '+' + cc;
    let national = raw.replace(/\D/g, '');
    if (national.startsWith('0')) national = national.slice(1);
    e164 = `${cc}${national}`;
  }
  const normalized = normalizePhone(e164);
  const phoneHash = hashPhone(normalized);

  const envSchema = process.env.USER_REGISTRATION_SCHEMA_ID as `0x${string}` | undefined;
  const schemaId = envSchema || await sdk.streams.idToSchemaId("userRegistration");
  if (!schemaId || /^0x0+$/.test(schemaId)) {
    throw new Error("userRegistration schema not found. Run schema registration first.");
  }
  console.log("Transfer: normalized phone=", normalized, " phoneHash=", phoneHash);

  const publisherAddress = (process.env.PUBLISHER_ADDRESS || process.env.WALLET_ADDRESS) as `0x${string}` | undefined;
  if (!publisherAddress) {
    throw new Error("PUBLISHER_ADDRESS or WALLET_ADDRESS env is required to query streams");
  }

  const results = await sdk.streams.getByKey(
    schemaId as `0x${string}`,
    publisherAddress,
    phoneHash as `0x${string}`
  );

  // We will also try to resolve by on-chain events; do not throw yet if empty.

  // Extract wallet address (support decoded or raw hex formats). If multiple results, prefer the newest by registeredAt.
  let recipientWallet: string | undefined;
  let bestTs = BigInt(-1);
  for (const item of results as any[]) {
    try {
      if (Array.isArray(item)) {
        const decodedArr = item as any[];
        const wallet = (decodedArr[1]?.value ?? decodedArr[1]) as string;
        const tsVal = decodedArr[3]?.value ?? decodedArr[3];
        const ts = typeof tsVal === 'bigint' ? tsVal : BigInt(tsVal ?? 0);
        if (wallet && /^0x[0-9a-fA-F]{40}$/.test(wallet) && ts >= bestTs) {
          bestTs = ts;
          recipientWallet = wallet;
        }
      } else if (typeof item === 'string') {
        const decoded = new AbiCoder().decode([
          'bytes32','address','string','uint64'
        ], item);
        const wallet = decoded[1] as string;
        const ts = BigInt(decoded[3] as any);
        if (wallet && /^0x[0-9a-fA-F]{40}$/.test(wallet) && ts >= bestTs) {
          bestTs = ts;
          recipientWallet = wallet;
        }
      }
    } catch {}
  }

  // Try cross-validating/overriding with on-chain events (latest registration wins)
  try {
    const rpcUrl = process.env.RPC_URL;
    const contract = (process.env.REGISTRY_CONTRACT_ADDRESS || '0x6AB397FF662e42312c003175DCD76EfF69D048Fc') as `0x${string}`;
    if (rpcUrl) {
      const client = createPublicClient({ chain: somniaTestnet, transport: http(rpcUrl) });
      const eventAbi = {
        type: 'event',
        name: 'UserRegistrationBroadcast',
        inputs: [
          { name: 'phoneHash', type: 'bytes32', indexed: true },
          { name: 'walletAddress', type: 'address', indexed: false },
          { name: 'registeredAt', type: 'uint64', indexed: false }
        ]
      } as const;

      const latest = await client.getBlockNumber();
      const CHUNK = BigInt(1000);
      const MAX = BigInt(50);
      let to = latest;
      let bestEventTs = bestTs;
      let bestEventWallet = recipientWallet;

      for (let i = BigInt(0); i < MAX; i++) {
        const from = to > CHUNK ? to - CHUNK : BigInt(0);
        const logs = await client.getLogs({
          address: contract,
          event: eventAbi as any,
          args: { phoneHash: phoneHash as `0x${string}` },
          fromBlock: from,
          toBlock: to,
        });
        for (const log of logs as any[]) {
          const decoded = decodeEventLog({ abi: [eventAbi as any], data: log.data, topics: log.topics }) as any;
          const w = decoded.args.walletAddress as string;
          const ts = BigInt(decoded.args.registeredAt as any);
          if (w && /^0x[0-9a-fA-F]{40}$/.test(w) && ts >= bestEventTs) {
            bestEventTs = ts;
            bestEventWallet = w;
          }
        }
        if (from === BigInt(0)) break;
        to = from - BigInt(1);
      }

      if (bestEventWallet && bestEventWallet !== recipientWallet) {
        console.log('Transfer: overriding recipient wallet from events:', bestEventWallet);
        recipientWallet = bestEventWallet;
        bestTs = bestEventTs;
      }
    }
  } catch (e) {
    console.warn('Transfer: event cross-validate failed:', e);
  }

  if (!recipientWallet) {
    throw new Error("Recipient phone is not registered to any wallet");
  }
  console.log("Transfer: resolved recipient wallet=", recipientWallet);

  // 2) Create Somnia transaction
  const sender = (sdk as any)?.wallet?.account?.address || process.env.WALLET_ADDRESS || process.env.PUBLISHER_ADDRESS;
  if (sender) console.log("Transfer: sender wallet=", sender);
  let txHash: `0x${string}`;
  let eventAmountWei: bigint;
  const upper = token.toUpperCase();
  if (upper === "SOMI") {
    const value = parseEther(String(amount));
    eventAmountWei = value;
      txHash = await walletClient.sendTransaction({
      to: recipientWallet as `0x${string}`,
      value,
    });
  } else if (upper === "STT") {
    const tokenAddress = process.env.STT_TOKEN_ADDRESS as `0x${string}` | undefined;
    const decimals = Number(process.env.STT_DECIMALS || 18);
    if (!tokenAddress) {
      throw new Error("STT_TOKEN_ADDRESS env is required for STT transfers");
    }
    const amountWei = parseUnits(String(amount), decimals);
    eventAmountWei = amountWei;
    const erc20Abi = [
      {
        type: "function",
        name: "transfer",
        stateMutability: "nonpayable",
        inputs: [
          { name: "to", type: "address" },
          { name: "value", type: "uint256" },
        ],
        outputs: [{ name: "success", type: "bool" }],
      },
    ] as const;
    const data = encodeFunctionData({
      abi: erc20Abi,
      functionName: "transfer",
      args: [recipientWallet as `0x${string}`, amountWei],
    });
    txHash = await walletClient.sendTransaction({
      to: tokenAddress,
      data,
      value: BigInt(0),
    });
  } else {
    throw new Error(`Unsupported token: ${token}`);
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
