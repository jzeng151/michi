import type { Metadata } from "next";
import Image, { type StaticImageData } from "next/image";
import Link from "next/link";
import springPhoto from "../../../public/shots/source/philosophers-path-ginkakuji.jpg";
import summerPhoto from "../../../public/shots/source/yuigahama.jpg";
import autumnPhoto from "../../../public/shots/source/nakasendo.jpg";
import winterPhoto from "../../../public/shots/source/inamuragasaki.jpg";

export const metadata: Metadata = {
  title: "Season palette studies",
  description: "Light and dark color palettes for Michi's four seasonal themes.",
};

type Colors = {
  canvas: string;
  surface: string;
  ink: string;
  muted: string;
  accent: string;
  accentInk: string;
  wash: string;
  line: string;
  focus: string;
};

type Palette = {
  name: string;
  status: "Light" | "Dark";
  colors: Colors;
};

const SEASONS: {
  name: string;
  place: string;
  image: StaticImageData;
  alt: string;
  palettes: Palette[];
}[] = [
  {
    name: "Spring 春",
    place: "Philosopher's Path, Kyoto",
    image: springPhoto,
    alt: "Cherry blossoms along the Philosopher's Path in Kyoto",
    palettes: [
      {
        name: "Plum Postmark",
        status: "Light",
        colors: {
          canvas: "#f7f4f6",
          surface: "#fffdfe",
          ink: "#251e23",
          muted: "#67535f",
          accent: "#b1476a",
          accentInk: "#ffffff",
          wash: "#f1e2e8",
          line: "#8f7b84",
          focus: "#7e1f42",
        },
      },
      {
        name: "Plum Postmark",
        status: "Dark",
        colors: {
          canvas: "#201a1e",
          surface: "#2b2328",
          ink: "#f4eaf0",
          muted: "#c0aeb8",
          accent: "#d993aa",
          accentInk: "#2b101b",
          wash: "#382b32",
          line: "#4c3b44",
          focus: "#f0b2c6",
        },
      },
    ],
  },
  {
    name: "Summer 夏",
    place: "Yuigahama, Kamakura",
    image: summerPhoto,
    alt: "Blue water along Yuigahama Beach in Kamakura",
    palettes: [
      {
        name: "Mint Shade",
        status: "Light",
        colors: {
          canvas: "#f1f6f7",
          surface: "#fcfeff",
          ink: "#192629",
          muted: "#4a6065",
          accent: "#4d9b75",
          accentInk: "#10291d",
          wash: "#dceef1",
          line: "#6c858b",
          focus: "#1f684a",
        },
      },
      {
        name: "Mint Shade",
        status: "Dark",
        colors: {
          canvas: "#172225",
          surface: "#203033",
          ink: "#eaf2f3",
          muted: "#acbdc0",
          accent: "#86c8aa",
          accentInk: "#10291d",
          wash: "#263a3e",
          line: "#3b4d51",
          focus: "#a2dbbf",
        },
      },
    ],
  },
  {
    name: "Autumn 秋",
    place: "Nakasendo, Kiso Valley",
    image: autumnPhoto,
    alt: "Autumn maples around a Nakasendo trail marker",
    palettes: [
      {
        name: "Persimmon Stamp",
        status: "Light",
        colors: {
          canvas: "#f7f3f0",
          surface: "#fffefd",
          ink: "#2b211d",
          muted: "#67564e",
          accent: "#a13f1c",
          accentInk: "#ffffff",
          wash: "#f2e3dc",
          line: "#8d7a70",
          focus: "#7b2d11",
        },
      },
      {
        name: "Persimmon Stamp",
        status: "Dark",
        colors: {
          canvas: "#211c17",
          surface: "#2b251e",
          ink: "#f0e9df",
          muted: "#b5a894",
          accent: "#e0955c",
          accentInk: "#291807",
          wash: "#382e22",
          line: "#3e362c",
          focus: "#edb98a",
        },
      },
    ],
  },
  {
    name: "Winter 冬",
    place: "Inamuragasaki, Kamakura",
    image: winterPhoto,
    alt: "Cool winter light across the water at Inamuragasaki",
    palettes: [
      {
        name: "Indigo Snow",
        status: "Light",
        colors: {
          canvas: "#f1f4f7",
          surface: "#fcfeff",
          ink: "#1b232b",
          muted: "#4f5e6c",
          accent: "#4d7199",
          accentInk: "#ffffff",
          wash: "#dce7f0",
          line: "#6f818f",
          focus: "#244464",
        },
      },
      {
        name: "Indigo Snow",
        status: "Dark",
        colors: {
          canvas: "#191d20",
          surface: "#22272b",
          ink: "#e6ebee",
          muted: "#9fabb2",
          accent: "#8ab4cf",
          accentInk: "#0e1e29",
          wash: "#293238",
          line: "#313a40",
          focus: "#b2d3e6",
        },
      },
    ],
  },
];

const SWATCHES: { key: keyof Colors; label: string }[] = [
  { key: "canvas", label: "Canvas" },
  { key: "surface", label: "Surface" },
  { key: "ink", label: "Ink" },
  { key: "muted", label: "Muted" },
  { key: "accent", label: "Accent" },
  { key: "accentInk", label: "On accent" },
  { key: "wash", label: "Wash" },
  { key: "line", label: "Line" },
  { key: "focus", label: "Focus" },
];

function PalettePreview({
  palette,
  image,
  alt,
  place,
}: {
  palette: Palette;
  image: StaticImageData;
  alt: string;
  place: string;
}) {
  const { colors } = palette;

  return (
    <article
      className="overflow-hidden rounded-2xl border"
      style={{
        backgroundColor: colors.canvas,
        borderColor: colors.line,
        color: colors.ink,
      }}
    >
      <div className="grid min-h-80 sm:grid-cols-[0.88fr_1.12fr]">
        <div className="flex flex-col justify-between gap-10 p-6">
          <div>
            <div className="flex items-center justify-between gap-3 text-sm font-bold">
              <span>
                <span style={{ color: colors.focus }} aria-hidden="true">
                  道
                </span>{" "}
                Michi
              </span>
              <span style={{ color: colors.muted }}>{palette.status}</span>
            </div>
            <h2 className="mt-10 text-3xl font-bold leading-tight">
              {palette.name}
            </h2>
            <p className="mt-3 leading-relaxed" style={{ color: colors.muted }}>
              Japan, one walk at a time.
            </p>
          </div>
          <span
            className="inline-flex w-fit rounded-full px-4 py-2 text-sm font-bold"
            style={{
              backgroundColor: colors.accent,
              color: colors.accentInk,
            }}
          >
            Replay walk
          </span>
        </div>
        <figure className="p-3 sm:pl-0">
          <Image
            src={image}
            alt={alt}
            className="h-full min-h-60 w-full rounded-xl object-cover"
            sizes="(min-width: 768px) 32vw, 100vw"
            placeholder="blur"
          />
          <figcaption className="sr-only">{place}</figcaption>
        </figure>
      </div>

      <div
        className="border-t px-5 py-4"
        style={{ backgroundColor: colors.surface, borderColor: colors.line }}
      >
        <p className="mb-3 text-sm font-bold">{place}</p>
        <div className="flex gap-4 overflow-x-auto pb-1">
          {SWATCHES.map(({ key, label }) => (
            <div key={key} className="w-16 shrink-0">
              <span
                className="block h-8 rounded-lg border"
                style={{
                  backgroundColor: colors[key],
                  borderColor: colors.line,
                }}
              />
              <span className="mt-1 block text-xs" style={{ color: colors.muted }}>
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}

export default function PaletteStudiesPage() {
  return (
    <main className="min-h-dvh bg-canvas px-5 py-8 text-ink md:px-10 md:py-12">
      <div className="mx-auto max-w-[1440px]">
        <header className="flex flex-col items-start justify-between gap-6 border-b border-line pb-10 sm:flex-row sm:items-end">
          <div>
            <p className="font-bold text-accent-text">Michi color studies</p>
            <h1 className="mt-3 text-4xl font-bold tracking-[-0.04em] md:text-6xl">
              Season palette studies
            </h1>
            <p className="mt-4 max-w-xl text-lg text-ink-muted">
              Paired light and dark production palettes for every season.
            </p>
          </div>
          <Link
            href="/"
            className="whitespace-nowrap rounded-full border border-line bg-surface px-5 py-2.5 font-bold transition-colors hover:bg-wash"
          >
            Back to landing page
          </Link>
        </header>

        {SEASONS.map((season) => (
          <section key={season.name} className="py-14 md:py-20">
            <h2 className="mb-7 text-3xl font-bold">{season.name}</h2>
            <div className="grid gap-6 lg:grid-cols-2">
              {season.palettes.map((palette) => (
                <PalettePreview
                  key={`${palette.name}-${palette.status}`}
                  palette={palette}
                  image={season.image}
                  alt={season.alt}
                  place={season.place}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
