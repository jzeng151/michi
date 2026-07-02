"use client";

import {
  createContext,
  useContext,
  useEffect,
  useSyncExternalStore,
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

type ThemeState = {
  season: Season;
  mode: ModePref;
  resolvedMode: ResolvedMode;
};

// Module-level store: the theme is a per-tab singleton, and
// useSyncExternalStore lets the server snapshot differ from the client one
// (set pre-paint by the no-flash script) without hydration errors.
const SERVER_STATE: ThemeState = {
  season: "spring",
  mode: "system",
  resolvedMode: "light",
};
let state: ThemeState | null = null;
const listeners = new Set<() => void>();

function systemMode(): ResolvedMode {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function readInitialState(): ThemeState {
  const storedSeason = localStorage.getItem("michi-season");
  const storedMode = localStorage.getItem("michi-mode");
  const season = SEASONS.includes(storedSeason as Season)
    ? (storedSeason as Season)
    : defaultSeason(new Date().getMonth());
  const mode = ["light", "dark", "system"].includes(storedMode as ModePref)
    ? (storedMode as ModePref)
    : "system";
  return { season, mode, resolvedMode: mode === "system" ? systemMode() : mode };
}

function applyToDocument({ season, resolvedMode }: ThemeState) {
  const el = document.documentElement;
  el.dataset.season = season;
  el.dataset.mode = resolvedMode;
  el.style.colorScheme = resolvedMode;
}

function getSnapshot(): ThemeState {
  if (!state) state = readInitialState();
  return state;
}

function getServerSnapshot(): ThemeState {
  return SERVER_STATE;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function update(partial: Partial<Pick<ThemeState, "season" | "mode">>) {
  const prev = getSnapshot();
  const season = partial.season ?? prev.season;
  const mode = partial.mode ?? prev.mode;
  state = { season, mode, resolvedMode: mode === "system" ? systemMode() : mode };
  applyToDocument(state);
  listeners.forEach((l) => l());
}

function setSeason(season: Season) {
  localStorage.setItem("michi-season", season);
  update({ season });
}

function setMode(mode: ModePref) {
  localStorage.setItem("michi-mode", mode);
  update({ mode });
}

type ThemeContextValue = ThemeState & {
  setSeason: (s: Season) => void;
  setMode: (m: ModePref) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const themeState = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (getSnapshot().mode === "system") update({});
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return (
    <ThemeContext.Provider value={{ ...themeState, setSeason, setMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
