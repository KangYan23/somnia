// src/lib/transaction.ts
/**
 * Transaction utilities for querying transfer data streams
 * 
 * This module provides utilities to query transfer records from data streams
 * using transaction hashes from TransferConfirmed events.
 * 
 * Event → Data Stream Reference Pattern:
 * 1. Event contains txHash in its data field
 * 2. Data stream uses txHash as the dataId (key)
 * 3. Use txHash to query the data stream for full transfer details
 */

import { sdk } from './somnia';
import { AbiCoder } from 'ethers';
import type { Hex } from 'viem';
import { decodeAbiParameters } from 'viem';

export interface TransferRecord {
  fromPhoneHash: `0x${string}`;
  toPhoneHash: `0x${string}`;
  fromPhone: string;
  toPhone: string;
  amount: bigint;
  token: string;
  txHash: `0x${string}`;
  timestamp: bigint;
}

/**
 * Extract txHash from TransferConfirmed event data
 * @param eventData - ABI-encoded event data from TransferConfirmed event
 * @returns Transaction hash that can be used to query data stream
 */
export function extractTxHashFromEvent(eventData: Hex): `0x${string}` | null {
  try {
    const decoded = decodeAbiParameters(
      [
        { type: 'string' },   // fromPhone
        { type: 'string' },   // toPhone
        { type: 'uint256' },  // amount
        { type: 'string' },   // token
        { type: 'bytes32' }   // txHash
      ],
      eventData
    );
    
    return decoded[4] as `0x${string}`; // txHash is the 5th field (index 4)
  } catch (error) {
    console.error('Failed to extract txHash from event:', error);
    return null;
  }
}

/**
 * Query transfer record from data stream using txHash from event
 * 
 * This demonstrates the event → data stream reference pattern:
 * Event (TransferConfirmed) → Extract txHash → Query data stream (transferHistory)
 * 
 * @param txHash - Transaction hash from TransferConfirmed event
 * @param publisherAddress - Publisher address who stored the data (optional, uses env var if not provided)
 * @returns Decoded transfer record or null if not found
 */
export async function queryTransferByTxHash(
  txHash: `0x${string}`,
  publisherAddress?: string
): Promise<TransferRecord | null> {
  try {
    // Get schema ID for transferHistory
    const schemaId = await sdk.streams.idToSchemaId('transferHistory');
    if (!schemaId || /^0x0+$/.test(schemaId)) {
      console.error('transferHistory schema not found. Register schema first.');
      return null;
    }

    // Use publisher from parameter or environment
    const publisher = publisherAddress || process.env.PUBLISHER_ADDRESS || process.env.WALLET_ADDRESS;
    if (!publisher) {
      console.error('Publisher address required. Provide as parameter or set PUBLISHER_ADDRESS/WALLET_ADDRESS in env.');
      return null;
    }

    console.log(`🔍 Querying transferHistory data stream...`);
    console.log(`   Schema: transferHistory`);
    console.log(`   Key (txHash): ${txHash}`);
    console.log(`   Publisher: ${publisher}`);

    // Query data stream using txHash as the key
    const results = await sdk.streams.getByKey(
      schemaId as `0x${string}`,
      publisher as `0x${string}`,
      txHash // Use txHash from event as the dataId key
    );

    if (!results || results.length === 0) {
      console.log('❌ No transfer record found for this txHash');
      return null;
    }

    // Decode the result
    const abiCoder = new AbiCoder();
    const firstResult = results[0];
    
    let decoded: any;
    if (typeof firstResult === 'string') {
      // Raw hex format
      decoded = abiCoder.decode(
        ['bytes32', 'bytes32', 'string', 'string', 'uint256', 'string', 'bytes32', 'uint64'],
        firstResult
      );
    } else if (Array.isArray(firstResult)) {
      // Already decoded format
      decoded = firstResult.map((item: any) => item?.value?.value || item?.value || item);
    } else {
      console.error('Unexpected data format:', typeof firstResult);
      return null;
    }

    const transferRecord: TransferRecord = {
      fromPhoneHash: decoded[0] as `0x${string}`,
      toPhoneHash: decoded[1] as `0x${string}`,
      fromPhone: decoded[2] as string,
      toPhone: decoded[3] as string,
      amount: decoded[4] as bigint,
      token: decoded[5] as string,
      txHash: decoded[6] as `0x${string}`,
      timestamp: decoded[7] as bigint
    };

    console.log('✅ Transfer record retrieved from data stream:');
    console.log(`   From: ${transferRecord.fromPhone}`);
    console.log(`   To: ${transferRecord.toPhone}`);
    console.log(`   Amount: ${transferRecord.amount.toString()} ${transferRecord.token}`);
    console.log(`   Timestamp: ${new Date(Number(transferRecord.timestamp) * 1000).toISOString()}`);

    return transferRecord;
  } catch (error: any) {
    console.error('❌ Failed to query transfer record:', error.message);
    return null;
  }
}

/**
 * Complete example: Subscribe to TransferConfirmed event and query data stream
 * 
 * This shows the full event → data stream reference flow:
 * 1. Subscribe to TransferConfirmed events
 * 2. Extract txHash from event data
 * 3. Use txHash to query transferHistory data stream
 * 4. Get full transfer details including timestamp
 */
export async function subscribeAndQueryTransferHistory() {
  // This is an example - actual subscription would be in a subscriber service
  console.log(`
📡 Event → Data Stream Reference Pattern:

1. Subscribe to TransferConfirmed event:
   sdk.streams.subscribe({
     somniaStreamsEventId: 'TransferConfirmed',
     onData: async (event) => {
       // 2. Extract txHash from event data
       const txHash = extractTxHashFromEvent(event.data);
       
       // 3. Query data stream using txHash
       const transferRecord = await queryTransferByTxHash(txHash);
       
       // 4. Now you have full transfer details + timestamp
       console.log('Transfer:', transferRecord);
     }
   });

🔗 Reference Chain:
   Event (TransferConfirmed) 
     → Contains: txHash in data field
     → Use txHash as key
     → Query: getByKey('transferHistory', publisher, txHash)
     → Returns: Full transfer record with timestamp
  `);
}

