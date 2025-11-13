// src/scripts/create-transfer-intent.ts
import { sdk } from '../lib/somnia.ts';
import { encodeAbiParameters } from 'viem';
import type { AbiParameter } from 'viem';

// Type definition for a Transfer Intent
export interface TransferIntent {
  fromPhoneHash: `0x${string}`;
  toPhoneHash: `0x${string}`;
  fromPhone: string;  // Actual phone number
  toPhone: string;    // Actual phone number
  amount: bigint;
  token: string;
}

/**
 * Emits a TransferIntentCreated event to Somnia streams.
 * This does NOT write persistent data on-chain, only triggers the event for subscribers.
 * 
 * @param intent - The transfer intent details
 */
export async function createTransferIntent(intent: TransferIntent) {
  if (!intent.fromPhoneHash || !intent.toPhoneHash || !intent.fromPhone || !intent.toPhone || !intent.amount || !intent.token) {
    throw new Error('All fields of TransferIntent are required');
  }

  try {
    // Encode non-indexed data fields as hex
    const encodedData = encodeAbiParameters(
      [
        { type: 'string' },   // fromPhone
        { type: 'string' },   // toPhone
        { type: 'uint256' },  // amount
        { type: 'string' }    // token
      ] as AbiParameter[],
      [intent.fromPhone, intent.toPhone, intent.amount, intent.token]
    );

    const tx = await sdk.streams.emitEvents([
      {
        id: 'TransferIntentCreated',  // event schema id
        argumentTopics: [
          intent.fromPhoneHash,        // indexed
          intent.toPhoneHash           // indexed
        ],
        data: encodedData              // hex string of the non-indexed fields
      }
    ]);

    console.log('TransferIntentCreated event emitted successfully:', tx);
    return tx;
  } catch (err) {
    console.error('Failed to emit TransferIntentCreated event:', err);
    throw err;
  }
}
