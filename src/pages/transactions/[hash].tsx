// src/pages/transactions/[hash].tsx
"use client"

import Image from "next/image"
import { Activity, TrendingUp } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/router"
import { CartesianGrid, Line, LineChart, XAxis } from "recharts"

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
import { transactionColumns, Transaction } from "@/lib/transaction-columns"
import { StatsCard } from "@/components/ui/activity-stats-card"

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

  const transactionsInRange = useMemo(
    () =>
      transactions.filter((transaction) => {
        const txDate = new Date(transaction.timestamp * 1000)
        return txDate >= selectedRange.startDate && txDate <= selectedRange.endDate
      }),
    [transactions, selectedRange]
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

  const primaryToken =
    transactionsInRange[0]?.token || transactions[0]?.token || "SOM"

  return renderPage(
    <div className="flex flex-col gap-6">
      <Card className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <CardHeader className="gap-6 pb-6">
          <div className="flex flex-col gap-3">
            <div className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Transaction History
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="text-3xl font-semibold text-slate-900">
                Account Overview
              </CardTitle>
              <a
                href={`${EXPLORER_URL}/address/${hash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-8 items-center rounded-sm border px-3 text-sm font-medium 
                text-slate-600 transition hover:border-slate-400 hover:text-slate-800"
                
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
                {transactionsInRange.length}
              </span>{" "}
              transaction{transactionsInRange.length !== 1 ? "s" : ""} in the
              selected range.
            </p>
          </div>

        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <StatsCard
              title="Income"
              metric={chartSummary.totalIncome}
              metricUnit={primaryToken}
              subtext={`Latest period: ${formatDisplayAmount(
                chartSummary.latestIncome
              )} ${primaryToken}`}
              icon={
                <Image
                  src="/received.png"
                  alt="Income"
                  width={24}
                  height={24}
                  className="h-6 w-6"
                />
              }
              amountColorClassName="text-emerald-600"
            />
            <StatsCard
              title="Expense"
              metric={chartSummary.totalExpenses}
              metricUnit={primaryToken}
              subtext={`Latest period: ${formatDisplayAmount(
                chartSummary.latestExpenses
              )} ${primaryToken}`}
              icon={
                <Image
                  src="/sent.png"
                  alt="Expenses"
                  width={24}
                  height={24}
                  className="h-6 w-6"
                />
              }
              amountColorClassName="text-rose-600"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <StatsCard
              title="Net Flow (Latest Period)"
              metric={chartSummary.netFlow}
              metricUnit={primaryToken}
              subtext="Income minus expenses for the most recent period."
              icon={<TrendingUp className="h-6 w-6 text-slate-600" />}
              amountColorClassName={
                chartSummary.netFlow >= 0 ? "text-emerald-600" : "text-rose-600"
              }
            />
            <StatsCard
              title="Transactions Recorded"
              metric={transactionsInRange.length}
              subtext="Within the selected range."
              icon={<Activity className="h-6 w-6 text-slate-600" />}
              decimalPlaces={0}
              amountColorClassName="text-slate-900"
            />
          </div>
        </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-col gap-4 pb-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Cashflow
                </p>
                <p className="text-xl font-semibold text-slate-900">
                  Income vs. Expenses
                </p>
                <p className="text-sm text-slate-500">{selectedRange.label}</p>
              </div>
              <div className="flex items-center gap-2">
                <Select
                  value={rangePreset}
                  onValueChange={(value) => setRangePreset(value as RangePreset)}
                >
                  <SelectTrigger
                    size="sm"
                    className="h-8 rounded-sm border px-3 text-sm font-semibold data-[state=open]:bg-accent"
                    aria-label="Select cashflow range"
                  >
                    <SelectValue placeholder="Last 3 months" />
                  </SelectTrigger>
                  <SelectContent
                    align="end"
                    position="popper"
                    sideOffset={4}
                    className="w-[180px] rounded-lg border border-slate-200 bg-white shadow-lg"
                  >
                    {RANGE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <ChartContainer config={chartConfig} className="h-64 w-full">
            <LineChart
              accessibilityLayer
              data={chartData}
              margin={{
                left: 12,
                right: 12,
              }}
            >
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
              />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    indicator="line"
                    formatter={(value, name) => (
                      <div className="flex w-full items-center justify-between">
                        <span>
                          {chartConfig[name as keyof typeof chartConfig]?.label ||
                            name}
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
              <Line
                dataKey="income"
                type="monotone"
                stroke="#059669"
                strokeWidth={2}
                dot={false}
              />
              <Line
                dataKey="expenses"
                type="monotone"
                stroke="#dc2626"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ChartContainer>
          <div className="mt-4 flex flex-wrap justify-center gap-6 border-t border-slate-100 pt-4">
            <div className="flex items-center gap-3">
              <Image
                src="/received.png"
                alt="Income"
                width={18}
                height={18}
                className="h-5 w-5"
              />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Income
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Image
                src="/sent.png"
                alt="Expenses"
                width={18}
                height={18}
                className="h-5 w-5"
              />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Expenses
                </p>
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter className="border-t border-slate-100 pt-6">
          <div className="flex w-full flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                <TrendingUp
                  className={`h-5 w-5 ${
                    trend.direction === "negative"
                      ? "rotate-180 text-rose-500"
                      : ""
                  }`}
                />
              </div>
              <div>
                <p className="text-base font-semibold text-slate-900">
                  {trend.direction === "negative"
                    ? "Net outflow for the latest period"
                    : "Net inflow for the latest period"}{" "}
                  of {formatDisplayAmount(Math.abs(chartSummary.netFlow))}{" "}
                  {primaryToken}
                </p>
                <p className="text-sm text-slate-500">
                  {trend.direction === "negative"
                    ? "Monitoring expenses can help rebalance cashflow."
                    : "Keep the momentum going with consistent incoming funds."}
                </p>
              </div>
            </div>
            <div className="text-sm font-medium text-slate-600">
              {trend.direction === "negative" ? "Trending down" : "Trending up"}{" "}
              by {Math.abs(trend.percentage).toFixed(1)}% · {trend.message}
            </div>
          </div>
        </CardFooter>
      </Card>

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

