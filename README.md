# ratpack

Firefox + Chrome extension that overlays multiple Squadrats users' collected
tiles on the same route-planner map. Plan activities that maximise the haul of
squares for the whole squad.

Here is what it might look like for an unaccomplished pair of amateurs:
<img width="1625" height="1057" alt="image" src="https://github.com/user-attachments/assets/dbb0467b-bfec-44ba-b8c5-767313ec03a7" />


## Download

Grab the latest release for your browser:

**[Latest release →](https://github.com/aliaksei135/ratpack/releases/latest)**

- **Firefox**: download `ratpack-*-firefox.xpi` (signed)
- **Chrome**: download `ratpack-*-chrome.zip`

### Install

Not on the official extension stores, so install is manual:

**Firefox:**
1. Download the `.xpi` and open it in Firefox (drag into a window, or File → Open)
2. Click **Add** when prompted

Signed through AMO, so it installs permanently — survives restarts, no developer mode needed.

**Chrome:**
1. Open `chrome://extensions/`
2. Enable **Developer mode** (top-right toggle)
3. Drag the zip into the window (or click **Load unpacked** and select the unzipped folder)

Chrome offers no self-signing path — the only signed distribution is via the Chrome Web Store review process, so sideloading in developer mode is the only option for now.

## Supported planners

| Planner | Engine | Status |
|---------|--------|--------|
| BRouter (`brouter.de/brouter-web`) | Leaflet | Working |
| Strava (`strava.com/maps`) | WASM renderer | Working |
| bikerouter.de / brouter.m11n.de | Leaflet | Needs manifest match |
| Komoot, gpx-studio, Garmin, etc. | MapLibre | Planned |

## Finding your Squadrats UID

The UID is an alphanumeric string that identifies your Squadrats account.
To find it:

1. Go to [squadrats.com](https://squadrats.com) and log in
2. Do one of the following:
   - **Standings**: open the standings page, find yourself (or your friend),
     and click on the name
   - **Profile**: go to your profile, then click **"my achievements"**
3. The URL will look like:
   ```
   https://squadrats.com/u/2qgThcUDn4OMjTDaGsvF9nSLbWV2
   ```
4. The UID is the alphanumeric string after `/u/` — in this example:
   `2qgThcUDn4OMjTDaGsvF9nSLbWV2`

## Adding users

1. Click the ratpack toolbar icon to open the popup
2. Paste a Squadrats UID into the input field
3. Click **Add**
4. Repeat for each user you want to overlay (no limit on count)

Each user gets a deterministic colour. You can:
- Click the colour swatch to change it
- Type an optional label (display name)

### Tile rendering

For each squadrat tile, depending on how many users have collected it:

- **0 users** — basemap shows through (no overlay)
- **1 user** — solid colour overlay at constant alpha
- **2+ users** — diagonal stripes (top-left → bottom-right), one stripe per
  user

Squadrats render in a **lighter** shade of each user's colour;
squadratinhos render in the **base** colour.

## Development

```bash
npm install          # install web-ext
npm run dev          # load into a temporary Firefox profile
npm run lint         # validate manifest/packaging
npm run build        # build Firefox + Chrome packages into dist/
```

No build step, no test suite, no typecheck. Verify changes with:
`node --check` on touched JS + `python3 -m json.tool manifest.json` + `npm run lint`.

## Architecture

See [AGENTS.md](AGENTS.md) for the full architecture guide, including the
two-world content-script/page-script pattern, module map, and cross-browser
shim details.

## License

This project is independent and not affiliated with Squadrats. The Squadrats
name and brand are property of their respective owners.
