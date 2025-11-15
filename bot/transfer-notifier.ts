// bot/transfer-notifier.ts
/**
 * Transfer Notification Subscriber
 * 
 * Subscribes to both TransferIntentCreated and TransferConfirmed events:
 * - TransferIntentCreated: Notifies recipient about incoming transfer
 * - TransferConfirmed: Notifies both sender and receiver about completed transfer
 */

import { SDK } from '@somnia-chain/streams';
import { createPublicWsClient } from '../src/lib/somnia';
import { decodeTransferConfirmed, decodeTransferIntentCreated, extractPhoneHashesFromTopics } from '../src/utils/event-decoder';
import { normalizePhone, addCountryCodeForWhatsApp } from '../src/lib/phone';
import { formatAmount } from '../src/lib/transaction';
import axios from 'axios';
import dotenv from 'dotenv';
import { createPublicClient, webSocket } from 'viem';
import { buildSomniaChainWithWs } from '../src/lib/somniaChain';

dotenv.config();

// Create WebSocket client for real-time event subscriptions
let RPC_WS_URL = process.env.RPC_WS_URL;
let wsPublicClient;
let somniaChainWithWs;

if (RPC_WS_URL) {
  // Fix WebSocket URL format: convert https:// to wss:// or http:// to ws://
  if (RPC_WS_URL.startsWith('https://')) {
    RPC_WS_URL = RPC_WS_URL.replace('https://', 'wss://');
    console.log('🔧 Converted HTTPS to WSS for WebSocket connection');
  } else if (RPC_WS_URL.startsWith('http://')) {
    RPC_WS_URL = RPC_WS_URL.replace('http://', 'ws://');
    console.log('🔧 Converted HTTP to WS for WebSocket connection');
  }
  
  // Make sure corrected URL is in environment for SDK's internal client
  process.env.RPC_WS_URL = RPC_WS_URL;
  
  try {
    somniaChainWithWs = buildSomniaChainWithWs(RPC_WS_URL);
    wsPublicClient = createPublicClient({ 
      chain: somniaChainWithWs, 
      transport: webSocket(RPC_WS_URL as `wss://${string}` | `ws://${string}`) 
    });
    console.log('✅ WebSocket client created for event subscriptions');
  } catch (error: any) {
    console.warn('⚠️ Failed to create WebSocket client:', error.message);
    console.warn('   Falling back to HTTP (may not receive real-time events)');
    // Fallback to HTTP if WebSocket fails
    const { publicClient } = require('../src/lib/somnia');
    wsPublicClient = publicClient;
  }
} else {
  console.warn('⚠️ RPC_WS_URL not set - using HTTP client (may not receive real-time events)');
  const { publicClient } = require('../src/lib/somnia');
  wsPublicClient = publicClient;
}

const sdk = new SDK({ public: wsPublicClient as any });

const WHATSAPP_TOKEN = 'EAAL0CDf89vYBP8JNEJZAArRmTvHIGyN2ZAlxHCQjtfy1yMnlfHsvcHYTEZBi0ZAHEv0WPDMwxikZAZCMasdrBb4LFDoZA9h2ImjGGncI42CNPbe8OINsjFywqfhsJ9NmRAy4qWyB7GzE99jOs39HfNX8nr2jeDWZBjduTvnVryTnj17q6YoY685octDSv23dXTuMZAvE3FMZBkqZCMtn3Un1dL0tUqaZBZBebeFPZBi68eqZA74hecVUGQZD';
const PHONE_NUMBER_ID = '879313071929309';

// Blockchain explorer URL for transaction links (Somnia Testnet - Shannon)
const EXPLORER_URL = process.env.BLOCKCHAIN_EXPLORER_URL || 'https://shannon-explorer.somnia.network';

/**
 * Get transaction explorer link
 */
function getTxLink(txHash: string): string {
  return `${EXPLORER_URL}/tx/${txHash}`;
}

/**
 * Send WhatsApp message to recipient
 */
async function sendWhatsAppMessage(to: string, message: string): Promise<boolean> {
  if (!WHATSAPP_TOKEN || !PHONE_NUMBER_ID) {
    console.warn('⚠️ WhatsApp credentials not configured. Cannot send notification.');
    return false;
  }

  try {
    const url = `https://graph.facebook.com/v17.0/${PHONE_NUMBER_ID}/messages`;
    
    // Phone number from data stream is WITHOUT country code (e.g., "01110851129")
    // Add country code ONLY ONCE here for WhatsApp
    // addCountryCodeForWhatsApp will handle it correctly (checks if already has CC)
    const phoneWithCountryCode = addCountryCodeForWhatsApp(to);
    console.log(`   Phone with country code for WhatsApp: ${to} → ${phoneWithCountryCode}`);
    
    // WhatsApp API expects phone number with + prefix (international format)
    // Keep the + sign and remove only spaces, but keep all digits and +
    const phoneNumber = phoneWithCountryCode.replace(/[^0-9+]/g, '');
    console.log(`   Phone number for WhatsApp API: ${phoneNumber}`);
    
    const payload = {
      messaging_product: 'whatsapp',
      to: phoneNumber,
      text: { body: message }
    };

    await axios.post(url, payload, {
      headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` }
    });

    console.log(`✅ WhatsApp notification sent to ${to}`);
    return true;
  } catch (error: any) {
    console.error(`❌ Failed to send WhatsApp notification to ${to}:`, error.response?.data || error.message);
    return false;
  }
}


/**
 * Subscribe to TransferIntentCreated events (no notification sent, just for logging)
 */
async function subscribeToTransferIntent() {
  console.log('📡 Subscribing to TransferIntentCreated events...');
  
  try {
    await sdk.streams.subscribe({
      somniaStreamsEventId: 'TransferIntentCreated',
      ethCalls: [],
      onlyPushChanges: false,
      onData: async (payload: any) => {
        try {
          console.log('\n🔔 TransferIntentCreated event received!');
          const eventResult = payload?.result || payload;
          const topics = eventResult?.topics || [];
          
          if (topics.length < 3) {
            console.warn('⚠️ Invalid topics array');
            return;
          }
          
          const phoneHashes = extractPhoneHashesFromTopics(topics);
          if (!phoneHashes) return;

          const decoded = decodeTransferIntentCreated(eventResult?.data);
          console.log(`   Transfer intent: ${decoded.amount} ${decoded.token} from ${decoded.fromPhone} to ${decoded.toPhone}`);
        } catch (error: any) {
          console.error('❌ Error processing TransferIntentCreated:', error.message);
        }
      }
    } as any);
    
    console.log('✅ TransferIntentCreated subscriber started');
  } catch (error: any) {
    console.error('❌ Failed to start TransferIntentCreated subscriber:', error.message);
  }
}

/**
 * Subscribe to TransferConfirmed events (notify both sender and receiver)
 */
async function subscribeToTransferConfirmed() {
  console.log('📡 Subscribing to TransferConfirmed events...');
  
  try {
    await sdk.streams.subscribe({
      somniaStreamsEventId: 'TransferConfirmed',
      ethCalls: [],
      onlyPushChanges: false,
      onData: async (payload: any) => {
        try {
          console.log('\n🔔 TransferConfirmed event received!');
          const eventResult = payload?.result || payload;
          const topics = eventResult?.topics || [];
          
          if (topics.length < 3) {
            console.warn('⚠️ Invalid topics array');
            return;
          }
          
          const phoneHashes = extractPhoneHashesFromTopics(topics);
          if (!phoneHashes) return;

          const { fromPhoneHash, toPhoneHash } = phoneHashes;
          const decoded = decodeTransferConfirmed(eventResult?.data);
          
          const recipientPhone = decoded.toPhone.trim();
          const senderPhone = decoded.fromPhone?.trim() || '';
          const amountFormatted = formatAmount(decoded.amount, decoded.token);
          const txLink = getTxLink(decoded.txHash);
          
          // Notify recipient
          if (recipientPhone) {
            const recipientMessage = 
              `💰 *Transfer Received!*\n\n` +
              `📥 Amount: *${amountFormatted}* ${decoded.token}\n` +
              `📱 From: ${senderPhone || 'Unknown'}\n` +
              `🔗 View transaction: ${txLink}\n\n` ;
            
            await sendWhatsAppMessage(recipientPhone, recipientMessage);
            console.log(`✅ Recipient ${recipientPhone} notified`);
          }
          
          // Notify sender (if sender phone is available)
          if (senderPhone && fromPhoneHash !== '0x' + '0'.repeat(64)) {
            const senderMessage = 
              `✅ *Transfer Sent!*\n\n` +
              `📤 Amount: *${amountFormatted}* ${decoded.token}\n` +
              `📱 To: ${recipientPhone}\n` +
              `🔗 View transaction: ${txLink}\n\n`;
            
            await sendWhatsAppMessage(senderPhone, senderMessage);
            console.log(`✅ Sender ${senderPhone} notified`);
          }
        } catch (error: any) {
          console.error('❌ Error processing TransferConfirmed:', error.message);
        }
      }
    } as any);
    
    console.log('✅ TransferConfirmed subscriber started');
  } catch (error: any) {
    console.error('❌ Failed to start TransferConfirmed subscriber:', error.message);
  }
}

/**
 * Start subscribing to both transfer events
 */
export async function startTransferNotifier() {
  if (!WHATSAPP_TOKEN || !PHONE_NUMBER_ID) {
    console.warn('⚠️ WhatsApp credentials not configured. Transfer notifications disabled.');
    console.warn('   Set WHATSAPP_TOKEN and PHONE_NUMBER_ID in .env to enable notifications.');
    return;
  }

  console.log('📡 Starting transfer event subscribers...');
  console.log('   Listening for TransferIntentCreated and TransferConfirmed events...\n');

  // Subscribe to both events
  await Promise.all([
    subscribeToTransferIntent(),
    subscribeToTransferConfirmed()
  ]);

  console.log('\n✅ All transfer subscribers started successfully');
  console.log('   Waiting for transfer events...\n');
  console.log('   💡 Make sure this service stays running to receive notifications!');
}

// Start the notifier if this file is run directly
if (require.main === module) {
  startTransferNotifier().catch(console.error);
}

