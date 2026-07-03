# Fetching Current Squadrats

Squadrats has an unprotected but rate limited endpoint for fetching a users map data in GeoJSON form.

The process:

## Get the user UID

This is probably going to be an input from the user. Can be found from the user going to their squadrats profile and inspecting network traffic for a request out to `https://mainframe-api.squadrats.com/squadrants/<USER_UID>`. It looks like this is just a alphanum string

## Get the collected tile indices

See [What are squadrats](/docs/spec/squadrats/description.md).
Query this endpoint with the found User UID: `https://mainframe-api.squadrats.com/anonymous/squadrants/<USER_UID>`. This gives a response of:

```json
{
  "raw": {
    "14": ["8128-5489","8128-5490",...],
    "17": [ "65025-43914", "65026-43914",...]
  },
  "geojson": "https://squadrats.org/trophies/<USER_UID>/<STRING>.geojson"
}
```

The response has only two top-level keys: `raw` and `geojson`. There is **no
name or profile field** — user display names are manually labelled in the popup,
not fetched from the API.

If the UID does not exist or has no data, the endpoint returns HTTP 200 with a
`null` body. Treat this as an invalid UID.

### CORS

The API sends `access-control-allow-origin: *` on all responses, so content
scripts can `fetch()` directly — no background script proxy is needed.

### Rate limiting

The endpoint is rate-limited. HTTP 429 responses are possible when fetching
multiple users in quick succession. The fetcher retries 429s with exponential
backoff (1s, 2s, 4s, 8s, max 4 retries). Fetches are throttled to 3 concurrent
requests (see `src/throttle.js`).

### Alternative mainframe URLs

The official (proprietary) extension uses proxy hosts
`mainframe-proxy-01.squadrats.com` and `mainframe-proxy-02.squadrats.com` for
load balancing. ratpack uses the direct `mainframe-api.squadrats.com` host.
All three send permissive CORS headers.

## The `raw` key

The `raw` key gives lists of the map tile indices for 'squadrats' and 'squadratinhos' (zoom levels 14 and 17 respectively). These are in `x-y` format.

## The `geojson` key

The `geojson` key provide an alternative representation of this in a ready-to-use GeoJSON file URL. This file contains each aspect of the users progress as a separate feature within a GeoJSON FeatureCollection:

```geojson
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": ...,
        "coordinates": ...
      },
      "properties": {
        "name": "squadrats",
        "size": 944
      }
    },
    {
      "type": "Feature",
      "geometry": {
        "type": ...,
        "coordinates": ...
      },
      "properties": {
        "name": "squadratinhos",
        "size": 10907
      }
    },
  ...
  ]
}
```

These are usually features of type `MultiPolygon`, but not exclusively. Crucially, individual squadrats are _not_ split out, instead this is a union of all collected squadrats/inhos. This would be useful for any bulk geospatial operations where we don't care about individual squares, or when visualising.
