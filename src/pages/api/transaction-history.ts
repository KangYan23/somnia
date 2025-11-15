// src/pages/api/transaction-history.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getTransactionHistory, formatTransactionHistory } from '../../../services/transaction-history/history';
import { hashPhone, normalizePhone } from '../../lib/phone';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get wallet address from request (user must connect wallet first)
    const walletAddress = (req.method === 'GET' ? req.query.wallet : req.body?.wallet) as string;
    const limit = parseInt((req.method === 'GET' ? req.query.limit : req.body?.limit) as string) || 10;

    if (!walletAddress) {
      return res.status(400).json({ 
        error: 'Wallet address required',
        message: 'Please connect your wallet first to view transaction history'
      });
    }

    // Validate wallet address format
    if (!walletAddress.startsWith('0x') || walletAddress.length !== 42) {
      return res.status(400).json({ 
        error: 'Invalid wallet address format',
        message: 'Wallet address must be a valid Ethereum address (0x...)'
      });
    }

    console.log(`🔍 Querying transaction history for wallet: ${walletAddress}`);
    console.log(`   Limit: ${limit}`);

    // Query transactions by wallet address
    // The service will get phone hash from userRegistration first
    const transactions = await getTransactionHistory({
      walletAddress: walletAddress as `0x${string}`,
      limit
    });

    if (transactions.length === 0) {
      return res.status(200).json({
        success: true,
        count: 0,
        transactions: [],
        message: 'No transactions found for this wallet address'
      });
    }

    // Get user's phone hash to determine sent/received direction
    const { getPhoneHashFromWallet } = await import('../../../services/transaction-history/history');
    const userPhoneHash = await getPhoneHashFromWallet(walletAddress as `0x${string}`);

    // Format for API response (structured data)
    const formattedTransactions = transactions.map(tx => {
      const isSent = userPhoneHash && tx.fromPhoneHash.toLowerCase() === userPhoneHash.toLowerCase();
      const isReceived = userPhoneHash && tx.toPhoneHash.toLowerCase() === userPhoneHash.toLowerCase();
      
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
      formatted: formatTransactionHistory(transactions, userPhoneHash || undefined) // WhatsApp-style format for display
    });

  } catch (error: any) {
    console.error('❌ Failed to query transaction history:', error.message);
    return res.status(500).json({ 
      error: 'Failed to query transaction history',
      message: error.message 
    });
  }
}

