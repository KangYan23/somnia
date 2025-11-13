// Test direct query for registered phone hash
require('dotenv').config();

async function initSdk() {
  const { createPublicClient, createWalletClient, http } = await import('viem');
  const { privateKeyToAccount } = await import('viem/accounts');
  const { SomniaStreamsSdk } = await import('@somnia-metaverse/streams-sdk-ts');

  const account = privateKeyToAccount(process.env.PRIVATE_KEY);
  const publicClient = createPublicClient({
    transport: http(process.env.SOMNIA_RPC_URL),
  });
  
  const sdk = new SomniaStreamsSdk({
    apiUrl: process.env.SOMNIA_STREAMS_URL,
    apiKey: process.env.SOMNIA_STREAMS_API_KEY,
    publicClient
  });
  
  return { sdk, account };
}

async function testDirectQuery() {
  try {
    const { sdk } = await initSdk();
    
    // Test the registered phone hash directly
    const registeredPhoneHash = '0xeceb6f44e0a6396aa50de30994b95aba3616fa4835cc6ea022bdd7f08e564de0';
    
    console.log('Testing direct query for registered phone hash...');
    console.log('Phone hash:', registeredPhoneHash);

    const schemaId = await sdk.streams.idToSchemaId('userRegistration');
    console.log('Schema ID:', schemaId);

    const publisherAddress = process.env.PUBLISHER_ADDRESS || process.env.WALLET_ADDRESS;
    console.log('Publisher address:', publisherAddress);

    const results = await sdk.streams.getByKey(
      schemaId,
      publisherAddress,
      registeredPhoneHash
    );

    console.log('Direct query results:');
    console.dir(results, { depth: null });
    
    if (results && results.length > 0 && Array.isArray(results[0])) {
      const returnedPhoneHash = results[0][0]?.value?.value;
      console.log('Returned phoneHash:', returnedPhoneHash);
      console.log('Match:', registeredPhoneHash === returnedPhoneHash);
      
      // Try to extract wallet address
      const walletData = results[0][1];
      console.log('Wallet data structure:');
      console.dir(walletData, { depth: null });
      
      let walletAddress;
      if (typeof walletData === 'object' && walletData !== null) {
        if (walletData.value && typeof walletData.value === 'object' && walletData.value.value) {
          walletAddress = walletData.value.value;
        } else if (walletData.value) {
          walletAddress = walletData.value;
        }
      }
      console.log('Extracted wallet address:', walletAddress);
    }

  } catch (error) {
    console.error('Query failed:', error);
  }
}

testDirectQuery();