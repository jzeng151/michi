# Michi v1 implementation roadmap

This plan translates the approved product and engineering notes into reviewable pull requests. It preserves the working Supabase/RLS foundation, gallery, map shell, media storage, and replay controls instead of rebuilding them.

## Release outcomes

Two journeys define v1:

1. Import a camera roll, recover missing locations, save safely, and replay every stop in chronological order.
2. Replay a personal stop near a curated path and see the path's historical story alongside it.

The first journey is not complete until a 20-photo import works end to end. The second is not complete until the Nakasendo/Tsumago overlap works with the curated layer both on and off.

## Sequence

| PR | Deliverable | Depends on | Release critical |
| --- | --- | --- | --- |
| 1 | Test and CI foundation | — | Yes |
| 2 | Align the reachable UI to v1 | 1 | Yes |
| 3 | Make stops the domain model | 1 | Yes |
| 4 | Batch import and EXIF normalization | 3 | Yes |
| 5 | Placement, resilient drafts, and reliable sync | 4 | Yes |
| 6 | Complete chronological replay | 3, 5 | Yes |
| 7 | Layered Memory matching and overlay | 3, 6 | Yes |
| 8 | Curated routes and Japanese presentation | 7 | Yes |
| 9 | Google OAuth | 1; merge before release | Yes |
| 10 | Read-only share links | 7, 9 | No |
| 11 | PWA and production hardening | 8, 9 | Yes |

PR 9 can proceed alongside the core photo work once PR 1 is stable. PR 10 is the first whole PR to cut if schedule is at risk.

## PR 1 — Test and CI foundation

Establish the smallest useful quality rail before adding parser, matching, or migration logic.

Scope:

- Add Vitest for pure TypeScript logic and Chromium Playwright for real user journeys.
- Use Supabase's pgTAP runner for schema, RLS, storage, and RPC behavior.
- Reuse the installed `axe-core` package from Playwright; do not add another accessibility stack.
- Add `typecheck`, `test`, `test:db`, and `test:e2e` scripts plus a GitHub Actions workflow.
- Add seeded login and Supabase lifecycle helpers for tests.
- Cover one authenticated dashboard/walk smoke path and the current RLS/storage baseline.

Tests and acceptance:

- CI runs lint, typecheck, build, Vitest, pgTAP, and the focused Chromium suite.
- The suite proves an owner can read their private walk and another user cannot.
- The seeded walk opens and the existing replay controls render.
- No snapshot, Storybook, broad browser matrix, or Lighthouse setup is added.

## PR 2 — Align the reachable UI to v1

Make the shipped surface match the photo-first release without deleting compatible data.

Scope:

- Reduce the primary gallery to Curated and My walks.
- Hide GPS recording, audio capture, likes, comments, and follow surfaces from normal navigation.
- Keep visibility controls, existing tables, and stored records so this remains a reversible product decision.
- Remove copy that promises deferred live-recording or social behavior.

Tests and acceptance:

- Playwright covers dashboard, new-walk, and walk-detail navigation.
- An existing photo walk still loads and replays.
- No reachable v1 UI claims GPS, audio, or social capabilities.
- Deleting dormant tables or files is explicitly out of scope.

## PR 3 — Make stops the domain model

Introduce one ordered model that can represent a located photo, an unplaced photo, or a note-only stop.

Scope:

- Add `walk_stops` with kind, order, nullable coordinates, captured time, note, and ownership relationships.
- Relate media to stops and retain original filename, MIME type, capture time, and orientation metadata.
- Backfill current media rows and preserve the seeded walks.
- Allow valid zero- and one-stop drafts; derive route geometry only when enough placed points exist.
- Update read adapters and regenerate Supabase types without changing the visible UI.

Tests and acceptance:

- pgTAP covers constraints, backfill, ordering, owner writes, public reads, private reads, and cross-owner denial.
- Zero, one, and multiple stops are valid in the states intended by the schema.
- A note stop needs no storage object; an unplaced photo needs no coordinates.
- Existing seeded walks produce the same ordered pins after migration.

## PR 4 — Batch import and EXIF normalization

Replace the one-photo input with a bounded, fault-tolerant import queue.

Scope:

- Add multiple file selection and drag-and-drop.
- Add one focused EXIF dependency for GPS, capture time, timezone, and orientation.
- Normalize coordinates and sort by capture time with original file order as the stable tie-break.
- Parse with bounded concurrency and visible per-file progress.
- Keep corrupt and unsupported files isolated so one failure cannot discard the batch.
- Support HEIC metadata; defer HEIC visual conversion if browser support requires a second large dependency.

Tests and acceptance:

- Table-driven Vitest fixtures cover N/E/S/W GPS, timezones, orientation, missing GPS/time, corrupt metadata, unsupported types, and stable sorting.
- Fixtures include a Japanese filename and HEIC metadata.
- Playwright imports three small fixtures and distinguishes located from needs-placement items.
- A 20-photo mixed-order import yields 20 correctly ordered queue entries.
- Parsing concurrency is bounded and metadata reads do not decode full images.

## PR 5 — Placement, resilient drafts, and reliable sync

Turn the import queue into a recoverable editor and replace the current partial-save failure mode.

Scope:

- Add an Unplaced tray with select-then-map placement, reassignment, removal, notes, and photo-less stops.
- Provide a keyboard-accessible map-center placement action; dragging cannot be the only path.
- Persist metadata and blobs in native IndexedDB and restore the draft after reload or session expiry.
- Upload with per-file progress, retry only failed items, and clear the draft only after a confirmed save.
- Make save orchestration idempotent and clean up newly uploaded objects if database persistence fails.
- Surface read, upload, and persistence errors instead of discarding them.

Tests and acceptance:

- Vitest covers coordinate validation, deterministic untimed ordering, draft restore/clear, and retry state.
- pgTAP covers stop/media ownership and the save contract.
- Playwright imports all-no-EXIF photos, places one without a mouse, adds a note-only stop, saves, reloads, and verifies both.
- Forced upload, database, and expired-session failures preserve a retryable draft without orphaning new media.
- A 100-photo draft stays interactive and reports progress. Background sync, offline maps, and cross-tab editing are out of scope.

## PR 6 — Complete chronological replay

Keep the current GSAP/MapLibre work and finish its temporal and spatial contract.

Scope:

- Order stops by normalized capture time with a deterministic missing-time fallback.
- Move the route marker along the path instead of leaving it at the start.
- Add 1×, 4×, and 16× playback speeds and an ordered stop timeline.
- Keep pause, scrub, photo popups, and step-through reduced-motion behavior synchronized.
- Harden zero-, one-, 20-, and 500-stop cases.

Tests and acceptance:

- Vitest covers ordering, duration/speed math, seek boundaries, and firing a stop exactly once across pause/resume.
- Playwright reopens the saved fixture walk, changes speed, scrubs, and verifies photo/note order.
- Reduced-motion emulation uses step-through instead of animated camera flight.
- The 20-photo release journey moves the dot through every stop and opens the matching memory.
- A local trace checks a 100-stop walk for per-frame React rerenders; CI does not use a flaky FPS threshold.

## PR 7 — Layered Memory matching and overlay

Add the path's memory as a separate, understandable layer over personal stops.

Scope:

- Add curated waypoints with route, coordinates, time period, title, copy, media, and order.
- Implement one authoritative proximity query using an inclusive 100-metre radius, deterministic ordering, and a hard result cap.
- Allow multiple user stops to match the same curated waypoint.
- Default the curated overlay on and provide a visible, accessible toggle.
- Merge personal and curated entries in replay while preserving source labels and the plain no-match experience.

Tests and acceptance:

- pgTAP proves 100 m matches, 101 m does not, public curated reads work, client writes fail, and private user data does not leak.
- The proximity query uses an index and a result cap rather than a full scan.
- Vitest covers deterministic merging without mutating either source list.
- Playwright shows both “Your stop” and “The path's story,” toggles the layer, and verifies a far-away walk stays plain.
- Source is conveyed with text, not color alone, and every marker has an ordered-list equivalent.

## PR 8 — Curated routes and Japanese presentation

Provide enough owner-authorized content to demonstrate the product without inventing a second route system.

Scope:

- Seed Nakasendo, Kumano Kodo, and Philosopher's Path.
- Add roughly ten photographed and annotated waypoint stories per route with credits or ownership recorded.
- Reuse the current gallery, walk detail, and replay routes.
- Add kanji/kana and selective vertical waypoint titles; keep texture and ornament subordinate to readability.
- Preserve all four approved seasonal themes in light and dark modes.

Tests and acceptance:

- A clean local reset creates three routes, the expected waypoint counts, and resolvable assets.
- Playwright covers gallery → route detail → replay for each route.
- The Nakasendo/Tsumago release journey reveals the expected historical story beside the user stop.
- Keyboard navigation, reduced motion, and WCAG AA contrast pass for seasonal light and dark themes.
- A new `/routes/[slug]` route, decorative washi effects, and additional theme families are out of scope.

## PR 9 — Google OAuth

Replace production password entry with the approved identity flow while keeping local development practical.

Scope:

- Add Google OAuth, callback handling, safe return paths, session refresh, and sign-out.
- Keep seeded email/password login available only in local development and automated tests.
- Document Supabase provider settings, environment variables, and exact callback URLs.

Tests and acceptance:

- Playwright covers fresh sign-in, returning session, expired session, protected-route redirect, and sign-out.
- Open redirects are rejected.
- A new production user can sign in and reach the import flow; local seeded tests remain deterministic.

## PR 10 — Read-only share links (optional)

Make unlisted sharing secure without turning the private media bucket public.

Scope:

- Add an unlisted share token and `/share/[token]` viewer.
- Resolve authorized media through short-lived server-created signed URLs.
- Show the same replay and curated overlay without edit controls.
- Support token revocation; expiry is optional unless the product requires it.

Tests and acceptance:

- pgTAP covers valid, revoked, invalid, cross-owner, public-media, and private-media cases.
- Playwright opens a valid share in a signed-out private context and rejects invalid or revoked tokens.
- Anonymous users cannot enumerate walks or read another private object.
- This entire PR may move after v1 if schedule is at risk.

## PR 11 — PWA and production hardening

Ship the verified core journeys with an explicit operating contract.

Scope:

- Add a web manifest, icons, standalone metadata, and app-shell caching.
- Do not promise offline MapLibre tiles or user media.
- Validate required environment variables at startup.
- Add production migrations, rollback, storage, OAuth, monitoring, and incident notes to the README or a runbook.
- Configure HTTPS, the custom domain, and security headers after production origins are known.
- Run both release journeys against the deployed environment.

Tests and acceptance:

- Chromium verifies the manifest, service worker, standalone metadata, and app-shell offline reload.
- Production build and migration dry-run pass from a clean checkout.
- The deployed 20-photo replay and Nakasendo Layered Memory journeys pass with no critical/serious axe findings.
- Failed uploads remain recoverable, private media stays private, and rollback steps are exercised before launch.
- Install-prompt polish and offline map/media caching remain cuttable.

## Definition of done for every PR

- Scope is independently reviewable and leaves the main branch runnable.
- Forward-only migrations reset locally, pgTAP passes when data access changes, and generated database types are committed.
- Lint, typecheck, build, and focused tests for changed behavior pass.
- New controls have accessible names, complete keyboard paths, and reduced-motion behavior where relevant.
- Failure states are visible and do not silently discard user data.
- README and operational notes change with commands, schema, environment, or user-visible behavior.
- Incomplete multi-PR behavior stays behind an unreachable UI or a temporary feature flag.

## Test policy

Keep the suite small and behavior-focused:

- Vitest for parsers, ordering, matching, timing, and other pure branching logic.
- pgTAP for migrations, constraints, RLS, storage authorization, and RPCs.
- Chromium Playwright for the two release journeys plus the highest-risk negative/security cases.
- Existing `axe-core` runs inside those browser journeys.
- No snapshots, Storybook, Lighthouse gate, cross-browser matrix, or micro-benchmarks until a real failure justifies them.

Performance gates should test architecture—bounded concurrency, indexed/capped queries, and absence of per-frame React rendering. Record local browser traces for representative 50–100 item cases rather than enforcing machine-dependent millisecond or FPS thresholds in CI.

## Deliberate cuts

Cut in this order if time is constrained:

1. PR 10 share links.
2. Install-prompt polish and offline app-shell extras.
3. Decorative route textures and cinematic camera refinements.
4. HEIC visual conversion if metadata can still be read and the unsupported preview is clear.

Do not cut safe draft recovery, manual placement, time-ordered replay, the Layered Memory match, RLS tests, or the two release journeys.
