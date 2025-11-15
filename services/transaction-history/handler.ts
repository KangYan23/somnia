// services/transaction-history/handler.ts
/**
 * Transaction History Handler
 * Handles transaction history requests from WhatsApp bot
 */

import { getTransactionHistory, formatTransactionHistory } from './history';
import { hashPhone, stripCountryCode } from '../../src/lib/phone';

export async function handleTransactionHistory(action: {
  sender_phone?: string;
  limit?: number;
}) {
  const { sender_phone, limit = 10 } = action;

  if (!sender_phone) {
    throw new Error('Sender phone required to query transaction history');
  }

  console.log('📋 Executing transaction history query:', {
    sender_phone,
    limit
  });

  // IMPORTANT: Use stripCountryCode to match how data is stored in transfer.ts
  // WhatsApp sends "601110851129", we need "01110851129" (stripped CC, with leading 0)
  // This ensures the hash matches the stored data
  const normalized = stripCountryCode(sender_phone);
  const phoneHash = hashPhone(normalized) as `0x${string}`;

  console.log(`🔍 Querying transactions for phone: ${sender_phone}`);
  console.log(`   Normalized (stripped CC): ${normalized}`);
  console.log(`   Phone hash: ${phoneHash}`);

  // Query transactions
  const transactions = await getTransactionHistory({
    phoneHash,
    limit
  });

  if (transactions.length === 0) {
    return (
      `📋 *Transaction History*\n\n` +
      `No transactions found for your account.\n\n` +
      `Start sending or receiving transfers to see your history here!`
    );
  }

  // Format transaction history
  const historyText = formatTransactionHistory(transactions, phoneHash);
  
  // Generate link to view all transactions
  // Use the phone hash to create a shareable link
  const baseUrl = process.env.WEBAPP_BASE_URL || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const transactionsLink = `${baseUrl}/transactions/${phoneHash}`;
  
  // Add link at the end if we have 10 transactions (showing only latest 10)
  if (transactions.length >= limit) {
    return (
      `${historyText}\n\n` +
      `📊 *View All Transactions*\n` +
      `${transactionsLink}\n\n` +
      `View all your transactions on the web!`
    );
  }
  
  return historyText;
}

