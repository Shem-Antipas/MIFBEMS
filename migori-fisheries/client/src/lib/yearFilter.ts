export const ALL_YEARS = "All";

type YearLike = number | string | null | undefined;

export const normalizeYear = (value: YearLike): number | null => {
  if (typeof value === "number" && Number.isInteger(value) && value >= 1900 && value <= 2200) {
    return value;
  }

  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  const trimmedValue = value.trim();
  if (/^\d{4}$/.test(trimmedValue)) {
    const parsedYear = Number(trimmedValue);
    return parsedYear >= 1900 && parsedYear <= 2200 ? parsedYear : null;
  }

  const parsedDate = new Date(trimmedValue);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate.getFullYear();
};

export const matchesSelectedYear = (selectedYear: string, ...values: YearLike[]): boolean => {
  const targetYear = normalizeYear(selectedYear);
  if (!targetYear) return true;

  return values.some((value) => normalizeYear(value) === targetYear);
};

export const collectAvailableYears = (...groups: YearLike[][]): number[] => {
  const years = new Set<number>();

  groups.flat().forEach((value) => {
    const year = normalizeYear(value);
    if (year) years.add(year);
  });

  return Array.from(years).sort((a, b) => b - a);
};
