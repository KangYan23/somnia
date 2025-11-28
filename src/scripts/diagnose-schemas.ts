import { privateKeyToAccount } from 'viem/accounts';
import { createWalletClient, createPublicClient, http } from 'viem';
import { somniaTestnet } from 'viem/chains';

const privateKey = '92fecb94f7445a4061aab39fdfbf33d83dadfc27b0931aa6decffdde5c6b9807';
const rpcUrl = 'https://dream-rpc.somnia.network';

const account = privateKeyToAccount(`0x${privateKey}`);
const walletClient = createWalletClient({
  account,
  chain: somniaTestnet,
  transport: http(rpcUrl)
});
const publicClient = createPublicClient({
  chain: somniaTestnet,
  transport: http(rpcUrl)
});

const contractAddress = '0x6AB397FF662e42312c003175DCD76EfF69D048Fc';

async function diagnose() {
  try {
    console.log('Account:', account.address);
    
    console.log('1. Checking schema registration status...');

    // Check if priceThreshold ID mapping exists
    const priceThresholdId = await publicClient.readContract({
      address: contractAddress,
      abi: [{
        inputs: [{ name: 'id', type: 'string' }],
        name: 'idToSchemaId',
        outputs: [{ name: '', type: 'bytes32' }],
        stateMutability: 'view',
        type: 'function'
      }],
      functionName: 'idToSchemaId',
      args: ['priceThreshold']
    });
    console.log('priceThreshold ID mapping:', priceThresholdId);

    // Try to get the actual schema
    try {
      const schema = await publicClient.readContract({
        address: contractAddress,
        abi: [{
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
        }],
        functionName: 'getSchema',
        args: [priceThresholdId]
      });
      console.log('priceThreshold schema:', schema);
    } catch (e) {
      console.log('getSchema failed:', (e as Error).message);
    }

    console.log('2. Trying direct contract registration...');
    
    // Try direct contract call with a unique schema ID
    try {
      const tx = await walletClient.writeContract({
        address: contractAddress,
        abi: [{
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
        }],
        functionName: 'registerSchemas',
        args: [
          [`priceThresholdNew_${Date.now()}`], // Unique ID
          [{
            fields: [
              { name: 'phoneHash', valueType: 'bytes32' },
              { name: 'minLossPercentage', valueType: 'uint256' },
              { name: 'maxProfitPercentage', valueType: 'uint256' }
            ],
            parent: '0x0000000000000000000000000000000000000000000000000000000000000000'
          }]
        ]
      });
      console.log('Direct registration tx:', tx);
      
      // Wait for receipt
      const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
      console.log('Registration confirmed:', receipt.status);
      
    } catch (e) {
      console.log('Direct registration error:', (e as Error).message);
    }

  } catch (error) {
    console.error('Diagnosis error:', error);
  }
}

diagnose();