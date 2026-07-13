import Image from "next/image";
import Link from "next/link";
import { ScrollReveal } from "@/components/landing/ScrollReveal";
import { ThemeMenu } from "@/components/dashboard/ThemeMenu";
import shotDashboard from "../../public/shots/dashboard.png";
import shotDetail from "../../public/shots/detail.png";
import shotPlayback from "../../public/shots/playback.png";
import dawnPath from "../../public/landing/philosophers-path-dawn.webp";
import postcardCollage from "../../public/landing/postcard-collage.webp";
import philosophersPhoto from "../../public/shots/source/philosophers-path-ginkakuji.jpg";
import philosophersCanal from "../../public/shots/source/philosophers-path-canal.jpg";
import nakasendoPhoto from "../../public/shots/source/nakasendo.jpg";
import tsumagoPhoto from "../../public/shots/source/tsumago.jpg";
import yuigahamaPhoto from "../../public/shots/source/yuigahama.jpg";
import shibuyaPhoto from "../../public/shots/source/shibuya.jpg";
import fushimiPhoto from "../../public/shots/source/fushimi-inari.jpg";

const POSTCARD_ROUTES = [
  {
    name: "Philosopher's Path",
    place: "Kyoto",
    image: philosophersPhoto,
    alt: "Cherry blossoms over the Philosopher's Path canal in Kyoto",
    rotation: "-rotate-2",
  },
  {
    name: "Nakasendo",
    place: "Kiso Valley",
    image: nakasendoPhoto,
    alt: "Nakasendo trail sign under autumn maples",
    rotation: "rotate-1",
  },
  {
    name: "Coastal Stroll",
    place: "Kamakura",
    image: yuigahamaPhoto,
    alt: "Yuigahama Beach on the Kamakura coast",
    rotation: "-rotate-1",
  },
  {
    name: "Night Loop",
    place: "Shibuya",
    image: shibuyaPhoto,
    alt: "Shibuya Scramble Crossing at night",
    rotation: "rotate-2",
  },
  {
    name: "Inari Loop",
    place: "Kyoto",
    image: fushimiPhoto,
    alt: "Vermilion torii gates at Fushimi Inari",
    rotation: "-rotate-2",
  },
];

const primaryButton =
  "inline-flex w-fit items-center justify-center whitespace-nowrap rounded-full bg-accent px-6 py-3 font-bold text-accent-ink transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 hover:scale-[1.02] active:translate-y-px active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none";

function Mark() {
  return (
    <p className="font-display text-lg font-semibold">
      <span className="text-accent-text" aria-hidden="true">
        道
      </span>{" "}
      Michi
    </p>
  );
}

function SkipLink() {
  return (
    <a
      href="#main"
      className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:bg-surface focus:px-4 focus:py-2"
    >
      Skip to content
    </a>
  );
}

function FilmHeader() {
  return (
    <header className="absolute inset-x-0 top-0 z-20 flex h-16 items-center justify-between px-5 text-[#f7f3ee] md:px-8">
      <Mark />
      <Link
        href="/login"
        className="whitespace-nowrap rounded-full border border-white/45 bg-black/25 px-4 py-1.5 text-sm transition-colors hover:bg-black/45"
      >
        Sign in
      </Link>
    </header>
  );
}

function Credits() {
  return (
    <p>
      Maps by MapLibre and OpenFreeMap. Demo photography from{" "}
      <a className="underline underline-offset-4" href="/shots/CREDITS.md">
        Wikimedia Commons
      </a>
      .
    </p>
  );
}

function Film() {
  return (
    <div className="concept-film min-h-dvh bg-canvas text-ink">
      <SkipLink />
      <FilmHeader />
      <main id="main">
        <section className="relative flex min-h-dvh items-end overflow-hidden px-6 pb-16 pt-24 md:px-12 md:pb-20">
          <Image
            src={dawnPath}
            alt="The Philosopher's Path canal under cherry blossoms at quiet dawn"
            fill
            priority
            placeholder="blur"
            sizes="100vw"
            className="animate-[film-drift_14s_ease-out_forwards] object-cover"
          />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(12,12,11,0.82)_0%,rgba(12,12,11,0.42)_48%,rgba(12,12,11,0.12)_100%)]" />
          <div className="relative z-10 flex max-w-2xl flex-col items-start gap-6 text-[#f7f3ee]">
            <p className="font-display text-lg text-[#efb0ba]">
              A walk can hold a lifetime
            </p>
            <h1 className="font-display text-5xl font-semibold leading-[1.05] tracking-[-0.03em] md:text-7xl">
              Go back to where it happened.
            </h1>
            <p className="max-w-md text-lg leading-relaxed text-[#e2ded8]">
              Import the photos, let location pin each moment, then relive the
              path in motion.
            </p>
            <Link
              href="/login"
              className="inline-flex whitespace-nowrap rounded-full bg-[#f7f3ee] px-6 py-3 font-medium text-[#171716] transition-transform hover:-translate-y-0.5 active:translate-y-px"
            >
              Import a walk
            </Link>
          </div>
        </section>

        <ScrollReveal>
          <section className="mx-auto max-w-7xl px-6 py-24 md:px-10 md:py-32">
            <div data-reveal className="grid items-end gap-8 md:grid-cols-12">
              <div className="md:col-span-5">
                <h2 className="font-display text-4xl font-semibold leading-tight md:text-6xl">
                  First, choose the path.
                </h2>
                <p className="mt-5 max-w-sm text-lg leading-relaxed text-ink-muted">
                  Open a curated route or import a walk from your camera roll.
                </p>
              </div>
              <Image
                src={shotDashboard}
                alt="Michi's route dashboard across Japan"
                className="border border-line md:col-span-7"
                sizes="(min-width: 768px) 58vw, 100vw"
                placeholder="blur"
              />
            </div>
          </section>

          <section className="mx-auto grid max-w-7xl gap-8 px-6 pb-24 md:grid-cols-[1.25fr_0.75fr] md:px-10 md:pb-32">
            <Image
              data-reveal
              src={shotDetail}
              alt="A photograph saved along the Nakasendo route"
              className="border border-line"
              sizes="(min-width: 768px) 62vw, 100vw"
              placeholder="blur"
            />
            <div
              data-reveal
              className="flex flex-col justify-end gap-5 bg-surface p-8 md:p-10"
            >
              <h2 className="font-display text-4xl font-semibold leading-tight">
                Then, keep the moment.
              </h2>
              <p className="text-lg leading-relaxed text-ink-muted">
                Photos and short notes stay attached to the places that gave
                them meaning.
              </p>
            </div>
          </section>

          <section className="relative overflow-hidden border-y border-line bg-surface px-6 py-24 md:px-10 md:py-32">
            <div className="mx-auto max-w-7xl">
              <div data-reveal className="mb-10 max-w-2xl">
                <h2 className="font-display text-4xl font-semibold leading-tight md:text-6xl">
                  Finally, watch it return.
                </h2>
                <p className="mt-5 text-lg text-ink-muted">
                  Playback brings every stop back at the right point in the
                  journey.
                </p>
              </div>
              <Image
                data-reveal
                src={shotPlayback}
                alt="Cinematic route playback with a canal photograph open"
                className="border border-line shadow-[0_4px_8px_rgba(0,0,0,0.22)]"
                sizes="100vw"
                placeholder="blur"
              />
            </div>
          </section>

          <section className="px-6 py-28 text-center md:py-36">
            <div
              data-reveal
              className="mx-auto flex max-w-2xl flex-col items-center gap-6"
            >
              <h2 className="font-display text-4xl font-semibold md:text-6xl">
                Keep more than the map.
              </h2>
              <Link href="/login" className={primaryButton}>
                Import a walk
              </Link>
            </div>
          </section>
        </ScrollReveal>
      </main>
      <footer className="border-t border-line px-6 py-8 text-center text-sm text-ink-muted">
        <Credits />
      </footer>
    </div>
  );
}

function Postcards() {
  return (
    <ScrollReveal>
      <div className="min-h-dvh bg-canvas font-sans text-ink">
        <SkipLink />
        <header
          data-hero-nav
          className="absolute inset-x-0 top-0 z-20 flex h-16 items-center justify-between px-5 md:px-8"
        >
          <p className="text-lg font-bold">
            <span className="text-accent-text" aria-hidden="true">
              道
            </span>{" "}
            Michi
          </p>
          <div className="flex items-center gap-2">
            <ThemeMenu />
            <Link
              href="/login"
              className="whitespace-nowrap rounded-full border border-line bg-surface px-4 py-1.5 text-sm transition-colors hover:bg-wash"
            >
              Sign in
            </Link>
          </div>
        </header>

        <main id="main">
          <section className="mx-auto grid min-h-dvh max-w-[1440px] items-center gap-8 px-6 pb-12 pt-24 md:px-10 lg:grid-cols-[0.95fr_1.05fr]">
            <div
              data-hero-copy
              className="flex max-w-lg flex-col items-start gap-6"
            >
              <p className="font-bold text-accent-text">
                A memory palace for Japan
              </p>
              <h1 className="text-4xl font-bold leading-[0.98] tracking-[-0.04em] md:text-7xl">
                Japan, one walk at a time.
              </h1>
              <p className="max-w-md text-lg leading-relaxed text-ink-muted">
                Import your photos. Michi puts each moment back on the map, then
                replays the path in motion.
              </p>
              <div className="flex flex-wrap items-center gap-4">
                <Link href="/login" className={primaryButton}>
                  Import a walk
                </Link>
                <a
                  href="#how-it-works"
                  className="font-bold underline decoration-line decoration-2 underline-offset-4 transition-colors hover:decoration-accent"
                >
                  See how it works
                </a>
              </div>
            </div>
            <Image
              data-hero-art
              src={postcardCollage}
              alt="Travel photo prints from Kyoto, Kamakura, and Shibuya arranged on a tabletop"
              priority
              placeholder="blur"
              sizes="(min-width: 768px) 64vw, 100vw"
              className="rounded-2xl border border-line shadow-[0_4px_8px_rgba(29,44,35,0.14)]"
            />
          </section>

          <section
            data-story
            aria-labelledby="routes-title"
            className="border-y border-line bg-surface py-16"
          >
            <div className="mx-auto max-w-[1440px] px-6 md:px-10">
              <div data-story-item className="max-w-2xl">
                <h2 id="routes-title" className="text-4xl font-bold leading-tight">
                  A route gallery made for Japan lovers.
                </h2>
                <p className="mt-4 max-w-xl text-lg leading-relaxed text-ink-muted">
                  Begin with canals, old post towns, coastal paths, night
                  streets, and shrine trails grounded in real photographs.
                </p>
              </div>
              <div className="mt-10 flex snap-x gap-5 overflow-x-auto px-2 py-6">
                {POSTCARD_ROUTES.map((route) => (
                  <figure
                    data-story-item
                    key={route.name}
                    className={`w-[72vw] max-w-xs shrink-0 snap-start rounded-2xl border border-line bg-canvas p-3 shadow-[0_4px_8px_rgba(29,44,35,0.12)] transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-1 hover:scale-[1.01] motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:hover:scale-100 md:w-72 ${route.rotation}`}
                  >
                    <Image
                      src={route.image}
                      alt={route.alt}
                      className="aspect-[4/3] w-full rounded-xl object-cover"
                      sizes="288px"
                      placeholder="blur"
                    />
                    <figcaption className="flex items-center justify-between gap-3 px-1 pb-1 pt-3">
                      <span className="font-bold">{route.name}</span>
                      <span className="text-sm text-ink-muted">
                        {route.place}
                      </span>
                    </figcaption>
                  </figure>
                ))}
              </div>
            </div>
          </section>

          <section
            id="how-it-works"
            data-story
            className="mx-auto grid max-w-7xl gap-12 px-6 py-24 md:grid-cols-12 md:px-10 md:py-32"
          >
            <div className="md:col-span-5">
              <h2 data-story-item className="text-4xl font-bold leading-tight md:text-6xl">
                From camera roll to replay.
              </h2>
              <div className="mt-10 space-y-8">
                <div data-story-item>
                  <h3 className="text-2xl font-bold">Import photos</h3>
                  <p className="mt-2 max-w-md leading-relaxed text-ink-muted">
                    Michi reads location and time, then orders every stop
                    automatically.
                  </p>
                </div>
                <div data-story-item>
                  <h3 className="text-2xl font-bold">Place what is missing</h3>
                  <p className="mt-2 max-w-md leading-relaxed text-ink-muted">
                    Put photos without location on the map by hand. Add a
                    photo-less stop or short note anywhere.
                  </p>
                </div>
                <div data-story-item>
                  <h3 className="text-2xl font-bold">Replay the path</h3>
                  <p className="mt-2 max-w-md leading-relaxed text-ink-muted">
                    Follow the moving dot through time-ordered stops. Speed up
                    the journey or scrub back to any moment.
                  </p>
                </div>
              </div>
            </div>

            <div className="relative min-h-[34rem] md:col-span-7 md:min-h-[48rem]">
              <Image
                data-story-item
                src={shotDashboard}
                alt="Michi dashboard with photographed routes across Japan"
                className="absolute left-0 top-0 w-[88%] rounded-2xl border border-line bg-surface shadow-[0_4px_8px_rgba(29,44,35,0.12)]"
                sizes="(min-width: 768px) 52vw, 88vw"
                placeholder="blur"
              />
              <Image
                data-story-item
                src={shotDetail}
                alt="Photo stops placed along the Nakasendo route"
                className="absolute right-0 top-[31%] w-[68%] rotate-2 rounded-2xl border border-line bg-surface shadow-[0_4px_8px_rgba(29,44,35,0.14)]"
                sizes="(min-width: 768px) 40vw, 68vw"
                placeholder="blur"
              />
              <Image
                data-story-item
                src={shotPlayback}
                alt="Michi replay moving through a photographed walk"
                className="absolute bottom-0 left-[4%] w-[76%] -rotate-1 rounded-2xl border border-line bg-surface shadow-[0_4px_8px_rgba(29,44,35,0.14)]"
                sizes="(min-width: 768px) 44vw, 76vw"
                placeholder="blur"
              />
            </div>
          </section>

          <section
            data-layer-story
            className="overflow-hidden border-y border-line bg-wash px-6 py-24 md:px-10 md:py-32"
          >
            <div className="mx-auto grid max-w-7xl items-center gap-14 md:grid-cols-12">
              <div className="md:col-span-5">
                <h2 className="text-4xl font-bold leading-tight md:text-6xl">
                  Your memory meets the path&apos;s memory.
                </h2>
                <p className="mt-5 max-w-md text-lg leading-relaxed text-ink-muted">
                  Near a curated route, historical waypoint stories appear
                  beside your own stops. The place becomes a dialogue across
                  time.
                </p>
              </div>
              <div className="relative min-h-[36rem] md:col-span-7 md:min-h-[48rem]">
                <figure
                  data-layer-user
                  className="absolute left-0 top-0 w-[74%] -rotate-3 rounded-2xl border border-line bg-surface p-3 shadow-[0_4px_8px_rgba(29,44,35,0.14)]"
                >
                  <Image
                    src={tsumagoPhoto}
                    alt="Traditional wooden buildings along the road through Tsumago"
                    className="aspect-[4/3] w-full rounded-xl object-cover"
                    sizes="(min-width: 768px) 42vw, 70vw"
                    placeholder="blur"
                  />
                  <figcaption className="px-2 pb-2 pt-4">
                    <p className="text-sm font-bold text-accent-text">Your stop</p>
                    <p className="mt-1 text-xl font-bold">
                      Coffee in Tsumago, 07:14
                    </p>
                  </figcaption>
                </figure>
                <figure
                  data-layer-history
                  className="absolute bottom-0 right-0 w-[70%] rotate-3 rounded-2xl border border-line bg-canvas p-3 shadow-[0_4px_8px_rgba(29,44,35,0.14)]"
                >
                  <Image
                    src={nakasendoPhoto}
                    alt="A Nakasendo trail marker beneath autumn maples"
                    className="aspect-[4/3] w-full rounded-xl object-cover"
                    sizes="(min-width: 768px) 40vw, 66vw"
                    placeholder="blur"
                  />
                  <figcaption className="px-2 pb-2 pt-4">
                    <p className="text-sm font-bold text-accent-text">
                      The path&apos;s story
                    </p>
                    <p className="mt-1 text-xl font-bold">
                      Edo-period travelers rested here.
                    </p>
                  </figcaption>
                </figure>
              </div>
            </div>
          </section>

          <section
            data-story
            className="mx-auto grid max-w-7xl gap-10 px-6 py-24 md:grid-cols-12 md:px-10 md:py-32"
          >
            <div data-story-item className="md:col-span-4">
              <h2 className="text-4xl font-bold leading-tight">
                Japan is more than a backdrop.
              </h2>
              <p className="mt-5 text-lg leading-relaxed text-ink-muted">
                Curated cultural waypoints, Japanese typography, and seasonal
                atmosphere make the route itself part of every memory.
              </p>
            </div>
            <figure data-story-item className="md:col-span-5 md:mt-20">
              <Image
                src={philosophersCanal}
                alt="The Philosopher's Path beside its narrow Kyoto canal"
                className="aspect-[4/3] w-full rounded-2xl object-cover"
                sizes="(min-width: 768px) 42vw, 100vw"
                placeholder="blur"
              />
              <figcaption className="mt-3 text-sm text-ink-muted">
                Canal path, Kyoto
              </figcaption>
            </figure>
            <figure data-story-item className="md:col-span-3">
              <Image
                src={tsumagoPhoto}
                alt="Historic wooden post town buildings in Tsumago"
                className="aspect-[3/4] w-full rounded-2xl object-cover"
                sizes="(min-width: 768px) 25vw, 100vw"
                placeholder="blur"
              />
              <figcaption className="mt-3 text-sm text-ink-muted">
                Post town, Kiso Valley
              </figcaption>
            </figure>
          </section>

          <section className="bg-accent px-6 py-24 text-accent-ink md:py-32">
            <div className="mx-auto max-w-5xl">
              <h2 className="max-w-4xl text-4xl font-bold leading-tight md:text-7xl">
                Place is the index into memory.
              </h2>
              <p className="mt-6 max-w-xl text-lg leading-relaxed opacity-90">
                Michi turns a camera roll into a memory palace and every walk
                into a dialogue with the path.
              </p>
            </div>
          </section>
        </main>

        <footer className="border-t border-line px-6 py-8 text-center text-sm text-ink-muted">
          <Credits />
        </footer>
      </div>
    </ScrollReveal>
  );
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ concept?: string | string[] }>;
}) {
  return (await searchParams).concept === "film" ? <Film /> : <Postcards />;
}
