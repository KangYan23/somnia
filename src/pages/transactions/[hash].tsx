// src/pages/transactions/[hash].tsx
"use client"

import Image from "next/image"
import { Activity, TrendingUp, Check, ArrowUp, ArrowDown, ExternalLink, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react"
import { useEffect, useMemo, useState, useRef, type KeyboardEvent } from "react"
import { motion, animate } from "framer-motion"
import { useRouter } from "next/router"
import { CartesianGrid, Line, LineChart, XAxis, YAxis, RadialBar, RadialBarChart, Area, AreaChart, Bar, BarChart } from "recharts"
import { format, addDays, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, startOfDay, endOfDay } from "date-fns"

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
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { CalendarIcon } from "lucide-react"
import { cn } from "@/lib/utils"

import WavyBackground from "../../../components/WavyBackground"
import { ConnectButton } from "@rainbow-me/rainbowkit"

const EXPLORER_URL =
  process.env.NEXT_PUBLIC_BLOCKCHAIN_EXPLORER_URL ||
  "https://shannon-explorer.somnia.network"

const chartConfig = {
  income: {
    label: "Income",
    color: "#16a34a",
  },
  expenses: {
    label: "Expenses",
    color: "#dff5e1",
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



function formatInputDate(date: Date) {
  // Format date in local timezone to avoid UTC conversion issues
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatDisplayDate(date: Date) {
  // Format date for display as "11 Nov"
  const day = date.getDate()
  const month = date.toLocaleDateString(undefined, { month: 'short' })
  return `${day} ${month}`
}

function parseInputDate(value: string) {
  if (!value) return null
  // Parse as local date to avoid timezone shift
  const [year, month, day] = value.split('-').map(Number)
  const parsed = new Date(year, month - 1, day)
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
  // Default start date is November 1st, 2025
  let start = new Date(now)
  start.setFullYear(2025)
  start.setMonth(10) // November is month 10 (0-indexed)
  start.setDate(1)
  start = startOfDay(start)

  // For presets, adjust end date as needed
  switch (preset) {
    case "7d":
      start = new Date(now)
      start.setDate(start.getDate() - 6)
      start = startOfDay(start)
      break
    case "30d":
      start = new Date(now)
      start.setDate(start.getDate() - 29)
      start = startOfDay(start)
      break
    case "3m":
    default:
      // Keep November 1st as start for default
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
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>(undefined)
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>(undefined)
  const [isUsingCustomRange, setIsUsingCustomRange] = useState(false)

  // Separate state for table-only date filtering
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }))

  // Generate calendar days for the current week
  const calendarDays = useMemo(() => {
    const end = endOfWeek(currentWeekStart, { weekStartsOn: 1 })
    return eachDayOfInterval({ start: currentWeekStart, end })
  }, [currentWeekStart])

  const handlePrevWeek = () => {
    setCurrentWeekStart(prev => addDays(prev, -7))
  }

  const handleNextWeek = () => {
    setCurrentWeekStart(prev => addDays(prev, 7))
  }

  // Filter transactions for the table based on selected date
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      const txDate = new Date(Number(tx.timestamp) * 1000)
      return isSameDay(txDate, selectedDate)
    })
  }, [transactions, selectedDate])



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

    // Initial fetch
    fetchTransactions()

    // Set up polling interval to fetch new transactions every 10 seconds
    const pollInterval = setInterval(() => {
      // Fetch without showing loading state for polling updates
      async function pollTransactions() {
        try {
          const response = await fetch(`/api/transactions/${hash}`)
          const data = await response.json()

          if (response.ok && data.success) {
            setTransactions(data.transactions || [])
          }
        } catch (err) {
          // Silently fail for polling updates to avoid disrupting UX
          console.error("Failed to poll transactions:", err)
        }
      }
      pollTransactions()
    }, 10000) // Poll every 10 seconds

    // Cleanup interval on unmount or hash change
    return () => clearInterval(pollInterval)
  }, [hash])

  // Trigger chart animation when transactions update (for real-time updates)
  useEffect(() => {
    if (transactions.length > 0) {
      setChartAnimationKey((key) => key + 1)
    }
  }, [transactions.length])


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
    <div className="min-h-screen relative overflow-hidden">
      <div className="absolute inset-0 z-0">
        <WavyBackground />
      </div>
      <div className="relative z-10 py-8 px-4 sm:px-6 lg:px-8">
        <div className="w-full">{content}</div>
      </div>
    </div>
  )

  const selectedRange = useMemo(() => {
    // Use custom date range if both dates are selected or if using custom range
    if (isUsingCustomRange && customStartDate && customEndDate) {
      return finalizeRange(customStartDate, customEndDate)
    } else if (isUsingCustomRange && customStartDate && !customEndDate) {
      // If only start date is selected, use start date to current date
      return finalizeRange(customStartDate, new Date())
    } else if (isUsingCustomRange && !customStartDate && customEndDate) {
      // If only end date is selected, use 30 days before end date to end date
      const startDate = new Date(customEndDate)
      startDate.setDate(startDate.getDate() - 30)
      return finalizeRange(startDate, customEndDate)
    }
    // Otherwise use preset range
    return getRangeFromPreset(rangePreset)
  }, [rangePreset, customStartDate, customEndDate, isUsingCustomRange])

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
    <div className="space-y-10 fade-in">
      {/* Header Section */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Account Analytics
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <ConnectButton />
          <motion.a
            href={`${EXPLORER_URL}/address/${hash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-9 items-center gap-2 rounded-lg bg-[#000000] px-4 text-sm font-semibold text-primary-foreground transition-all duration-200 hover:bg-primary/90 hover:shadow-md zoom-in"
            whileHover={{ scale: 1.02, y: -1 }}
            transition={{ type: "spring", stiffness: 250, damping: 20 }}
          >
            <ExternalLink className="h-4 w-4" />
            Explorer
          </motion.a>
        </div>
      </div>

      {/* SECTION 1 & 2: Combined Layout - Cards and Analytics */}
      <div className="grid gap-6 lg:grid-cols-5">
        {/* Left Section: Cards (3 columns) */}
        <div className="lg:col-span-3">
          <motion.div
            className="grid gap-4 grid-cols-1 md:grid-cols-3 mb-6"
            initial="hidden"
            animate="visible"
            variants={{
              hidden: {},
              visible: {
                transition: {
                  staggerChildren: 0.05,
                  delayChildren: 0.1,
                },
              },
            }}
          >
            {/* Card 1: Net Flow */}
            <motion.div
              variants={{
                hidden: { opacity: 0, y: 20 },
                visible: { opacity: 1, y: 0 },
              }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="rounded-lg border border-border bg-card p-4 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer hover:scale-[1.02] slide-in"
              onClick={() => {
                if (chartView !== "both") {
                  toggleChartView("both")
                }
              }}
            >
              <div className="flex items-start justify-between mb-2">
                <p className="text-xs font-medium text-muted-foreground">Net Flow</p>
                <span className={`text-xs font-semibold ${chartSummary.netFlow >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {chartSummary.netFlow >= 0 ? '↑' : '↓'}{Math.abs(trend.percentage)}%
                </span>
              </div>
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-2xl font-bold text-foreground mb-1">
                    {chartSummary.netFlow >= 0 ? "+" : ""}{formatDisplayAmount(Math.abs(chartSummary.netFlow))}
                  </p>
                  <p className="text-xs text-muted-foreground">from {transactionsInRange.length} (last 30 days)</p>
                </div>
                <div className="flex-1 max-w-[120px]">
                  <ChartContainer
                    config={{
                      netFlow: {
                        label: "Net Flow",
                        color: chartSummary.netFlow >= 0 ? "#059669" : "#ef4444",
                      },
                    }}
                    className="h-[50px] w-full"
                  >
                    <AreaChart
                      data={chartData.slice(-7).map((point) => ({
                        value: point.income - point.expenses,
                      }))}
                      margin={{ top: 5, right: 0, left: 0, bottom: 5 }}
                    >
                      <defs>
                        <linearGradient id="fillNetFlow" x1="0" y1="0" x2="0" y2="1">
                          <stop
                            offset="5%"
                            stopColor={chartSummary.netFlow >= 0 ? "#059669" : "#ef4444"}
                            stopOpacity={0.8}
                          />
                          <stop
                            offset="95%"
                            stopColor={chartSummary.netFlow >= 0 ? "#059669" : "#ef4444"}
                            stopOpacity={0.1}
                          />
                        </linearGradient>
                      </defs>
                      <Area
                        type="monotone"
                        dataKey="value"
                        stroke={chartSummary.netFlow >= 0 ? "#059669" : "#ef4444"}
                        fill="url(#fillNetFlow)"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ChartContainer>
                </div>
              </div>
            </motion.div>

            {/* Card 2: Total Transactions */}
            <motion.div
              variants={{
                hidden: { opacity: 0, y: 20 },
                visible: { opacity: 1, y: 0 },
              }}
              transition={{ duration: 0.4, ease: "easeOut", delay: 0.05 }}
              className="rounded-lg border border-border bg-card p-4 shadow-sm hover:shadow-md transition-all duration-200 slide-in"
            >
              <div className="flex items-start justify-between mb-2">
                <p className="text-xs font-medium text-muted-foreground">Total Txns</p>
                <span className={`text-xs font-semibold ${velocityChange >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {velocityChange >= 0 ? '↑' : '↓'}{Math.abs(velocityChange).toFixed(0)}%
                </span>
              </div>
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-2xl font-bold text-foreground mb-1">
                    {additionalMetrics.totalTransactions}
                  </p>
                  <p className="text-xs text-muted-foreground">from {transactionsInRange.length} (last 30 days)</p>
                </div>
                <div className="flex-1 max-w-[120px]">
                  <ChartContainer
                    config={{
                      transactions: {
                        label: "Transactions",
                        color: "#10b981",
                      },
                    }}
                    className="h-[50px] w-full"
                  >
                    <AreaChart
                      data={chartData.slice(-7).map((point, idx) => ({
                        value: transactionsInRange.filter((tx) => {
                          const txDate = new Date(tx.timestamp * 1000);
                          const pointDate = new Date(point.key);
                          return txDate.toDateString() === pointDate.toDateString();
                        }).length,
                      }))}
                      margin={{ top: 5, right: 0, left: 0, bottom: 5 }}
                    >
                      <defs>
                        <linearGradient id="fillTransactions" x1="0" y1="0" x2="0" y2="1">
                          <stop
                            offset="5%"
                            stopColor="#10b981"
                            stopOpacity={0.8}
                          />
                          <stop
                            offset="95%"
                            stopColor="#10b981"
                            stopOpacity={0.1}
                          />
                        </linearGradient>
                      </defs>
                      <Area
                        type="monotone"
                        dataKey="value"
                        stroke="#10b981"
                        fill="url(#fillTransactions)"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ChartContainer>
                </div>
              </div>
            </motion.div>

            {/* Card 3: Total Volume */}
            <motion.div
              variants={{
                hidden: { opacity: 0, y: 20 },
                visible: { opacity: 1, y: 0 },
              }}
              transition={{ duration: 0.4, ease: "easeOut", delay: 0.1 }}
              className="rounded-lg border border-border bg-card p-4 shadow-sm hover:shadow-md transition-all duration-200 slide-in"
            >
              <div className="flex items-start justify-between mb-2">
                <p className="text-xs font-medium text-muted-foreground">Total Volume</p>
                <span className={`text-xs font-semibold ${chartSummary.incomeChange >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {chartSummary.incomeChange >= 0 ? '↑' : '↓'}{Math.abs(chartSummary.incomeChange).toFixed(0)}%
                </span>
              </div>
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-2xl font-bold text-foreground mb-1">
                    {formatDisplayAmount(additionalMetrics.totalVolume)}
                  </p>
                  <p className="text-xs text-muted-foreground">from {transactionsInRange.length} (last 30 days)</p>
                </div>
                <div className="flex-1 max-w-[120px]">
                  <ChartContainer
                    config={{
                      volume: {
                        label: "Volume",
                        color: "#34d399",
                      },
                    }}
                    className="h-[50px] w-full"
                  >
                    <AreaChart
                      data={chartData.slice(-7).map((point) => ({
                        value: point.income + point.expenses,
                      }))}
                      margin={{ top: 5, right: 0, left: 0, bottom: 5 }}
                    >
                      <defs>
                        <linearGradient id="fillVolume" x1="0" y1="0" x2="0" y2="1">
                          <stop
                            offset="5%"
                            stopColor="#34d399"
                            stopOpacity={0.8}
                          />
                          <stop
                            offset="95%"
                            stopColor="#34d399"
                            stopOpacity={0.1}
                          />
                        </linearGradient>
                      </defs>
                      <Area
                        type="monotone"
                        dataKey="value"
                        stroke="#34d399"
                        fill="url(#fillVolume)"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ChartContainer>
                </div>
              </div>
            </motion.div>
          </motion.div>

          {/* Analytics Chart Section */}
          <div className="bg-gradient-to-br from-card to-card/80 rounded-2xl border border-border/50 p-8 shadow-xl backdrop-blur-sm">
            <div className="space-y-6">
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ background: '#16a34a' }}></div>
                    <span className="text-sm font-medium text-foreground">Income</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ background: '#dff5e1', border: '1px solid #16a34a' }}></div>
                    <span className="text-sm font-medium text-foreground">Expenses</span>
                  </div>
                </div>

                <div className="flex items-center gap-3 justify-end">
                  {isUsingCustomRange && (
                    <button
                      onClick={() => {
                        setIsUsingCustomRange(false)
                        setCustomStartDate(undefined)
                        setCustomEndDate(undefined)
                        setRangePreset("30d")
                        setChartAnimationKey(key => key + 1)
                      }}
                      className="px-2 py-1 text-xs rounded-md bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Reset
                    </button>
                  )}
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-medium text-muted-foreground">From:</span>
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          className={cn(
                            "px-3 py-1 text-sm rounded-md focus:outline-none flex items-center gap-2 min-w-[100px] justify-between",
                            customStartDate && isUsingCustomRange ? "bg-white text-black" : "bg-white text-black"
                          )}
                          style={{}}
                        >
                          {(customStartDate && isUsingCustomRange) ? formatDisplayDate(customStartDate) : formatDisplayDate(selectedRange.startDate)}
                          <ChevronDown className="h-3 w-3 opacity-50" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={customStartDate || selectedRange.startDate}
                          onSelect={(date) => {
                            if (date) {
                              setCustomStartDate(date)
                              setIsUsingCustomRange(true)
                              setChartAnimationKey(key => key + 1) // Trigger chart animation
                            }
                          }}
                          disabled={(date) =>
                            date > new Date() || date < new Date("1900-01-01")
                          }
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-medium text-muted-foreground">To:</span>
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          className={cn(
                            "px-3 py-1 text-sm rounded-md focus:outline-none flex items-center gap-2 min-w-[100px] justify-between",
                            customEndDate && isUsingCustomRange ? "bg-white text-black" : "bg-white text-black"
                          )}
                          style={{}}
                        >
                          {(customEndDate && isUsingCustomRange) ? formatDisplayDate(customEndDate) : formatDisplayDate(selectedRange.endDate)}
                          <ChevronDown className="h-3 w-3 opacity-50" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={customEndDate || selectedRange.endDate}
                          onSelect={(date) => {
                            if (date) {
                              setCustomEndDate(date)
                              setIsUsingCustomRange(true)
                              setChartAnimationKey(key => key + 1) // Trigger chart animation
                            }
                          }}
                          disabled={(date) =>
                            date > new Date() || date < new Date("1900-01-01")
                          }
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </div>
            </div>

            <motion.div
              key={chartAnimationKey}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="mt-8"
            >
              <div className="rounded-xl p-4 backdrop-blur-sm">
                <ChartContainer config={chartConfig} className="h-32 w-full">
                  <LineChart
                    accessibilityLayer
                    data={chartData}
                    margin={{
                      left: -35,
                      right: 12,
                    }}
                  >
                    <CartesianGrid vertical={false} />
                    <XAxis
                      dataKey="label"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      tick={{
                        fill: "hsl(var(--muted-foreground))",
                        fontSize: 11,
                        fontWeight: 500
                      }}
                      tickFormatter={(value) => value.slice(0, 6)}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tickMargin={12}
                      tick={{
                        fill: "hsl(var(--muted-foreground))",
                        fontSize: 11,
                        fontWeight: 500
                      }}
                      domain={[0, 6]}
                      ticks={[0, 2, 4, 6]}
                    />
                    <ChartTooltip
                      cursor={false}
                      content={({ active, payload, label }) => {
                        if (!active || !payload || !payload.length) return null;
                        return (
                          <div
                            className="rounded-lg shadow-lg bg-white/95 border border-border/60 p-3 min-w-[120px]"
                            style={{ backdropFilter: 'blur(6px)' }}
                          >
                            <div className="font-semibold mb-2 text-sm text-foreground">{label}</div>
                            {payload.map((entry, idx) => (
                              <div key={entry.dataKey} className="flex items-center gap-2 mb-1">
                                <span
                                  className="inline-block w-3 h-3 rounded"
                                  style={{ background: chartConfig[entry.dataKey as keyof typeof chartConfig]?.color || entry.color }}
                                ></span>
                                <span className="text-xs font-medium text-muted-foreground">
                                  {chartConfig[String(entry.dataKey) as keyof typeof chartConfig]?.label || entry.name}
                                </span>
                                <span className="ml-auto text-sm font-bold text-foreground">
                                  {Number(entry.value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                              </div>
                            ))}
                          </div>
                        );
                      }}
                    />
                    {showIncomeLine && (
                      <Line
                        dataKey="income"
                        type="monotone"
                        stroke="#16a34a"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4, stroke: "#16a34a", strokeWidth: 2 }}
                      />
                    )}
                    {showExpenseLine && (
                      <Line
                        dataKey="expenses"
                        type="monotone"
                        stroke="#dff5e1"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4, stroke: "#dff5e1", strokeWidth: 2 }}
                      />
                    )}
                  </LineChart>
                </ChartContainer>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Right Section: Transaction Details - Radial Chart */}
        <motion.div
          variants={{
            hidden: { opacity: 0, y: 20 },
            visible: { opacity: 1, y: 0 },
          }}
          transition={{ duration: 0.4, ease: "easeOut", delay: 0.15 }}
          className="lg:col-span-2 rounded-lg border border-border bg-card shadow-sm hover:shadow-md transition-all duration-200 slide-in flex flex-col h-full"
        >
          <div className="flex items-center gap-2 p-6 pb-0">
            <div className="w-2 h-2 rounded-full bg-chart-3"></div>
            <p className="text-xs font-medium text-muted-foreground">Transaction Analytics</p>
          </div>

          <div className="flex flex-row items-center p-6 gap-8">
            <div className="flex-1">
              <ChartContainer
                config={{
                  sent: {
                    label: "Sent",
                    color: "#059669",
                  },
                  received: {
                    label: "Received",
                    color: "#10b981",
                  },
                  avgTransaction: {
                    label: "Avg Transaction",
                    color: "#34d399",
                  },
                  largestTransaction: {
                    label: "Largest",
                    color: "#6ee7b7",
                  },
                  weekActivity: {
                    label: "Week Activity",
                    color: "#a7f3d0",
                  },
                }}
                className="mx-auto aspect-square max-h-[250px]"
              >
                <RadialBarChart
                  data={[
                    {
                      metric: "weekActivity",
                      value: Math.min(additionalMetrics.velocityThisWeek * 10, 100),
                      fill: "#a7f3d0",
                    },
                    {
                      metric: "largestTransaction",
                      value: Math.min((additionalMetrics.largestTransaction / additionalMetrics.totalVolume) * 100 || 0, 100),
                      fill: "#6ee7b7",
                    },
                    {
                      metric: "avgTransaction",
                      value: Math.min((additionalMetrics.avgTransactionSize / additionalMetrics.largestTransaction) * 100 || 0, 100),
                      fill: "#34d399",
                    },
                    {
                      metric: "received",
                      value: Math.min((additionalMetrics.receivedCount / additionalMetrics.totalTransactions) * 100 || 0, 100),
                      fill: "#10b981",
                    },
                    {
                      metric: "sent",
                      value: Math.min((additionalMetrics.sentCount / additionalMetrics.totalTransactions) * 100 || 0, 100),
                      fill: "#059669",
                    },
                  ]}
                  innerRadius={30}
                  outerRadius={110}
                >
                  <ChartTooltip
                    cursor={false}
                    content={<ChartTooltipContent hideLabel nameKey="metric" />}
                  />
                  <RadialBar dataKey="value" background />
                </RadialBarChart>
              </ChartContainer>
            </div>

            <div className="flex-1 grid grid-cols-2 gap-x-4 gap-y-6">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-md" style={{ backgroundColor: "#059669" }}></div>
                <div className="flex flex-col">
                  <span className="text-xs text-muted-foreground">Sent</span>
                  <span className="font-bold text-sm">{additionalMetrics.sentCount}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-md" style={{ backgroundColor: "#10b981" }}></div>
                <div className="flex flex-col">
                  <span className="text-xs text-muted-foreground">Received</span>
                  <span className="font-bold text-sm">{additionalMetrics.receivedCount}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-md" style={{ backgroundColor: "#34d399" }}></div>
                <div className="flex flex-col">
                  <span className="text-xs text-muted-foreground">Avg Transaction</span>
                  <span className="font-bold text-sm">{additionalMetrics.avgTransactionSize.toFixed(2)}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-md" style={{ backgroundColor: "#6ee7b7" }}></div>
                <div className="flex flex-col">
                  <span className="text-xs text-muted-foreground">Largest</span>
                  <span className="font-bold text-sm">{additionalMetrics.largestTransaction.toFixed(2)}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 col-span-2">
                <div className="w-3 h-3 rounded-md" style={{ backgroundColor: "#a7f3d0" }}></div>
                <div className="flex flex-col">
                  <span className="text-xs text-muted-foreground">Week Activity</span>
                  <span className="font-bold text-sm">{additionalMetrics.velocityThisWeek.toFixed(1)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 text-sm p-6 pt-0">
            <div className="flex items-center gap-2 leading-none font-medium">
              {velocityChange >= 0 ? (
                <>
                  Trending up by {Math.abs(velocityChange).toFixed(1)}% this week
                  <TrendingUp className="h-4 w-4" />
                </>
              ) : (
                <>
                  Trending down by {Math.abs(velocityChange).toFixed(1)}% this week
                  <ArrowDown className="h-4 w-4" />
                </>
              )}
            </div>
            <div className="text-muted-foreground leading-none">
              Showing transaction metrics for {selectedRange.label}
            </div>
          </div>
        </motion.div>
      </div>
      {/* SECTION 3: Recent Activities Card */}
      <Card className="col-span-full shadow-sm hover:shadow-md transition-all duration-200 mt-6">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-6">
          <div className="flex flex-col gap-1">
            <CardTitle className="text-xl font-bold">Recent Activities</CardTitle>
            <CardDescription>
              Detailed transaction log with search, filter, and export capabilities.
            </CardDescription>
          </div>

          {/* Horizontal Date Selector */}
          <div className="flex items-center gap-2 ml-auto">
            <Button
              variant="ghost"
              size="icon"
              onClick={handlePrevWeek}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <div className="flex items-center gap-1">
              {calendarDays.map((date) => {
                const isSelected = isSameDay(date, selectedDate)
                return (
                  <button
                    key={date.toISOString()}
                    onClick={() => setSelectedDate(date)}
                    className={cn(
                      "flex flex-col items-center justify-center p-2 rounded-xl transition-all min-w-[3rem]",
                      isSelected
                        ? "bg-primary text-primary-foreground shadow-md scale-105"
                        : "hover:bg-muted text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <span className="text-[10px] font-medium uppercase tracking-wider opacity-80">
                      {format(date, "EEE")}
                    </span>
                    <span className={cn(
                      "text-lg font-bold mt-0.5",
                      isSelected && "text-primary-foreground"
                    )}>
                      {format(date, "d")}
                    </span>
                  </button>
                )
              })}
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={handleNextWeek}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {filteredTransactions.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-muted/50 p-10 text-center fade-in">
              <p className="text-lg font-semibold text-foreground">
                No transactions found
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Start sending or receiving transfers to see your activity here.
              </p>
            </div>
          ) : (
            <DataTable
              columns={transactionColumns}
              data={filteredTransactions}
              searchKey="counterparty"
              searchPlaceholder="Search by counterparty..."
              enableRowSelection={true}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

