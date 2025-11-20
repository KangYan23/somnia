// src/pages/transactions/[hash].tsx
"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/router"

import { DataTable } from "@/components/data-table/data-table"
import { transactionColumns, Transaction } from "@/lib/transaction-columns"

const EXPLORER_URL =
  process.env.NEXT_PUBLIC_BLOCKCHAIN_EXPLORER_URL ||
  "https://shannon-explorer.somnia.network"

export default function TransactionHistoryPage() {
  const router = useRouter()
  const { hash } = router.query
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!hash || typeof hash !== "string") {
      return
    }

    async function fetchTransactions() {
      try {
        setLoading(true)
        setError(null)
        const response = await fetch(`/api/transactions/${hash}`)
        const data = await response.json()

        if (!response.ok) {
          throw new Error(
            data.message || data.error || "Failed to fetch transactions"
          )
        }

        if (data.success) {
          setTransactions(data.transactions || [])
        } else {
          throw new Error(data.message || "Failed to fetch transactions")
        }
      } catch (err: any) {
        setError(err.message || "Failed to load transaction history")
      } finally {
        setLoading(false)
      }
    }

    fetchTransactions()
  }, [hash])

  const renderPage = (content: React.ReactNode) => (
    <div className="min-h-screen bg-slate-50 py-12">
      <div className="mx-auto w-full max-w-5xl px-4">{content}</div>
    </div>
  )

  if (!hash) {
    return renderPage(
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">
          Transaction History
        </h1>
        <p className="mt-2 text-slate-500">Preparing account details...</p>
      </div>
    )
  }

  if (loading) {
    return renderPage(
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">
          Transaction History
        </h1>
        <p className="mt-2 text-slate-500">Loading transactions...</p>
      </div>
    )
  }

  if (error) {
    return renderPage(
      <div className="rounded-2xl border border-rose-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">
          Transaction History
        </h1>
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          <strong className="font-semibold">Error:</strong> {error}
        </div>
      </div>
    )
  }

  return renderPage(
    <div className="flex flex-col gap-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3">
          <div className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Transaction History
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="text-3xl font-semibold text-slate-900">
              Account Overview
            </h1>
            <a
              href={`${EXPLORER_URL}/address/${hash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-400 hover:text-slate-800"
            >
              View on Explorer
            </a>
          </div>
          <p className="text-sm text-slate-500">
            Account Hash:{" "}
            <span className="font-mono text-slate-800">
              {hash.slice(0, 12)}...{hash.slice(-10)}
            </span>
          </p>
          <p className="text-sm text-slate-500">
            Showing{" "}
            <span className="font-semibold text-slate-900">
              {transactions.length}
            </span>{" "}
            transaction{transactions.length !== 1 ? "s" : ""}.
          </p>
        </div>
      </div>

      {transactions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
          <p className="text-lg font-semibold text-slate-800">
            No transactions found
          </p>
          <p className="mt-2 text-sm text-slate-500">
            Start sending or receiving transfers to see your activity here.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-0 shadow-sm">
          <div className="border-b border-slate-100 px-6 py-4">
            <h2 className="text-lg font-semibold text-slate-900">
              Recent Activity
            </h2>
            <p className="text-sm text-slate-500">
              Search, filter, or export your transactions.
            </p>
          </div>
          <div className="px-4 py-4">
            <DataTable
              columns={transactionColumns}
              data={transactions}
              searchKey="counterparty"
              searchPlaceholder="Search by counterparty..."
              enableRowSelection={true}
            />
          </div>
        </div>
      )}
    </div>
  )
}

