# ratpack — implementation todo

Firefox MV3 extension that overlays multiple Squadrats users' collected
tiles on the same route-planner map. Clean-room reimplementation informed
by the official "Squadrats Route Planning" extension (closed source).

## Locked decisions

- No user cap; all entered by direct UID (alphanum). No OAuth.
- MVP = Leaflet planners first (canvas L.GridLayer). MapLibre deferred.
- UI = action popup (toolbar) for managing the user list.
- Both z14 (squadrats) + z17 (squadratinhos), zoom-gated like the official ext.
- API: GET https://mainframe-api.squadrats.com/anonymous/squadrants/<UID>
  -> {raw:{14:["x-y",...],17:[...]}, geojson:"<url>"} ; CORS \* confirmed.

## Phase 0 — scaffolding

- [ ] T0.1 Firefox MV3 manifest (gecko id, strict_min_version 109, storage perm, content_scripts for Leaflet planner domains starting with brouter.de)
- [ ] T0.2 Content-script loader that injects config + renderer + planner adapter
- [ ] T0.3 Popup HTML skeleton + web-ext dev build config
- [ ] T0.4 Shared config module: mainframe URLs, constant alpha, zoom thresholds

## Phase 1 — users & storage

- [ ] T1.1 UID list model in storage.local (alphanum validate, no cap)
- [ ] T1.2 Colour assignment: random + perceptually distinct + persisted per UID; stable sort-by-UID helper
- [ ] T1.3 Popup UI: user list w/ colour swatches, add/remove input

## Phase 2 — data layer

- [ ] T2.1 Fetcher /anonymous/squadrants/<UID> -> raw{14,17} Sets, 429 backoff/retry
- [ ] T2.2 IndexedDB cache (per-UID TTL) + throttle queue (<=15 concurrent)

## Phase 3 — Leaflet renderer + BRouter

- [ ] T3.1 Canvas L.GridLayer: per-tile owners, draw 0/1/2+ (solid+alpha; diagonal stripes stably sorted by UID)
- [ ] T3.2 z14/z17 zoom-gating + DPR scaling
- [ ] T3.3 BRouter adapter (findMap / isPathSupported)

## Phase 4 — polish

- [ ] T4.1 Refresh on UID-list change (refetch/redraw), loading + empty/error states
- [ ] T4.2 Manual QA on BRouter; package & sign for Firefox

## Deferred (post-MVP)

- MapLibre renderer (Komoot/Strava/gpx-studio)
- Remaining planner adapters (Garmin, Mapy, RideWithGPS, etc.)
