(function () {
  const rp = (window.ratpack = window.ratpack || {});

  function hashUid(str) {
    let h = 5381;
    for (let i = 0; i < str.length; i++) {
      h = (h << 5) + h + str.charCodeAt(i);
      h = h >>> 0;
    }
    return h;
  }

  function hslToRgb(h, s, l) {
    let r, g, b;
    if (s === 0) {
      r = g = b = l;
    } else {
      const hue2rgb = (p, q, t) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      };
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1 / 3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1 / 3);
    }
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
  }

  function toHex(r, g, b) {
    return (
      "#" +
      [r, g, b]
        .map((x) => x.toString(16).padStart(2, "0"))
        .join("")
    );
  }

  function assign(uid) {
    const hue = (hashUid(uid) * 137.508) % 360;
    const [r, g, b] = hslToRgb(hue / 360, 0.7, 0.5);
    return toHex(r, g, b);
  }

  function hexToRgb(hex) {
    const h = String(hex).replace("#", "");
    return [
      parseInt(h.slice(0, 2), 16),
      parseInt(h.slice(2, 4), 16),
      parseInt(h.slice(4, 6), 16),
    ];
  }

  function lighten(hex) {
    const [r, g, b] = hexToRgb(hex);
    const ratio = 0.4;
    return toHex(
      Math.round(r + (255 - r) * ratio),
      Math.round(g + (255 - g) * ratio),
      Math.round(b + (255 - b) * ratio)
    );
  }

  function colorForZoom(baseColor, zoom) {
    return zoom === rp.config.zoom.squadrats
      ? lighten(baseColor)
      : baseColor;
  }

  function sortByUid(users) {
    return users.slice().sort((a, b) => {
      if (a.uid < b.uid) return -1;
      if (a.uid > b.uid) return 1;
      return 0;
    });
  }

  rp.colors = { assign, lighten, colorForZoom, sortByUid, hashUid };
})();