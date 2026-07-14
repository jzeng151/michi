export const PLAYBACK_SPEEDS = [1, 4, 16] as const;

export type PlaybackSpeed = (typeof PLAYBACK_SPEEDS)[number];

export function orderReplayStops<
  T extends { id: string; captured_at: string | null; sort_index: number },
>(stops: readonly T[]): T[] {
  return [...stops].sort((a, b) => {
    if (a.captured_at === null && b.captured_at !== null) return 1;
    if (a.captured_at !== null && b.captured_at === null) return -1;
    if (a.captured_at !== null && b.captured_at !== null) {
      const byTime = Date.parse(a.captured_at) - Date.parse(b.captured_at);
      if (byTime) return byTime;
    }
    return a.sort_index - b.sort_index || a.id.localeCompare(b.id);
  });
}

export function playbackDuration(
  distanceM: number,
  speed: PlaybackSpeed,
): number {
  return Math.min(90, Math.max(20, distanceM / 25)) / speed;
}

export function playbackHoldDuration(speed: PlaybackSpeed): number {
  return 3 / speed;
}

export function clampProgress(progress: number): number {
  return Number.isNaN(progress)
    ? 0
    : Math.min(1, Math.max(0, progress));
}

export function cursorAfterSeek(
  stops: readonly { frac: number }[],
  progress: number,
): number {
  const index = stops.findIndex(({ frac }) => frac > clampProgress(progress));
  return index === -1 ? stops.length : index;
}

export function activeStopAtProgress(
  stops: readonly { frac: number }[],
  progress: number,
): number | null {
  const cursor = cursorAfterSeek(stops, progress);
  return cursor === 0 ? null : cursor - 1;
}

export function dueStopIndex(
  stops: readonly { frac: number }[],
  nextIndex: number,
  progress: number,
): number | null {
  const stop = stops[nextIndex];
  return Number.isInteger(nextIndex) &&
    stop !== undefined &&
    stop.frac <= clampProgress(progress)
    ? nextIndex
    : null;
}

export function fillStopFractions(
  raw: readonly (number | null)[],
): number[] {
  const values = raw.map((value) =>
    value === null ? null : clampProgress(value),
  );
  let previous = 0;
  let known = 0;

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === null) continue;
    const next = Math.max(previous, value);
    values[index] = next;
    previous = next;
    known += 1;
  }

  if (known === 0) {
    if (values.length < 2) return values.length === 0 ? [] : [0];
    return values.map((_, index) => index / (values.length - 1));
  }

  let start = 0;
  while (start < values.length) {
    if (values[start] !== null) {
      start += 1;
      continue;
    }

    let end = start;
    while (end < values.length && values[end] === null) end += 1;
    const count = end - start;
    const left = start === 0 ? 0 : values[start - 1]!;
    const right = end === values.length ? 1 : values[end]!;

    for (let offset = 0; offset < count; offset += 1) {
      const position =
        start === 0
          ? offset / count
          : end === values.length
            ? (offset + 1) / count
            : (offset + 1) / (count + 1);
      values[start + offset] = left + (right - left) * position;
    }
    start = end;
  }

  return values as number[];
}
