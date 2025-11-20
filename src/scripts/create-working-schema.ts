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

async function createWorkingSchema() {
  try {
    console.log('Creating new working price threshold schema...');
    
    // Use timestamp to ensure uniqueness
    const schemaId = `priceThresholdWorking_${Date.now()}`;
    console.log('New schema ID:', schemaId);
    
    // Register the schema
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
        [schemaId],
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
    
    console.log('Registration transaction:', tx);
    
    // Wait for confirmation
    const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
    console.log('Transaction confirmed with status:', receipt.status);
    
    if (receipt.status === 'success') {
      // Get the schema ID that was created
      const createdSchemaId = await publicClient.readContract({
        address: contractAddress,
        abi: [{
          inputs: [{ name: 'id', type: 'string' }],
          name: 'idToSchemaId',
          outputs: [{ name: '', type: 'bytes32' }],
          stateMutability: 'view',
          type: 'function'
        }],
        functionName: 'idToSchemaId',
        args: [schemaId]
      });
      console.log('Created schema ID mapping:', createdSchemaId);
      
      // Verify the schema can be retrieved
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
          args: [createdSchemaId]
        });
        console.log('✅ Schema verification successful:', schema);
        console.log('🎉 New schema ready to use!');
        console.log('');
        console.log('To update your environment:');
        console.log(`PRICE_THRESHOLD_SCHEMA_ID=${createdSchemaId}`);
        console.log(`PRICE_THRESHOLD_STRING_ID=${schemaId}`);
        
      } catch (e) {
        console.error('❌ Schema verification failed:', (e as Error).message);
      }
      
    } else {
      console.error('❌ Transaction failed');
    }
    
  } catch (error) {
    console.error('❌ Error creating schema:', (error as Error).message);
  }
}

createWorkingSchema();