// src/pages/api/transactions/[hash].ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getTransactionHistory, formatTransactionHistory } from '../../../../services/transaction-history/history';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get phone hash from URL parameter
    const { hash } = req.query;
    
    if (!hash || typeof hash !== 'string') {
      return res.status(400).json({ 
        error: 'Phone hash required',
        message: 'Please provide a valid phone hash in the URL'
      });
    }

    // Validate phone hash format (should be 0x + 64 hex characters)
    const phoneHash = hash as `0x${string}`;
    if (!/^0x[0-9a-fA-F]{64}$/.test(phoneHash)) {
      return res.status(400).json({ 
        error: 'Invalid phone hash format',
        message: 'Phone hash must be a 32-byte hex string (0x + 64 hex characters)'
      });
    }

    console.log(`🔍 Querying ALL transactions for phone hash: ${phoneHash}`);

    // Query ALL transactions (no limit)
    const transactions = await getTransactionHistory({
      phoneHash,
      limit: 1000 // High limit to get all transactions
    });

    if (transactions.length === 0) {
      return res.status(200).json({
        success: true,
        count: 0,
        transactions: [],
        message: 'No transactions found for this phone hash'
      });
    }

    // Format for API response (structured data)
    const formattedTransactions = transactions.map(tx => {
      const isSent = tx.fromPhoneHash.toLowerCase() === phoneHash.toLowerCase();
      const isReceived = tx.toPhoneHash.toLowerCase() === phoneHash.toLowerCase();
      
      return {
        fromPhone: tx.fromPhone,
        toPhone: tx.toPhone,
        amount: tx.amount.toString(),
        token: tx.token,
        txHash: tx.txHash,
        timestamp: Number(tx.timestamp),
        date: new Date(Number(tx.timestamp) * 1000).toISOString(),
        direction: isSent ? 'sent' : isReceived ? 'received' : (tx.fromPhoneHash === '0x' + '0'.repeat(64) ? 'received' : 'sent'),
        counterparty: isSent ? tx.toPhone : isReceived ? tx.fromPhone : (tx.fromPhoneHash === '0x' + '0'.repeat(64) ? tx.fromPhone : tx.toPhone)
      };
    });

    return res.status(200).json({
      success: true,
      count: transactions.length,
      transactions: formattedTransactions,
      formatted: formatTransactionHistory(transactions, phoneHash) // WhatsApp-style format for display
    });

  } catch (error: any) {
    console.error('❌ Failed to query transaction history:', error.message);
    return res.status(500).json({ 
      error: 'Failed to query transaction history',
      message: error.message 
    });
  }
}

