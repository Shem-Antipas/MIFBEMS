import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export const cn = (...inputs: ClassValue[]): string => twMerge(clsx(inputs));

export const formatRole = (role: string): string => role.replaceAll("_", " ");

export const formatNumber = (value: number): string =>
  new Intl.NumberFormat("en-KE", { maximumFractionDigits: 0 }).format(value);
