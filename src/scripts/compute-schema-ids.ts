// src/scripts/compute-schema-ids.ts
import 'dotenv/config';
import { createPublicClient, http } from 'viem';
import { somniaTestnet } from 'viem/chains';
import { keccak256, toUtf8Bytes } from 'ethers';
import { hexToBytes } from 'viem';

const rpcUrl = process.env.RPC_URL;
if (!rpcUrl) {
  throw new Error('RPC_URL required in env');
}

const publicClient = createPublicClient({ chain: somniaTestnet, transport: http(rpcUrl) });

// Address of the Somnia Streams / registry contract seen in your run output
const CONTRACT_ADDRESS = '0x6AB397FF662e42312c003175DCD76EfF69D048Fc';

// Minimal ABI entries we need
const ABI = [
  {
    inputs: [
      { internalType: 'string', name: 'id', type: 'string' },
      { internalType: 'string', name: 'schema', type: 'string' },
      { internalType: 'bytes32', name: 'parentSchemaId', type: 'bytes32' }
    ],
    name: 'computeSchemaId',
    outputs: [{ internalType: 'bytes32', name: '', type: 'bytes32' }],
    stateMutability: 'pure',
    type: 'function'
  },
  {
    inputs: [{ internalType: 'bytes32', name: 'schemaId', type: 'bytes32' }],
    name: 'getSchema',
    outputs: [
      { internalType: 'string', name: 'id', type: 'string' },
      { internalType: 'string', name: 'schema', type: 'string' },
      { internalType: 'bytes32', name: 'parentSchemaId', type: 'bytes32' }
    ],
    stateMutability: 'view',
    type: 'function'
  }
];

// Copy the dataSchemas you intend to register (must match exactly the strings used when registering)
const dataSchemas = [
  {
    id: 'userRegistration',
    schema: 'bytes32 phoneHash, address walletAddress, string metainfo, uint64 registeredAt',
    parentSchemaId: '0x' + '0'.repeat(64)
  },
  {
    id: 'priceThreshold',
    schema: 'bytes32 phoneHash, string tokenSymbol, uint256 minPrice, uint256 maxPrice, uint64 updatedAt',
    parentSchemaId: '0x' + '0'.repeat(64)
  }
];

async function main() {
  console.log('Computing schema IDs locally via contract.computeSchemaId...');

  for (const s of dataSchemas) {
    try {
      // Compute locally using the same packed encoding the contract likely uses.
      const idBytes = toUtf8Bytes(s.id);
      const schemaBytes = toUtf8Bytes(s.schema);
  const parentBytes = hexToBytes(s.parentSchemaId as `0x${string}`);
      const packed = new Uint8Array(idBytes.length + schemaBytes.length + parentBytes.length);
      packed.set(idBytes, 0);
      packed.set(schemaBytes, idBytes.length);
      packed.set(parentBytes, idBytes.length + schemaBytes.length);
      const localSchemaId = keccak256(packed);

      console.log(`\nLocally computed schema id for id='${s.id}': ${localSchemaId}\n  schema: ${s.schema}\n  parentSchemaId: ${s.parentSchemaId}\n`);

      // Try on-chain lookup for that schema id (if registered)
      try {
        const onChain = await publicClient.readContract({
          address: CONTRACT_ADDRESS,
          abi: ABI as any,
          functionName: 'getSchema',
          args: [localSchemaId]
        });

        console.log('On-chain schema found:', onChain);
      } catch (err: any) {
        console.log('getSchema call failed or schema not registered yet:', err?.message ?? err);
      }
    } catch (err: any) {
      console.error('computeSchemaId (local) failed for', s.id, err?.message ?? err);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
