// src/pages/transactions/[hash].tsx
"use client"

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { DataTable } from "@/components/data-table/data-table"
import { transactionColumns, Transaction } from "@/lib/transaction-columns"

const EXPLORER_URL = process.env.NEXT_PUBLIC_BLOCKCHAIN_EXPLORER_URL || 'https://shannon-explorer.somnia.network';

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
        <div style={{ background: 'white', borderRadius: '8px', padding: '1.5rem' }}>
          <DataTable
            columns={transactionColumns}
            data={transactions}
            searchKey="counterparty"
            searchPlaceholder="Search by counterparty..."
            enableRowSelection={true}
          />
        </div>
      )}
    </div>
  );
}

