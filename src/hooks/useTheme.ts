"use client";

import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "collabboard-theme";

export function useTheme() {
  const [isDark, setIsDark] = useState(true);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored !== null) {
        setIsDark(stored === "dark");
      }
    } catch { /* SSR or storage unavailable */ }
  }, []);

  const toggleTheme = useCallback(() => {
    setIsDark((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "dark" : "light");
      } catch { /* ignore */ }
      return next;
    });
  }, []);

  return { isDark, toggleTheme };
}
