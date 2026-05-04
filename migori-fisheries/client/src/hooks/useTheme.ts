import { useEffect, useState } from "react";

export type Theme = "light" | "dark";

const THEME_STORAGE_KEY = "mifbems-theme";

const isTheme = (value: string | null): value is Theme => value === "light" || value === "dark";

const getStoredTheme = (): Theme | null => {
  if (typeof window === "undefined") {
    return null;
  }

  const value = window.localStorage.getItem(THEME_STORAGE_KEY);
  return isTheme(value) ? value : null;
};

export const applyTheme = (theme: Theme): void => {
  if (typeof document === "undefined") {
    return;
  }

  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.style.colorScheme = theme;
  window.localStorage.setItem(THEME_STORAGE_KEY, theme);
};

export const initTheme = (): void => {
  applyTheme(getStoredTheme() ?? "light");
};

export const useTheme = () => {
  const [theme, setThemeState] = useState<Theme>(() => getStoredTheme() ?? "light");

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  return {
    theme,
    setTheme: setThemeState,
    isDark: theme === "dark"
  };
};
