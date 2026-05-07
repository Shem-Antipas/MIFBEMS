import { useEffect, useMemo, useState, type ReactNode } from "react";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";

interface DataTableProps {
  headers: string[];
  rows: Array<Array<ReactNode>>;
  emptyLabel?: string;
  pageSize?: number;
}

const DataTable = ({ headers, rows, emptyLabel = "No records available.", pageSize = 10 }: DataTableProps) => {
  const [page, setPage] = useState(1);
  const totalPages = pageSize && rows.length > pageSize ? Math.ceil(rows.length / pageSize) : 1;
  const safePage = Math.min(page, totalPages);

  useEffect(() => {
    setPage(1);
  }, [pageSize, rows.length]);

  const visibleRows = useMemo(() => {
    if (!pageSize) {
      return rows;
    }

    const start = (safePage - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }, [pageSize, rows, safePage]);

  return (
    <div className="w-full min-w-0 overflow-hidden rounded-lg border bg-card">
      <div className="w-full overflow-x-auto">
        <Table className="min-w-max">
          <TableHeader className="bg-muted/50">
            <TableRow>
              {headers.map((header) => (
                <TableHead key={header}>
                  {header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleRows.length > 0 ? (
              visibleRows.map((row, index) => (
                <TableRow key={`row-${safePage}-${index}`}>
                  {row.map((cell, cellIndex) => (
                    <TableCell key={`cell-${safePage}-${index}-${cellIndex}`} className="whitespace-nowrap text-foreground">
                      {cell}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={headers.length} className="h-24 text-center text-muted-foreground">
                  {emptyLabel}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {pageSize && rows.length > pageSize ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t px-3 py-2 text-sm text-muted-foreground">
          <span>
            Showing {(safePage - 1) * pageSize + 1}-{Math.min(safePage * pageSize, rows.length)} of {rows.length}
          </span>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" disabled={safePage === 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
              Previous
            </Button>
            <span>
              Page {safePage} of {totalPages}
            </span>
            <Button type="button" variant="outline" size="sm" disabled={safePage === totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default DataTable;
