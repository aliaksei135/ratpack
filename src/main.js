(function () {
  const rp = (window.ratpack = window.ratpack || {});
  const VERSION = "0.1.0";

  let overlay = null;
  let refreshInFlight = false;
  let refreshQueued = false;

  const waitForMap = (timeoutMs = 30000, intervalMs = 1000) => {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      const tick = () => {
        const map = rp.planners.brouter.findMap();
        if (map) {
          resolve(map);
          return;
        }
        if (Date.now() - start >= timeoutMs) {
          reject(new Error("Timed out waiting for BRouter map"));
          return;
        }
        setTimeout(tick, intervalMs);
      };
      tick();
    });
  };

  const loadData = async (users) => {
    const tileData = new Map();
    const tasks = users.map(async (u) => {
      try {
        let data = await rp.cache.getValid(u.uid);
        if (!data) {
          const result = await rp.throttle.defaultQueue.add(() =>
            rp.fetcher.fetchUserTiles(u.uid)
          );
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
    await Promise.all(tasks);
    return tileData;
  };

  const render = (map, users, tileData) => {
    if (overlay) {
      overlay.remove();
      overlay = null;
    }
    overlay = rp.leafletEngine.createOverlay(map, users, tileData);
    console.log("[ratpack] overlay rendered for " + users.length + " user(s)");
  };

  const doRefresh = async () => {
    if (overlay) {
      overlay.remove();
      overlay = null;
    }
    const users = await rp.storage.getUsers();
    if (users.length === 0) {
      console.log("[ratpack] no users configured");
      return;
    }
    let map = rp.planners.brouter.findMap();
    if (!map) {
      try {
        map = await waitForMap();
      } catch (err) {
        console.error("[ratpack] " + (err && err.message));
        return;
      }
    }
    const tileData = await loadData(users);
    render(map, users, tileData);
  };

  const refresh = async () => {
    if (refreshInFlight) {
      refreshQueued = true;
      return;
    }
    refreshInFlight = true;
    try {
      await doRefresh();
    } finally {
      refreshInFlight = false;
    }
    if (refreshQueued) {
      refreshQueued = false;
      refresh();
    }
  };

  const init = async () => {
    console.log("[ratpack] content script loaded v" + VERSION);

    if (!rp.planners || !rp.planners.brouter) {
      console.error("[ratpack] brouter planner not loaded");
      return;
    }
    if (!rp.planners.brouter.isPathSupported()) {
      console.log("[ratpack] path not supported by brouter adapter");
      return;
    }

    let users;
    try {
      users = await rp.storage.getUsers();
    } catch (err) {
      console.error("[ratpack] failed to read users:", err);
      return;
    }
    console.log("[ratpack] " + users.length + " user(s) configured");
    if (users.length === 0) return;

    let map;
    try {
      map = await waitForMap();
    } catch (err) {
      console.error("[ratpack] " + (err && err.message));
      return;
    }

    const tileData = await loadData(users);
    render(map, users, tileData);
  };

  if (
    typeof browser !== "undefined" &&
    browser.storage &&
    browser.storage.onChanged
  ) {
    browser.storage.onChanged.addListener((changes, area) => {
      if (area === "local" && changes.ratpack_users) {
        refresh().catch((err) => {
          console.error("[ratpack] refresh failed:", err);
        });
      }
    });
  }

  rp.main = { init, version: VERSION, loadData, render, refresh };

  init().catch((err) => {
    console.error("[ratpack] init failed:", err);
  });
})();
