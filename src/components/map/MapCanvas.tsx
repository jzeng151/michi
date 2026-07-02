"use client";

import { forwardRef } from "react";
import Map, {
  NavigationControl,
  ScaleControl,
  type MapRef,
  type MapProps,
} from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { useTheme } from "@/components/theme/ThemeProvider";

const MAP_STYLES = {
  light: "https://tiles.openfreemap.org/styles/liberty",
  dark: "https://tiles.openfreemap.org/styles/fiord",
} as const;

const JAPAN_VIEW = { longitude: 137.2, latitude: 37.2, zoom: 4.5 };

type MapCanvasProps = Omit<MapProps, "mapStyle" | "mapLib"> & {
  label: string;
};

/**
 * Shared MapLibre surface. Tile style follows the theme's resolved mode;
 * declarative children (Source/Layer/Marker) are re-applied by react-map-gl
 * after style swaps.
 */
export const MapCanvas = forwardRef<MapRef, MapCanvasProps>(
  function MapCanvas({ label, children, initialViewState, ...rest }, ref) {
    const { resolvedMode } = useTheme();

    return (
      <div role="application" aria-label={label} className="h-full w-full">
        <Map
          ref={ref}
          initialViewState={initialViewState ?? JAPAN_VIEW}
          mapStyle={MAP_STYLES[resolvedMode]}
          style={{ width: "100%", height: "100%" }}
          {...rest}
        >
          <NavigationControl position="top-right" />
          <ScaleControl position="bottom-left" />
          {children}
        </Map>
      </div>
    );
  },
);
