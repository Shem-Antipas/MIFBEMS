import type { ReactNode } from "react";

interface DataTableProps {
  headers: string[];
  rows: Array<Array<ReactNode>>;
  emptyLabel?: string;
}

const DataTable = ({ headers, rows, emptyLabel = "No records available." }: DataTableProps) => {
  return (
    <div className="overflow-hidden rounded-xl border bg-white">
      <table className="min-w-full divide-y divide-border">
        <thead className="bg-muted/50">
          <tr>
            {headers.map((header) => (
              <th key={header} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border bg-white text-sm">
          {rows.length > 0 ? (
            rows.map((row, index) => (
              <tr key={`row-${index}`}>
                {row.map((cell, cellIndex) => (
                  <td key={`cell-${index}-${cellIndex}`} className="px-4 py-3 text-foreground">
                    {cell}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={headers.length} className="px-4 py-8 text-center text-sm text-muted-foreground">
                {emptyLabel}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default DataTable;
