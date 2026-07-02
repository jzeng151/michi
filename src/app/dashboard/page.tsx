/** Placeholder split view — sidebar lists and the map arrive in P4. */
export default function DashboardPage() {
  return (
    <>
      <aside
        aria-label="Walks"
        className="h-[45dvh] shrink-0 overflow-y-auto border-t border-line bg-surface p-4 md:h-auto md:w-90 md:border-r md:border-t-0"
      >
        <p className="text-sm text-ink-muted">
          Walk lists will appear here.
        </p>
      </aside>
      <main className="relative min-h-0 flex-1 bg-wash">
        <p className="absolute inset-0 flex items-center justify-center text-sm text-ink-muted">
          Map coming next.
        </p>
      </main>
    </>
  );
}
