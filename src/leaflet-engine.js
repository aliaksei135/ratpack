(function () {
  const rp = (window.ratpack = window.ratpack || {});

  const TILE_SIZE = 256;
  const MAX_FACTOR = 64;

  const getL = () => {
    const L = window.wrappedJSObject && window.wrappedJSObject.L;
    if (!L) {
      console.error("[ratpack] Leaflet not found");
    }
    return L;
  };

  const makeDrawTile = (targetZoom, users, tileData) => {
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
            const d = tileData.get(u.uid);
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
  };

  const drawCell = (ctx, px, py, size, owners) => {
    if (owners.length === 1) {
      ctx.globalAlpha = rp.config.alpha;
      ctx.fillStyle = owners[0].color;
      ctx.fillRect(px, py, size, size);
      ctx.globalAlpha = 1;
      return;
    }

    // 2+ owners: diagonal stripes top-left -> bottom-right.
    // Rotate 45deg around the cell centre so the main diagonal becomes
    // horizontal, then lay horizontal bands of equal height per user.
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
    ctx.globalAlpha = rp.config.alpha;

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
  };

  const createLayer = (targetZoom, users, tileData) => {
    const L = getL();
    if (!L || !L.GridLayer) return null;

    const resolvedUsers = users.map((u) => ({
      uid: u.uid,
      color: rp.colors.colorForZoom(u.color, targetZoom),
    }));
    const drawTile = makeDrawTile(targetZoom, resolvedUsers, tileData);

    const createTileFn = function (coords, done) {
      const canvas = document.createElement("canvas");
      const dpr = window.devicePixelRatio || 1;
      canvas.width = TILE_SIZE * dpr;
      canvas.height = TILE_SIZE * dpr;
      canvas.style.width = TILE_SIZE + "px";
      canvas.style.height = TILE_SIZE + "px";
      const ctx = canvas.getContext("2d");
      ctx.scale(dpr, dpr);
      drawTile(ctx, coords);
      setTimeout(() => {
        done(null, canvas);
      }, 0);
      return canvas;
    };

    const pageOpts = cloneInto(
      {
        options: { tileSize: TILE_SIZE, updateWhenZooming: false },
        createTile: createTileFn,
      },
      window,
      { cloneFunctions: true }
    );

    const LayerClass = L.GridLayer.extend(pageOpts);

    return new LayerClass();
  };

  const createOverlay = (map, users, tileData) => {
    const squadratsLayer = createLayer(rp.config.zoom.squadrats, users, tileData);
    const squadratinhosLayer = createLayer(rp.config.zoom.squadratinhos, users, tileData);

    if (squadratsLayer) squadratsLayer.addTo(map);
    if (squadratinhosLayer) squadratinhosLayer.addTo(map);

    return {
      squadratsLayer,
      squadratinhosLayer,
      remove: () => {
        if (squadratsLayer) squadratsLayer.remove();
        if (squadratinhosLayer) squadratinhosLayer.remove();
      },
    };
  };

  rp.leafletEngine = { createOverlay, createLayer, drawCell };
})();
