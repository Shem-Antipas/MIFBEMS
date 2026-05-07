import type { License } from "@/types";

export const getLicenseRevenue = (license: License): number =>
  Number.isFinite(Number(license.amountLicensed)) ? Number(license.amountLicensed) : 0;

export const formatCurrency = (value: number): string =>
  `KES ${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
