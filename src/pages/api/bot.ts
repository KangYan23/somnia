// src/pages/api/bot.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { normalizePhone, hashPhone } from '../../lib/phone';
import { createTransferIntent } from '../../scripts/create-transfer-intent';
import { confirmTransfer } from '../../scripts/confirm-transfer';
import { sdk, publicClient } from '../../lib/somnia';
import { parseEther } from 'viem';
import { randomBytes } from 'crypto';
import type { ExpectedEventData } from '../../types/events';

/** Wait for a transaction to be mined before sending the next one. */
async function waitForTransactionReceipt(txHash: `0x${string}`): Promise<void> {
  try {
    await publicClient.waitForTransactionReceipt({ hash: txHash });
  } catch (err) {
    console.warn('Failed to wait for transaction receipt:', err);
  }
}

/**
 * Verify event was emitted correctly via WebSocket subscription
 */
async function verifyEventEmission(
  eventType: 'TransferIntentCreated' | 'TransferConfirmed',
  expected: ExpectedEventData
): Promise<{ verified: boolean; reason?: string }> {
  try {
    // Use internal API call - in Next.js API routes, we can call the handler directly
    // or use localhost for same-server calls
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    
    const response = await fetch(`${baseUrl}/api/verify-events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventType,
        expected,
        timeout: 20000
      })
    });

    if (!response.ok) {
      console.warn(`[${eventType}] Verification request failed:`, response.status);
      return { verified: false, reason: 'request_failed' };
    }

    const result = await response.json();
    return { verified: result.verified, reason: result.reason };
  } catch (err) {
    console.error(`[${eventType}] Verification error:`, err);
    return { verified: false, reason: 'error' };
  }
}

interface ParsedTransferCommand {
  amount: string;
  recipientPhone: string;
}

/**
 * Parse user message using OpenAI to extract transfer details
 * All transfers use SOMI token
 */
async function parseTransferMessage(message: string): Promise<ParsedTransferCommand | null> {
  const apiKey = process.env.OPENAI_API_KEY;

  // If OpenAI API key not configured, fall back to regex parsing
  if (!apiKey) {
    return fallbackParseMessage(message);
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        temperature: 0,
        messages: [
          {
            role: 'system',
            content:
              'You are a Somnia blockchain assistant. Extract transfer instructions from user messages. ' +
              'Always assume the token is SOMI unless specified. Respond strictly in JSON with keys "amount" and "recipientPhone". '
          },
          {
            role: 'user',
            content: message
          }
        ]
      })
    });

    if (!response.ok) {
      console.error('OpenAI API error:', response.status, await response.text());
      return fallbackParseMessage(message);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
      return fallbackParseMessage(message);
    }

    const parsed = JSON.parse(content.trim());
    if (!parsed.amount || !parsed.recipientPhone) {
      return fallbackParseMessage(message);
    }

    return {
      amount: String(parsed.amount),
      recipientPhone: String(parsed.recipientPhone)
    };
  } catch (err) {
    console.error('OpenAI parsing failed:', err);
    return fallbackParseMessage(message);
  }
}

/**
 * Fallback regex parser when OpenAI is unavailable
 */
function fallbackParseMessage(message: string): ParsedTransferCommand | null {
  const lower = message.toLowerCase();
  const amountMatch = lower.match(/(?:send|transfer)\s+(\d+(?:\.\d+)?)/);
  const phoneMatch = message.match(/(\+?[\d\s\-()]{5,})/);

  if (!amountMatch || !phoneMatch) {
    return null;
  }

  return {
    amount: amountMatch[1],
    recipientPhone: phoneMatch[1].replace(/[\s\-()]/g, '')
  };
}

/**
 * Query wallet address by phone number
 */
async function getWalletByPhone(phone: string): Promise<string | null> {
  try {
    const normalized = normalizePhone(phone);
    const phoneHash = hashPhone(normalized);

    const schemaId = await sdk.streams.idToSchemaId('userRegistration');
    if (!schemaId || schemaId === '0x' + '0'.repeat(64)) {
      return null;
    }

    const publisherAddress = process.env.PUBLISHER_ADDRESS || process.env.WALLET_ADDRESS;
    if (!publisherAddress) {
      return null;
    }

    const results = await sdk.streams.getByKey(
      schemaId as `0x${string}`,
      publisherAddress as `0x${string}`,
      phoneHash as `0x${string}`
    );

    if (!results || results.length === 0) {
      return null;
    }

    // Extract wallet address from first result
    const firstResult = results[0];

    console.log('Raw result from getByKey:', firstResult);
    console.log('Type of firstResult:', typeof firstResult);
    console.log('Is Array:', Array.isArray(firstResult));

    if (Array.isArray(firstResult) && firstResult.length >= 2) {
      const walletField = firstResult[1];

      console.log('walletField:', walletField);
      console.log('Type of walletField:', typeof walletField);

      const extractValue = (value: unknown): string | null => {
        if (!value) return null;
        if (typeof value === 'string') return value;
        if (typeof value === 'object') {
          const obj = value as Record<string, unknown>;
          if ('value' in obj) return extractValue(obj.value);
          if ('address' in obj) return extractValue(obj.address);
          if ('wallet' in obj) return extractValue(obj.wallet);
        }
        return null;
      };

      const extracted = extractValue(walletField);
      if (extracted) {
        console.log('✅ Extracted wallet address:', extracted);
        return extracted;
      }

      console.error('❌ Unknown object structure.');
      const walletRecord = walletField as unknown as Record<string, unknown>;
      console.error('Keys:', Object.keys(walletRecord));
      console.error('Entries:', Object.entries(walletRecord));
      console.error('Full object:', walletField);
    }

    if (typeof firstResult === 'string') {
      console.log('✅ Result is string:', firstResult);
      return firstResult;
    }

    console.error('❌ Could not extract wallet from result');
    return null;
  } catch (err) {
    console.error('Error querying wallet by phone:', err);
    return null;
  }
}

/**
 * Handle bot message and emit BOTH event streams for testing
 * Flow: Parse message → Emit TransferIntentCreated → Simulate TX → Emit TransferConfirmed
 */
export async function handleBotMessage(
  message: string,
  senderPhone: string
): Promise<{ 
  reply: string; 
  eventsEmitted?: boolean; 
  transferData?: any;
  verificationStatus?: {
    intentCreated: { verified: boolean; reason?: string } | null;
    transferConfirmed: { verified: boolean; reason?: string } | null;
    allVerified: boolean;
  };
}> {
  try {
    const parsed = await parseTransferMessage(message);

    if (!parsed) {
      return {
        reply: "I couldn't understand that. Try: 'send 0.05 SOMI to 01110851129' or 'send 10 to +60123456789'",
        eventsEmitted: false
      };
    }

    const { amount, recipientPhone } = parsed;
    const token = 'SOMI';

    const senderNormalized = normalizePhone(senderPhone);
    const senderPhoneHash = hashPhone(senderNormalized);

    const recipientNormalized = normalizePhone(recipientPhone);
    const recipientPhoneHash = hashPhone(recipientNormalized);

    const senderWallet = await getWalletByPhone(senderPhone);
    if (!senderWallet) {
      return {
        reply: `Your phone number ${senderNormalized} is not registered. Please register first at the home page.`,
        eventsEmitted: false
      };
    }

    const recipientWallet = await getWalletByPhone(recipientPhone);
    if (!recipientWallet) {
      return {
        reply: `Recipient ${recipientNormalized} is not registered. They need to register first.`,
        eventsEmitted: false
      };
    }

    let amountBigInt: bigint;
    try {
      amountBigInt = parseEther(amount);
    } catch (err) {
      return {
        reply: `Invalid amount: ${amount}`,
        eventsEmitted: false
      };
    }

    console.log('Sender wallet:', senderWallet);
    console.log('Recipient wallet:', recipientWallet);

    if (typeof senderWallet !== 'string' || typeof recipientWallet !== 'string') {
      throw new Error(`Invalid wallet addresses: sender=${typeof senderWallet}, recipient=${typeof recipientWallet}`);
    }

    // ==========================================
    // STEP 1: Emit TransferIntentCreated Event
    // ==========================================
    console.log('\n🔹 STEP 1: Emitting TransferIntentCreated event...');
    const intent = {
      fromPhoneHash: senderPhoneHash as `0x${string}`,
      toPhoneHash: recipientPhoneHash as `0x${string}`,
      fromPhone: senderNormalized,
      toPhone: recipientNormalized,
      amount: amountBigInt,
      token
    };

    // Prepare expected data for verification
    const expectedIntent: ExpectedEventData = {
      fromPhoneHash: senderPhoneHash as `0x${string}`,
      toPhoneHash: recipientPhoneHash as `0x${string}`,
      fromPhone: senderNormalized,
      toPhone: recipientNormalized,
      amount: amountBigInt.toString(),
      token
    };

    // Start verification subscription FIRST
    console.log('🔍 Starting verification subscription for TransferIntentCreated...');
    const verificationPromise = verifyEventEmission('TransferIntentCreated', expectedIntent);

    // THEN emit the event
    let intentTxHash: string | null = null;
    let intentVerificationResult: { verified: boolean; reason?: string } | null = null;
    
    const intentTx = await createTransferIntent(intent);
    if (typeof intentTx === 'string') {
      intentTxHash = intentTx;
      console.log('✅ TransferIntentCreated event emitted!');
      console.log('   Event data: from', senderNormalized, 'to', recipientNormalized);
      console.log('   Transaction:', intentTx);
      await waitForTransactionReceipt(intentTx as `0x${string}`);
      
      // Wait for verification result
      intentVerificationResult = await verificationPromise;
      console.log(`🔍 Verification result: ${intentVerificationResult.verified ? '✅ VERIFIED' : '❌ FAILED'} (${intentVerificationResult.reason || 'unknown'})`);
    } else if (intentTx instanceof Error) {
      throw intentTx;
    } else {
      throw new Error('Failed to emit TransferIntentCreated event');
    }

    // ==========================================
    // STEP 2: Simulate Token Transfer (for testing)
    // ==========================================
    console.log('\n🔹 STEP 2: Simulating token transfer...');
    const fakeTxHash = `0x${randomBytes(32).toString('hex')}`;
    console.log('   Simulated TX Hash:', fakeTxHash);

    // ==========================================
    // STEP 3: Emit TransferConfirmed Event
    // ==========================================
    console.log('\n🔹 STEP 3: Emitting TransferConfirmed event...');

    // Prepare expected data for verification
    const expectedConfirm: ExpectedEventData = {
      fromPhoneHash: senderPhoneHash as `0x${string}`,
      toPhoneHash: recipientPhoneHash as `0x${string}`,
      fromPhone: senderNormalized,
      toPhone: recipientNormalized,
      amount: amountBigInt.toString(),
      token,
      txHash: fakeTxHash as `0x${string}`
    };

    // Start verification subscription FIRST
    console.log('🔍 Starting verification subscription for TransferConfirmed...');
    const confirmVerificationPromise = verifyEventEmission('TransferConfirmed', expectedConfirm);

    // THEN emit the event
    let confirmTxHash: string | null = null;
    let confirmVerificationResult: { verified: boolean; reason?: string } | null = null;
    
    const confirmTx = await confirmTransfer({
      fromPhoneHash: senderPhoneHash as `0x${string}`,
      toPhoneHash: recipientPhoneHash as `0x${string}`,
      fromPhone: senderNormalized,
      toPhone: recipientNormalized,
      amount: amountBigInt,
      token,
      txHash: fakeTxHash as `0x${string}`
    });
    if (typeof confirmTx === 'string') {
      confirmTxHash = confirmTx;
      console.log('✅ TransferConfirmed event emitted!');
      console.log('   Event data: from', senderNormalized, 'to', recipientNormalized);
      console.log('   Transaction:', confirmTx);
      await waitForTransactionReceipt(confirmTx as `0x${string}`);
      
      // Wait for verification result
      confirmVerificationResult = await confirmVerificationPromise;
      console.log(`🔍 Verification result: ${confirmVerificationResult.verified ? '✅ VERIFIED' : '❌ FAILED'} (${confirmVerificationResult.reason || 'unknown'})`);
    } else if (confirmTx instanceof Error) {
      throw confirmTx;
    } else {
      throw new Error('Failed to emit TransferConfirmed event');
    }

    // Determine overall status
    const bothEventsEmitted = intentTxHash !== null && confirmTxHash !== null;
    const bothVerified = intentVerificationResult?.verified === true && confirmVerificationResult?.verified === true;

    // Build status messages
    const intentStatus = intentVerificationResult?.verified 
      ? '✅ TransferIntentCreated (VERIFIED)' 
      : `⚠️ TransferIntentCreated (${intentVerificationResult?.reason || 'NOT VERIFIED'})`;
    
    const confirmStatus = confirmVerificationResult?.verified 
      ? '✅ TransferConfirmed (VERIFIED)' 
      : `⚠️ TransferConfirmed (${confirmVerificationResult?.reason || 'NOT VERIFIED'})`;

    console.log(`\n${bothVerified ? '🎉' : '⚠️'} EVENT STREAMS ${bothEventsEmitted ? 'EMITTED' : 'FAILED'} - VERIFICATION: ${bothVerified ? 'SUCCESS' : 'FAILED'}\n`);

    return {
      reply: `${bothVerified ? '✅' : '⚠️'} EVENT STREAMS ${bothEventsEmitted ? 'EMITTED' : 'FAILED'}!\n\n💸 Amount: ${amount} ${token}\n📱 From: ${senderNormalized}\n📱 To: ${recipientNormalized}\n\n📡 EVENTS:\n1. ${intentStatus}\n2. ${confirmStatus}\n\n🔗 Simulated TX: ${fakeTxHash.slice(0, 10)}...${fakeTxHash.slice(-8)}\n\n${bothVerified ? '✅ Both events verified via WebSocket subscription!' : '⚠️ Verification failed - events emitted but not confirmed via subscription'}`,
      eventsEmitted: bothEventsEmitted,
      verificationStatus: {
        intentCreated: intentVerificationResult,
        transferConfirmed: confirmVerificationResult,
        allVerified: bothVerified
      },
      transferData: {
        from: senderWallet,
        to: recipientWallet,
        amount,
        amountWei: amountBigInt.toString(),
        token,
        fromPhone: senderNormalized,
        toPhone: recipientNormalized,
        txHash: fakeTxHash,
        intentTxHash,
        confirmTxHash
      }
    };
  } catch (err: any) {
    console.error('Bot message handling error:', err);
    return {
      reply: `❌ Error: ${err.message || 'Failed to process your request'}`,
      eventsEmitted: false
    };
  }
}

/**
 * API endpoint for bot messages
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { message, senderPhone } = req.body;

    if (!message || !senderPhone) {
      return res.status(400).json({
        error: 'message and senderPhone are required',
        botReply: 'Please provide both a message and your phone number.',
        eventsEmitted: false
      });
    }

    const result = await handleBotMessage(message, senderPhone);

    return res.json({
      success: true,
      userMessage: message,
      botReply: result.reply,
      eventsEmitted: result.eventsEmitted,
      transferData: result.transferData
    });
  } catch (err: any) {
    console.error('Bot API error:', err);
    return res.status(500).json({
      error: err.message || 'Internal server error',
      botReply: '❌ Sorry, something went wrong. Please try again.',
      eventsEmitted: false
    });
  }
}
