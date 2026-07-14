import { describe, expect, it } from "vitest";
import {
  PLAYBACK_SPEEDS,
  activeStopAtProgress,
  clampProgress,
  cursorAfterSeek,
  dueStopIndex,
  fillStopFractions,
  orderReplayStops,
  playbackDuration,
  playbackHoldDuration,
} from "./playback";

describe("replay model", () => {
  it("orders capture times first with deterministic ties and nulls", () => {
    const stops = [
      {
        id: "null-b",
        captured_at: null,
        sort_index: 4,
      },
      {
        id: "same-b",
        captured_at: "2025-01-01T00:00:00Z",
        sort_index: 2,
      },
      {
        id: "later",
        captured_at: "2025-01-02T00:00:00Z",
        sort_index: 0,
      },
      {
        id: "same-a",
        captured_at: "2024-12-31T19:00:00-05:00",
        sort_index: 1,
      },
      {
        id: "null-a",
        captured_at: null,
        sort_index: 4,
      },
    ];

    expect(orderReplayStops(stops).map(({ id }) => id)).toEqual([
      "same-a",
      "same-b",
      "later",
      "null-a",
      "null-b",
    ]);
    expect(stops.map(({ id }) => id)).toEqual([
      "null-b",
      "same-b",
      "later",
      "same-a",
      "null-a",
    ]);
  });

  it("scales the clamped route duration and media hold at every speed", () => {
    expect(PLAYBACK_SPEEDS).toEqual([1, 4, 16]);
    expect(playbackDuration(0, 1)).toBe(20);
    expect(playbackDuration(1_000, 1)).toBe(40);
    expect(playbackDuration(10_000, 1)).toBe(90);

    for (const speed of PLAYBACK_SPEEDS) {
      expect(playbackDuration(1_000, speed) * speed).toBe(40);
      expect(playbackHoldDuration(speed) * speed).toBe(3);
    }
  });

  it("clamps seeks and resolves the last stop at each boundary", () => {
    const stops = [{ frac: 0 }, { frac: 0.25 }, { frac: 0.25 }, { frac: 1 }];

    expect(clampProgress(Number.NEGATIVE_INFINITY)).toBe(0);
    expect(clampProgress(Number.NaN)).toBe(0);
    expect(clampProgress(0.4)).toBe(0.4);
    expect(clampProgress(Number.POSITIVE_INFINITY)).toBe(1);
    expect(cursorAfterSeek(stops, -1)).toBe(1);
    expect(cursorAfterSeek(stops, 0.25)).toBe(3);
    expect(cursorAfterSeek(stops, 2)).toBe(4);
    expect(activeStopAtProgress([{ frac: 0.2 }], 0)).toBeNull();
    expect(activeStopAtProgress(stops, Number.NaN)).toBe(0);
    expect(activeStopAtProgress(stops, 0.25)).toBe(2);
    expect(activeStopAtProgress(stops, 1)).toBe(3);
  });

  it("fires each chronological cursor once across pause, resume, and ties", () => {
    const stops = [{ frac: 0 }, { frac: 0.5 }, { frac: 0.5 }, { frac: 1 }];
    const fired: number[] = [];
    let nextIndex = 0;
    const advance = (progress: number) => {
      const due = dueStopIndex(stops, nextIndex, progress);
      if (due === null) return;
      fired.push(due);
      nextIndex = due + 1;
    };

    advance(0);
    advance(0);
    advance(0.5);
    advance(0.5);
    advance(0.5);
    advance(1);
    advance(1);

    expect(fired).toEqual([0, 1, 2, 3]);
  });

  it("fills sparse fractions without moving known spatial matches", () => {
    const expectFractions = (actual: number[], expected: number[]) => {
      expect(actual).toHaveLength(expected.length);
      expected.forEach((fraction, index) =>
        expect(actual[index]).toBeCloseTo(fraction),
      );
    };

    expectFractions(fillStopFractions([0.2, null, null, 0.8]), [
      0.2, 0.4, 0.6, 0.8,
    ]);
    expectFractions(
      fillStopFractions([null, null, 0.6, null, 0.4, null, null]),
      [0, 0.3, 0.6, 0.6, 0.6, 0.8, 1],
    );
    expect(fillStopFractions([-1, 2, 0.5])).toEqual([0, 1, 1]);
  });

  it("handles empty, one, 20, and 500-stop timelines", () => {
    expect(fillStopFractions([])).toEqual([]);
    expect(cursorAfterSeek([], 0)).toBe(0);
    expect(activeStopAtProgress([], 0)).toBeNull();
    expect(dueStopIndex([], 0, 1)).toBeNull();

    const one = fillStopFractions([null]);
    expect(one).toEqual([0]);
    expect(activeStopAtProgress(one.map((frac) => ({ frac })), 0)).toBe(0);

    for (const size of [20, 500]) {
      const fractions = fillStopFractions(Array<number | null>(size).fill(null));
      const stops = fractions.map((frac) => ({ frac }));
      expect(fractions).toHaveLength(size);
      expect(fractions[0]).toBe(0);
      expect(fractions.at(-1)).toBe(1);
      expect(fractions.every((frac, index) => index === 0 || frac >= fractions[index - 1])).toBe(true);

      let nextIndex = 0;
      while (nextIndex < stops.length) {
        expect(dueStopIndex(stops, nextIndex, 1)).toBe(nextIndex);
        nextIndex += 1;
      }
      expect(dueStopIndex(stops, nextIndex, 1)).toBeNull();
    }
  });
});
