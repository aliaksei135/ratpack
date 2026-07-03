# AGENTS.md

Firefox MV3 browser extension. Overlays multiple Squadrats users' collected
tiles on route-planner maps. Clean-room reimplementation — the official
"Squadrats Route Planning" extension is proprietary ("All Rights Reserved");
never copy its code. Architecture concepts (manifest layout, IIFE modules,
canvas GridLayer rendering, API contract) are reimplemented independently.

## Commands

- `npm run dev` — load extension into a temporary Firefox profile (`web-ext run`).
- `npm run lint` — validate manifest/packaging (`web-ext lint`). Expect 1
  non-blocking warning about `data_collection_permissions` (that field
  requires Firefox 140+; we target 109, so do NOT add it — adding it
  produces a hard error on lint).
- Syntax check a single content script: `node --check src/<file>.js`
  (`node --check` on `popup/popup.js` works too — module imports aren't resolved
  by `--check`, only syntax is validated).

There is no build step, no test suite, no typecheck. Verify changes with:
`node --check` on touched JS + `python3 -m json.tool manifest.json` + `npm run lint`.

## Architecture — non-obvious rules

**No ES modules in content scripts.** Firefox MV3 content scripts cannot use
`import`/`export`. Every `src/*.js` is a classic IIFE that attaches to a shared
namespace:

```js
(function () {
  const rp = (window.ratpack = window.ratpack || {});
  rp.moduleName = { /* ... */ };
})();
```

The popup (`popup/popup.html` + `popup.js`) IS an extension page and CAN use
`<script type="module">`. Content-script IIFEs do NOT load on extension pages,
so `popup.js` deliberately **duplicates** the storage + colour logic from
`src/storage.js` / `src/colors.js`. Keep the two copies in sync when changing
UID validation, colour assignment, the `ratpack_users` storage shape, or
name/colour editing. The popup also registers a `browser.storage.onChanged`
listener so it live-updates when the content script writes back (e.g. after a
fetch completes).

**Manifest script order matters.** `content_scripts[0].js` loads in array order
and modules depend on earlier ones being present on `window.ratpack`. Current
order: `config -> storage -> colors -> fetcher -> cache -> throttle ->
leaflet-engine -> planners/brouter -> main`. Preserve dependency order when
adding files.

**Firefox X-ray vision is the #1 footgun.** Content scripts run in a separate
compartment from the page. To read page globals (Leaflet's `L`, BRouter's `BR`):
`const L = window.wrappedJSObject.L;`. To **pass** a content-script object into a
page function (e.g. `L.GridLayer.extend(opts)`), you MUST clone it into the page
compartment or Leaflet throws `Permission denied to access property "statics"`:

```js
const pageOpts = cloneInto(
  { options: {...}, createTile: createTileFn },
  window,
  { cloneFunctions: true }
);
const LayerClass = L.GridLayer.extend(pageOpts);
```

`cloneFunctions: true` wraps the content-side function so the page can call it,
while it still closes over content-script variables. `document.createElement`
returns a real DOM element that crosses compartments freely — no clone needed
for canvas nodes passed back via `done(null, canvas)`.

## Module map

- `src/config.js` — constants: API URL, `alpha` (overlay opacity),
  `zoom` (14=squadrats, 17=squadratinhos), cache TTL.
- `src/storage.js` / `popup/popup.js` — UID list in `browser.storage.local` under
  key `ratpack_users` as `[{uid, color, name?}]`, uid regex `/^[a-zA-Z0-9]+$/`
  (no cap). `color` is editable per-user via `setUserColor(uid, "#rrggbb")`;
  `name` is an optional manual label via `setUserName(uid, str|null)` (the API
  has no name field). The popup exposes an `<input type="color">` and a text
  `<input>` per row. Keep the storage + colour logic in both files in sync
  (popup duplicates content-script modules — see below).
- `src/colors.js` — deterministic colour via DJB2 hash + golden-ratio hue
  spacing; `sortByUid` gives stable ordering (used for stripe order).
  `colorForZoom(baseColor, zoom)` derives a **lighter** shade (40% blend toward
  white) for z14 squadrats from the stored base colour; z17 uses the base as-is.
  The overlay reads the **stored** `u.color` (not a recompute), so user edits to
  colour take effect immediately via `storage.onChanged` → `refresh()`.
- `src/fetcher.js` — `GET mainframe-api.squadrats.com/anonymous/squadrants/<UID>`,
  429 exponential backoff (1/2/4/8s). `null` body = invalid UID. Response has
  only `raw` and `geojson` keys — no name/profile field (see `docs/spec/squadrats/fetching.md`).
- `src/cache.js` — IndexedDB (`ratpack-cache`/`userTiles`), TTL-aware. IndexedDB
  silently drops `Set` → always store arrays; convert at the boundary
  (`getValid` returns Sets, `put` accepts either).
- `src/throttle.js` — concurrency-limited promise queue (default 3).
- `src/leaflet-engine.js` — canvas `L.GridLayer` renderer. Per squadrat cell:
  0 owners = skip, 1 = solid fill at `config.alpha`, 2+ = diagonal stripes
  (45° rotation + horizontal bands, owners already uid-sorted). Zoom gating:
  draw z14 when `2^(14-z) ≤ 64` (z≥8), z17 when z≥11.
- `src/planners/brouter.js` — adapter: `findMap()` reads `BR.debug.map` via
  `wrappedJSObject`; `isPathSupported()` checks pathname/hash.
- `src/main.js` — orchestrator: wait-for-map poll (1s, 30s timeout) →
  cache-first load via throttle queue → render. `browser.storage.onChanged`
  triggers `refresh()` with `refreshInFlight`/`refreshQueued` coalescing.

## Content-script match scope

Manifest matches `*://*.brouter.de/*` only (MVP target). `bikerouter.de` and
`brouter.m11n.de` are NOT matched even though `isPathSupported()` checks them —
extend the manifest match pattern before expecting coverage there. MapLibre
planners (Komoot, Strava, gpx-studio, etc.) are deferred post-MVP.

## Squadrats data model

Tile index format: `"x-y"` strings at zoom 14 (squadrats) and 17
(squadratinhos), Web Mercator. For a map tile `(tx,ty,z)`, squadrat range is
`factor = 2^(14-z)` cells per tile dimension; `minSx = tx*factor` etc. See
`docs/spec/` for the API contract and coordinate math. API CORS is open
(`access-control-allow-origin: *`) so content scripts fetch directly — no
background proxy needed.
