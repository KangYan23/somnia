// src/scripts/register-and-wait-schemas.ts
import 'dotenv/config';
import { sdk } from '../lib/somnia.ts';
import { createPublicClient, http, hexToBytes } from 'viem';
import { somniaTestnet } from 'viem/chains';
import { keccak256, toUtf8Bytes } from 'ethers';
import { privateKeyToAccount } from 'viem/accounts';

const rpcUrl = process.env.RPC_URL;
if (!rpcUrl) throw new Error('RPC_URL required in env');

const publicClient = createPublicClient({ chain: somniaTestnet, transport: http(rpcUrl) });
const CONTRACT_ADDRESS = '0x6AB397FF662e42312c003175DCD76EfF69D048Fc';

type DataSchema = { id: string; schema: string; parentSchemaId: `0x${string}` };

const dataSchemas: DataSchema[] = [
  {
    id: 'userRegistration',
    schema: 'bytes32 phoneHash, address walletAddress, string metainfo, uint64 registeredAt',
    parentSchemaId: ('0x' + '0'.repeat(64)) as `0x${string}`
  },
  {
    id: 'priceThreshold',
    schema: 'bytes32 phoneHash, string tokenSymbol, uint256 minPrice, uint256 maxPrice, uint64 updatedAt',
    parentSchemaId: ('0x' + '0'.repeat(64)) as `0x${string}`
  }
];

function computeSchemaIdLocal(s: DataSchema) {
  const idBytes = toUtf8Bytes(s.id);
  const schemaBytes = toUtf8Bytes(s.schema);
  const parentBytes = hexToBytes(s.parentSchemaId);
  const packed = new Uint8Array(idBytes.length + schemaBytes.length + parentBytes.length);
  packed.set(idBytes, 0);
  packed.set(schemaBytes, idBytes.length);
  packed.set(parentBytes, idBytes.length + schemaBytes.length);
  return keccak256(packed);
}

async function getOnChainSchema(schemaId: `0x${string}`) {
  try {
    const abi = [
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

    return await publicClient.readContract({
      address: CONTRACT_ADDRESS,
      abi: abi as any,
      functionName: 'getSchema',
      args: [schemaId]
    });
  } catch (err) {
    return null;
  }
}

async function getSchemaIdFromId(id: string): Promise<`0x${string}` | null> {
  try {
    const abi = [
      {
        inputs: [{ internalType: 'string', name: 'id', type: 'string' }],
        name: 'idToSchemaId',
        outputs: [{ internalType: 'bytes32', name: '', type: 'bytes32' }],
        stateMutability: 'view',
        type: 'function'
      }
    ];

    const res = await publicClient.readContract({
      address: CONTRACT_ADDRESS,
      abi: abi as any,
      functionName: 'idToSchemaId',
      args: [id]
    }) as `0x${string}`;

    // If zero value, treat as not set
    if (!res || res === ('0x' + '0'.repeat(64))) return null;
    return res;
  } catch (err) {
    return null;
  }
}

async function waitForReceipt(txHash: `0x${string}`, timeout = 120_000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const receipt = await publicClient.getTransactionReceipt({ hash: txHash });
    if (receipt && receipt.status !== undefined) return receipt;
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw new Error('Timed out waiting for tx receipt');
}

async function main() {
  const publish = (process.env.PUBLISH === 'true');

  for (const s of dataSchemas) {
    const localId = computeSchemaIdLocal(s) as `0x${string}`;
    console.log(`Computed local schemaId for ${s.id}: ${localId}`);

    // First try to find the on-chain schemaId by the string id mapping (idToSchemaId)
    const mappedId = await getSchemaIdFromId(s.id);
    if (mappedId) {
      console.log(`On-chain schemaId mapping for id='${s.id}': ${mappedId}`);
      const onChainById = await getOnChainSchema(mappedId as `0x${string}`);
      console.log(`On-chain schema for id='${s.id}':`, onChainById);
      continue;
    }

    // If no mapping, fall back to checking by the locally computed id
    const onChain = await getOnChainSchema(localId);
    if (onChain) {
      console.log(`Schema ${s.id} is already registered on-chain (found by computed id):`, onChain);
      // Try to fetch the mapping too and print it if present
      const mappedId2 = await getSchemaIdFromId(s.id);
      if (mappedId2) console.log(`idToSchemaId mapping: ${mappedId2}`);
      continue;
    }

    console.log(`Schema ${s.id} not registered on-chain.`);
    if (!publish) {
      console.log(`To register it, set PUBLISH=true and rerun this script. Example:`);
      console.log(`PUBLISH=true npx ts-node src/scripts/register-and-wait-schemas.ts`);
      continue;
    }

    // Proceed to register via SDK (this will send a transaction). Wrap and wait for receipt.
    console.log(`Registering schema ${s.id} on-chain...`);
    try {
      // Before sending, check nonce/pending txs for the wallet derived from PRIVATE_KEY
      const rawPrivateKey = process.env.PRIVATE_KEY;
      if (!rawPrivateKey) {
        console.error('PRIVATE_KEY missing in env. Set PRIVATE_KEY to publish.');
        continue;
      }
      const pkClean = rawPrivateKey.trim().startsWith('0x') ? rawPrivateKey.trim() : '0x' + rawPrivateKey.trim();
      const account = privateKeyToAccount(pkClean as `0x${string}`);
      const addr = account.address as `0x${string}`;
      const pending = await publicClient.getTransactionCount({ address: addr, blockTag: 'pending' });
      const latest = await publicClient.getTransactionCount({ address: addr, blockTag: 'latest' });
      console.log(`Account ${addr} nonce pending=${pending} latest=${latest}`);
      if (pending > latest) {
        console.error('There are pending transactions for this account. This may cause NonceTooLow errors. Wait for pending txs or use a different account.');
        continue;
      }
      const tx = await sdk.streams.registerDataSchemas([s], true) as any;
      // tx may be an object with hash or the full response; attempt to extract a hash
      const rawHash = (tx && typeof tx === 'object') ? (tx.hash || tx.transactionHash || tx.txHash || tx.tx) : tx;
      if (!rawHash || typeof rawHash !== 'string') {
        console.log('Register call returned:', tx);
        console.log('Could not find tx hash automatically. Please inspect the output above to find the transaction hash.');
        continue;
      }
      const txHash = (rawHash.startsWith('0x') ? rawHash : '0x' + rawHash) as `0x${string}`;

      console.log('Sent tx hash:', txHash, 'waiting for it to be mined...');
  const receipt = await waitForReceipt(txHash, 180_000);
      console.log('Transaction mined:', receipt);

      const registered = await getOnChainSchema(localId);
      console.log('On-chain schema after registration:', registered);
    } catch (err: any) {
      console.error('Registration failed for', s.id, err?.message ?? err);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
