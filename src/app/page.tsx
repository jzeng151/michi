import { ThemeSwitcher } from "@/components/theme/ThemeSwitcher";

/** Temporary theme preview — replaced by the landing page in P8. */
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-6 py-16">
      <header className="flex flex-col gap-2">
        <p className="font-display text-lg text-accent">道 michi</p>
        <h1 className="font-display text-4xl font-semibold">
          Walk Japan, keep the memory.
        </h1>
        <p className="text-ink-muted">
          Theme system preview: four seasons, each with a light and dark face.
        </p>
      </header>

      <ThemeSwitcher />

      <section
        aria-label="Sample card"
        className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-6 shadow-sm"
      >
        <h2 className="font-display text-2xl">Philosopher&apos;s Path</h2>
        <p className="text-ink-muted">
          Follow the canal from Ginkaku-ji toward Nanzen-ji beneath hundreds of
          cherry trees.
        </p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="rounded-full bg-accent px-5 py-2 text-sm font-medium text-accent-ink transition-opacity hover:opacity-90"
          >
            Start walking
          </button>
          <span className="rounded-full bg-wash px-3 py-1 text-sm">
            Kyoto · 1.8 km
          </span>
        </div>
      </section>
    </main>
  );
}
