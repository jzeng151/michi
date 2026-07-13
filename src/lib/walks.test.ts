import { expect, it } from "vitest";
import { pathDistance } from "./geo";
import { isHeicMime } from "./media-url";
import { fetchBrowseLists, fetchWalkDetail } from "./walks";

it("keeps unplaced media and measures a route derived from placed stops", async () => {
  const coordinates: [number, number][] = [
    [135, 35],
    [135.001, 35.001],
  ];
  const media = (id: string, mimeType = "image/webp") => ({
    id,
    bucket: "curated",
    storage_path: `${id}.webp`,
    alt_text: id,
    mime_type: mimeType,
  });
  const row = {
    id: "walk",
    owner_id: "owner",
    title: "Draft",
    description: null,
    region: null,
    path: null,
    distance_m: 0,
    duration_s: null,
    visibility: "private",
    is_curated: false,
    created_at: "2026-01-01T00:00:00Z",
    profiles: { username: "owner", display_name: null },
    walk_stops: [
      {
        id: "stop-1",
        kind: "photo",
        sort_index: 0,
        lat: null,
        lng: null,
        note: "Needs placement",
        walk_media: media("unplaced", "image/heic"),
      },
      ...coordinates.map(([lng, lat], index) => ({
        id: `stop-${index + 2}`,
        kind: "photo",
        sort_index: index + 1,
        lat,
        lng,
        note: null,
        walk_media: media(
          `placed-${index + 1}`,
          index === 0 ? "image/heic" : "image/webp",
        ),
      })),
    ],
  };
  const client = {
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: row }) }),
      }),
    }),
  } as unknown as Parameters<typeof fetchWalkDetail>[0];

  const detail = await fetchWalkDetail(client, row.id);
  const browseClient = {
    from: () => ({
      select: () => ({
        eq: () => ({ order: async () => ({ data: [row] }) }),
      }),
    }),
  } as unknown as Parameters<typeof fetchBrowseLists>[0];
  const lists = await fetchBrowseLists(browseClient, row.owner_id);

  expect(detail?.media.map(({ id }) => id)).toEqual([
    "unplaced",
    "placed-1",
    "placed-2",
  ]);
  expect(detail?.pins.map(({ id }) => id)).toEqual(["placed-1", "placed-2"]);
  expect(detail?.pins.map(({ listIndex }) => listIndex)).toEqual([1, 2]);
  expect(detail?.media[0]).toMatchObject({
    mimeType: "image/heic",
    url: null,
  });
  expect(detail?.pins[0]).toMatchObject({
    mimeType: "image/heic",
    url: null,
  });
  expect(lists.mine[0].cover?.alt).toBe("placed-2");
  expect(detail?.walk.path?.coordinates).toEqual(coordinates);
  expect(detail?.walk.distance_m).toBe(pathDistance(coordinates));
  expect(lists.curated[0].distanceM).toBe(pathDistance(coordinates));
  expect(lists.mine[0].distanceM).toBe(pathDistance(coordinates));
  expect(isHeicMime("image/heic")).toBe(true);
  expect(isHeicMime("image/heif; charset=binary")).toBe(true);
  expect(isHeicMime("image/webp")).toBe(false);
  expect(isHeicMime(null)).toBe(false);
});
