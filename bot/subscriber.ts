// bot/subscriber.ts
import { SDK } from '@somnia-chain/streams';
import { publicClient } from '../src/lib/somnia';
import dotenv from 'dotenv';
dotenv.config();

const sdk = new SDK({ public: publicClient as any });

async function start() {
  console.log('Subscribing to UserRegistrationBroadcast...');
  await sdk.streams.subscribe({
    somniaStreamsEventId: 'UserRegistrationBroadcast',
  onData: async (payload: any) => {
      // payload likely contains topics (phoneHash)
      console.log('Event payload raw:', payload);

      // extract phoneHash from topics or data depending on SDK shape; we assume first topic
      const phoneHash = payload?.topics?.[0] || payload?.data?.phoneHash;
      console.log('Got phoneHash:', phoneHash);

      // Use getByKey to fetch registration details
      // You need publisher and schemaId - if you registered under your publisher address (your server)
      const schemaIdRaw = await sdk.streams.idToSchemaId('userRegistration') as `0x${string}` | null;
      if (!schemaIdRaw) {
        console.warn('schema id for userRegistration not found');
        return;
      }
      const schemaId = schemaIdRaw as `0x${string}`;
      // publisher: use the correct environment variable name
      const publisher = process.env.PUBLISHER_ADDRESS;
      const items = await sdk.streams.getByKey(schemaId, publisher as any, phoneHash);
      console.log('Registration data (raw/decoded):', items);

      // parse decoded items if necessary (depending on SDK output)
      // Now chatbot can map the contact phoneHash -> wallet address and store in its own DB/cache
    }
  } as any);
}

start().catch(console.error);
