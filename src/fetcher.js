(function () {
  const rp = (window.ratpack = window.ratpack || {});

  const DEFAULT_MAINFRAME_URL = "https://mainframe-api.squadrats.com";
  const DEFAULT_API_PATH = "/anonymous/squadrants/";

  const getConfig = () => {
    const cfg = (rp && rp.config) || {};
    return {
      mainframeUrl: cfg.mainframeUrl || DEFAULT_MAINFRAME_URL,
      apiPath: cfg.apiPath || DEFAULT_API_PATH,
    };
  };

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const fetchUserTiles = async (uid) => {
    const { mainframeUrl, apiPath } = getConfig();
    const url = mainframeUrl + apiPath + uid;
    const maxRetries = 4;
    const backoff = [1000, 2000, 4000, 8000];

    let rateLimitError;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      let res;
      try {
        res = await fetch(url);
      } catch (err) {
        throw new Error("Network error fetching UID " + uid + ": " + (err && err.message));
      }

      if (res.status === 429) {
        rateLimitError = new Error("Rate limited (429) for UID " + uid);
        if (attempt < maxRetries) {
          await sleep(backoff[attempt]);
          continue;
        }
        throw rateLimitError;
      }

      if (!res.ok) {
        throw new Error("HTTP " + res.status + " for UID " + uid);
      }

      let body;
      try {
        body = await res.json();
      } catch (err) {
        throw new Error("Invalid JSON for UID " + uid + ": " + (err && err.message));
      }

      if (body === null) {
        throw new Error("No data for UID: " + uid);
      }

      const raw = body.raw || {};
      return {
        uid,
        raw: {
          14: new Set(raw["14"] || []),
          17: new Set(raw["17"] || []),
        },
        geojson: body.geojson || null,
      };
    }

    throw rateLimitError || new Error("Unexpected fetch failure for UID " + uid);
  };

  const fetchHealth = async () => {
    const { mainframeUrl } = getConfig();
    try {
      const res = await fetch(mainframeUrl + "/anonymous/health");
      return res.ok;
    } catch (err) {
      return false;
    }
  };

  rp.fetcher = { fetchUserTiles, fetchHealth };
})();