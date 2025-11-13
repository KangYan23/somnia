// src/scripts/set-price-threshold.ts
import { createWalletClient, http, parseAbi, publicActions } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import * as dotenv from "dotenv";
import { encodeAbiParameters, parseUnits } from "viem/utils";
import { hashPhone } from "../lib/phone.ts";

dotenv.config();

// 🔑 Load your private key
const PRIVATE_KEY = process.env.PRIVATE_KEY!;
const account = privateKeyToAccount(`0x${PRIVATE_KEY}`);

// 🌐 Somnia Data Stream contract address
const CONTRACT_ADDRESS = "0x6AB397FF662e42312c003175DCD76EfF69D048Fc";

// 🧾 On-chain schema ID for priceThreshold
const PRICE_THRESHOLD_SCHEMA_ID =
  "0x2b9ecdb54560ad5c48f26b46e029f4b9b05dda40e5b5e3daa532abc910e64455";

// 🧠 ABI (minimal version for writing data)
const dataStreamAbi = parseAbi([
  "function set(bytes32 schemaId, bytes data) external returns (bytes32 recordId)",
]);

// ⚡ Somnia Testnet chain config
const somniaTestnet = {
  id: 50312, // Somnia testnet chain ID
  name: "Somnia Testnet",
  network: "somnia-testnet",
  rpcUrls: {
    default: { http: ["https://dream-rpc.somnia.network"] },
  },
  nativeCurrency: { name: "Somnia Token", symbol: "STT", decimals: 18 },
};

async function main() {
  const client = createWalletClient({
    account,
    chain: somniaTestnet,
    transport: http(process.env.RPC_URL || "https://dream-rpc.somnia.network"),
  }).extend(publicActions);

  // === USER SETTINGS ===
  // These can be dynamically set per user later
  const phoneNumber = "+60123456789";
  const tokenSymbol = "STT"; // default token
  const minLossPercent = 5;
  const maxProfitPercent = 10;

  console.log(`📱 Setting price threshold for ${phoneNumber} (${tokenSymbol})`);

  // Hash phone number (use same hash function as other scripts)
  const phoneHash = hashPhone(phoneNumber);

  // Convert percentages to integers
  const minPrice = parseUnits(minLossPercent.toString(), 0);
  const maxPrice = parseUnits(maxProfitPercent.toString(), 0);

  const updatedAt = BigInt(Math.floor(Date.now() / 1000));

  // Encode data according to schema
  const encoded = encodeAbiParameters(
    [
      { type: "bytes32", name: "phoneHash" },
      { type: "string", name: "tokenSymbol" },
      { type: "uint256", name: "minPrice" },
      { type: "uint256", name: "maxPrice" },
      { type: "uint64", name: "updatedAt" },
    ],
    [phoneHash as `0x${string}`, tokenSymbol, minPrice, maxPrice, updatedAt]
  );

    // Diagnostic: print encoded length and preview
    console.log('Encoded data length (bytes):', (encoded.length - 2) / 2);
    console.log('Encoded preview:', encoded.slice(0, 200));

    // Diagnostic: verify schema exists on-chain and mapping by id
    try {
      const schemaAbi = parseAbi([
        'function getSchema(bytes32 schemaId) view returns (string id, string schema, bytes32 parentSchemaId)',
        'function idToSchemaId(string id) view returns (bytes32)'
      ]);

      try {
        const onChain = await client.readContract({
          address: CONTRACT_ADDRESS,
          abi: schemaAbi,
          functionName: 'getSchema',
          args: [PRICE_THRESHOLD_SCHEMA_ID as `0x${string}`]
        });
        console.log('onChain getSchema for PRICE_THRESHOLD_SCHEMA_ID:', onChain);
      } catch (e) {
        console.log('getSchema call failed or schema not set on-chain for this id:', (e as any)?.message || e);
      }

      try {
        const mapped = await client.readContract({
          address: CONTRACT_ADDRESS,
          abi: schemaAbi,
          functionName: 'idToSchemaId',
          args: ['priceThreshold']
        });
        console.log("idToSchemaId('priceThreshold') ->", mapped);
      } catch (e) {
        console.log('idToSchemaId call failed:', (e as any)?.message || e);
      }
    } catch (e) {
      console.warn('Schema verification skipped due to read error:', (e as any)?.message || e);
    }

    // Try an estimate (dry run) before sending transaction to gather revert reason earlier
    try {
      const gasEst = await (client as any).estimateGas({
        address: CONTRACT_ADDRESS,
        abi: dataStreamAbi,
        functionName: 'set',
        args: [PRICE_THRESHOLD_SCHEMA_ID, encoded]
      });
      console.log('Estimated gas for set():', gasEst?.toString?.());
    } catch (e: any) {
      console.warn('Gas estimation failed (likely will revert). Error:', e?.message || e);
    }

  // Call contract
  const txHash = await client.writeContract({
    address: CONTRACT_ADDRESS,
    abi: dataStreamAbi,
    functionName: "set",
    args: [PRICE_THRESHOLD_SCHEMA_ID, encoded],
  });

  console.log(`✅ Transaction sent: ${txHash}`);
  console.log("💾 Your price threshold is now stored on-chain.");
}

main().catch((err) => {
  console.error("❌ Error setting price threshold:", err);
});
