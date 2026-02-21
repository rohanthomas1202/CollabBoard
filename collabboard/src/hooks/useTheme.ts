"use client";

import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "collabboard-theme";

function applyTheme(theme: string) {
  try {
    document.documentElement.setAttribute("data-theme", theme);
  } catch { /* SSR */ }
}

export function useTheme() {
  const [isDark, setIsDark] = useState(true);

  // Load from localStorage on mount and sync data-theme attribute
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored !== null) {
        setIsDark(stored === "dark");
        applyTheme(stored);
      } else {
        applyTheme("dark");
      }
    } catch { /* SSR or storage unavailable */ }
  }, []);

  const toggleTheme = useCallback(() => {
    setIsDark((prev) => {
      const next = !prev;
      const theme = next ? "dark" : "light";
      try {
        localStorage.setItem(STORAGE_KEY, theme);
      } catch { /* ignore */ }
      applyTheme(theme);
      return next;
    });
  }, []);

  return { isDark, toggleTheme };
}
