"use client";

import { useEffect, useRef, useState } from "react";
import { setMapDisplay } from "@/components/map/display-store";
import type { BrowseLists } from "@/lib/walks";
import { WalkCard } from "./WalkCard";

const TABS = [
  { key: "curated", label: "Curated" },
  { key: "trending", label: "Trending" },
  { key: "top", label: "Top" },
  { key: "community", label: "Community" },
  { key: "friends", label: "Friends" },
  { key: "mine", label: "My walks" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const EMPTY_COPY: Record<TabKey, string> = {
  curated: "No curated walks yet.",
  trending: "Nothing trending this week — be the first to like a walk.",
  top: "No liked walks yet.",
  community: "No community walks yet.",
  friends: "Follow walkers you enjoy and their walks will gather here.",
  mine: "You haven't recorded a walk yet. Tap “New walk” to start.",
};

export function WalkList({ lists }: { lists: BrowseLists }) {
  const [active, setActive] = useState<TabKey>("curated");
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const walks = lists[active];

  useEffect(() => {
    setMapDisplay({
      kind: "overview",
      points: walks.map((w) => ({ id: w.id, title: w.title, start: w.start })),
    });
  }, [walks]);

  function onTabKeyDown(e: React.KeyboardEvent, index: number) {
    const dir =
      e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const next = (index + dir + TABS.length) % TABS.length;
    setActive(TABS[next].key);
    tabRefs.current[next]?.focus();
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        role="tablist"
        aria-label="Walk collections"
        className="flex flex-wrap gap-1"
      >
        {TABS.map((tab, i) => (
          <button
            key={tab.key}
            ref={(el) => {
              tabRefs.current[i] = el;
            }}
            role="tab"
            id={`tab-${tab.key}`}
            aria-selected={active === tab.key}
            aria-controls="walk-list-panel"
            tabIndex={active === tab.key ? 0 : -1}
            onClick={() => setActive(tab.key)}
            onKeyDown={(e) => onTabKeyDown(e, i)}
            className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
              active === tab.key
                ? "bg-accent text-accent-ink"
                : "text-ink-muted hover:bg-wash"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id="walk-list-panel"
        aria-labelledby={`tab-${active}`}
      >
        {walks.length === 0 ? (
          <p className="px-1 py-4 text-sm text-ink-muted">
            {EMPTY_COPY[active]}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {walks.map((walk) => (
              <WalkCard key={walk.id} walk={walk} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
