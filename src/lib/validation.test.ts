import { describe, expect, it } from "vitest";
import { safeNextPath } from "./validation";

describe("safeNextPath", () => {
  it.each([
    ["/dashboard/new?draft=1#photos", "/dashboard/new?draft=1#photos"],
    [null, "/dashboard"],
    ["https://example.com/walk", "/dashboard"],
    ["//example.com/walk", "/dashboard"],
    ["/\\example.com/walk", "/dashboard"],
  ])("maps %s to %s", (target, expected) => {
    expect(safeNextPath(target)).toBe(expected);
  });
});
