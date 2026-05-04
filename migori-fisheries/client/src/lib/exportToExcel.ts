export type ExcelCellValue = string | number | boolean | Date | null | undefined;

export interface ExcelColumn<T> {
  header: string;
  value: keyof T | ((row: T) => ExcelCellValue);
}

interface ExportRowsOptions<T> {
  filename: string;
  sheetName: string;
  columns: Array<ExcelColumn<T>>;
  rows: T[];
}

const riskyFormulaStart = /^[=+\-@\t\r]/;

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const formatCellValue = (value: ExcelCellValue): string => {
  if (value === null || value === undefined) {
    return "";
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? "" : value.toISOString().slice(0, 10);
  }

  return String(value);
};

const secureCellText = (value: ExcelCellValue): string => {
  const formatted = formatCellValue(value);
  return riskyFormulaStart.test(formatted) ? `'${formatted}` : formatted;
};

const sanitizeFilename = (filename: string): string =>
  filename
    .trim()
    .replace(/[^a-z0-9._-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "export";

const sanitizeSheetName = (sheetName: string): string =>
  sheetName
    .replace(/\[/g, " ")
    .replace(/\]/g, " ")
    .replace(/[\\:*?/]/g, " ")
    .trim()
    .slice(0, 31) || "Export";

const getCellValue = <T,>(row: T, column: ExcelColumn<T>): ExcelCellValue => {
  if (typeof column.value === "function") {
    return column.value(row);
  }

  return row[column.value] as ExcelCellValue;
};

export const exportRowsToExcel = <T,>({ filename, sheetName, columns, rows }: ExportRowsOptions<T>): void => {
  if (typeof window === "undefined") {
    return;
  }

  const worksheetName = sanitizeSheetName(sheetName);
  const tableHeaders = columns.map((column) => `<th>${escapeHtml(column.header)}</th>`).join("");
  const tableRows = rows
    .map((row) => {
      const cells = columns
        .map((column) => `<td style='mso-number-format:"\\@";'>${escapeHtml(secureCellText(getCellValue(row, column)))}</td>`)
        .join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");

  const html = `<!doctype html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
<head>
  <meta charset="UTF-8" />
  <!--[if gte mso 9]><xml>
    <x:ExcelWorkbook>
      <x:ExcelWorksheets>
        <x:ExcelWorksheet>
          <x:Name>${escapeHtml(worksheetName)}</x:Name>
          <x:WorksheetOptions><x:DisplayGridlines /></x:WorksheetOptions>
        </x:ExcelWorksheet>
      </x:ExcelWorksheets>
    </x:ExcelWorkbook>
  </xml><![endif]-->
</head>
<body>
  <table>
    <thead><tr>${tableHeaders}</tr></thead>
    <tbody>${tableRows}</tbody>
  </table>
</body>
</html>`;

  const blob = new Blob(["\ufeff", html], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  const timestamp = new Date().toISOString().slice(0, 10);

  link.href = url;
  link.download = `${sanitizeFilename(filename)}-${timestamp}.xls`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => window.URL.revokeObjectURL(url), 0);
};
