"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export const SEASONS = ["spring", "summer", "autumn", "winter"] as const;
export type Season = (typeof SEASONS)[number];
export type ModePref = "light" | "dark" | "system";
export type ResolvedMode = "light" | "dark";

/** Keep in sync with the no-flash script in src/app/layout.tsx. */
export function defaultSeason(month: number): Season {
  if (month >= 2 && month <= 4) return "spring";
  if (month >= 5 && month <= 7) return "summer";
  if (month >= 8 && month <= 10) return "autumn";
  return "winter";
}

type ThemeContextValue = {
  season: Season;
  mode: ModePref;
  resolvedMode: ResolvedMode;
  setSeason: (s: Season) => void;
  setMode: (m: ModePref) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function systemMode(): ResolvedMode {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Server renders with defaults; the no-flash script already set the real
  // attributes on <html>, and we sync React state to them after mount.
  const [season, setSeasonState] = useState<Season>("spring");
  const [mode, setModeState] = useState<ModePref>("system");
  const [resolvedMode, setResolvedMode] = useState<ResolvedMode>("light");

  const apply = useCallback((s: Season, m: ModePref) => {
    const resolved = m === "system" ? systemMode() : m;
    const el = document.documentElement;
    el.dataset.season = s;
    el.dataset.mode = resolved;
    el.style.colorScheme = resolved;
    setResolvedMode(resolved);
  }, []);

  useEffect(() => {
    const storedSeason = localStorage.getItem("michi-season");
    const storedMode = localStorage.getItem("michi-mode");
    const s = SEASONS.includes(storedSeason as Season)
      ? (storedSeason as Season)
      : defaultSeason(new Date().getMonth());
    const m = ["light", "dark", "system"].includes(storedMode as ModePref)
      ? (storedMode as ModePref)
      : "system";
    setSeasonState(s);
    setModeState(m);
    apply(s, m);
  }, [apply]);

  useEffect(() => {
    if (mode !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => apply(season, "system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [mode, season, apply]);

  const setSeason = useCallback(
    (s: Season) => {
      setSeasonState(s);
      localStorage.setItem("michi-season", s);
      apply(s, mode);
    },
    [mode, apply],
  );

  const setMode = useCallback(
    (m: ModePref) => {
      setModeState(m);
      localStorage.setItem("michi-mode", m);
      apply(season, m);
    },
    [season, apply],
  );

  return (
    <ThemeContext.Provider
      value={{ season, mode, resolvedMode, setSeason, setMode }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
