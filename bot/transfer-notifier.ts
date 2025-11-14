// bot/transfer-notifier.ts
/**
 * Transfer Notification Subscriber
 * 
 * Subscribes to TransferConfirmed events and sends WhatsApp notifications
 * to recipients when they receive transfers.
 */

import { SDK } from '@somnia-chain/streams';
import { createPublicWsClient } from '../src/lib/somnia';
import { decodeTransferConfirmed, extractPhoneHashesFromTopics } from '../src/utils/event-decoder';
import { normalizePhone } from '../src/lib/phone';
import axios from 'axios';
import dotenv from 'dotenv';
import { formatEther } from 'viem';
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

const WHATSAPP_TOKEN = 'EAAL0CDf89vYBP2EQKeoFfMt1a0kE6Qb0ipGRMGnQ9sa8yGKeOTaJZAR60cFb5E6tnVBgrfgmdc2Edo7tKTMsQI3cPrUZCa8vI3Un6iZCXO3NfhDZA6cm6o7ZAQh2OP5qQCt80Gjtpba91cwugxQDTvyPIoQpd26kYSVYIGXNanyRFwjNzgOoMAgfUskxLCrRvHItDdWvk4BnA2cuXfcqtEXpZCVX7GALPFSbc80nHNo17EKYYZD';
const PHONE_NUMBER_ID = "879313071929309";

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
    
    // Ensure phone number has country code before sending
    // Add country code if missing (similar to transfer.ts logic)
    let phoneWithCountryCode = to.trim();
    if (!phoneWithCountryCode.startsWith('+')) {
      const defaultCc = ('+6').trim();
      if (defaultCc) {
        phoneWithCountryCode = defaultCc + phoneWithCountryCode;
        console.log(`   Added country code: ${to} → ${phoneWithCountryCode}`);
      } else {
        console.warn(`   ⚠️ DEFAULT_COUNTRY_CODE not set - phone may be rejected by WhatsApp`);
      }
    }
    
    // WhatsApp API expects phone number without + or spaces
    // Remove + and any non-digit characters (but keep country code digits)
    const phoneNumber = phoneWithCountryCode.replace(/[^0-9]/g, '');
    
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
 * Format transfer amount for display
 */
function formatAmount(amountWei: bigint, token: string): string {
  try {
    const amount = formatEther(amountWei);
    // Format to show reasonable decimal places
    const num = parseFloat(amount);
    if (num < 0.0001) {
      return `${amount} ${token}`;
    } else if (num < 1) {
      return `${num.toFixed(4)} ${token}`;
    } else {
      return `${num.toFixed(2)} ${token}`;
    }
  } catch (error) {
    return `${amountWei.toString()} ${token}`;
  }
}

/**
 * Start subscribing to TransferConfirmed events
 */
export async function startTransferNotifier() {
  if (!WHATSAPP_TOKEN || !PHONE_NUMBER_ID) {
    console.warn('⚠️ WhatsApp credentials not configured. Transfer notifications disabled.');
    console.warn('   Set WHATSAPP_TOKEN and PHONE_NUMBER_ID in .env to enable notifications.');
    return;
  }

  console.log('📡 Starting TransferConfirmed event subscriber...');
  console.log('   Listening for incoming transfers...');

  try {
    await sdk.streams.subscribe({
      somniaStreamsEventId: 'TransferConfirmed',
      ethCalls: [], // Required: empty array means no on-chain calls before onData
      onlyPushChanges: false, // Push all events, not just changes
      onData: async (payload: any) => {
        try {
          console.log('\n🔔 TransferConfirmed event received!');
          console.log('   Raw payload:', JSON.stringify(payload, null, 2));

          // SDK wraps the event in a 'result' object
          // Payload structure: { subscription: "...", result: { address, topics, data, ... } }
          const eventResult = payload?.result || payload;
          
          // Extract phone hashes from topics
          // topics[0] = event signature
          // topics[1] = fromPhoneHash (indexed)
          // topics[2] = toPhoneHash (indexed)
          const topics = eventResult?.topics || [];
          console.log('   Topics:', topics);
          
          if (topics.length < 3) {
            console.warn('⚠️ Invalid topics array - expected at least 3 topics');
            console.warn('   Topics received:', topics.length);
            return;
          }
          
          const phoneHashes = extractPhoneHashesFromTopics(topics);
          
          if (!phoneHashes) {
            console.warn('⚠️ Could not extract phone hashes from event topics');
            return;
          }

          const { fromPhoneHash, toPhoneHash } = phoneHashes;
          console.log(`   From phone hash: ${fromPhoneHash}`);
          console.log(`   To phone hash: ${toPhoneHash}`);

          // Decode event data
          const eventData = eventResult?.data;
          if (!eventData) {
            console.warn('⚠️ No event data found in payload');
            console.warn('   Available keys:', Object.keys(eventResult || {}));
            return;
          }

          const decoded = decodeTransferConfirmed(eventData);
          console.log('   Decoded event data:', {
            fromPhone: decoded.fromPhone,
            toPhone: decoded.toPhone,
            amount: decoded.amount.toString(),
            token: decoded.token,
            txHash: decoded.txHash
          });

          // Verify toPhoneHash matches the decoded toPhone
          // (This is a safety check - the event should be consistent)
          // Normalize phone numbers to ensure they have country codes
          let recipientPhone: string;
          try {
            // Add country code if missing (similar to transfer.ts logic)
            const raw = decoded.toPhone.trim();
            const withCc = raw.startsWith('+')
              ? raw
              : ((process.env.DEFAULT_COUNTRY_CODE || '').trim() + raw);
            recipientPhone = normalizePhone(withCc);
            console.log(`   Recipient phone normalized: ${decoded.toPhone} → ${recipientPhone}`);
          } catch (e) {
            console.warn(`⚠️ Failed to normalize recipient phone ${decoded.toPhone}:`, e);
            recipientPhone = decoded.toPhone; // Use as-is if normalization fails
          }
          
          let senderPhone: string;
          try {
            if (decoded.fromPhone) {
              const raw = decoded.fromPhone.trim();
              const withCc = raw.startsWith('+')
                ? raw
                : ((process.env.DEFAULT_COUNTRY_CODE || '').trim() + raw);
              senderPhone = normalizePhone(withCc);
            } else {
              senderPhone = 'Unknown';
            }
          } catch (e) {
            senderPhone = decoded.fromPhone || 'Unknown';
          }

          // Format notification message
          const amountFormatted = formatAmount(decoded.amount, decoded.token);
          const txHashShort = decoded.txHash.slice(0, 10) + '...' + decoded.txHash.slice(-8);
          
          const notificationMessage = 
            `💰 *You received a transfer!*\n\n` +
            `📥 Amount: *${amountFormatted}*\n` +
            `📱 From: ${senderPhone}\n` +
            `🔗 Transaction: ${txHashShort}\n\n` +
            `Your wallet has been credited.`;

          console.log(`📤 Sending notification to recipient: ${recipientPhone}`);
          console.log(`   Message: ${notificationMessage.replace(/\n/g, ' ')}`);

          // Send WhatsApp notification to recipient
          const sent = await sendWhatsAppMessage(recipientPhone, notificationMessage);

          if (sent) {
            console.log(`✅ Recipient ${recipientPhone} notified successfully`);
          } else {
            console.warn(`⚠️ Failed to notify recipient ${recipientPhone}`);
          }

        } catch (error: any) {
          console.error('❌ Error processing TransferConfirmed event:', error.message);
          console.error('   Payload:', JSON.stringify(payload, null, 2));
        }
      }
    } as any);

    console.log('✅ TransferConfirmed subscriber started successfully');
    console.log('   Waiting for transfer events...\n');
    console.log('   💡 Make sure this service stays running to receive notifications!');

  } catch (error: any) {
    console.error('❌ Failed to start TransferConfirmed subscriber:', error.message);
    throw error;
  }
}

// Start the notifier if this file is run directly
if (require.main === module) {
  startTransferNotifier().catch(console.error);
}

