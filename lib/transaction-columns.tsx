// lib/transaction-columns.tsx
"use client"

import { Column, ColumnDef } from "@tanstack/react-table"
import {
  ArrowDown,
  ArrowUp,
  ChevronsUpDown,
  Check,
  ExternalLink,
  EyeOff,
  MoreHorizontalIcon,
} from "lucide-react"
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
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header"

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

const EXPLORER_URL = process.env.NEXT_PUBLIC_BLOCKCHAIN_EXPLORER_URL || 'https://shannon-explorer.somnia.network'

function getTxLink(txHash: string): string {
  return `${EXPLORER_URL}/tx/${txHash}`
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp * 1000)
  return date.toLocaleDateString()
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp * 1000)
  return date.toLocaleTimeString()
}

function formatAmount(amount: string, token: string): string {
  const num = parseFloat(amount) / 1e18 // Convert from Wei
  if (num < 0.0001) {
    return `${num} ${token}`
  } else if (num < 1) {
    return `${num.toFixed(4)} ${token}`
  } else {
    return `${num.toFixed(2)} ${token}`
  }
}

export const transactionColumns: ColumnDef<Transaction>[] = [
  {
    accessorKey: "direction",
    header: ({ column }) => <TypeColumnHeader column={column} />,
    cell: ({ row }) => {
      const transaction = row.original
      const direction = transaction.direction
      const isSent = direction === "sent"
      const amount = formatAmount(transaction.amount, transaction.token)
      return (
        <div className="flex items-center justify-center gap-3">
          <Image
            src={isSent ? "/sent.png" : "/received.png"}
            alt={isSent ? "Sent transaction" : "Received transaction"}
            width={72}
            height={24}
            className="h-6 w-auto"
          />
          <div className="text-right">
            <div
              className={cn(
                "text-sm font-semibold",
                isSent ? "text-red-600" : "text-green-600"
              )}
            >
              {isSent ? "-" : "+"}
              {amount}
            </div>
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
      <div className="text-center font-medium">Counterparty</div>
    ),
    cell: ({ row }) => {
      const transaction = row.original
      return (
        <div className="text-center">
          <div className="font-medium">{transaction.counterparty || 'Unknown'}</div>
          <div className="text-xs text-muted-foreground">
            {transaction.direction === 'sent' ? 'To' : 'From'}
          </div>
        </div>
      )
    },
  },
  {
    accessorKey: "txHash",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Transaction Hash" />
    ),
    cell: ({ row }) => {
      const txHash = row.getValue("txHash") as string
      return (
        <a
          href={getTxLink(txHash)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline font-mono text-sm"
        >
          {txHash.slice(0, 10)}...{txHash.slice(-8)}
          <ExternalLink className="h-3 w-3" />
        </a>
      )
    },
    enableSorting: false,
  },
  {
    accessorKey: "timestamp",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Date" />
    ),
    cell: ({ row }) => {
      const timestamp = row.getValue("timestamp") as number
      return (
        <div className="text-sm">
          {formatDate(timestamp)}
        </div>
      )
    },
  },
  {
    id: "time",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Time" />
    ),
    cell: ({ row }) => {
      const timestamp = row.getValue("timestamp") as number
      return (
        <div className="text-sm">
          {formatTime(timestamp)}
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

function TypeColumnHeader({
  column,
}: {
  column: Column<Transaction, unknown>
}) {
  const currentFilter = column.getFilterValue() as string[] | undefined
  const activeValue = currentFilter?.[0]

  const handleSelect = (value: "sent" | "received") => {
    if (activeValue === value) {
      column.setFilterValue(undefined)
      column.clearSorting?.()
    } else {
      column.setFilterValue([value])
    }
  }

  return (
    <div className="flex justify-center">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="-ml-3 h-8 data-[state=open]:bg-accent"
          >
            <span>Transaction</span>
            {column.getIsSorted() === "desc" ? (
              <ArrowDown className="ml-2 h-4 w-4" />
            ) : column.getIsSorted() === "asc" ? (
              <ArrowUp className="ml-2 h-4 w-4" />
            ) : (
              <ChevronsUpDown className="ml-2 h-4 w-4" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" className="w-40">
          <DropdownMenuItem
            onSelect={(event) => {
              event.preventDefault()
              handleSelect("received")
            }}
            className="flex items-center justify-between"
          >
            <span className="flex items-center gap-2 text-foreground">
              <span className="h-3 w-3 rounded-[25%] bg-green-500" />
              Received
            </span>
            {activeValue === "received" && (
              <Check className="h-4 w-4 text-green-600" />
            )}
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={(event) => {
              event.preventDefault()
              handleSelect("sent")
            }}
            className="flex items-center justify-between"
          >
            <span className="flex items-center gap-2 text-foreground">
              <span className="h-3 w-3 rounded-[25%] bg-red-500" />
              Sent
            </span>
            {activeValue === "sent" && (
              <Check className="h-4 w-4 text-red-600" />
            )}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={(event) => {
              event.preventDefault()
              column.toggleVisibility(false)
            }}
            className="flex items-center"
          >
            <EyeOff className="mr-2 h-3.5 w-3.5 text-muted-foreground/70" />
            Hide
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

