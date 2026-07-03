(function () {
  const TILE_SIZE = 256;
  const MAX_FACTOR = 64;

  let cfg = { alpha: 0.4, zoom: { squadrats: 14, squadratinhos: 17 } };
  let currentOverlay = null;
  let renderToken = 0;

  function lngToTileX(lng, zoom) {
    return Math.floor(((lng + 180) / 360) * Math.pow(2, zoom));
  }

  function latToTileY(lat, zoom) {
    const rad = (lat * Math.PI) / 180;
    return Math.floor(
      ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) *
        Math.pow(2, zoom)
    );
  }

  function tileXToLng(sx, zoom) {
    return (sx / Math.pow(2, zoom)) * 360 - 180;
  }

  function tileYToLat(sy, zoom) {
    const n = Math.PI - (2 * Math.PI * sy) / Math.pow(2, zoom);
    return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  }

  function isPathSupported() {
    if (
      location.pathname.includes("brouter-web") ||
      location.href.includes("bikerouter.de/#map=") ||
      location.href.includes("brouter.m11n.de/#map=")
    ) {
      return true;
    }
    if (
      location.hostname.includes("strava.com") &&
      location.pathname.includes("/maps")
    ) {
      return true;
    }
    return false;
  }

  function findMap() {
    if (typeof BR !== "undefined" && BR.debug && BR.debug.map) {
      console.log("[ratpack] map found: leaflet (BR.debug.map)");
      return { type: "leaflet", map: BR.debug.map };
    }
    var wasmMap = findStravaWasmMap();
    if (wasmMap) {
      console.log("[ratpack] map found: strava wasm");
      return { type: "wasm", map: wasmMap };
    }
    var mlMap = findMapLibreMap();
    if (mlMap) {
      console.log("[ratpack] map found: maplibre/mapbox");
      return { type: "maplibre", map: mlMap };
    }
    return null;
  }

  function findStravaWasmMap() {
    var el = document.querySelector("[class*='CoreMap_mapContainer']");
    if (!el) el = document.querySelector("[class*='CoreMap']");
    if (!el) return null;

    var fiberKey = Object.keys(el).find(function (k) {
      return k.startsWith("__reactFiber$");
    });
    if (!fiberKey) return null;

    var fiber = el[fiberKey];
    for (var i = 0; i < 3 && fiber; i++) {
      fiber = fiber.child;
    }
    if (!fiber) return null;

    var state = fiber.memoizedState;
    while (state) {
      var rendered = state.queue && state.queue.lastRenderedState;
      if (rendered && rendered._djinni_native_ref) {
        console.log("[ratpack] wasm map found via _djinni_native_ref");
        return rendered;
      }
      state = state.next;
    }
    return null;
  }

  var RESERVED_PROPS = {
    self: 1, parent: 1, global: 1, window: 1, frames: 1, globalThis: 1,
    top: 1, promise: 1, loaded: 1, userChoice: 1, finished: 1, ready: 1,
    caller: 1, callee: 1, arguments: 1, prototype: 1, localStorage: 1,
    squadrats: 1, $: 1, chat: 1, closed: 1, connectionList: 1,
    responseReady: 1,
  };

  function isMapInstance(e) {
    if (!e || typeof e !== "object") return false;
    return (
      typeof e.getZoom === "function" && typeof e.project === "function"
    );
  }

  function isMapboxMap(e) {
    if (!e || typeof e !== "object") return false;
    return !(!e._mapId || typeof e.getLayer !== "function");
  }

  function isLeafletMap(e) {
    return !!(
      e &&
      e._leaflet_id &&
      e._layers &&
      e._handlers &&
      e._mapPane &&
      e._mapPane.parentNode
    );
  }

  function searchFiberForMap(startNode, timeoutMs) {
    var visited = new Set();
    var queue = [startNode];
    var maxNodes = 15000;
    var count = 0;
    var checked = 0;
    var deadline = Date.now() + (timeoutMs || 5000);

    while (queue.length > 0 && count < maxNodes && Date.now() < deadline) {
      var e = queue.shift();
      if (!e || visited.has(e)) continue;
      if (typeof e !== "object" && typeof e !== "function") continue;
      visited.add(e);
      count++;
      checked++;

      if (isMapInstance(e) || isMapboxMap(e) || isLeafletMap(e)) {
        console.log("[ratpack] map found in fiber search after checking " + checked + " nodes, " + count + " queued");
        return e;
      }

      try {
        var names = Object.getOwnPropertyNames(e);
        for (var i = 0; i < names.length; i++) {
          var key = names[i];
          if (RESERVED_PROPS[key]) continue;
          try {
            var val = e[key];
            if (val !== null && val !== undefined) queue.push(val);
          } catch (er) {}
        }
      } catch (er2) {}
    }
    console.log("[ratpack] fiber search exhausted: checked " + checked + " nodes, visited " + count + ", queue " + queue.length + ", timed out: " + (Date.now() >= deadline));
    return null;
  }

  function getFiberFromElement(el) {
    var keys = Object.keys(el);
    for (var i = 0; i < keys.length; i++) {
      if (
        keys[i].startsWith("__reactFiber$") ||
        keys[i].startsWith("__reactInternalInstance$")
      ) {
        return el[keys[i]];
      }
    }
    return null;
  }

  function findMapLibreMap() {
    try {
      var s = window.strava;
      if (s && s.maps && typeof s.maps.getMap === "function") {
        var m = s.maps.getMap();
        if (m && typeof m.getLayer === "function") {
          console.log("[ratpack] map found via window.strava.maps.getMap()");
          return m;
        }
      }
    } catch (e) {}

    var el =
      document.querySelector("[class*='CoreMap']") ||
      document.querySelector("[class*='coreMap']");
    if (el) {
      var fiber = getFiberFromElement(el);
      if (fiber) {
        var map = searchFiberForMap(fiber, 5000);
        if (map) {
          console.log("[ratpack] map found via React fiber on CoreMap container");
          return map;
        }
      }
    }

    var canvases = document.querySelectorAll("canvas");
    for (var i = 0; i < canvases.length; i++) {
      var c = canvases[i];
      if (c._map && isMapboxMap(c._map)) return c._map;
      var anc = c.parentElement;
      while (anc && anc !== document.body) {
        var f = getFiberFromElement(anc);
        if (f) {
          var m2 = searchFiberForMap(f, 5000);
          if (m2) {
            console.log("[ratpack] map found via React fiber on canvas ancestor");
            return m2;
          }
        }
        anc = anc.parentElement;
      }
    }

    var stdSelectors = [
      ".mapboxgl-map", ".maplibregl-map",
      ".mapboxgl-canvas-container", ".maplibregl-canvas-container",
    ];
    for (var s2 = 0; s2 < stdSelectors.length; s2++) {
      var node = document.querySelector(stdSelectors[s2]);
      if (node && node._map && (isMapInstance(node._map) || isMapboxMap(node._map)))
        return node._map;
    }
    return null;
  }

  function diagnoseNoMap() {
    console.log("[ratpack] === map detection diagnostics ===");
    console.log("[ratpack] location:", location.href);
    console.log("[ratpack] isPathSupported:", isPathSupported());
    console.log("[ratpack] window.strava:", typeof window.strava);
    if (window.strava) {
      console.log("[ratpack] strava.maps:", typeof window.strava.maps);
      if (window.strava.maps) {
        console.log(
          "[ratpack] strava.maps.getMap:",
          typeof window.strava.maps.getMap
        );
        try {
          var m = window.strava.maps.getMap();
          console.log("[ratpack] strava.maps.getMap() result:", typeof m, m);
          if (m) {
            console.log(
              "[ratpack]   getZoom:",
              typeof m.getZoom,
              "project:",
              typeof m.project,
              "getBounds:",
              typeof m.getBounds,
              "_mapId:",
              m._mapId
            );
          }
        } catch (e) {
          console.log("[ratpack] strava.maps.getMap() threw:", e.message);
        }
      }
    }
    var coreMap = document.querySelector("[class*='CoreMap']");
    console.log("[ratpack] CoreMap element:", coreMap);
    if (coreMap) {
      var fiberKeys = Object.keys(coreMap).filter(function (k) {
        return k.startsWith("__react");
      });
      console.log("[ratpack] CoreMap fiber keys:", fiberKeys);
    }
    var canvases = document.querySelectorAll("canvas");
    console.log("[ratpack] canvas count:", canvases.length);
    for (var i = 0; i < Math.min(canvases.length, 3); i++) {
      console.log(
        "[ratpack] canvas[" + i + "]:",
        canvases[i].className,
        canvases[i].width + "x" + canvases[i].height,
        "_map:", canvases[i]._map ? "yes" : "no"
      );
    }
    console.log("[ratpack] === end diagnostics ===");
  }

  function drawCell(ctx, px, py, w, h, owners) {
    if (owners.length === 1) {
      ctx.globalAlpha = cfg.alpha;
      ctx.fillStyle = owners[0].color;
      ctx.fillRect(px, py, w, h);
      ctx.globalAlpha = 1;
      return;
    }

    var n = owners.length;
    var stripeH = h / n;
    var span = Math.max(w, h) * 2;
    var half = span / 2;

    ctx.save();
    ctx.beginPath();
    ctx.rect(px, py, w, h);
    ctx.clip();
    ctx.translate(px + w / 2, py + h / 2);
    ctx.rotate(Math.PI / 4);
    ctx.globalAlpha = cfg.alpha;

    for (var i = 0; i < n; i++) {
      ctx.fillStyle = owners[i].color;
      ctx.beginPath();
      for (var y = -half + i * stripeH; y < half; y += n * stripeH) {
        ctx.rect(-half, y, span, stripeH);
      }
      ctx.fill();
    }

    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function makeDrawTile(targetZoom, users, tileData) {
    return function (ctx, coords) {
      var zoom = coords.z;
      var factor = Math.pow(2, targetZoom - zoom);
      if (factor > MAX_FACTOR) return;

      var cellSize = TILE_SIZE / factor;
      var tx = coords.x;
      var ty = coords.y;
      var minSx = tx * factor;
      var maxSx = (tx + 1) * factor - 1;
      var minSy = ty * factor;
      var maxSy = (ty + 1) * factor - 1;

      for (var sx = minSx; sx <= maxSx; sx++) {
        for (var sy = minSy; sy <= maxSy; sy++) {
          var key = sx + "-" + sy;
          var owners = [];
          for (var ui = 0; ui < users.length; ui++) {
            var u = users[ui];
            var d = tileData[u.uid];
            if (
              d &&
              d.raw &&
              d.raw[targetZoom] &&
              d.raw[targetZoom].has(key)
            ) {
              owners.push(u);
            }
          }
          if (owners.length === 0) continue;
          var px = (sx - tx * factor) * cellSize;
          var py = (sy - ty * factor) * cellSize;
          drawCell(ctx, px, py, cellSize, cellSize, owners);
        }
      }
    };
  }

  function createLeafletLayer(targetZoom, users, tileData) {
    var L = window.L;
    if (!L || !L.GridLayer) return null;

    var resolvedUsers = users.map(function (u) {
      return {
        uid: u.uid,
        color: targetZoom === cfg.zoom.squadrats ? u.color14 : u.color17,
      };
    });
    var drawTile = makeDrawTile(targetZoom, resolvedUsers, tileData);

    var LayerClass = L.GridLayer.extend({
      options: { tileSize: TILE_SIZE, updateWhenZooming: false },
      createTile: function (coords, done) {
        var canvas = document.createElement("canvas");
        var dpr = window.devicePixelRatio || 1;
        canvas.width = TILE_SIZE * dpr;
        canvas.height = TILE_SIZE * dpr;
        canvas.style.width = TILE_SIZE + "px";
        canvas.style.height = TILE_SIZE + "px";
        var ctx = canvas.getContext("2d");
        ctx.scale(dpr, dpr);
        drawTile(ctx, coords);
        setTimeout(function () {
          done(null, canvas);
        }, 0);
        return canvas;
      },
    });

    return new LayerClass();
  }

  function createLeafletOverlay(map, users, tileData) {
    var squadratsLayer = createLeafletLayer(cfg.zoom.squadrats, users, tileData);
    var squadratinhosLayer = createLeafletLayer(
      cfg.zoom.squadratinhos,
      users,
      tileData
    );

    if (squadratsLayer) squadratsLayer.addTo(map);
    if (squadratinhosLayer) squadratinhosLayer.addTo(map);

    return {
      remove: function () {
        if (squadratsLayer) squadratsLayer.remove();
        if (squadratinhosLayer) squadratinhosLayer.remove();
      },
    };
  }

  function drawMapLibreZoomLevel(ctx, map, targetZoom, users, tileData) {
    var zoom = map.getZoom();
    var factor = Math.pow(2, targetZoom - zoom);
    if (factor > MAX_FACTOR) return 0;

    var bounds = map.getBounds();
    var ne = bounds.getNorthEast
      ? bounds.getNorthEast()
      : bounds._ne;
    var sw = bounds.getSouthWest
      ? bounds.getSouthWest()
      : bounds._sw;

    var minSx = Math.min(
      lngToTileX(ne.lng, targetZoom),
      lngToTileX(sw.lng, targetZoom)
    );
    var maxSx = Math.max(
      lngToTileX(ne.lng, targetZoom),
      lngToTileX(sw.lng, targetZoom)
    );
    var minSy = Math.min(
      latToTileY(ne.lat, targetZoom),
      latToTileY(sw.lat, targetZoom)
    );
    var maxSy = Math.max(
      latToTileY(ne.lat, targetZoom),
      latToTileY(sw.lat, targetZoom)
    );

    var colStep = Math.max(1, Math.floor((maxSx - minSx) / 500));
    var rowStep = Math.max(1, Math.floor((maxSy - minSy) / 500));

    var drawn = 0;
    for (var sx = minSx; sx <= maxSx; sx += colStep) {
      for (var sy = minSy; sy <= maxSy; sy += rowStep) {
        var key = sx + "-" + sy;
        var owners = [];
        for (var ui = 0; ui < users.length; ui++) {
          var u = users[ui];
          var d = tileData[u.uid];
          if (
            d &&
            d.raw &&
            d.raw[targetZoom] &&
            d.raw[targetZoom].has(key)
          ) {
            owners.push(u);
          }
        }
        if (owners.length === 0) continue;

        var nwLng = tileXToLng(sx, targetZoom);
        var nwLat = tileYToLat(sy, targetZoom);
        var seLng = tileXToLng(sx + colStep, targetZoom);
        var seLat = tileYToLat(sy + rowStep, targetZoom);

        var nwPx = map.project({ lng: nwLng, lat: nwLat });
        var sePx = map.project({ lng: seLng, lat: seLat });

        var px = nwPx.x;
        var py = nwPx.y;
        var w = sePx.x - nwPx.x;
        var h = sePx.y - nwPx.y;

        drawCell(ctx, px, py, w, h, owners);
        drawn++;
      }
    }
    return drawn;
  }

  function createMapLibreOverlay(map, users, tileData) {
    var container = map.getContainer();
    var canvas = document.createElement("canvas");
    canvas.style.position = "absolute";
    canvas.style.top = "0";
    canvas.style.left = "0";
    canvas.style.pointerEvents = "none";
    canvas.style.zIndex = "2";

    container.appendChild(canvas);

    var resolvedUsers = users.map(function (u) {
      return {
        uid: u.uid,
        color14: u.color14,
        color17: u.color17,
      };
    });

    function resize() {
      var mapCanvas = map.getCanvas();
      var w = mapCanvas.clientWidth;
      var h = mapCanvas.clientHeight;
      var dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      console.log("[ratpack] maplibre canvas resized: " + w + "x" + h);
      draw();
    }

    function draw() {
      var ctx = canvas.getContext("2d");
      var dpr = window.devicePixelRatio || 1;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      var zoom = map.getZoom();
      var bounds = map.getBounds();
      var ne, sw;
      if (typeof bounds.getNorthEast === "function") {
        ne = bounds.getNorthEast();
        sw = bounds.getSouthWest();
      } else {
        ne = bounds._ne;
        sw = bounds._sw;
      }
      console.log(
        "[ratpack] maplibre draw: zoom=" +
          zoom +
          " bounds=" +
          sw.lng.toFixed(2) +
          "," +
          sw.lat.toFixed(2) +
          " -> " +
          ne.lng.toFixed(2) +
          "," +
          ne.lat.toFixed(2)
      );

      var drawn14 = drawMapLibreZoomLevel(
        ctx,
        map,
        cfg.zoom.squadrats,
        resolvedUsers,
        tileData
      );
      var drawn17 = drawMapLibreZoomLevel(
        ctx,
        map,
        cfg.zoom.squadratinhos,
        resolvedUsers,
        tileData
      );
      console.log(
        "[ratpack] maplibre cells drawn: z14=" + drawn14 + " z17=" + drawn17
      );
    }

    resize();
    map.on("move", draw);
    map.on("resize", resize);

    return {
      remove: function () {
        map.off("move", draw);
        map.off("resize", resize);
        canvas.remove();
      },
    };
  }

  function createWasmOverlay(map, users, tileData) {
    var stravaCanvas = document.getElementById("canvas");
    if (!stravaCanvas) {
      console.error("[ratpack] strava canvas not found");
      return null;
    }

    var container = stravaCanvas.parentElement;
    container.style.position = "relative";

    var canvas = document.createElement("canvas");
    canvas.style.position = "absolute";
    canvas.style.top = "0";
    canvas.style.left = "0";
    canvas.style.pointerEvents = "none";
    canvas.style.zIndex = "2";
    container.appendChild(canvas);

    var resolvedUsers = users.map(function (u) {
      return {
        uid: u.uid,
        color14: u.color14,
        color17: u.color17,
      };
    });

    function getScreenPos(point) {
      try {
        var camera = map.getCamera();
        var p = camera.getScreenPosition(point);
        if (p && typeof p.x === "number" && typeof p.y === "number") return p;
      } catch (e) {}
      return null;
    }

    function buildProjector(targetZoom) {
      var camera = map.getCamera();
      var lookAt = camera.getTarget().lookAtPoint;
      var n = 1 << targetZoom;
      var centerTileX = ((lookAt.longitude + 180) / 360) * n;
      var latRad = (lookAt.latitude * Math.PI) / 180;
      var centerTileY =
        ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) /
          2) *
        n;

      var sx0 = Math.floor(centerTileX);
      var sy0 = Math.floor(centerTileY);
      var h = 0.01;

      var p0 = getScreenPos(lookAt);
      var p1 = getScreenPos({
        latitude: tileYToLat(centerTileY, targetZoom),
        longitude: tileXToLng(centerTileX + h, targetZoom),
      });
      var p2 = getScreenPos({
        latitude: tileYToLat(centerTileY + h, targetZoom),
        longitude: tileXToLng(centerTileX, targetZoom),
      });

      if (!p0 || !p1 || !p2) {
        console.log("[ratpack] projector failed: p0=", !!p0, "p1=", !!p1, "p2=", !!p2, "lookAt=", lookAt);
        return null;
      }

      var cw = canvas.width;
      var ch = canvas.height;
      var fx = (p1.x - p0.x) * cw / h;
      var fy = (p1.y - p0.y) * cw / h;
      var gx = (p2.x - p0.x) * ch / h;
      var gy = (p2.y - p0.y) * ch / h;

      var fracX = centerTileX - sx0;
      var fracY = centerTileY - sy0;

      var originX = p0.x * cw - fracX * fx - fracY * gx;
      var originY = p0.y * ch - fracX * fy - fracY * gy;

      return {
        project: function (sx, sy) {
          return {
            x: originX + (sx - sx0) * fx + (sy - sy0) * gx,
            y: originY + (sx - sx0) * fy + (sy - sy0) * gy,
          };
        },
        tilePxWidth: Math.sqrt(fx * fx + fy * fy),
        viewRange: {
          minX: sx0 - Math.ceil(cw / Math.abs(fx) / 2) - 2,
          maxX: sx0 + Math.ceil(cw / Math.abs(fx) / 2) + 2,
          minY: sy0 - Math.ceil(ch / Math.abs(fy) / 2) - 2,
          maxY: sy0 + Math.ceil(ch / Math.abs(fy) / 2) + 2,
        },
      };
    }

    function resize() {
      var w = stravaCanvas.clientWidth;
      var h = stravaCanvas.clientHeight;
      canvas.width = stravaCanvas.width;
      canvas.height = stravaCanvas.height;
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      draw();
    }

    function draw() {
      var ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      var proj14 = buildProjector(14);
      if (!proj14) return;

      var zoom14 = 14 + Math.log2(proj14.tilePxWidth / 256);
      console.log("[ratpack] wasm draw: zoom=" + zoom14.toFixed(1) + " tilePx=" + proj14.tilePxWidth.toFixed(1));

      var drawn14 = drawWasmMerged(ctx, resolvedUsers, tileData, 14, proj14);
      var drawn17 = 0;

      if (proj14.tilePxWidth / 8 > 4) {
        var proj17 = buildProjector(17);
        if (proj17) {
          drawn17 = drawWasmMerged(ctx, resolvedUsers, tileData, 17, proj17);
        }
      }

      console.log("[ratpack] wasm cells drawn: z14=" + drawn14 + " z17=" + drawn17);
    }

    function drawWasmMerged(ctx, users, tileData, targetZoom, proj) {
      var range = proj.viewRange;
      var tileOwners = {};

      for (var ui = 0; ui < users.length; ui++) {
        var u = users[ui];
        var d = tileData[u.uid];
        if (!d || !d.raw || !d.raw[targetZoom]) continue;
        var color = targetZoom === cfg.zoom.squadrats ? u.color14 : u.color17;
        var arr = Array.from(d.raw[targetZoom]);
        for (var ti = 0; ti < arr.length; ti++) {
          var dash = arr[ti].indexOf("-");
          var sx = +arr[ti].substring(0, dash);
          var sy = +arr[ti].substring(dash + 1);
          if (sx < range.minX || sx > range.maxX || sy < range.minY || sy > range.maxY)
            continue;
          var key = sx + "-" + sy;
          if (!tileOwners[key]) tileOwners[key] = [];
          tileOwners[key].push({ uid: u.uid, color: color });
        }
      }

      var drawn = 0;
      for (var key2 in tileOwners) {
        if (!tileOwners.hasOwnProperty(key2)) continue;
        var owners = tileOwners[key2];
        var dash2 = key2.indexOf("-");
        var sx2 = +key2.substring(0, dash2);
        var sy2 = +key2.substring(dash2 + 1);

        var nw = proj.project(sx2, sy2);
        var ne = proj.project(sx2 + 1, sy2);
        var se = proj.project(sx2 + 1, sy2 + 1);
        var sw = proj.project(sx2, sy2 + 1);

        var minX = Math.min(nw.x, ne.x, se.x, sw.x);
        var minY = Math.min(nw.y, ne.y, se.y, sw.y);
        var maxX = Math.max(nw.x, ne.x, se.x, sw.x);
        var maxY = Math.max(nw.y, ne.y, se.y, sw.y);
        var w = maxX - minX;
        var h = maxY - minY;

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(nw.x, nw.y);
        ctx.lineTo(ne.x, ne.y);
        ctx.lineTo(se.x, se.y);
        ctx.lineTo(sw.x, sw.y);
        ctx.closePath();
        ctx.clip();

        drawCell(ctx, minX, minY, w, h, owners);
        ctx.restore();
        drawn++;
      }
      return drawn;
    }

    resize();

    try {
      map.addViewUpdateListener({ onViewUpdated: draw });
      console.log("[ratpack] wasm view update listener installed");
    } catch (e) {
      console.warn("[ratpack] view listener failed, falling back to events:", e.message);
      stravaCanvas.addEventListener("pointerdown", draw);
      stravaCanvas.addEventListener("pointermove", draw);
      stravaCanvas.addEventListener("pointerup", draw);
      stravaCanvas.addEventListener("wheel", draw);
    }

    return {
      remove: function () {
        try {
          map.removeViewUpdateListener({ onViewUpdated: draw });
        } catch (e) {}
        stravaCanvas.removeEventListener("pointerdown", draw);
        stravaCanvas.removeEventListener("pointermove", draw);
        stravaCanvas.removeEventListener("pointerup", draw);
        stravaCanvas.removeEventListener("wheel", draw);
        canvas.remove();
      },
    };
  }

  function createOverlay(mapInfo, users, tileData) {
    if (mapInfo.type === "leaflet") {
      return createLeafletOverlay(mapInfo.map, users, tileData);
    }
    if (mapInfo.type === "maplibre") {
      return createMapLibreOverlay(mapInfo.map, users, tileData);
    }
    if (mapInfo.type === "wasm") {
      return createWasmOverlay(mapInfo.map, users, tileData);
    }
    return null;
  }

  function render(users, tileData) {
    if (currentOverlay) {
      currentOverlay.remove();
      currentOverlay = null;
    }

    var token = ++renderToken;

    var tryRender = function (attempts) {
      if (token !== renderToken) return;
      var mapInfo = findMap();
      if (mapInfo) {
        if (token !== renderToken) return;
        currentOverlay = createOverlay(mapInfo, users, tileData);
        window.postMessage(
          { type: "RATPACK_RENDERED", source: "ratpack" },
          "*"
        );
        return;
      }
      if (attempts >= 30) {
        if (token !== renderToken) return;
        diagnoseNoMap();
        window.postMessage(
          { type: "RATPACK_NO_MAP", source: "ratpack" },
          "*"
        );
        return;
      }
      setTimeout(function () {
        tryRender(attempts + 1);
      }, 1000);
    };
    tryRender(0);
  }

  window.addEventListener("message", function (e) {
    if (e.source !== window) return;
    if (!e.data || e.data.source !== "ratpack-cs") return;

    if (e.data.type === "RATPACK_RENDER") {
      cfg = e.data.config || cfg;
      var users = e.data.users || [];
      var tiles = e.data.tiles || {};
      var tileData = {};
      for (var uid in tiles) {
        if (!tiles.hasOwnProperty(uid)) continue;
        var t = tiles[uid];
        tileData[uid] = {
          raw: {
            14: new Set(t.raw["14"] || []),
            17: new Set(t.raw["17"] || []),
          },
        };
      }
      render(users, tileData);
    } else if (e.data.type === "RATPACK_REMOVE") {
      if (currentOverlay) {
        currentOverlay.remove();
        currentOverlay = null;
      }
    }
  });

  window.postMessage(
    {
      type: "RATPACK_READY",
      source: "ratpack",
      pathSupported: isPathSupported(),
    },
    "*"
  );
})();
