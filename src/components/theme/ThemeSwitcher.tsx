"use client";

import { SEASONS, useTheme, type ModePref, type Season } from "./ThemeProvider";

const SEASON_LABELS: Record<Season, string> = {
  spring: "Spring 春",
  summer: "Summer 夏",
  autumn: "Autumn 秋",
  winter: "Winter 冬",
};

const MODES: { value: ModePref; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "system", label: "System" },
  { value: "dark", label: "Dark" },
];

const pill =
  "cursor-pointer rounded-full border border-line px-3 py-1.5 text-sm transition-colors " +
  "has-[:checked]:bg-accent has-[:checked]:text-accent-ink has-[:checked]:border-accent " +
  "not-has-[:checked]:hover:bg-wash " +
  "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-focus has-[:focus-visible]:outline-offset-2";

export function ThemeSwitcher() {
  const { season, mode, setSeason, setMode } = useTheme();

  return (
    <div className="flex flex-col gap-3">
      <fieldset className="flex flex-wrap items-center gap-2">
        <legend className="mb-2 text-sm text-ink-muted">Season</legend>
        {SEASONS.map((s) => (
          <label key={s} className={pill}>
            <input
              type="radio"
              name="michi-season"
              value={s}
              checked={season === s}
              onChange={() => setSeason(s)}
              className="sr-only"
            />
            {SEASON_LABELS[s]}
          </label>
        ))}
      </fieldset>
      <fieldset className="flex flex-wrap items-center gap-2">
        <legend className="mb-2 text-sm text-ink-muted">Appearance</legend>
        {MODES.map((m) => (
          <label key={m.value} className={pill}>
            <input
              type="radio"
              name="michi-mode"
              value={m.value}
              checked={mode === m.value}
              onChange={() => setMode(m.value)}
              className="sr-only"
            />
            {m.label}
          </label>
        ))}
      </fieldset>
    </div>
  );
}
