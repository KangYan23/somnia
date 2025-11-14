import { privateKeyToAccount } from 'viem/accounts';
import { createWalletClient, createPublicClient, http } from 'viem';
import { somniaTestnet } from 'viem/chains';

const privateKey = process.env.PRIVATE_KEY;
if (!privateKey) throw new Error('PRIVATE_KEY not found');

const account = privateKeyToAccount(`0x${privateKey}`);
const walletClient = createWalletClient({
  account,
  chain: somniaTestnet,
  transport: http(process.env.RPC_URL)
});
const publicClient = createPublicClient({
  chain: somniaTestnet,
  transport: http(process.env.RPC_URL)
});

const contractAddress = '0x6AB397FF662e42312c003175DCD76EfF69D048Fc';

// Contract ABI for registerSchemas
const abi = [{
  inputs: [
    { name: 'ids', type: 'string[]' },
    { name: 'schemas', type: 'tuple[]', components: [
      { name: 'fields', type: 'tuple[]', components: [
        { name: 'name', type: 'string' },
        { name: 'valueType', type: 'string' }
      ]},
      { name: 'parent', type: 'bytes32' }
    ]}
  ],
  name: 'registerSchemas',
  outputs: [],
  stateMutability: 'nonpayable',
  type: 'function'
}, {
  inputs: [{ name: 'schemaId', type: 'bytes32' }],
  name: 'getSchema',
  outputs: [{ name: '', type: 'tuple', components: [
    { name: 'fields', type: 'tuple[]', components: [
      { name: 'name', type: 'string' },
      { name: 'valueType', type: 'string' }
    ]},
    { name: 'parent', type: 'bytes32' }
  ]}],
  stateMutability: 'view',
  type: 'function'
}];

async function registerDataSchemas() {
  try {
    console.log('Registering data schemas directly...');

    // Define the schemas
    const schemas = [
      {
        fields: [
          { name: 'phoneHash', valueType: 'bytes32' },
          { name: 'walletAddress', valueType: 'address' },
          { name: 'registeredAt', valueType: 'uint64' }
        ],
        parent: '0x0000000000000000000000000000000000000000000000000000000000000000'
      },
      {
        fields: [
          { name: 'phoneHash', valueType: 'bytes32' },
          { name: 'minLossPercentage', valueType: 'uint256' },
          { name: 'maxProfitPercentage', valueType: 'uint256' }
        ],
        parent: '0x0000000000000000000000000000000000000000000000000000000000000000'
      }
    ];

    const ids = ['userRegistration', 'priceThreshold'];

    console.log('Schema data:', JSON.stringify({ ids, schemas }, null, 2));

    // Register schemas
    const tx = await walletClient.writeContract({
      address: contractAddress,
      abi,
      functionName: 'registerSchemas',
      args: [ids, schemas]
    });

    console.log('Registration transaction:', tx);

    // Wait for confirmation
    const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
    console.log('Transaction confirmed:', receipt.status);

    // Verify registration
    console.log('\nVerifying registration...');
    
    // Get schema IDs from environment
    const userRegSchemaId = process.env.USER_REGISTRATION_SCHEMA_ID;
    const priceSchemaId = process.env.PRICE_THRESHOLD_SCHEMA_ID;

    if (userRegSchemaId) {
      try {
        const userSchema = await publicClient.readContract({
          address: contractAddress,
          abi,
          functionName: 'getSchema',
          args: [userRegSchemaId]
        });
        console.log('userRegistration schema verified:', userSchema);
      } catch (e) {
        console.log('userRegistration schema not found:', (e as Error).message);
      }
    }

    if (priceSchemaId) {
      try {
        const priceSchema = await publicClient.readContract({
          address: contractAddress,
          abi,
          functionName: 'getSchema',
          args: [priceSchemaId]
        });
        console.log('priceThreshold schema verified:', priceSchema);
      } catch (e) {
        console.log('priceThreshold schema not found:', (e as Error).message);
      }
    }

  } catch (error) {
    console.error('Error registering schemas:', error);
  }
}

registerDataSchemas();