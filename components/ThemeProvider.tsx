"use client";

import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";

export type ArchiveTheme = {
  name: string;
  bg: string;
  text: string;
  muted: string;
  border: string;
  card: string;
  accent: string;
  hover: string;
  soft: string;
};

export const DEFAULT_THEME: ArchiveTheme = {
  name: "MONO",
  bg: "#f5f4f1",
  text: "#242323",
  muted: "#77746d",
  border: "#deddd8",
  card: "#fff",
  accent: "#242323",
  hover: "#eeece8",
  soft: "#f8f7f4",
};

export const THEME_PRESETS: ArchiveTheme[] = [
  DEFAULT_THEME,
  {
    name: "SOFT",
    bg: "#f3eee7",
    text: "#403a34",
    muted: "#847a70",
    border: "#d9cfc3",
    card: "#fffaf4",
    accent: "#6f5b48",
    hover: "#ebe1d6",
    soft: "#f8f1e9",
  },
  {
    name: "DARK",
    bg: "#171717",
    text: "#f2f2ef",
    muted: "#aaa9a4",
    border: "#393939",
    card: "#222",
    accent: "#f2f2ef",
    hover: "#2c2c2c",
    soft: "#1e1e1e",
  },
  {
    name: "RED",
    bg: "#f4efee",
    text: "#342323",
    muted: "#856b6b",
    border: "#dccbcb",
    card: "#fffafa",
    accent: "#8d4242",
    hover: "#eee0e0",
    soft: "#f8f0f0",
  },
  {
    name: "BLUE",
    bg: "#eef2f5",
    text: "#263139",
    muted: "#6d7b84",
    border: "#cfd9df",
    card: "#fafdff",
    accent: "#486879",
    hover: "#e0e8ed",
    soft: "#f3f7f9",
  },
];

const STORAGE_KEY = "my-archive-theme";

function readStoredTheme(): ArchiveTheme {
  if (typeof window === "undefined") {
    return DEFAULT_THEME;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_THEME;

    const parsed = JSON.parse(raw) as Partial<ArchiveTheme>;

    return {
      ...DEFAULT_THEME,
      ...parsed,
      name: parsed.name || DEFAULT_THEME.name,
    };
  } catch {
    return DEFAULT_THEME;
  }
}

function applyTheme(theme: ArchiveTheme) {
  if (typeof document === "undefined") return;

  const root = document.documentElement;

  root.style.setProperty("--archive-bg", theme.bg);
  root.style.setProperty("--archive-text", theme.text);
  root.style.setProperty("--archive-muted", theme.muted);
  root.style.setProperty("--archive-border", theme.border);
  root.style.setProperty("--archive-card", theme.card);
  root.style.setProperty("--archive-accent", theme.accent);
  root.style.setProperty("--archive-hover", theme.hover);
  root.style.setProperty("--archive-soft", theme.soft);

  root.style.backgroundColor = theme.bg;
  document.body.style.backgroundColor = theme.bg;
  document.body.style.color = theme.text;
}

type ThemeContextValue = {
  theme: ArchiveTheme;
  setTheme: (theme: ArchiveTheme) => void;
  saveTheme: (theme: ArchiveTheme) => Promise<void>;
  resetTheme: () => Promise<void>;
  saving: boolean;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [theme, setThemeState] = useState<ArchiveTheme>(DEFAULT_THEME);
  const [saving, setSaving] = useState(false);

  useLayoutEffect(() => {
    const stored = readStoredTheme();
    setThemeState(stored);
    applyTheme(stored);
  }, []);

  const setTheme = useCallback((nextTheme: ArchiveTheme) => {
    setThemeState(nextTheme);
    applyTheme(nextTheme);
  }, []);

  const saveTheme = useCallback(async (nextTheme: ArchiveTheme) => {
    setSaving(true);

    try {
      const normalized: ArchiveTheme = {
        ...DEFAULT_THEME,
        ...nextTheme,
      };

      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(normalized),
      );

      setThemeState(normalized);
      applyTheme(normalized);
    } finally {
      setSaving(false);
    }
  }, []);

  const resetTheme = useCallback(async () => {
    await saveTheme(DEFAULT_THEME);
  }, [saveTheme]);

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      saveTheme,
      resetTheme,
      saving,
    }),
    [theme, setTheme, saveTheme, resetTheme, saving],
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error(
      "useTheme은 ThemeProvider 안에서 사용해야 합니다.",
    );
  }

  return context;
}
