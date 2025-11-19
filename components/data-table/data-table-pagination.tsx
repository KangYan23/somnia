"use client"

import * as React from "react"
import { Table } from "@tanstack/react-table"

import { ChevronLeft, ChevronRight } from "lucide-react"

import { Button } from "@/components/ui/button-1"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
} from "@/components/ui/pagination"

interface DataTablePaginationProps<TData> {
  table: Table<TData>
}

export function DataTablePagination<TData>({
  table,
}: DataTablePaginationProps<TData>) {
  const pageCount = table.getPageCount()
  const currentPage = table.getState().pagination.pageIndex

  const visiblePages = React.useMemo(() => {
    const maxVisible = 3
    if (pageCount <= maxVisible) {
      return Array.from({ length: pageCount }, (_, i) => i)
    }

    let start = currentPage - 1
    if (start < 0) start = 0
    if (start > pageCount - maxVisible) {
      start = pageCount - maxVisible
    }

    return Array.from({ length: maxVisible }, (_, i) => start + i)
  }, [currentPage, pageCount])

  const showLeadingEllipsis = visiblePages[0] > 0
  const showTrailingEllipsis =
    visiblePages[visiblePages.length - 1] < pageCount - 1

  return (
    <Pagination className="px-2">
      <PaginationContent>
        <PaginationItem>
          <Button
            variant="ghost"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronLeft className="rtl:rotate-180" />
            <span className="ml-1 hidden sm:inline">Previous</span>
          </Button>
        </PaginationItem>

        {showLeadingEllipsis && (
          <>
            <PaginationItem>
              <Button
                variant="ghost"
                mode="icon"
                onClick={() => table.setPageIndex(0)}
              >
                1
              </Button>
            </PaginationItem>
            <PaginationItem>
              <PaginationEllipsis />
            </PaginationItem>
          </>
        )}

        {visiblePages.map((page) => (
          <PaginationItem key={page}>
            <Button
              variant={page === currentPage ? "outline" : "ghost"}
              mode="icon"
              onClick={() => table.setPageIndex(page)}
              selected={page === currentPage}
            >
              {page + 1}
            </Button>
          </PaginationItem>
        ))}

        {showTrailingEllipsis && (
          <>
            <PaginationItem>
              <PaginationEllipsis />
            </PaginationItem>
            <PaginationItem>
              <Button
                variant="ghost"
                mode="icon"
                onClick={() => table.setPageIndex(pageCount - 1)}
              >
                {pageCount}
              </Button>
            </PaginationItem>
          </>
        )}

        <PaginationItem>
          <Button
            variant="ghost"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            <span className="mr-1 hidden sm:inline">Next</span>
            <ChevronRight className="rtl:rotate-180" />
          </Button>
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  )
}

