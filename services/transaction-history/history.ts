// services/transaction-history/history.ts
/**
 * Transaction History Service
 * 
 * Queries recent transactions from TransferConfirmed events
 * Supports querying by:
 * - Phone hash (for WhatsApp bot)
 * - Wallet address (for website - gets phone from userRegistration first)
 */

import { sdk, publicClient } from '../../src/lib/somnia';
import { hashPhone, normalizePhone } from '../../src/lib/phone';
import { TransferRecord, formatAmount, TRANSFER_EVENT_SIGNATURES, decodeUserRegistration, decodeTransferRecord } from '../../src/lib/transaction';
import { decodeAbiParameters, keccak256, toBytes } from 'viem';
import type { Hex } from 'viem';

export interface TransactionHistoryOptions {
  phoneHash?: `0x${string}`;
  walletAddress?: `0x${string}`;
  limit?: number; // Max number of transactions to return
}

/**
 * Get phone hash from wallet address by querying userRegistration
 * 
 * Since userRegistration uses phoneHash as key (not wallet address),
 * we need to query all registrations and filter by wallet address
 */
export async function getPhoneHashFromWallet(walletAddress: `0x${string}`): Promise<`0x${string}` | null> {
  try {
    const schemaId = await sdk.streams.idToSchemaId('userRegistration');
    if (!schemaId || /^0x0+$/.test(schemaId)) {
      console.warn('userRegistration schema not found');
      return null;
    }

    const publisher = process.env.PUBLISHER_ADDRESS || process.env.WALLET_ADDRESS;
    if (!publisher) {
      console.error('Publisher address required');
      return null;
    }

    console.log(`🔍 Searching for phone hash for wallet: ${walletAddress}`);
    
    // Get all registrations using getAllPublisherDataForSchema and filter by wallet address
    const allRegistrations = await sdk.streams.getAllPublisherDataForSchema(
      schemaId as `0x${string}`,
      publisher as `0x${string}`
    );

    if (!allRegistrations || allRegistrations.length === 0) {
      console.warn('⚠️ No registrations found');
      return null;
    }
    
    console.log(`Found ${allRegistrations.length} registration records`);

    // Filter by wallet address
    const normalizedWallet = walletAddress.toLowerCase();
    
    for (const record of allRegistrations) {
      const registration = decodeUserRegistration(record);
      if (!registration) {
        continue;
      }

      if (registration.walletAddress.toLowerCase() === normalizedWallet) {
        console.log(`✅ Found phone hash for wallet: ${registration.phoneHash}`);
        return registration.phoneHash;
      }
    }

    console.warn(`⚠️ No registration found for wallet: ${walletAddress}`);
    return null;
  } catch (error: any) {
    console.error('Failed to get phone hash from wallet:', error.message);
    return null;
  }
}

/**
 * Query recent transactions by phone hash from data stream
 * 
 * IMPORTANT: getByKey() returns Hex[] | SchemaDecodedItem[][] | null
 * - The array format is the data structure (one record = one array element)
 * - Each key is UNIQUE in the data stream
 * - If multiple transactions use the same phoneHash as key, only the LATEST is stored
 * 
 * Therefore, we must use getAllPublisherDataForSchema() to get ALL records,
 * then filter by phone hash to find all transactions (not just the latest).
 * 
 * This is still faster than querying events because:
 * - Data stream queries are optimized by the SDK
 * - No need to query blockchain event logs
 * - Filtering in memory is fast
 */
async function queryTransactionsByPhoneHash(
  phoneHash: `0x${string}`,
  limit: number = 10
): Promise<TransferRecord[]> {
  try {
    console.log(`🔍 Querying transferHistory data stream for phone hash: ${phoneHash}`);
    
    const schemaId = await sdk.streams.idToSchemaId('transferHistory');
    if (!schemaId || /^0x0+$/.test(schemaId)) {
      console.error('❌ transferHistory schema not found');
      console.error('   Please run schema registration first: npm run register-schemas');
      return [];
    }

    const publisher = process.env.PUBLISHER_ADDRESS || process.env.WALLET_ADDRESS;
    if (!publisher) {
      console.error('Publisher address required');
      return [];
    }

    console.log(`   Schema ID: ${schemaId}`);
    console.log(`   Publisher: ${publisher}`);
    console.log(`   Method: getAllPublisherDataForSchema() then filter by phone hash`);
    
    // Why we can't use getByKey() directly:
    // 1. Keys are composite: phoneHash + txHash (e.g., '0xabcd...1234...')
    // 2. getByKey() requires EXACT key match - no partial/prefix matching
    // 3. We don't know the txHash when querying, so we can't construct the full key
    // 4. Therefore, we must get ALL records and filter by phone hash in the data
    const allRecords = await sdk.streams.getAllPublisherDataForSchema(
      schemaId as `0x${string}`,
      publisher as `0x${string}`
    );
    
    console.log(`   Found ${allRecords?.length || 0} total transfer records`);

    if (!allRecords || allRecords.length === 0) {
      console.log('ℹ️ No transfer records found in data stream');
      return [];
    }

    // Filter records by phone hash
    // Records are stored with phoneHash as key, but we need to check the actual fromPhoneHash/toPhoneHash fields
    // because the key might be fromPhoneHash OR toPhoneHash, and we want both
    const matchingRecords: TransferRecord[] = [];

    console.log(`   Filtering records where fromPhoneHash OR toPhoneHash = ${phoneHash.slice(0, 10)}...`);

    for (const record of allRecords) {
      const transferRecord = decodeTransferRecord(record);
      if (!transferRecord) {
        continue;
      }

      // Check if this transaction involves the phone hash (as sender or receiver)
      const fromMatches = transferRecord.fromPhoneHash.toLowerCase() === phoneHash.toLowerCase();
      const toMatches = transferRecord.toPhoneHash.toLowerCase() === phoneHash.toLowerCase();
      
      if (fromMatches || toMatches) {
        matchingRecords.push(transferRecord);
      }
    }

    // Sort by timestamp (newest first) and limit
    matchingRecords.sort((a, b) => {
      const timeA = Number(a.timestamp);
      const timeB = Number(b.timestamp);
      return timeB - timeA; // Descending order
    });

    const result = matchingRecords.slice(0, limit);
    console.log(`✅ Found ${result.length} matching transactions from data stream`);
    return result;

  } catch (error: any) {
    console.error('Failed to query transactions from data stream:', error.message);
    console.error('   Falling back to event query...');
    // Fallback to event query if data stream fails
    return queryTransactionsByPhoneHashFromEvents(phoneHash, limit);
  }
}

/**
 * Fallback: Query transactions from TransferConfirmed events
 * Used when data stream query fails
 */
async function queryTransactionsByPhoneHashFromEvents(
  phoneHash: `0x${string}`,
  limit: number = 10
): Promise<TransferRecord[]> {
  try {
    console.log(`🔍 Fallback: Querying TransferConfirmed events for phone hash: ${phoneHash}`);
    
    const protocolInfo = await sdk.streams.getSomniaDataStreamsProtocolInfo();
    if (!protocolInfo || typeof protocolInfo !== 'object' || !('contractAddress' in protocolInfo)) {
      console.error('❌ Could not get Somnia Streams protocol contract address');
      return [];
    }

    const contractAddress = (protocolInfo as any).contractAddress as `0x${string}`;
    const eventSignature = TRANSFER_EVENT_SIGNATURES.TransferConfirmed;
    const eventTopic = keccak256(toBytes(eventSignature)) as `0x${string}`;
    
    // Use raw topics for getLogs (viem's type system is strict, so we use as any)
    const logsFrom = await (publicClient as any).getLogs({
      address: contractAddress,
      topics: [eventTopic, phoneHash, null],
      fromBlock: 'earliest',
      toBlock: 'latest'
    });

    const logsTo = await (publicClient as any).getLogs({
      address: contractAddress,
      topics: [eventTopic, null, phoneHash],
      fromBlock: 'earliest',
      toBlock: 'latest'
    });

    const allLogs = [...logsFrom, ...logsTo];
    const uniqueLogs = allLogs.filter((log, index, self) => 
      index === self.findIndex((l) => l.transactionHash === log.transactionHash)
    );

    const transactions: TransferRecord[] = [];
    
    for (const log of uniqueLogs) {
      try {
        const fromPhoneHash = log.topics[1] as `0x${string}`;
        const toPhoneHash = log.topics[2] as `0x${string}`;
        const decoded = decodeAbiParameters(
          [{ type: 'string' }, { type: 'string' }, { type: 'uint256' }, { type: 'string' }, { type: 'bytes32' }],
          log.data as Hex
        );
        const block = await publicClient.getBlock({ blockNumber: log.blockNumber });

        transactions.push({
          fromPhoneHash,
          toPhoneHash,
          fromPhone: decoded[0] as string,
          toPhone: decoded[1] as string,
          amount: decoded[2] as bigint,
          token: decoded[3] as string,
          txHash: decoded[4] as `0x${string}`,
          timestamp: BigInt(block.timestamp)
        });
      } catch (e: any) {
        console.warn(`   ⚠️ Failed to decode event log:`, e.message);
        continue;
      }
    }

    transactions.sort((a, b) => Number(b.timestamp) - Number(a.timestamp));
    const result = transactions.slice(0, limit);
    console.log(`✅ Found ${result.length} matching transactions from events (fallback)`);
    return result;

  } catch (error: any) {
    console.error('Failed to query transactions from events:', error.message);
    return [];
  }
}


/**
 * Main function to get transaction history
 * Supports querying by phone hash or wallet address
 */
export async function getTransactionHistory(
  options: TransactionHistoryOptions
): Promise<TransferRecord[]> {
  const { phoneHash, walletAddress, limit = 10 } = options;

  let targetPhoneHash: `0x${string}` | null = null;

  if (phoneHash) {
    targetPhoneHash = phoneHash;
  } else if (walletAddress) {
    // Get phone hash from wallet address via userRegistration
    console.log(`🔍 Getting phone hash for wallet: ${walletAddress}`);
    targetPhoneHash = await getPhoneHashFromWallet(walletAddress);
    
    if (!targetPhoneHash) {
      console.warn('⚠️ Could not find phone hash for wallet address');
      console.warn('   User may not be registered or SDK limitation');
      return [];
    }
  } else {
    console.error('Either phoneHash or walletAddress must be provided');
    return [];
  }

  return await queryTransactionsByPhoneHash(targetPhoneHash, limit);
}

/**
 * Format transaction history for display (WhatsApp/Website)
 * 
 * @param transactions - List of transfer records
 * @param userPhoneHash - Phone hash of the user querying (to determine sent vs received)
 */
export function formatTransactionHistory(
  transactions: TransferRecord[],
  userPhoneHash?: `0x${string}`
): string {
  if (transactions.length === 0) {
    return '📋 *Transaction History*\n\nNo transactions found.';
  }

  const lines: string[] = [];
  lines.push(`📋 *Transaction History*\n`);
  lines.push(`Found ${transactions.length} transaction(s)\n\n`);

  for (let i = 0; i < transactions.length; i++) {
    const tx = transactions[i];
    const date = new Date(Number(tx.timestamp) * 1000).toLocaleString();
    const amount = formatAmount(tx.amount, tx.token);
    
    // Determine direction and counterparty based on user's phone hash
    let direction: string;
    let counterparty: string;
    let isSent = false;
    let isReceived = false;
    
    if (userPhoneHash) {
      isSent = tx.fromPhoneHash.toLowerCase() === userPhoneHash.toLowerCase();
      isReceived = tx.toPhoneHash.toLowerCase() === userPhoneHash.toLowerCase();
      
      if (isSent) {
        direction = '📤 Sent';
        counterparty = tx.toPhone || 'Unknown';
      } else if (isReceived) {
        direction = '📥 Received';
        counterparty = tx.fromPhone || 'Unknown';
      } else {
        // Fallback: check if fromPhoneHash is zero (unknown sender)
        direction = tx.fromPhoneHash === '0x' + '0'.repeat(64) ? '📥 Received' : '📤 Sent';
        counterparty = tx.fromPhoneHash === '0x' + '0'.repeat(64) ? tx.fromPhone : tx.toPhone;
        isReceived = tx.fromPhoneHash === '0x' + '0'.repeat(64);
      }
    } else {
      // Fallback if no user phone hash provided
      isReceived = tx.fromPhoneHash === '0x' + '0'.repeat(64);
      direction = isReceived ? '📥 Received' : '📤 Sent';
      counterparty = isReceived ? tx.fromPhone : tx.toPhone;
    }

    lines.push(`${i + 1}. ${direction}`);
    if (counterparty && counterparty !== 'Unknown') {
      lines.push(`   ${isSent ? 'To' : 'From'}: ${counterparty}`);
    }
    lines.push(`   Amount: *${amount}*`);
    lines.push(`   Token: ${tx.token}`);
    lines.push(`   Tx: ${tx.txHash.slice(0, 10)}...${tx.txHash.slice(-8)}`);
    lines.push(`   Date: ${date}`);
    lines.push('');
  }

  return lines.join('\n');
}


