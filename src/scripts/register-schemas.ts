// src/scripts/register-schemas.ts
import { sdk } from '../lib/somnia.ts';

// The package '@somnia-chain/streams' may not export constants in every install
// (and importing a non-existent module causes TS/Node resolution errors). Use
// a local fallback for the zero 32-byte value instead of importing it.
type HexString = `0x${string}`;
const zeroBytes32 = ('0x' + '0'.repeat(64)) as HexString;

async function register() {
  // Data schema: userRegistration with thresholds included
  const dataSchemas = [
    {
      id: 'userRegistrationWithThresholds',
      schema: 'bytes32 phoneHash, address walletAddress, string metainfo, uint64 registeredAt, uint256 minLossPercentage, uint256 maxProfitPercentage, string tokenSymbol',
      parentSchemaId: zeroBytes32
    },
    {
      id: 'priceThreshold',
      schema: 'bytes32 phoneHash, string tokenSymbol, uint256 minPrice, uint256 maxPrice, uint64 updatedAt',
      parentSchemaId: zeroBytes32
    }
  ];

  // Event schema registrations
  const eventIds = ['TransferIntentCreated', 'TransferConfirmed', 'PriceAlertTriggered', 'UserRegistrationBroadcast'];
  const eventSchemas = [
    {
      params: [
        { name:'fromPhoneHash', paramType:'bytes32', isIndexed: true },
        { name:'toPhoneHash', paramType:'bytes32', isIndexed: true },
        { name:'to', paramType:'address', isIndexed: false },
        { name:'amount', paramType:'uint256', isIndexed: false },
        { name:'token', paramType:'string', isIndexed: false }
      ],
      eventTopic: 'TransferIntentCreated(bytes32 indexed fromPhoneHash, bytes32 indexed toPhoneHash, address to, uint256 amount, string token)'
    },
    {
      params: [
        { name:'fromPhoneHash', paramType:'bytes32', isIndexed: true },
        { name:'toPhoneHash', paramType:'bytes32', isIndexed: true },
        { name:'amount', paramType:'uint256', isIndexed: false },
        { name:'token', paramType:'string', isIndexed: false },
        { name:'txHash', paramType:'bytes32', isIndexed: false }
      ],
      eventTopic: 'TransferConfirmed(bytes32 indexed fromPhoneHash, bytes32 indexed toPhoneHash, uint256 amount, string token, bytes32 txHash)'
    },
    {
      params: [
        { name:'phoneHash', paramType:'bytes32', isIndexed: true },
        { name:'tokenSymbol', paramType:'string', isIndexed: false },
        { name:'action', paramType:'string', isIndexed: false },
        { name:'price', paramType:'uint256', isIndexed: false }
      ],
      eventTopic: 'PriceAlertTriggered(bytes32 indexed phoneHash, string tokenSymbol, string action, uint256 price)'
    },
    {
      params: [
        { name:'phoneHash', paramType:'bytes32', isIndexed: true },
        { name:'walletAddress', paramType:'address', isIndexed: false },
        { name:'registeredAt', paramType:'uint64', isIndexed: false }
      ],
      eventTopic: 'UserRegistrationBroadcast(bytes32 indexed phoneHash, address walletAddress, uint64 registeredAt)'
    },
   
  ];

  console.log('Registering data schemas...');
  const tx1 = await sdk.streams.registerDataSchemas(dataSchemas, true);
  // Print the full response to make it easy to find schema IDs/receipt data
  console.log('Data schema registration tx:', JSON.stringify(tx1, null, 2));

  console.log('Registering event schemas...');
  const tx2 = await sdk.streams.registerEventSchemas(eventIds, eventSchemas);
  console.log('Event schema registration tx:', JSON.stringify(tx2, null, 2));
}

register().catch(console.error);
