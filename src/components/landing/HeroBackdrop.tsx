"use client";

import { useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import { HeroPoster } from "./HeroPoster";

const Hero3D = dynamic(() => import("./Hero3D"), { ssr: false });

let capability: boolean | null = null;

function canRender3D(): boolean {
  if (capability !== null) return capability;
  try {
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    // Desktop-only: phones get the static poster (battery, data, and LCP).
    const wide = window.matchMedia("(min-width: 768px)").matches;
    const canvas = document.createElement("canvas");
    const webgl = Boolean(
      canvas.getContext("webgl2") ?? canvas.getContext("webgl"),
    );
    capability = !reduced && wide && webgl;
  } catch {
    capability = false;
  }
  return capability;
}

const subscribe = () => () => {};

export function HeroBackdrop() {
  // Server snapshot renders the poster; capable clients upgrade to the scene.
  const enable3d = useSyncExternalStore(subscribe, canRender3D, () => false);

  return (
    <div className="absolute inset-0" aria-hidden="true">
      <HeroPoster />
      {enable3d && (
        <div className="absolute inset-0">
          <Hero3D />
        </div>
      )}
    </div>
  );
}
