// bot/subscriber.ts
/**
 * Event Subscriber Service
 * 
 * Subscribes to various Somnia events and handles them accordingly.
 * Currently subscribes to:
 * - UserRegistrationBroadcast: For user registration events
 * - TransferConfirmed: For transfer notifications (handled by transfer-notifier.ts)
 */

import { SDK } from '@somnia-chain/streams';
import { createPublicClient, webSocket, decodeAbiParameters } from 'viem';
import { startTransferNotifier } from './transfer-notifier';
import dotenv from 'dotenv';
import { buildSomniaChainWithWs } from '../src/lib/somniaChain';
import fs from 'fs';
import path from 'path';
import { sendWhatsAppMessage } from './whatsapp';

dotenv.config();

// Create WebSocket client for real-time event subscriptions
let RPC_WS_URL = process.env.RPC_WS_URL;

if (!RPC_WS_URL) {
  console.error('❌ RPC_WS_URL is required for event subscriptions!');
  console.error('   Please set RPC_WS_URL in your .env file');
  throw new Error('RPC_WS_URL is required');
}

// Fix WebSocket URL format: convert https:// to wss:// or http:// to ws://
if (RPC_WS_URL.startsWith('https://')) {
  RPC_WS_URL = RPC_WS_URL.replace('https://', 'wss://');
  console.log('🔧 Converted HTTPS to WSS for WebSocket connection');
} else if (RPC_WS_URL.startsWith('http://')) {
  RPC_WS_URL = RPC_WS_URL.replace('http://', 'ws://');
  console.log('🔧 Converted HTTP to WS for WebSocket connection');
} else if (!RPC_WS_URL.startsWith('wss://') && !RPC_WS_URL.startsWith('ws://')) {
  console.warn('⚠️  WebSocket URL should start with wss:// or ws://');
  console.warn('   Attempting to use as-is...');
}

let wsPublicClient;
let somniaChainWithWs;

try {
  somniaChainWithWs = buildSomniaChainWithWs(RPC_WS_URL);
  wsPublicClient = createPublicClient({ 
    chain: somniaChainWithWs, 
    transport: webSocket(RPC_WS_URL as `wss://${string}` | `ws://${string}`) 
  });
  console.log('✅ WebSocket client created for event subscriptions');
  console.log('   WebSocket URL:', RPC_WS_URL.replace(/\/\/.*@/, '//***@')); // Hide credentials in log
} catch (error: any) {
  console.error('❌ Failed to create WebSocket client:', error.message);
  throw error;
}

// Initialize SDK with WebSocket client
console.log('🔧 Initializing SDK with WebSocket client...');

// The SDK requires a client parameter, so we need to pass our WebSocket client
// But since the subscribe() method creates its own client internally, 
// we need to ensure the environment has the right URL when it does that
const sdk = new SDK({ 
  public: wsPublicClient as any
});

// Set environment variables that the SDK's internal client creation will use
process.env.RPC_URL = process.env.RPC_URL || 'https://dream-rpc.somnia.network';
process.env.RPC_WS_URL = RPC_WS_URL;

console.log('✅ SDK initialized with WebSocket client');
console.log('   WebSocket client ready:', wsPublicClient ? '✅' : '❌');
console.log('   Environment variables for SDK internal usage:');
console.log('     RPC_URL =', process.env.RPC_URL);
console.log('     RPC_WS_URL =', process.env.RPC_WS_URL);

export async function startEventSubscribers() {
  console.log('🚀 Starting event subscribers...\n');

  // Subscribe to UserRegistrationBroadcast events
  console.log('📡 Subscribing to UserRegistrationBroadcast...');
  console.log('   Using WebSocket URL:', RPC_WS_URL ? '✅ Set' : '❌ Missing');
  console.log('   Environment RPC_WS_URL:', process.env.RPC_WS_URL ? '✅' : '❌');
  
  try {
    // The SDK's subscribe method creates its own WebSocket client internally
    // It needs the WebSocket URL to be accessible when it creates the client
    // Ensure the URL is in the environment right before subscribe is called
    const originalRpcWsUrl = process.env.RPC_WS_URL;
    process.env.RPC_WS_URL = RPC_WS_URL;
    
    await sdk.streams.subscribe({
      somniaStreamsEventId: 'UserRegistrationBroadcast',
      ethCalls: [], // Optional: empty array means no on-chain calls before onData
      onlyPushChanges: false, // Push all events, not just changes
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
    console.log('✅ UserRegistrationBroadcast subscriber started\n');
  } catch (subscribeError: any) {
    if (subscribeError.message?.includes('No URL was provided to the Transport')) {
      console.error('\n❌ SDK WebSocket Configuration Issue');
      console.error('═══════════════════════════════════════════════════════════');
      console.error('The SDK\'s subscribe() method is trying to create its own');
      console.error('WebSocket client but cannot find the URL.');
      console.error('');
      console.error('This appears to be a limitation in @somnia-chain/streams v0.9.5');
      console.error('');
      console.error('Possible solutions:');
      console.error('1. Update @somnia-chain/streams to latest version');
      console.error('2. Check SDK documentation for WebSocket configuration');
      console.error('3. Contact Somnia SDK support with this error');
      console.error('4. Use HTTP polling as temporary workaround');
      console.error('');
      console.error('Current configuration:');
      console.error('  - WebSocket URL:', RPC_WS_URL);
      console.error('  - Environment RPC_WS_URL:', process.env.RPC_WS_URL || 'NOT SET');
      console.error('  - SDK Version: 0.9.5');
      console.error('═══════════════════════════════════════════════════════════\n');
    } else {
      console.error('❌ Failed to subscribe to UserRegistrationBroadcast:', subscribeError.message);
    }
    // Don't throw - allow transfer notifier to start even if this fails
    console.warn('⚠️  Continuing without UserRegistrationBroadcast subscription...\n');
  }

  // Subscribe to PriceAlert events
  console.log('📡 Subscribing to PriceAlert...');
  try {
    await sdk.streams.subscribe({
      somniaStreamsEventId: 'PriceAlert',
      ethCalls: [],
      onlyPushChanges: false,
      onData: async (payload: any) => {
        console.log('🚨 Price Alert Event Received:', JSON.stringify(payload, null, 2));
        
        // Extract phoneHash from topics (it's the first topic)
        const phoneHash = payload?.result?.topics?.[1] || payload?.topics?.[0];
        
        if (!phoneHash) {
          console.warn('⚠️ PriceAlert received but no phoneHash found in topics');
          return;
        }

        console.log(`📱 Alert for phoneHash: ${phoneHash}`);

        // Look up phone number
        const userMapPath = path.join(process.cwd(), 'data', 'user-map.json');
        if (fs.existsSync(userMapPath)) {
          const userMap = JSON.parse(fs.readFileSync(userMapPath, 'utf-8'));
          const phoneNumber = userMap[phoneHash];

          if (phoneNumber) {
            console.log(`✅ Found phone number for hash: ${phoneNumber}`);
            
            // Decode event data to get details
            // data: currentPrice, minPrice, maxPrice, tokenSymbol
            try {
              const dataHex = payload?.result?.data || payload?.data;
              if (dataHex) {
                const decoded = decodeAbiParameters(
                  [
                    { type: "uint256", name: "currentPrice" },
                    { type: "uint256", name: "minPrice" },
                    { type: "uint256", name: "maxPrice" },
                    { type: "string", name: "tokenSymbol" }
                  ],
                  dataHex
                );
                
                const currentPrice = Number(decoded[0]) / 1e18;
                const minPrice = Number(decoded[1]) / 1e18;
                const maxPrice = Number(decoded[2]) / 1e18;
                const tokenSymbol = decoded[3];

                let msg = `🚨 *PRICE ALERT: ${tokenSymbol}*\n\n`;
                msg += `💰 Current Price: $${currentPrice.toFixed(4)}\n`;
                
                if (currentPrice < minPrice) {
                  msg += `📉 Price dropped below your threshold of $${minPrice.toFixed(4)}`;
                } else if (currentPrice > maxPrice) {
                  msg += `📈 Price rose above your threshold of $${maxPrice.toFixed(4)}`;
                } else {
                  msg += `⚠️ Price is outside range $${minPrice.toFixed(4)} - $${maxPrice.toFixed(4)}`;
                }

                await sendWhatsAppMessage(phoneNumber, msg);
              } else {
                await sendWhatsAppMessage(phoneNumber, `🚨 Price Alert triggered for your account! Check the market.`);
              }
            } catch (decodeError) {
              console.error('❌ Error decoding price alert data:', decodeError);
              await sendWhatsAppMessage(phoneNumber, `🚨 Price Alert triggered! (Error decoding details)`);
            }
          } else {
            console.warn(`⚠️ No phone number found for hash ${phoneHash}`);
          }
        } else {
          console.warn('⚠️ User map file not found');
        }
      }
    } as any);
    console.log('✅ PriceAlert subscriber started\n');
  } catch (error: any) {
    console.error('❌ Failed to subscribe to PriceAlert:', error.message);
  }

  // Start transfer notification subscriber
  await startTransferNotifier();
}

// Allow running subscriber.ts directly for standalone mode
if (require.main === module) {
  startEventSubscribers().catch(console.error);
}
