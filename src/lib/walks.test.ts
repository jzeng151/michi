import { expect, it } from "vitest";
import { pathDistance } from "./geo";
import { isHeicMime } from "./media-url";
import { fetchBrowseLists, fetchWalkDetail } from "./walks";

it("orders stops chronologically and derives a route from placed stops", async () => {
  const coordinates: [number, number][] = [
    [135, 35],
    [135.001, 35.001],
  ];
  const noteCoordinate: [number, number] = [134.999, 34.999];
  const route = [coordinates[1], coordinates[0], noteCoordinate];
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
        id: "note-1",
        kind: "note",
        sort_index: 1,
        captured_at: null,
        lat: noteCoordinate[1],
        lng: noteCoordinate[0],
        note: "Tea beside the old cedar.",
        walk_media: null,
      },
      {
        id: "stop-1",
        kind: "photo",
        sort_index: 0,
        captured_at: null,
        lat: null,
        lng: null,
        note: "Needs placement",
        walk_media: media("unplaced", "image/heic"),
      },
      ...coordinates.map(([lng, lat], index) => ({
        id: `stop-${index + 2}`,
        kind: "photo",
        sort_index: index + 2,
        captured_at: `2026-01-0${2 - index}T00:00:00Z`,
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

  expect(detail?.media.map(({ id, capturedAt }) => [id, capturedAt])).toEqual([
    ["placed-2", "2026-01-01T00:00:00Z"],
    ["placed-1", "2026-01-02T00:00:00Z"],
    ["unplaced", null],
    ["note-1", null],
  ]);
  expect(detail?.pins.map(({ id, capturedAt }) => [id, capturedAt])).toEqual([
    ["placed-2", "2026-01-01T00:00:00Z"],
    ["placed-1", "2026-01-02T00:00:00Z"],
    ["note-1", null],
  ]);
  expect(detail?.pins.map(({ listIndex }) => listIndex)).toEqual([0, 1, 3]);
  expect(detail?.pins[2]).toEqual({
    id: "note-1",
    kind: "note",
    note: "Tea beside the old cedar.",
    capturedAt: null,
    lat: noteCoordinate[1],
    lng: noteCoordinate[0],
    listIndex: 3,
  });
  expect(detail?.media[3]).toEqual({
    id: "note-1",
    kind: "note",
    note: "Tea beside the old cedar.",
    capturedAt: null,
    lat: noteCoordinate[1],
    lng: noteCoordinate[0],
  });
  expect(detail?.media[2]).toMatchObject({
    mimeType: "image/heic",
    url: null,
  });
  expect(detail?.pins[1]).toMatchObject({
    mimeType: "image/heic",
    url: null,
  });
  expect(lists.mine[0].cover?.alt).toBe("placed-2");
  expect(lists.mine[0].start).toEqual(coordinates[1]);
  expect(detail?.walk.path?.coordinates).toEqual(route);
  expect(detail?.walk.distance_m).toBe(pathDistance(route));
  expect(lists.curated[0].distanceM).toBe(pathDistance(route));
  expect(lists.mine[0].distanceM).toBe(pathDistance(route));
  expect(isHeicMime("image/heic")).toBe(true);
  expect(isHeicMime("image/heif; charset=binary")).toBe(true);
  expect(isHeicMime("image/webp")).toBe(false);
  expect(isHeicMime(null)).toBe(false);
});
