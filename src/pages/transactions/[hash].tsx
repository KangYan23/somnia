// src/pages/transactions/[hash].tsx
"use client"

import Image from "next/image"
import { Activity, TrendingUp, Check, ArrowUp, ArrowDown, ExternalLink } from "lucide-react"
import { useEffect, useMemo, useState, useRef, type KeyboardEvent } from "react"
import { motion, animate } from "framer-motion"
import { useRouter } from "next/router"
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"

import { DataTable } from "@/components/data-table/data-table"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { transactionColumns, Transaction } from "@/lib/transaction-columns"
import { StatsCard } from "@/components/ui/activity-stats-card"
import styles from "./transactions.module.css"

const EXPLORER_URL =
  process.env.NEXT_PUBLIC_BLOCKCHAIN_EXPLORER_URL ||
  "https://shannon-explorer.somnia.network"

const chartConfig = {
  income: {
    label: "Income",
    color: "var(--chart-1)",
  },
  expenses: {
    label: "Expenses",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig

const RANGE_OPTIONS = [
  { value: "3m", label: "Last 3 months" },
  { value: "30d", label: "Last 30 days" },
  { value: "7d", label: "Last 7 days" },
] as const

type RangePreset = (typeof RANGE_OPTIONS)[number]["value"]

type ChartPoint = {
  key: string
  label: string
  income: number
  expenses: number
}

type ChartRange = {
  startDate: Date
  endDate: Date
  granularity: "day" | "month"
  label: string
}

type ChartView = "both" | "income" | "expenses"

function formatWeiToNumber(amount: string) {
  const parsed = parseFloat(amount)
  if (Number.isNaN(parsed)) {
    return 0
  }
  return parsed / 1e18
}

function formatDisplayAmount(value: number) {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function startOfDay(date: Date) {
  const clone = new Date(date)
  clone.setHours(0, 0, 0, 0)
  return clone
}

function endOfDay(date: Date) {
  const clone = new Date(date)
  clone.setHours(23, 59, 59, 999)
  return clone
}

function formatInputDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

function parseInputDate(value: string) {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function formatRangeLabel(start: Date, end: Date) {
  const sameYear = start.getFullYear() === end.getFullYear()
  const startFormatter = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: sameYear ? undefined : "numeric",
  })
  const endFormatter = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
  return `${startFormatter.format(start)} – ${endFormatter.format(end)}`
}

function buildDailyBuckets(startDate: Date, endDate: Date): ChartPoint[] {
  const buckets: ChartPoint[] = []
  const current = startOfDay(startDate)
  const end = endOfDay(endDate)

  while (current <= end) {
    const key = current.toISOString().slice(0, 10)
    buckets.push({
      key,
      label: current.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      }),
      income: 0,
      expenses: 0,
    })
    current.setDate(current.getDate() + 1)
  }

  return buckets
}

function buildMonthlyBucketsForRange(
  startDate: Date,
  endDate: Date
): ChartPoint[] {
  const buckets: ChartPoint[] = []
  const current = new Date(startDate.getFullYear(), startDate.getMonth(), 1)
  const last = new Date(endDate.getFullYear(), endDate.getMonth(), 1)

  while (current <= last) {
    const key = `${current.getFullYear()}-${current.getMonth()}`
    buckets.push({
      key,
      label: current.toLocaleDateString(undefined, {
        month: "short",
        year: "numeric",
      }),
      income: 0,
      expenses: 0,
    })
    current.setMonth(current.getMonth() + 1)
  }

  return buckets
}

function buildChartData(
  transactions: Transaction[],
  range: ChartRange
): ChartPoint[] {
  const buckets =
    range.granularity === "day"
      ? buildDailyBuckets(range.startDate, range.endDate)
      : buildMonthlyBucketsForRange(range.startDate, range.endDate)

  const bucketMap = new Map(buckets.map((bucket) => [bucket.key, bucket]))

  transactions.forEach((transaction) => {
    const txDate = new Date(transaction.timestamp * 1000)
    if (txDate < range.startDate || txDate > range.endDate) {
      return
    }

    const key =
      range.granularity === "day"
        ? txDate.toISOString().slice(0, 10)
        : `${txDate.getFullYear()}-${txDate.getMonth()}`

    const bucket = bucketMap.get(key)
    if (!bucket) {
      return
    }

    const amount = formatWeiToNumber(transaction.amount)
    if (transaction.direction === "received") {
      bucket.income += amount
    } else if (transaction.direction === "sent") {
      bucket.expenses += amount
    }
  })

  return buckets.map((bucket) => ({
    ...bucket,
    income: Number(bucket.income.toFixed(2)),
    expenses: Number(bucket.expenses.toFixed(2)),
  }))
}

function finalizeRange(start: Date, end: Date): ChartRange {
  let rangeStart = startOfDay(start)
  let rangeEnd = endOfDay(end)

  if (rangeStart > rangeEnd) {
    const swap = rangeStart
    rangeStart = rangeEnd
    rangeEnd = swap
  }

  return {
    startDate: rangeStart,
    endDate: rangeEnd,
    granularity: "day",
    label: formatRangeLabel(rangeStart, rangeEnd),
  }
}

function getRangeFromPreset(preset: RangePreset): ChartRange {
  const now = endOfDay(new Date())
  const start = startOfDay(new Date(now))

  switch (preset) {
    case "7d":
      start.setDate(start.getDate() - 6)
      break
    case "30d":
      start.setDate(start.getDate() - 29)
      break
    case "3m":
    default:
      start.setMonth(start.getMonth() - 2)
      start.setDate(1)
      break
  }

  return finalizeRange(start, now)
}

function getTrendCopy(data: ChartPoint[]) {
  if (data.length < 2) {
    return {
      direction: "neutral" as const,
      percentage: 0,
      message: "Not enough data to calculate trends yet.",
    }
  }

  const lastPoint = data[data.length - 1]
  const prevPoint = data[data.length - 2]
  const lastNet = lastPoint.income - lastPoint.expenses
  const prevNet = prevPoint.income - prevPoint.expenses

  if (prevNet === 0) {
    return {
      direction: "neutral" as const,
      percentage: 0,
      message: "Tracking net flow for the latest period.",
    }
  }

  const change = ((lastNet - prevNet) / Math.abs(prevNet)) * 100

  return {
    direction: change >= 0 ? ("positive" as const) : ("negative" as const),
    percentage: Number(change.toFixed(1)),
    message:
      change >= 0
        ? "Net flow improved compared to the previous period."
        : "Net flow dipped compared to the previous period.",
  }
}

export default function TransactionHistoryPage() {
  const router = useRouter()
  const { hash } = router.query
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rangePreset, setRangePreset] = useState<RangePreset>("3m")
  const [chartView, setChartView] = useState<ChartView>("both")
  const [chartAnimationKey, setChartAnimationKey] = useState(0)

  // Refs for animated amount values
  const incomeAmountRef = useRef<HTMLHeadingElement>(null)
  const expenseAmountRef = useRef<HTMLHeadingElement>(null)
  const netFlowAmountRef = useRef<HTMLHeadingElement>(null)

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

  const toggleChartView = (view: ChartView) => {
    setChartView((prev) => (prev === view ? "both" : view))
    setChartAnimationKey((key) => key + 1)
  }

  const handleStatCardKeyDown = (
    event: KeyboardEvent<HTMLDivElement>,
    view: ChartView
  ) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      toggleChartView(view)
    }
  }

  const renderPage = (content: React.ReactNode) => (
    <div className={`${styles.transactionTheme} min-h-screen bg-background py-8 px-4 sm:px-6 lg:px-8`}>
      <div className="w-full">{content}</div>
    </div>
  )

  const selectedRange = useMemo(() => getRangeFromPreset(rangePreset), [
    rangePreset,
  ])

  const chartData = useMemo(
    () => buildChartData(transactions, selectedRange),
    [transactions, selectedRange]
  )

  const trend = useMemo(() => getTrendCopy(chartData), [chartData])

  const chartSummary = useMemo(() => {
    if (!chartData.length) {
      return {
        totalIncome: 0,
        totalExpenses: 0,
        latestIncome: 0,
        latestExpenses: 0,
        incomeChange: 0,
        expenseChange: 0,
        netFlow: 0,
      }
    }

    const totalIncome = chartData.reduce((sum, point) => sum + point.income, 0)
    const totalExpenses = chartData.reduce(
      (sum, point) => sum + point.expenses,
      0
    )
    const lastPoint = chartData[chartData.length - 1]
    const prevPoint =
      chartData.length > 1 ? chartData[chartData.length - 2] : undefined

    const incomeChange = prevPoint
      ? ((lastPoint.income - prevPoint.income) /
        Math.max(prevPoint.income || 1, 1)) *
      100
      : 0
    const expenseChange = prevPoint
      ? ((lastPoint.expenses - prevPoint.expenses) /
        Math.max(prevPoint.expenses || 1, 1)) *
      100
      : 0

    return {
      totalIncome: Number(totalIncome.toFixed(2)),
      totalExpenses: Number(totalExpenses.toFixed(2)),
      latestIncome: lastPoint.income,
      latestExpenses: lastPoint.expenses,
      incomeChange: Number(incomeChange.toFixed(1)),
      expenseChange: Number(expenseChange.toFixed(1)),
      netFlow: Number((lastPoint.income - lastPoint.expenses).toFixed(2)),
    }
  }, [chartData])

  // Animate income amount
  useEffect(() => {
    const node = incomeAmountRef.current
    if (!node) return

    const controls = animate(0, chartSummary.totalIncome, {
      duration: 1.5,
      ease: "easeOut",
      onUpdate(value) {
        node.textContent = formatDisplayAmount(value)
      },
    })

    return () => controls.stop()
  }, [chartSummary.totalIncome])

  // Animate expense amount
  useEffect(() => {
    const node = expenseAmountRef.current
    if (!node) return

    const controls = animate(0, chartSummary.totalExpenses, {
      duration: 1.5,
      ease: "easeOut",
      onUpdate(value) {
        node.textContent = formatDisplayAmount(value)
      },
    })

    return () => controls.stop()
  }, [chartSummary.totalExpenses])

  // Animate net flow amount
  useEffect(() => {
    const node = netFlowAmountRef.current
    if (!node) return

    const controls = animate(0, chartSummary.netFlow, {
      duration: 1.5,
      ease: "easeOut",
      onUpdate(value) {
        node.textContent = formatDisplayAmount(value)
      },
    })

    return () => controls.stop()
  }, [chartSummary.netFlow])

  const showIncomeLine = chartView !== "expenses"
  const showExpenseLine = chartView !== "income"
  const incomeCardActive = chartView === "income"
  const expenseCardActive = chartView === "expenses"

  const transactionsInRange = useMemo(
    () =>
      transactions.filter((transaction) => {
        const txDate = new Date(transaction.timestamp * 1000)
        return txDate >= selectedRange.startDate && txDate <= selectedRange.endDate
      }),
    [transactions, selectedRange]
  )

  // Additional metrics for the expanded layout
  const additionalMetrics = useMemo(() => {
    if (transactionsInRange.length === 0) {
      return {
        totalTransactions: 0,
        avgTransactionSize: 0,
        largestTransaction: 0,
        sentCount: 0,
        receivedCount: 0,
        velocityThisWeek: 0,
        velocityLastWeek: 0,
        totalVolume: 0,
        tokenBreakdown: {} as Record<string, { count: number; total: number }>,
      }
    }

    const sentTxs = transactionsInRange.filter((t) => t.direction === "sent")
    const receivedTxs = transactionsInRange.filter((t) => t.direction === "received")

    const amounts = transactionsInRange.map((t) => formatWeiToNumber(t.amount))
    const avgTransactionSize = amounts.reduce((sum, amt) => sum + amt, 0) / amounts.length
    const largestTransaction = Math.max(...amounts)
    const totalVolume = chartSummary.totalIncome + chartSummary.totalExpenses

    // Calculate velocity (transactions this week vs last week)
    const now = new Date()
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)

    const thisWeekTxs = transactions.filter((tx) => {
      const txDate = new Date(tx.timestamp * 1000)
      return txDate >= oneWeekAgo && txDate <= now
    }).length

    const lastWeekTxs = transactions.filter((tx) => {
      const txDate = new Date(tx.timestamp * 1000)
      return txDate >= twoWeeksAgo && txDate < oneWeekAgo
    }).length

    // Token breakdown
    const tokenMap = new Map<string, { count: number; total: number }>()
    transactionsInRange.forEach((tx) => {
      const token = tx.token || "SOM"
      const existing = tokenMap.get(token) || { count: 0, total: 0 }
      tokenMap.set(token, {
        count: existing.count + 1,
        total: existing.total + formatWeiToNumber(tx.amount),
      })
    })
    const tokenBreakdown = Object.fromEntries(tokenMap)

    return {
      totalTransactions: transactionsInRange.length,
      avgTransactionSize: Number(avgTransactionSize.toFixed(2)),
      largestTransaction: Number(largestTransaction.toFixed(2)),
      sentCount: sentTxs.length,
      receivedCount: receivedTxs.length,
      velocityThisWeek: thisWeekTxs,
      velocityLastWeek: lastWeekTxs,
      totalVolume: Number(totalVolume.toFixed(2)),
      tokenBreakdown,
    }
  }, [transactionsInRange, transactions, chartSummary])

  // Calculate velocity change percentage
  const velocityChange = useMemo(() => {
    if (additionalMetrics.velocityLastWeek === 0) return 0
    return ((additionalMetrics.velocityThisWeek - additionalMetrics.velocityLastWeek) / additionalMetrics.velocityLastWeek) * 100
  }, [additionalMetrics])

  // Calculate net flow percentage (for account health)
  const netFlowPercentage = useMemo(() => {
    if (additionalMetrics.totalVolume === 0) return 0
    return (chartSummary.netFlow / additionalMetrics.totalVolume) * 100
  }, [chartSummary.netFlow, additionalMetrics.totalVolume])

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

  const primaryToken =
    transactionsInRange[0]?.token || transactions[0]?.token || "SOM"

  return renderPage(
    <Card className="rounded-2xl border border-[#e2e8f0] bg-white px-8 py-8 shadow-lg gap-0 space-y-10">
      {/* Header Section */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="mb-2">
            <Badge
              variant="outline"
              className="rounded-sm bg-[#dff5e1] border-transparent px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#15803d]"
            >
              <Activity className="h-3.5 w-3.5" />
              Transaction Dashboard
            </Badge>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-[#111827]">
            Account Analytics
          </h1>
          <p className="mt-2 text-sm text-[#4b5563]">
            Account: <span className="font-mono font-medium text-[#374151]">{hash.slice(0, 12)}...{hash.slice(-10)}</span>
          </p>
        </div>
        <motion.a
          href={`${EXPLORER_URL}/address/${hash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-9 items-center gap-2 rounded-lg bg-[#111827] px-4 text-sm font-semibold text-white transition hover:bg-[#1f2937] hover:shadow-md"
          whileHover={{ scale: 1.02, y: -1 }}
          transition={{ type: "spring", stiffness: 250, damping: 20 }}
        >
          <ExternalLink className="h-4 w-4" />
          Explorer
        </motion.a>
      </div>

      {/* SECTION 1: Top-Level Summary Cards (Four Key Metrics) */}
      <motion.div
        className="grid gap-6 md:grid-cols-2 lg:grid-cols-4"
        initial="hidden"
        animate="visible"
        variants={{
          hidden: {},
          visible: {
            transition: {
              staggerChildren: 0.1,
              delayChildren: 0.1,
            },
          },
        }}
      >
        {/* Card 1: Account Health/Net Flow */}
        <motion.div
          variants={{
            hidden: { opacity: 0, y: 20 },
            visible: { opacity: 1, y: 0 },
          }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="rounded-xl border-2 border-[#e2e8f0] bg-white p-6 shadow-md cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => {
            if (chartView !== "both") {
              toggleChartView("both")
            }
          }}
        >
          <div className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#4b5563] mb-1">
              Account Health
            </p>
            <div className="flex items-baseline gap-2">
              <h2 className="text-3xl font-bold text-[#111827]">
                {netFlowPercentage >= 0 ? "+" : ""}{netFlowPercentage.toFixed(1)}%
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={`h-6 px-2.5 text-xs font-medium ${chartSummary.netFlow >= 0
                ? "bg-[#dff5e1] text-[#15803d] border-[#16a34a]"
                : "bg-[#fee2e2] text-[#dc2626] border-[#dc2626]"
                }`}
            >
              {formatDisplayAmount(chartSummary.netFlow)} {primaryToken}
            </Badge>
            <span className="text-xs text-[#4b5563]">Net Flow</span>
          </div>
        </motion.div>

        {/* Card 2: Total Transactions */}
        <motion.div
          variants={{
            hidden: { opacity: 0, y: 20 },
            visible: { opacity: 1, y: 0 },
          }}
          transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
          className="rounded-xl border-2 border-[#e2e8f0] bg-white p-6 shadow-md"
        >
          <div className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#4b5563] mb-1">
              Total Transactions
            </p>
            <div className="flex items-baseline gap-2">
              <h2 className="text-3xl font-bold text-[#111827]">
                {additionalMetrics.totalTransactions}
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="h-6 border-[#e2e8f0] bg-[#f9fafb] px-2.5 text-xs font-medium text-[#374151]"
            >
              {additionalMetrics.sentCount} sent · {additionalMetrics.receivedCount} received
            </Badge>
          </div>
        </motion.div>

        {/* Card 3: Transaction Velocity */}
        <motion.div
          variants={{
            hidden: { opacity: 0, y: 20 },
            visible: { opacity: 1, y: 0 },
          }}
          transition={{ duration: 0.6, ease: "easeOut", delay: 0.2 }}
          className="rounded-xl border-2 border-[#e2e8f0] bg-white p-6 shadow-md"
        >
          <div className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#4b5563] mb-1">
              This Week
            </p>
            <div className="flex items-baseline gap-2">
              <h2 className="text-3xl font-bold text-[#111827]">
                {additionalMetrics.velocityThisWeek}
              </h2>
              <span className="text-sm text-[#4b5563]">txns</span>
            </div>
          </div>
          {velocityChange !== 0 && (
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className={`h-6 border-0 px-2.5 text-xs font-medium ${velocityChange >= 0
                  ? "bg-[#dff5e1] text-[#15803d]"
                  : "bg-[#fee2e2] text-[#dc2626]"
                  }`}
              >
                {velocityChange >= 0 ? (
                  <ArrowUp className="h-3 w-3 inline mr-1" />
                ) : (
                  <ArrowDown className="h-3 w-3 inline mr-1" />
                )}
                {Math.abs(velocityChange).toFixed(1)}% vs last week
              </Badge>
            </div>
          )}
        </motion.div>

        {/* Card 4: Total Volume */}
        <motion.div
          variants={{
            hidden: { opacity: 0, y: 20 },
            visible: { opacity: 1, y: 0 },
          }}
          transition={{ duration: 0.6, ease: "easeOut", delay: 0.3 }}
          className="rounded-xl border-2 border-[#e2e8f0] bg-white p-6 shadow-md"
        >
          <div className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#4b5563] mb-1">
              Total Volume
            </p>
            <div className="flex items-baseline gap-2">
              <h2 className="text-3xl font-bold text-[#111827]">
                {formatDisplayAmount(additionalMetrics.totalVolume)}
              </h2>
              <span className="text-sm text-[#4b5563]">{primaryToken}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="h-6 border-[#e2e8f0] bg-[#f9fafb] px-2.5 text-xs font-medium text-[#374151]"
            >
              Income + Expenses
            </Badge>
          </div>
        </motion.div>
      </motion.div>

      {/* SECTION 2: Main Analytics Section */}
      <div className="flex flex-col gap-6 rounded-xl border-2 border-[#e2e8f0] bg-white p-6 shadow-md">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[#4b5563]">
                Cashflow Trend
              </p>
              <h2 className="text-2xl font-bold tracking-tight text-[#111827]">
                Income vs Expenses
              </h2>
            </div>
            <Select
              value={rangePreset}
              onValueChange={(value) => setRangePreset(value as RangePreset)}
            >
              <SelectTrigger
                size="sm"
                className="h-8 rounded-sm border border-[#e2e8f0] px-3 text-sm font-semibold bg-white hover:bg-[#f9fafb] data-[state=open]:bg-[#f9fafb]"
                aria-label="Select cashflow range"
              >
                <SelectValue placeholder="Last 3 months" />
              </SelectTrigger>
              <SelectContent
                align="end"
                position="popper"
                sideOffset={4}
                className="w-[180px] rounded-lg border border-[#e2e8f0] bg-white shadow-lg"
              >
                {RANGE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-3">
            <p className="text-sm text-[#4b5563]">
              {selectedRange.label}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => toggleChartView("income")}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${chartView === "income"
                  ? "bg-[#16a34a] text-white"
                  : "bg-[#f9fafb] text-[#4b5563] hover:bg-[#e5e7eb]"
                  }`}
              >
                Income
              </button>
              <button
                onClick={() => toggleChartView("expenses")}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${chartView === "expenses"
                  ? "bg-[#dc2626] text-white"
                  : "bg-[#f9fafb] text-[#4b5563] hover:bg-[#e5e7eb]"
                  }`}
              >
                Expenses
              </button>
            </div>
          </div>
        </div>
        <motion.div
          key={chartAnimationKey}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="w-full"
        >
          <ChartContainer config={chartConfig} className="h-80 w-full">
            <LineChart
              accessibilityLayer
              data={chartData}
              margin={{
                left: 12,
                right: 12,
                top: 12,
                bottom: 12,
              }}
            >
              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tick={{ fill: "#4b5563", fontSize: 12 }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tick={{ fill: "#4b5563", fontSize: 12 }}
              />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    indicator="line"
                    formatter={(value, name) => (
                      <div className="flex w-full items-center justify-between">
                        <span>
                          {chartConfig[name as keyof typeof chartConfig]
                            ?.label || name}
                        </span>
                        <span className="font-mono font-semibold">
                          {Number(value).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}{" "}
                          {primaryToken}
                        </span>
                      </div>
                    )}
                  />
                }
              />
              {showIncomeLine && (
                <Line
                  dataKey="income"
                  type="monotone"
                  stroke="#16a34a"
                  strokeWidth={2.5}
                  dot={false}
                />
              )}
              {showExpenseLine && (
                <Line
                  dataKey="expenses"
                  type="monotone"
                  stroke="#dc2626"
                  strokeWidth={2.5}
                  dot={false}
                />
              )}
            </LineChart>
          </ChartContainer>
        </motion.div>
        <div className="flex items-center justify-center gap-6 pt-4 border-t border-[#e2e8f0]">
          {showIncomeLine && (
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-[#16a34a]"></div>
              <span className="text-xs font-medium text-[#4b5563]">Income</span>
            </div>
          )}
          {showExpenseLine && (
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-[#dc2626]"></div>
              <span className="text-xs font-medium text-[#4b5563]">Expenses</span>
            </div>
          )}
        </div>
      </div>

      {/* SECTION 3: Bottom Section - Detailed Transaction Table */}
      <Separator />

      <div className="flex flex-col gap-6">
        {/* Section Header */}
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-bold tracking-tight text-[#111827]">
            Recent Activities
          </h2>
          <p className="text-sm text-[#4b5563]">
            Detailed transaction log with search, filter, and export capabilities.
          </p>
        </div>

        {/* Transaction Table */}
        {transactions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#cbd5e1] bg-[#f9fafb] p-10 text-center">
            <p className="text-lg font-semibold text-[#374151]">
              No transactions found
            </p>
            <p className="mt-2 text-sm text-[#4b5563]">
              Start sending or receiving transfers to see your activity here.
            </p>
          </div>
        ) : (
          <div className="w-full">
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
    </Card>
  )
}

