"use client";

import { ThemeSwitcher } from "@/components/theme/ThemeSwitcher";

export function ThemeMenu() {
  return (
    <details className="relative">
      <summary className="cursor-pointer list-none rounded-full border border-line px-3 py-1.5 text-sm transition-colors hover:bg-wash [&::-webkit-details-marker]:hidden">
        Theme
      </summary>
      <div className="absolute right-0 z-20 mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-line bg-surface p-4">
        <ThemeSwitcher />
      </div>
    </details>
  );
}
