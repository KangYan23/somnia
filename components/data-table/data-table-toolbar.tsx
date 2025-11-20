"use client"

import { Table } from "@tanstack/react-table"
import {
  ArrowDown,
  ArrowUp,
  ChevronsUpDown,
  Check,
  EyeOff,
  XIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DataTableViewOptions } from "./data-table-view-options"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

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
  const currentDirectionFilter = directionColumn?.getFilterValue() as
    | string[]
    | undefined
  const activeDirection = currentDirectionFilter?.[0]

  const handleDirectionSelect = (value: "sent" | "received") => {
    if (!directionColumn) return
    if (activeDirection === value) {
      directionColumn.setFilterValue(undefined)
      directionColumn.clearSorting?.()
    } else {
      directionColumn.setFilterValue([value])
    }
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
        {isFiltered && (
          <Button
            variant="ghost"
            onClick={() => table.resetColumnFilters()}
            className="h-8 px-2 lg:px-3"
          >
            Reset
            <XIcon className="ml-2 h-4 w-4" />
          </Button>
        )}
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
                  <span className="h-3 w-3 rounded-[25%] bg-green-500" />
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
                  <span className="h-3 w-3 rounded-[25%] bg-red-500" />
                  Sent
                </span>
                {activeDirection === "sent" && (
                  <Check className="h-4 w-4 text-red-600" />
                )}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={(event) => {
                  event.preventDefault()
                  directionColumn.toggleVisibility(false)
                }}
                className="flex items-center"
              >
                <EyeOff className="mr-2 h-3.5 w-3.5 text-muted-foreground/70" />
                Hide
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      <DataTableViewOptions table={table} />
    </div>
  )
}
