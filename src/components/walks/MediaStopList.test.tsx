import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { MediaStopList } from "./MediaStopList";

it("shows a clear fallback instead of rendering a HEIC image", () => {
  const html = renderToStaticMarkup(
    <MediaStopList
      media={[
        {
          id: "heic-photo",
          kind: "photo",
          url: "https://example.com/photo.heic",
          mimeType: "image/heic",
          alt: "A retained HEIC photo",
          caption: null,
          lat: null,
          lng: null,
        },
      ]}
    />,
  );

  expect(html).toContain(
    "HEIC preview unavailable. The original photo is retained.",
  );
  expect(html).not.toContain("<img");
});
