import type { CaptureFisheriesRecord } from "@/types";

export type MonthlyCaptureTrendRow = {
  month: string;
  quantityKg: number;
  value: number;
  records: number;
};

export const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const getCaptureMonthIndex = (record: CaptureFisheriesRecord): number => {
  const month = Number(record.month);
  if (Number.isInteger(month) && month >= 1 && month <= 12) {
    return month - 1;
  }

  const fishingDate = new Date(record.fishingDate);
  return Number.isNaN(fishingDate.getTime()) ? 0 : fishingDate.getMonth();
};

export const buildMonthlyCaptureTrend = (records: CaptureFisheriesRecord[]): MonthlyCaptureTrendRow[] => {
  const rows = monthLabels.map((month) => ({
    month,
    quantityKg: 0,
    value: 0,
    records: 0
  }));

  records.forEach((record) => {
    const row = rows[getCaptureMonthIndex(record)];
    row.quantityKg += Number(record.catchKg) || 0;
    row.value += Number(record.value) || 0;
    row.records += 1;
  });

  return rows;
};

export const hasMonthlyCaptureTrendData = (rows: MonthlyCaptureTrendRow[]): boolean =>
  rows.some((row) => row.quantityKg > 0 || row.value > 0 || row.records > 0);
