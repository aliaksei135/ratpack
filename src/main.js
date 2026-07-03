(function () {
  const rp = (window.ratpack = window.ratpack || {});
  const VERSION = "0.1.0";

  let pageReady = false;
  let refreshInFlight = false;
  let refreshQueued = false;

  function injectPageScript() {
    const script = document.createElement("script");
    script.src = browser.runtime.getURL("src/page-renderer.js");
    script.onload = function () {
      script.remove();
    };
    (document.head || document.documentElement).appendChild(script);
  }

  function sendToPage(msg) {
    window.postMessage(Object.assign({ source: "ratpack-cs" }, msg), "*");
  }

  function loadData(users) {
    const tileData = new Map();
    const tasks = users.map(async function (u) {
      try {
        let data = await rp.cache.getValid(u.uid);
        if (!data) {
          const result = await rp.throttle.defaultQueue.add(function () {
            return rp.fetcher.fetchUserTiles(u.uid);
          });
          await rp.cache.put(u.uid, result.raw, result.geojson);
          data = { raw: result.raw, geojson: result.geojson };
        }
        tileData.set(u.uid, data);
        console.log("[ratpack] loaded tiles for " + u.uid);
      } catch (err) {
        console.warn(
          "[ratpack] failed to load tiles for " +
            u.uid +
            ": " +
            (err && err.message)
        );
      }
    });
    return Promise.all(tasks).then(function () {
      return tileData;
    });
  }

  function tileDataToMessage(tileData) {
    const tiles = {};
    for (const [uid, data] of tileData) {
      tiles[uid] = {
        raw: {
          14: Array.from(data.raw[14]),
          17: Array.from(data.raw[17]),
        },
      };
    }
    return tiles;
  }

  function doRefresh() {
    return rp.storage.getUsers().then(function (users) {
      if (users.length === 0) {
        console.log("[ratpack] no users configured");
        sendToPage({ type: "RATPACK_REMOVE" });
        return;
      }
      return loadData(users).then(function (tileData) {
        sendToPage({
          type: "RATPACK_RENDER",
          config: rp.config,
          users: users.map(function (u) {
            return {
              uid: u.uid,
              color14: rp.colors.colorForZoom(u.color, rp.config.zoom.squadrats),
              color17: rp.colors.colorForZoom(u.color, rp.config.zoom.squadratinhos),
            };
          }),
          tiles: tileDataToMessage(tileData),
        });
        console.log("[ratpack] render sent for " + users.length + " user(s)");
      });
    });
  }

  function refresh() {
    if (refreshInFlight) {
      refreshQueued = true;
      return Promise.resolve();
    }
    refreshInFlight = true;
    return doRefresh()
      .catch(function (err) {
        console.error("[ratpack] refresh failed:", err);
      })
      .then(function () {
        refreshInFlight = false;
        if (refreshQueued) {
          refreshQueued = false;
          return refresh();
        }
      });
  }

  function init() {
    console.log("[ratpack] content script loaded v" + VERSION);
    injectPageScript();
  }

  window.addEventListener("message", function (e) {
    if (e.source !== window) return;
    if (!e.data || e.data.source !== "ratpack") return;

    if (e.data.type === "RATPACK_READY") {
      pageReady = true;
      console.log(
        "[ratpack] page renderer ready (pathSupported: " +
          e.data.pathSupported +
          ")"
      );
      if (e.data.pathSupported) {
        refresh();
      }
    } else if (e.data.type === "RATPACK_NO_MAP") {
      console.warn("[ratpack] map not found by page renderer");
    } else if (e.data.type === "RATPACK_RENDERED") {
      console.log("[ratpack] overlay rendered");
    }
  });

  if (
    typeof browser !== "undefined" &&
    browser.storage &&
    browser.storage.onChanged
  ) {
    browser.storage.onChanged.addListener(function (changes, area) {
      if (area === "local" && changes.ratpack_users) {
        if (pageReady) {
          refresh();
        }
      }
    });
  }

  rp.main = { init: init, version: VERSION, refresh: refresh };

  init();
})();
