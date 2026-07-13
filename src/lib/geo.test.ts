import { describe, expect, it } from "vitest";
import { lineStringFromCoordinates } from "./geo";

describe("lineStringFromCoordinates", () => {
  it("only creates route geometry from at least two points", () => {
    const point: [number, number] = [135, 35];

    expect(lineStringFromCoordinates([])).toBeNull();
    expect(lineStringFromCoordinates([point])).toBeNull();
    expect(lineStringFromCoordinates([point, [136, 36]])).toEqual({
      type: "LineString",
      coordinates: [point, [136, 36]],
    });
  });
});
