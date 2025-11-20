// lib/transaction-columns.tsx
"use client"

import { ColumnDef } from "@tanstack/react-table"
import { ExternalLink, MoreHorizontalIcon } from "lucide-react"
import Image from "next/image"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
export interface Transaction {
  fromPhone: string
  toPhone: string
  amount: string
  token: string
  txHash: string
  timestamp: number
  date: string
  direction: 'sent' | 'received'
  counterparty: string
}

const EXPLORER_URL =
  process.env.NEXT_PUBLIC_BLOCKCHAIN_EXPLORER_URL ||
  "https://shannon-explorer.somnia.network"

function getTxLink(txHash: string): string {
  return `${EXPLORER_URL}/tx/${txHash}`
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp * 1000)
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp * 1000)
  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  })
}

function formatReadableAmount(amount: string): string {
  const num = parseFloat(amount) / 1e18 // Convert from Wei
  if (num < 0.0001) {
    return `${num}`
  } else if (num < 1) {
    return `${num.toFixed(4)}`
  } else {
    return `${num.toFixed(2)}`
  }
}

export const transactionColumns: ColumnDef<Transaction>[] = [
  {
    accessorKey: "direction",
    header: () => (
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Type
      </div>
    ),
    cell: ({ row }) => {
      const transaction = row.original
      const direction = transaction.direction
      const isSent = direction === "sent"
      const amountValue = formatReadableAmount(transaction.amount)
      return (
        <div className="flex items-center gap-3">
          <Image
            src={isSent ? "/sent.png" : "/received.png"}
            alt={isSent ? "Sent transaction" : "Received transaction"}
            width={20}
            height={20}
            className="h-5 w-5"
          />
          <div>
            <div className="text-sm font-semibold text-slate-900">
              {isSent ? "Sent" : "Received"}
            </div>
            <p className="text-xs text-slate-500">
              {transaction.token} · {isSent ? "Outgoing" : "Incoming"}
            </p>
          </div>
        </div>
      )
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id))
    },
  },
  {
    accessorKey: "counterparty",
    header: () => (
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Counterparty
      </div>
    ),
    cell: ({ row }) => {
      const transaction = row.original
      return (
        <div className="text-left">
          <div className="text-sm font-medium text-slate-900">
            {transaction.counterparty || "Unknown"}
          </div>
          <div className="text-xs uppercase tracking-wide text-slate-400">
            {transaction.direction === "sent" ? "Recipient" : "Sender"}
          </div>
        </div>
      )
    },
  },
  {
    accessorKey: "amount",
    header: () => (
      <div className="text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
        Amount
      </div>
    ),
    cell: ({ row }) => {
      const transaction = row.original
      const isSent = transaction.direction === "sent"
      const amountValue = formatReadableAmount(transaction.amount)
      return (
        <div className="text-right">
          <div
            className={cn(
              "text-sm font-semibold",
              isSent ? "text-rose-600" : "text-emerald-600"
            )}
          >
            {isSent ? "-" : "+"}
            {amountValue}
          </div>
          <div className="text-xs text-slate-500">{transaction.token}</div>
        </div>
      )
    },
  },
  {
    accessorKey: "txHash",
    header: () => (
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Hash
      </div>
    ),
    cell: ({ row }) => {
      const txHash = row.getValue("txHash") as string
      return (
        <div className="space-y-1">
          <a
            href={getTxLink(txHash)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600 transition hover:border-slate-400 hover:bg-white"
          >
            <span className="font-mono text-[11px]">
              {txHash.slice(0, 8)}...{txHash.slice(-6)}
            </span>
            <ExternalLink className="h-3.5 w-3.5 text-slate-500" />
          </a>
          <p className="text-[11px] uppercase tracking-wide text-slate-400">
            Explorer
          </p>
        </div>
      )
    },
    enableSorting: false,
  },
  {
    accessorKey: "timestamp",
    header: () => (
      <div className="text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
        Date &amp; Time
      </div>
    ),
    cell: ({ row }) => {
      const timestamp = row.getValue("timestamp") as number
      return (
        <div className="text-right">
          <div className="text-sm font-semibold text-slate-900">
            {formatDate(timestamp)}
          </div>
          <div className="text-xs text-slate-500">{formatTime(timestamp)}</div>
        </div>
      )
    },
  },
  {
    id: "actions",
    enableHiding: false,
    cell: ({ row }) => {
      const transaction = row.original

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontalIcon className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() => navigator.clipboard.writeText(transaction.txHash)}
            >
              Copy transaction hash
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => window.open(getTxLink(transaction.txHash), '_blank')}
            >
              View on explorer
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => navigator.clipboard.writeText(transaction.counterparty)}
            >
              Copy counterparty
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
  },
]

