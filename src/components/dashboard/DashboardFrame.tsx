"use client";

import { DashboardMap } from "./DashboardMap";

/**
 * Persistent split view: the map stays mounted while sidebar routes change.
 * Mobile stacks map above the sheet-like sidebar; desktop puts the sidebar left.
 */
export function DashboardFrame({ children }: { children: React.ReactNode }) {
  return (
    <>
      <aside
        aria-label="Walks panel"
        className="h-[45dvh] shrink-0 overflow-y-auto border-t border-line bg-surface md:h-auto md:w-95 md:border-r md:border-t-0"
      >
        {children}
      </aside>
      <main className="relative min-h-0 flex-1">
        <DashboardMap />
      </main>
    </>
  );
}
