(function () {
  const TILE_SIZE = 256;
  const MAX_FACTOR = 64;

  let cfg = { alpha: 0.4, zoom: { squadrats: 14, squadratinhos: 17 } };
  let currentOverlay = null;
  let renderToken = 0;

  function isPathSupported() {
    return (
      location.pathname.includes("brouter-web") ||
      location.href.includes("bikerouter.de/#map=") ||
      location.href.includes("brouter.m11n.de/#map=")
    );
  }

  function findMap() {
    if (typeof BR !== "undefined" && BR.debug && BR.debug.map) {
      return BR.debug.map;
    }
    return null;
  }

  function drawCell(ctx, px, py, size, owners) {
    if (owners.length === 1) {
      ctx.globalAlpha = cfg.alpha;
      ctx.fillStyle = owners[0].color;
      ctx.fillRect(px, py, size, size);
      ctx.globalAlpha = 1;
      return;
    }

    const n = owners.length;
    const stripeH = size / n;
    const span = size * 2;
    const half = span / 2;

    ctx.save();
    ctx.beginPath();
    ctx.rect(px, py, size, size);
    ctx.clip();
    ctx.translate(px + size / 2, py + size / 2);
    ctx.rotate(Math.PI / 4);
    ctx.globalAlpha = cfg.alpha;

    for (let i = 0; i < n; i++) {
      ctx.fillStyle = owners[i].color;
      ctx.beginPath();
      for (let y = -half + i * stripeH; y < half; y += n * stripeH) {
        ctx.rect(-half, y, span, stripeH);
      }
      ctx.fill();
    }

    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function makeDrawTile(targetZoom, users, tileData) {
    return (ctx, coords) => {
      const zoom = coords.z;
      const factor = Math.pow(2, targetZoom - zoom);
      if (factor > MAX_FACTOR) return;

      const cellSize = TILE_SIZE / factor;
      const tx = coords.x;
      const ty = coords.y;
      const minSx = tx * factor;
      const maxSx = (tx + 1) * factor - 1;
      const minSy = ty * factor;
      const maxSy = (ty + 1) * factor - 1;

      for (let sx = minSx; sx <= maxSx; sx++) {
        for (let sy = minSy; sy <= maxSy; sy++) {
          const key = sx + "-" + sy;
          const owners = [];
          for (const u of users) {
            const d = tileData[u.uid];
            if (d && d.raw && d.raw[targetZoom] && d.raw[targetZoom].has(key)) {
              owners.push(u);
            }
          }
          if (owners.length === 0) continue;
          const px = (sx - tx * factor) * cellSize;
          const py = (sy - ty * factor) * cellSize;
          drawCell(ctx, px, py, cellSize, owners);
        }
      }
    };
  }

  function createLayer(targetZoom, users, tileData) {
    const L = window.L;
    if (!L || !L.GridLayer) return null;

    const resolvedUsers = users.map(function (u) {
      return {
        uid: u.uid,
        color: targetZoom === cfg.zoom.squadrats ? u.color14 : u.color17,
      };
    });
    const drawTile = makeDrawTile(targetZoom, resolvedUsers, tileData);

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

  function createOverlay(map, users, tileData) {
    var squadratsLayer = createLayer(cfg.zoom.squadrats, users, tileData);
    var squadratinhosLayer = createLayer(cfg.zoom.squadratinhos, users, tileData);

    if (squadratsLayer) squadratsLayer.addTo(map);
    if (squadratinhosLayer) squadratinhosLayer.addTo(map);

    return {
      squadratsLayer: squadratsLayer,
      squadratinhosLayer: squadratinhosLayer,
      remove: function () {
        if (squadratsLayer) squadratsLayer.remove();
        if (squadratinhosLayer) squadratinhosLayer.remove();
      },
    };
  }

  function render(users, tileData) {
    if (currentOverlay) {
      currentOverlay.remove();
      currentOverlay = null;
    }

    var token = ++renderToken;

    var tryRender = function (attempts) {
      if (token !== renderToken) return;
      var map = findMap();
      if (map) {
        if (token !== renderToken) return;
        currentOverlay = createOverlay(map, users, tileData);
        window.postMessage({ type: "RATPACK_RENDERED", source: "ratpack" }, "*");
        return;
      }
      if (attempts >= 30) {
        if (token !== renderToken) return;
        window.postMessage({ type: "RATPACK_NO_MAP", source: "ratpack" }, "*");
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
