(function () {
  const rp = (window.ratpack = window.ratpack || {});

  const DB_NAME = "ratpack-cache";
  const DB_VERSION = 1;
  const STORE_NAME = "userTiles";
  const DEFAULT_TTL = 3600000;

  let dbPromise = null;

  const getTtl = () => ((rp && rp.config && rp.config.cacheTtlMs) || DEFAULT_TTL);

  const toArray = (v) =>
    Array.isArray(v) ? v : v instanceof Set ? Array.from(v) : [];

  const openDb = () => {
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === "undefined") {
        reject(new Error("IndexedDB is not available in this context"));
        return;
      }

      let req;
      try {
        req = indexedDB.open(DB_NAME, DB_VERSION);
      } catch (err) {
        reject(new Error("Failed to open IndexedDB: " + (err && err.message)));
        return;
      }

      req.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "uid" });
        }
      };

      req.onsuccess = (event) => resolve(event.target.result);
      req.onerror = () =>
        reject(new Error("Failed to open IndexedDB: " + (req.error && req.error.message)));
      req.onblocked = () => reject(new Error("IndexedDB open blocked"));
    });

    dbPromise.catch(() => {
      dbPromise = null;
    });

    return dbPromise;
  };

  const get = async (uid) => {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(uid);
      req.onsuccess = () => {
        const record = req.result || null;
        if (record && Date.now() - record.cachedAt > getTtl()) {
          resolve(null);
          return;
        }
        resolve(record);
      };
      req.onerror = () => reject(req.error || new Error("cache.get failed"));
    });
  };

  const put = async (uid, raw, geojson) => {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const record = {
        uid,
        raw: {
          14: toArray(raw && raw["14"]),
          17: toArray(raw && raw["17"]),
        },
        geojson: geojson || null,
        cachedAt: Date.now(),
      };
      const req = store.put(record);
      req.onsuccess = () => resolve(record);
      req.onerror = () => reject(req.error || new Error("cache.put failed"));
    });
  };

  const getValid = async (uid) => {
    const record = await get(uid);
    if (!record) return null;
    return {
      raw: {
        14: new Set(record.raw["14"] || []),
        17: new Set(record.raw["17"] || []),
      },
      geojson: record.geojson || null,
    };
  };

  const clear = async (uid) => {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = uid === undefined ? store.clear() : store.delete(uid);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error || new Error("cache.clear failed"));
    });
  };

  rp.cache = { get, put, getValid, clear };
})();