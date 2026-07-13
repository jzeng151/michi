"use client";

import { useMemo } from "react";
import { Source, Layer } from "react-map-gl/maplibre";
import { useTheme } from "@/components/theme/ThemeProvider";
import type { LineString } from "@/lib/types";

/** Current --accent as a concrete color (MapLibre paint can't read CSS vars). */
export function useAccentColor(): string {
  const { season, resolvedMode } = useTheme();
  return useMemo(() => {
    if (typeof document === "undefined") return "#b1476a";
    return (
      getComputedStyle(document.documentElement)
        .getPropertyValue("--accent")
        .trim() || "#b1476a"
    );
    // The CSS variable changes with the html[data-*] attributes, which these
    // two values track — the linter can't see that data flow.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [season, resolvedMode]);
}

export function RouteLayer({ path }: { path: LineString }) {
  const accent = useAccentColor();
  const { resolvedMode } = useTheme();

  return (
    <Source
      id="route"
      type="geojson"
      data={{ type: "Feature", geometry: path, properties: {} }}
    >
      <Layer
        id="route-casing"
        type="line"
        layout={{ "line-cap": "round", "line-join": "round" }}
        paint={{
          "line-color": resolvedMode === "dark" ? "#00000066" : "#ffffffcc",
          "line-width": 8,
        }}
      />
      <Layer
        id="route-line"
        type="line"
        layout={{ "line-cap": "round", "line-join": "round" }}
        paint={{ "line-color": accent, "line-width": 4 }}
      />
    </Source>
  );
}
