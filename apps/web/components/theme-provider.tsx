"use client";

import * as React from "react";

type Theme = "light" | "dark";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggle: () => void;
}

const ThemeContext = React.createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = "auto-theme";

/**
 * Applies the persisted theme class to <html> before React hydrates.
 * Render this **first** inside <body> to avoid a flash of unstyled theme.
 * The script body is kept tiny on purpose — it runs synchronously on load.
 */
export function ThemeScript() {
  const script = `try{var t=localStorage.getItem('${STORAGE_KEY}');if(!t){t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}document.documentElement.classList.toggle('dark',t==='dark');document.documentElement.dataset.theme=t;}catch(e){}`;
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = React.useState<Theme>("light");

  // Read whatever the no-FOUC script resolved on the server-rendered DOM.
  React.useEffect(() => {
    const fromDom = document.documentElement.dataset.theme as Theme | undefined;
    if (fromDom === "light" || fromDom === "dark") {
      setThemeState(fromDom);
    }
  }, []);

  const setTheme = React.useCallback((next: Theme) => {
    setThemeState(next);
    document.documentElement.classList.toggle("dark", next === "dark");
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* localStorage unavailable (private mode, etc.) — ignore */
    }
  }, []);

  const toggle = React.useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  const value = React.useMemo(() => ({ theme, setTheme, toggle }), [theme, setTheme, toggle]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = React.useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within <ThemeProvider>");
  return ctx;
}
