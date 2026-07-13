"use client";

import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger);

/** Runs the landing choreography while leaving the server-rendered page visible. */
export function ScrollReveal({ children }: { children: React.ReactNode }) {
  const scope = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      const q = gsap.utils.selector(scope);

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const heroCopy = q<HTMLElement>("[data-hero-copy] > *");
        const heroArt = q<HTMLElement>("[data-hero-art]");
        const heroNav = q<HTMLElement>("[data-hero-nav]");

        if (heroCopy.length && heroArt.length) {
          gsap
            .timeline({ defaults: { ease: "power3.out" } })
            .from(heroNav, {
              y: -18,
              opacity: 0,
              duration: 0.45,
              clearProps: "transform,opacity",
            })
            .from(
              heroCopy,
              {
                y: 18,
                opacity: 0,
                stagger: 0.06,
                duration: 0.55,
                clearProps: "transform,opacity",
              },
              "<0.08",
            )
            .from(
              heroArt,
              {
                y: 24,
                scale: 0.97,
                rotation: 1.5,
                opacity: 0,
                duration: 0.8,
                ease: "power4.out",
                clearProps: "transform,opacity",
              },
              "<0.08",
            );
        }

        q<HTMLElement>("[data-story]").forEach((section) => {
          const items = section.querySelectorAll<HTMLElement>("[data-story-item]");
          if (!items.length) return;

          gsap.from(items, {
            y: 24,
            opacity: 0,
            stagger: 0.07,
            duration: 0.65,
            ease: "power3.out",
            clearProps: "transform,opacity",
            scrollTrigger: {
              trigger: section,
              start: "top 78%",
              once: true,
            },
          });
        });

        q<HTMLElement>("[data-layer-story]").forEach((section) => {
          const user = section.querySelector<HTMLElement>("[data-layer-user]");
          const history = section.querySelector<HTMLElement>(
            "[data-layer-history]",
          );
          const copy = section.querySelectorAll<HTMLElement>("h2, p");

          gsap.from(copy, {
            y: 24,
            opacity: 0,
            stagger: 0.08,
            duration: 0.65,
            ease: "power3.out",
            clearProps: "transform,opacity",
            scrollTrigger: { trigger: section, start: "top 74%", once: true },
          });

          if (!user || !history) return;
          gsap.from(user, {
            x: -80,
            rotation: -8,
            ease: "none",
            scrollTrigger: {
              trigger: section,
              start: "top 85%",
              end: "center center",
              scrub: 0.7,
            },
          });
          gsap.from(history, {
            x: 80,
            rotation: 8,
            ease: "none",
            scrollTrigger: {
              trigger: section,
              start: "top 85%",
              end: "center center",
              scrub: 0.7,
            },
          });
        });

        q<HTMLElement>("[data-reveal]").forEach((el) => {
          gsap.from(el, {
            y: 24,
            opacity: 0,
            duration: 0.65,
            ease: "power3.out",
            clearProps: "transform,opacity",
            scrollTrigger: { trigger: el, start: "top 82%", once: true },
          });
        });
      });

      return () => mm.revert();
    },
    { scope },
  );

  return <div ref={scope}>{children}</div>;
}
