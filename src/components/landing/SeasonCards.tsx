"use client";

import { SEASONS, useTheme, type Season } from "@/components/theme/ThemeProvider";

const CARDS: Record<
  Season,
  { jp: string; name: string; note: string; swatch: string; swatchInk: string }
> = {
  spring: { jp: "春", name: "Spring", note: "Plum beside sakura", swatch: "#b1476a", swatchInk: "#ffffff" },
  summer: { jp: "夏", name: "Summer", note: "Fresh mint shade", swatch: "#4d9b75", swatchInk: "#10291d" },
  autumn: { jp: "秋", name: "Autumn", note: "Persimmon and maple", swatch: "#a13f1c", swatchInk: "#ffffff" },
  winter: { jp: "冬", name: "Winter", note: "Snow light and indigo", swatch: "#4d7199", swatchInk: "#ffffff" },
};

/** Live theme picker: choosing a season restyles the whole site. */
export function SeasonCards() {
  const { season, setSeason } = useTheme();

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {SEASONS.map((s) => {
        const card = CARDS[s];
        const active = season === s;
        return (
          <button
            key={s}
            type="button"
            onClick={() => setSeason(s)}
            aria-pressed={active}
            className={`flex flex-col items-start gap-2 rounded-2xl border p-5 text-left transition-all hover:-translate-y-1 hover:shadow-md ${
              active ? "border-accent bg-wash" : "border-line bg-surface"
            }`}
          >
            <span
              aria-hidden="true"
              className="flex h-10 w-10 items-center justify-center rounded-full font-display text-lg"
              style={{ backgroundColor: card.swatch, color: card.swatchInk }}
            >
              {card.jp}
            </span>
            <span className="font-medium">{card.name}</span>
            <span className="text-sm text-ink-muted">{card.note}</span>
          </button>
        );
      })}
    </div>
  );
}
