// src/utils/event-decoder.ts
import { decodeAbiParameters } from 'viem';
import type { Hex } from 'viem';
import type { ReceivedEventData } from '../types/events';

/**
 * Decode TransferIntentCreated event data
 */
export function decodeTransferIntentCreated(data: Hex): ReceivedEventData {
  const decoded = decodeAbiParameters(
    [
      { type: 'string' },   // fromPhone
      { type: 'string' },   // toPhone
      { type: 'uint256' },  // amount
      { type: 'string' }    // token
    ],
    data
  );

  return {
    fromPhone: decoded[0] as string,
    toPhone: decoded[1] as string,
    amount: decoded[2] as bigint,
    token: decoded[3] as string
  };
}

/**
 * Decode TransferConfirmed event data
 */
export function decodeTransferConfirmed(data: Hex): ReceivedEventData {
  const decoded = decodeAbiParameters(
    [
      { type: 'string' },   // fromPhone
      { type: 'string' },   // toPhone
      { type: 'uint256' },  // amount
      { type: 'string' },   // token
      { type: 'bytes32' }   // txHash
    ],
    data
  );

  return {
    fromPhone: decoded[0] as string,
    toPhone: decoded[1] as string,
    amount: decoded[2] as bigint,
    token: decoded[3] as string,
    txHash: decoded[4] as `0x${string}`
  };
}

/**
 * Extract phone hashes from event topics
 * topics[0] = event signature
 * topics[1] = fromPhoneHash (indexed)
 * topics[2] = toPhoneHash (indexed)
 */
export function extractPhoneHashesFromTopics(topics: Hex[]): {
  fromPhoneHash: `0x${string}`;
  toPhoneHash: `0x${string}`;
} | null {
  if (topics.length < 3) {
    return null;
  }

  return {
    fromPhoneHash: topics[1] as `0x${string}`,
    toPhoneHash: topics[2] as `0x${string}`
  };
}

