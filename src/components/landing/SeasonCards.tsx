"use client";

import { SEASONS, useTheme, type Season } from "@/components/theme/ThemeProvider";

const CARDS: Record<Season, { jp: string; name: string; note: string; swatch: string }> = {
  spring: { jp: "春", name: "Spring", note: "Sakura along the canals", swatch: "#a84455" },
  summer: { jp: "夏", name: "Summer", note: "Deep matcha greens", swatch: "#3e6b4f" },
  autumn: { jp: "秋", name: "Autumn", note: "Persimmon and maple", swatch: "#a3511f" },
  winter: { jp: "冬", name: "Winter", note: "Snow light and indigo", swatch: "#3a5a72" },
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
              className="flex h-10 w-10 items-center justify-center rounded-full font-display text-lg text-white"
              style={{ backgroundColor: card.swatch }}
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
