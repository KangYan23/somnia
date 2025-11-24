"use client"

import * as React from "react"
import { Table } from "@tanstack/react-table"
import {
  ArrowDown,
  ArrowUp,
  CalendarDays,
  ChevronsUpDown,
  Check,
  ChevronDownIcon,
} from "lucide-react"
import Image from "next/image"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DataTableViewOptions } from "./data-table-view-options"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface DataTableToolbarProps<TData> {
  table: Table<TData>
  searchKey?: string
  searchPlaceholder?: string
}

export function DataTableToolbar<TData>({
  table,
  searchKey = "value",
  searchPlaceholder = "Search...",
}: DataTableToolbarProps<TData>) {
  const isFiltered = table.getState().columnFilters.length > 0
  const searchColumn = searchKey ? table.getColumn(searchKey) : null
  const directionColumn = table.getColumn("direction")
  const timestampColumn = table.getColumn("timestamp")
  const timestampFilterValue =
    (timestampColumn?.getFilterValue() as { start?: string; end?: string }) ||
    {}
  const currentDirectionFilter = directionColumn?.getFilterValue() as
    | string[]
    | undefined
  const activeDirection = currentDirectionFilter?.[0]
  const [timestampPopoverOpen, setTimestampPopoverOpen] = React.useState(false)
  const selectedTimestampDate = React.useMemo(() => {
    if (timestampFilterValue.start) {
      return new Date(timestampFilterValue.start)
    }
    if (timestampFilterValue.end) {
      return new Date(timestampFilterValue.end)
    }
    return undefined
  }, [timestampFilterValue.start, timestampFilterValue.end])

  const handleDirectionSelect = (value: "sent" | "received") => {
    if (!directionColumn) return
    if (activeDirection === value) {
      directionColumn.setFilterValue(undefined)
      directionColumn.clearSorting?.()
    } else {
      directionColumn.setFilterValue([value])
    }
  }

  const pad = (value: number) => value.toString().padStart(2, "0")

  const buildDayTimestamp = (date: Date, startOfDay: boolean) => {
    const year = date.getFullYear()
    const month = pad(date.getMonth() + 1)
    const day = pad(date.getDate())
    const time = startOfDay ? "00:00:00" : "23:59:59"
    return `${year}-${month}-${day}T${time}`
  }

  const applyTimestampFilter = (date?: Date) => {
    if (!timestampColumn) return
    if (!date) {
      timestampColumn.setFilterValue(undefined)
      setTimestampPopoverOpen(false)
      return
    }

    timestampColumn.setFilterValue({
      start: buildDayTimestamp(date, true),
      end: buildDayTimestamp(date, false),
    })
    setTimestampPopoverOpen(false)
  }

  const handleTimestampClear = () => {
    if (!timestampColumn) return
    timestampColumn.setFilterValue(undefined)
    setTimestampPopoverOpen(false)
  }

  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-1 items-center space-x-2">
        {searchColumn && (
          <Input
            placeholder={searchPlaceholder}
            value={(searchColumn.getFilterValue() as string) ?? ""}
            onChange={(event) =>
              searchColumn.setFilterValue(event.target.value)
            }
            className="h-8 w-[150px] lg:w-[250px]"
          />
        )}
        <div className="flex flex-wrap items-center gap-2">
          {directionColumn && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 border px-3 data-[state=open]:bg-accent"
                >
                  <span>Transaction</span>
                  {directionColumn.getIsSorted() === "desc" ? (
                    <ArrowDown className="ml-2 h-4 w-4" />
                  ) : directionColumn.getIsSorted() === "asc" ? (
                    <ArrowUp className="ml-2 h-4 w-4" />
                  ) : (
                    <ChevronsUpDown className="ml-2 h-4 w-4" />
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-40">
                <DropdownMenuItem
                  onSelect={(event) => {
                    event.preventDefault()
                    handleDirectionSelect("received")
                  }}
                  className="flex items-center justify-between"
                >
                  <span className="flex items-center gap-2 text-foreground">
                    <Image
                      src="/received.png"
                      alt="Received"
                      width={20}
                      height={20}
                      className="h-5 w-5"
                    />
                    Received
                  </span>
                  {activeDirection === "received" && (
                    <Check className="h-4 w-4 text-green-600" />
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={(event) => {
                    event.preventDefault()
                    handleDirectionSelect("sent")
                  }}
                  className="flex items-center justify-between"
                >
                  <span className="flex items-center gap-2 text-foreground">
                    <Image
                      src="/sent.png"
                      alt="Sent"
                      width={20}
                      height={20}
                      className="h-5 w-5"
                    />
                    Sent
                  </span>
                  {activeDirection === "sent" && (
                    <Check className="h-4 w-4 text-red-600" />
                  )}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {timestampColumn && (
            <Popover
              open={timestampPopoverOpen}
              onOpenChange={setTimestampPopoverOpen}
            >
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  id="timestamp-filter"
                  className="h-8 border px-3 data-[state=open]:bg-accent"
                >
                  <CalendarDays className="mr-2 h-4 w-4 text-slate-500" />
                  <span className="truncate text-sm">
                    {selectedTimestampDate
                      ? selectedTimestampDate.toLocaleDateString()
                      : "Select date"}
                  </span>
                  <ChevronDownIcon className="ml-2 h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-auto overflow-hidden p-0">
                <div className="bg-white p-4">
                  <Calendar
                    mode="single"
                    selected={selectedTimestampDate}
                    captionLayout="dropdown"
                    onSelect={(date) => applyTimestampFilter(date)}
                  />
                  {(timestampFilterValue.start ||
                    timestampFilterValue.end) && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="mt-3 w-full justify-center text-xs font-semibold text-rose-500 hover:bg-red-400"
                        onClick={handleTimestampClear}
                      >
                        CLEAR
                      </Button>
                    )}
                </div>
              </PopoverContent>
            </Popover>
          )}
        </div>
      </div>
    </div>
  )
}
