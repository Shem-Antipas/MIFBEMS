import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { exportRowsToExcel, type ExcelColumn } from "@/lib/exportToExcel";

interface ExportButtonProps<T> {
  filename: string;
  sheetName: string;
  columns: Array<ExcelColumn<T>>;
  rows: T[];
  label?: string;
}

const ExportButton = <T,>({
  filename,
  sheetName,
  columns,
  rows,
  label = "Export Excel"
}: ExportButtonProps<T>) => {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={rows.length === 0}
      onClick={() => exportRowsToExcel({ filename, sheetName, columns, rows })}
    >
      <Download className="h-4 w-4" />
      {label}
    </Button>
  );
};

export default ExportButton;
