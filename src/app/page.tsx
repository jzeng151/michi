import Link from "next/link";
import Image from "next/image";
import { HeroBackdrop } from "@/components/landing/HeroBackdrop";
import { ScrollReveal } from "@/components/landing/ScrollReveal";
import { SeasonCards } from "@/components/landing/SeasonCards";
import { ThemeMenu } from "@/components/dashboard/ThemeMenu";
import shotDashboard from "../../public/shots/dashboard.png";
import shotDetail from "../../public/shots/detail.png";
import shotPlayback from "../../public/shots/playback.png";

const FEATURES = [
  {
    title: "Follow curated trails",
    body: "Hand-picked walks across Japan — the Philosopher's Path at dawn, the old Nakasendo post road through cedar forest, Shibuya after dark. Every route comes with photo stops and local notes.",
    image: shotDashboard,
    alt: "Michi dashboard showing curated walk cards beside a map of Japan with route markers",
  },
  {
    title: "Record your own path",
    body: "Trace a route on the map or let GPS follow your real steps. Pin photos and voice notes to the exact spots they happened, and keep the walk private or share it with everyone.",
    image: shotDetail,
    alt: "A walk detail view with a route line along a Kyoto canal and photo stops",
  },
  {
    title: "Relive it like a film",
    body: "Playback flies you along your route while your photos and audio notes surface right where you took them. Your evening stroll becomes a memory you can press play on.",
    image: shotPlayback,
    alt: "Cinematic playback flying over Kyoto rooftops with a cherry-blossom photo card open",
  },
];

export default function Home() {
  return (
    <div className="bg-canvas">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <header className="absolute inset-x-0 top-0 z-20 flex h-16 items-center justify-between px-5 md:px-8">
        <p className="font-display text-lg font-semibold">
          <span className="text-accent" aria-hidden="true">
            道
          </span>{" "}
          Michi
        </p>
        <div className="flex items-center gap-2">
          <ThemeMenu />
          <Link
            href="/login"
            className="rounded-full border border-line bg-surface px-4 py-1.5 text-sm transition-colors hover:bg-wash"
          >
            Sign in
          </Link>
        </div>
      </header>

      <main id="main">
        <section
          aria-label="Introduction"
          className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-6 text-center"
        >
          <HeroBackdrop />
          <div className="relative z-10 flex max-w-3xl flex-col items-center gap-6 rounded-3xl bg-canvas/55 px-6 py-10 backdrop-blur-sm md:px-12">
            <p className="font-display text-xl text-accent">
              道 — michi · the path
            </p>
            <h1 className="font-display text-5xl font-semibold leading-tight md:text-7xl">
              Walk Japan,
              <br />
              keep the memory.
            </h1>
            <p className="max-w-xl text-lg text-ink-muted">
              Curated walking trails and scenic routes across Japan. Record
              your own walks with photos and audio notes — then replay them
              like a film.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link
                href="/login"
                className="rounded-full bg-accent px-7 py-3 font-medium text-accent-ink shadow-sm transition-transform hover:scale-105"
              >
                Start walking
              </Link>
              <Link
                href="/login?next=/dashboard"
                className="rounded-full border border-line bg-surface px-7 py-3 font-medium transition-colors hover:bg-wash"
              >
                Explore the trails
              </Link>
            </div>
          </div>
          <p
            aria-hidden="true"
            className="absolute bottom-6 z-10 animate-bounce text-2xl text-ink-muted"
          >
            ↓
          </p>
        </section>

        <ScrollReveal>
          <section
            aria-label="What Michi does"
            className="mx-auto flex w-full max-w-6xl flex-col gap-24 px-6 py-24"
          >
            {FEATURES.map((feature, i) => (
              <div
                key={feature.title}
                data-reveal
                className="grid items-center gap-10 md:grid-cols-2"
              >
                <div
                  className={`flex flex-col gap-4 ${i % 2 === 1 ? "md:order-2" : ""}`}
                >
                  <h2 className="font-display text-3xl font-semibold md:text-4xl">
                    {feature.title}
                  </h2>
                  <p className="text-lg leading-relaxed text-ink-muted">
                    {feature.body}
                  </p>
                </div>
                <Image
                  src={feature.image}
                  alt={feature.alt}
                  className="rounded-2xl border border-line shadow-lg"
                  sizes="(min-width: 768px) 50vw, 100vw"
                  placeholder="blur"
                />
              </div>
            ))}
          </section>

          <section
            aria-label="Seasonal themes"
            className="border-y border-line bg-surface"
          >
            <div
              data-reveal
              className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-24"
            >
              <div className="flex flex-col gap-3">
                <h2 className="font-display text-3xl font-semibold md:text-4xl">
                  Four seasons, eight moods.
                </h2>
                <p className="max-w-xl text-lg text-ink-muted">
                  Michi dresses itself for the season you&apos;re walking in —
                  each with a light and a dark face. Try one.
                </p>
              </div>
              <SeasonCards />
            </div>
          </section>

          <section aria-label="Get started" className="px-6 py-28">
            <div
              data-reveal
              className="mx-auto flex max-w-2xl flex-col items-center gap-6 text-center"
            >
              <p className="font-display text-5xl text-accent" aria-hidden="true">
                道
              </p>
              <h2 className="font-display text-3xl font-semibold md:text-4xl">
                The path is waiting.
              </h2>
              <Link
                href="/login"
                className="rounded-full bg-accent px-8 py-3.5 text-lg font-medium text-accent-ink shadow-sm transition-transform hover:scale-105"
              >
                Begin your first walk
              </Link>
            </div>
          </section>
        </ScrollReveal>
      </main>

      <footer className="border-t border-line px-6 py-8 text-center text-sm text-ink-muted">
        <p>
          Maps by MapLibre · Tiles by OpenFreeMap © OpenMapTiles · Data ©
          OpenStreetMap contributors
        </p>
        <p className="mt-1">
          Demo account: michi@seed.local / michi-demo-password
        </p>
      </footer>
    </div>
  );
}
