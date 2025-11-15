// src/pages/transactions/[hash].tsx
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

interface Transaction {
  fromPhone: string;
  toPhone: string;
  amount: string;
  token: string;
  txHash: string;
  timestamp: number;
  date: string;
  direction: 'sent' | 'received';
  counterparty: string;
}

const EXPLORER_URL = process.env.NEXT_PUBLIC_BLOCKCHAIN_EXPLORER_URL || 'https://shannon-explorer.somnia.network';

function getTxLink(txHash: string): string {
  return `${EXPLORER_URL}/tx/${txHash}`;
}

function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleString();
}

function formatAmount(amount: string, token: string): string {
  const num = parseFloat(amount) / 1e18; // Convert from Wei
  if (num < 0.0001) {
    return `${num} ${token}`;
  } else if (num < 1) {
    return `${num.toFixed(4)} ${token}`;
  } else {
    return `${num.toFixed(2)} ${token}`;
  }
}

export default function TransactionHistoryPage() {
  const router = useRouter();
  const { hash } = router.query;
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hash || typeof hash !== 'string') {
      return;
    }

    async function fetchTransactions() {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(`/api/transactions/${hash}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || data.error || 'Failed to fetch transactions');
        }

        if (data.success) {
          setTransactions(data.transactions || []);
        } else {
          throw new Error(data.message || 'Failed to fetch transactions');
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load transaction history');
      } finally {
        setLoading(false);
      }
    }

    fetchTransactions();
  }, [hash]);

  if (!hash) {
    return (
      <div style={{ maxWidth: 1200, margin: '2rem auto', padding: '0 1rem' }}>
        <h1>Transaction History</h1>
        <p>Loading...</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ maxWidth: 1200, margin: '2rem auto', padding: '0 1rem' }}>
        <h1>Transaction History</h1>
        <p>Loading transactions...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ maxWidth: 1200, margin: '2rem auto', padding: '0 1rem' }}>
        <h1>Transaction History</h1>
        <div style={{ color: 'red', padding: '1rem', background: '#fee', borderRadius: '8px', marginTop: '1rem' }}>
          <strong>Error:</strong> {error}
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1200, margin: '2rem auto', padding: '0 1rem' }}>
      <h1 style={{ marginBottom: '0.5rem' }}>📋 Transaction History</h1>
      <p style={{ color: '#666', marginBottom: '2rem' }}>
        Found {transactions.length} transaction{transactions.length !== 1 ? 's' : ''}
      </p>

      {transactions.length === 0 ? (
        <div style={{ padding: '2rem', textAlign: 'center', background: '#f5f5f5', borderRadius: '8px' }}>
          <p style={{ fontSize: '1.1rem', color: '#666' }}>
            No transactions found for this account.
          </p>
          <p style={{ marginTop: '0.5rem', color: '#999' }}>
            Start sending or receiving transfers to see your history here!
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '1rem' }}>
          {transactions.map((tx, index) => (
            <div
              key={tx.txHash}
              style={{
                background: tx.direction === 'sent' ? '#fff5f5' : '#f0fff4',
                border: `2px solid ${tx.direction === 'sent' ? '#fc8181' : '#68d391'}`,
                borderRadius: '12px',
                padding: '1.5rem',
                transition: 'transform 0.2s, box-shadow 0.2s',
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '1.5rem' }}>
                      {tx.direction === 'sent' ? '📤' : '📥'}
                    </span>
                    <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 'bold' }}>
                      {tx.direction === 'sent' ? 'Sent' : 'Received'}
                    </h2>
                  </div>
                  <p style={{ margin: 0, color: '#666', fontSize: '0.9rem' }}>
                    {tx.direction === 'sent' ? 'To' : 'From'}: <strong>{tx.counterparty || 'Unknown'}</strong>
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: tx.direction === 'sent' ? '#e53e3e' : '#38a169' }}>
                    {tx.direction === 'sent' ? '-' : '+'}{formatAmount(tx.amount, tx.token)}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#999', marginTop: '0.25rem' }}>
                    {tx.token}
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #ddd' }}>
                <div>
                  <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.25rem' }}>Transaction Hash</div>
                  <a
                    href={getTxLink(tx.txHash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      color: '#3182ce',
                      textDecoration: 'none',
                      fontFamily: 'monospace',
                      fontSize: '0.9rem',
                      wordBreak: 'break-all'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
                    onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
                  >
                    {tx.txHash.slice(0, 10)}...{tx.txHash.slice(-8)}
                  </a>
                </div>
                <div>
                  <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.25rem' }}>Date & Time</div>
                  <div style={{ fontSize: '0.9rem', color: '#333' }}>
                    {formatDate(tx.timestamp)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

