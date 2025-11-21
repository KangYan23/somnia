import * as React from "react"

import { animate } from "framer-motion"

import { cn } from "@/lib/utils"

interface StatsCardProps extends React.HTMLAttributes<HTMLDivElement> {
  icon: React.ReactNode
  title: string
  metric: number
  metricUnit?: string
  subtext: string
  amountColorClassName?: string
  decimalPlaces?: number
}

const StatsCard = React.forwardRef<HTMLDivElement, StatsCardProps>(
  (
    {
      className,
      icon,
      title,
      metric,
      metricUnit,
      subtext,
      amountColorClassName,
      decimalPlaces,
      ...props
    },
    ref
  ) => {
    const metricRef = React.useRef<HTMLHeadingElement>(null)

    React.useEffect(() => {
      const node = metricRef.current
      if (!node) return

      const precision = decimalPlaces ?? 2

      const controls = animate(0, metric, {
        duration: 1.5,
        ease: "easeOut",
        onUpdate(value) {
          node.textContent = value.toFixed(precision)
        },
      })

      return () => controls.stop()
    }, [metric, decimalPlaces])

    return (
      <div
        ref={ref}
        className={cn(
          "flex w-full flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3 shadow-sm",
          className
        )}
        {...props}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            {icon}
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              {title}
            </p>
          </div>
        </div>
        <div className="flex items-baseline gap-1">
          <h2
            ref={metricRef}
            className={cn(
              "text-3xl font-semibold tracking-tight md:text-4xl",
              amountColorClassName
            )}
            aria-live="polite"
            aria-atomic="true"
          >
            0.00
          </h2>
          {metricUnit && (
            <span className="text-xl font-semibold text-slate-500 md:text-2xl">
              {metricUnit}
            </span>
          )}
        </div>
        <p className="text-xs text-slate-500">{subtext}</p>
      </div>
    )
  }
)

StatsCard.displayName = "StatsCard"

export { StatsCard }

