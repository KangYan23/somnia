// src/pages/api/verify-events.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { wsSdk } from '../../lib/somnia';
import { decodeTransferIntentCreated, decodeTransferConfirmed, extractPhoneHashesFromTopics } from '../../utils/event-decoder';
import type { VerificationRequest, VerificationResult, ExpectedEventData, ReceivedEventData } from '../../types/events';

/**
 * Compare received event with expected values
 */
function compareEvents(
  received: ReceivedEventData,
  expected: ExpectedEventData,
  phoneHashesMatch: boolean
): { matches: boolean; details: VerificationResult['matchDetails'] } {
  const expectedAmount = BigInt(expected.amount);
  const amountMatch = received.amount === expectedAmount;
  const tokenMatch = received.token === expected.token;

  let txHashMatch: boolean | undefined;
  if (expected.txHash !== undefined) {
    txHashMatch = received.txHash?.toLowerCase() === expected.txHash.toLowerCase();
  }

  const matches = phoneHashesMatch && amountMatch && tokenMatch && (txHashMatch === undefined || txHashMatch === true);

  return {
    matches,
    details: {
      phoneHashesMatch,
      amountMatch,
      tokenMatch,
      txHashMatch
    }
  };
}

/**
 * Verify a single event by subscribing and waiting for match
 */
async function verifyEvent(
  eventType: 'TransferIntentCreated' | 'TransferConfirmed',
  expected: ExpectedEventData,
  timeout: number = 20000
): Promise<VerificationResult> {
  return new Promise((resolve) => {
    let subscription: { unsubscribe: () => void } | null = null;
    let timeoutId: any = null;
    let resolved = false;

    const cleanup = () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (subscription) {
        try {
          subscription.unsubscribe();
        } catch (err) {
          console.error('Error unsubscribing:', err);
        }
      }
    };

    const resolveOnce = (result: VerificationResult) => {
      if (resolved) return;
      resolved = true;
      cleanup();
      resolve(result);
    };

    try {
      console.log(`[${eventType}] Using WebSocket SDK for subscription...`);

      // Set timeout
      timeoutId = setTimeout(() => {
        console.log(`[${eventType}] Verification timeout after ${timeout}ms`);
        resolveOnce({
          verified: false,
          reason: 'timeout',
          matchDetails: {
            phoneHashesMatch: false,
            amountMatch: false,
            tokenMatch: false
          }
        });
      }, timeout);

      // Subscribe to event
      // According to SDK guide: subscribe() returns Promise<{ subscriptionId: string, unsubscribe: () => void } | undefined>
      console.log(`[${eventType}] Subscribing to event stream...`);
      const subscriptionPromise = wsSdk.streams.subscribe({
        somniaStreamsEventId: eventType, // Required: registered event schema ID
        ethCalls: [], // Optional: empty array means no on-chain calls before onData
        onlyPushChanges: false, // Push all events, not just changes
        onData: async (payload: any) => {
          try {
            console.log(`[${eventType}] Received event payload:`, payload);

            // Extract phone hashes from topics
            const phoneHashes = extractPhoneHashesFromTopics(payload.topics || []);
            if (!phoneHashes) {
              console.warn('Could not extract phone hashes from topics');
              return;
            }

            // Check if phone hashes match
            const phoneHashesMatch =
              phoneHashes.fromPhoneHash.toLowerCase() === expected.fromPhoneHash.toLowerCase() &&
              phoneHashes.toPhoneHash.toLowerCase() === expected.toPhoneHash.toLowerCase();

            if (!phoneHashesMatch) {
              console.log('Phone hashes do not match, ignoring event');
              return;
            }

            // Decode event data
            let receivedEvent: ReceivedEventData;
            if (eventType === 'TransferIntentCreated') {
              receivedEvent = decodeTransferIntentCreated(payload.data);
            } else {
              receivedEvent = decodeTransferConfirmed(payload.data);
            }

            console.log(`[${eventType}] Decoded event:`, receivedEvent);

            // Compare with expected values
            const comparison = compareEvents(receivedEvent, expected, phoneHashesMatch);

            if (comparison.matches) {
              console.log(`[${eventType}] ✅ Event verified!`);
              resolveOnce({
                verified: true,
                receivedEvent: {
                  fromPhone: receivedEvent.fromPhone,
                  toPhone: receivedEvent.toPhone,
                  amount: receivedEvent.amount,
                  token: receivedEvent.token,
                  txHash: receivedEvent.txHash
                },
                matchDetails: comparison.details
              });
            } else {
              console.log(`[${eventType}] ❌ Event data mismatch:`, comparison.details);
              resolveOnce({
                verified: false,
                reason: 'mismatch',
                receivedEvent: {
                  fromPhone: receivedEvent.fromPhone,
                  toPhone: receivedEvent.toPhone,
                  amount: receivedEvent.amount,
                  token: receivedEvent.token,
                  txHash: receivedEvent.txHash
                },
                matchDetails: comparison.details
              });
            }
          } catch (err) {
            console.error(`[${eventType}] Error processing event:`, err);
            // Don't resolve on decode errors, keep waiting
          }
        },
        onError: (error: Error) => {
          console.error(`[${eventType}] Subscription error:`, error);
          resolveOnce({
            verified: false,
            reason: 'error',
            error: error.message
          });
        }
      });

      // Handle subscription promise according to SDK guide
      subscriptionPromise
        .then((sub) => {
          if (sub && typeof sub === 'object' && 'unsubscribe' in sub) {
            subscription = sub as { unsubscribe: () => void };
            console.log(`[${eventType}] Subscription established successfully`);
          } else {
            console.warn(`[${eventType}] Subscription returned undefined or invalid result:`, sub);
            resolveOnce({
              verified: false,
              reason: 'connection_failed',
              error: 'Failed to establish subscription - returned undefined'
            });
          }
        })
        .catch((err) => {
          console.error(`[${eventType}] Failed to subscribe:`, err);
          resolveOnce({
            verified: false,
            reason: 'connection_failed',
            error: err instanceof Error ? err.message : String(err)
          });
        });
    } catch (err) {
      console.error(`[${eventType}] Failed to create WebSocket SDK:`, err);
      resolveOnce({
        verified: false,
        reason: 'connection_failed',
        error: err instanceof Error ? err.message : String(err)
      });
    }
  });
}

/**
 * API endpoint for event verification
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { eventType, expected, timeout = 20000 }: VerificationRequest = req.body;

    if (!eventType || !expected) {
      return res.status(400).json({
        error: 'eventType and expected are required',
        verified: false,
        reason: 'error'
      });
    }

    if (eventType !== 'TransferIntentCreated' && eventType !== 'TransferConfirmed') {
      return res.status(400).json({
        error: 'eventType must be TransferIntentCreated or TransferConfirmed',
        verified: false,
        reason: 'error'
      });
    }

    // Validate required fields
    if (!expected.fromPhoneHash || !expected.toPhoneHash || !expected.fromPhone ||
      !expected.toPhone || !expected.amount || !expected.token) {
      return res.status(400).json({
        error: 'Missing required fields in expected data',
        verified: false,
        reason: 'error'
      });
    }

    // For TransferConfirmed, txHash is required
    if (eventType === 'TransferConfirmed' && !expected.txHash) {
      return res.status(400).json({
        error: 'txHash is required for TransferConfirmed events',
        verified: false,
        reason: 'error'
      });
    }

    console.log(`\n🔍 Starting verification for ${eventType}...`);
    console.log('Expected:', expected);

    // Verify event
    const result = await verifyEvent(eventType, expected, timeout);

    console.log(`\n📊 Verification result:`, result);

    return res.json(result);
  } catch (err: any) {
    console.error('Verification API error:', err);
    return res.status(500).json({
      verified: false,
      reason: 'error',
      error: err.message || 'Internal server error'
    });
  }
}

