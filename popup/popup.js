if (typeof browser === "undefined" && typeof chrome !== "undefined") {
  globalThis.browser = chrome;
}

const STORAGE_KEY = "ratpack_users";
const UID_RE = /^[a-zA-Z0-9]+$/;
const COLOR_RE = /^#[0-9a-f]{6}$/i;

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
    [r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("")
  );
}

function assignColor(uid) {
  const hue = (hashUid(uid) * 137.508) % 360;
  const [r, g, b] = hslToRgb(hue / 360, 0.7, 0.5);
  return toHex(r, g, b);
}

function getStored() {
  return browser.storage.local.get(STORAGE_KEY).then((res) => {
    const list = res && res[STORAGE_KEY];
    return Array.isArray(list) ? list : [];
  });
}

function setStored(users) {
  return browser.storage.local.set({ [STORAGE_KEY]: users });
}

function getUsers() {
  return getStored().then((users) =>
    users.slice().sort((a, b) => {
      if (a.uid < b.uid) return -1;
      if (a.uid > b.uid) return 1;
      return 0;
    })
  );
}

function addUser(uid) {
  if (typeof uid !== "string" || uid.length === 0 || !UID_RE.test(uid)) {
    return Promise.reject(
      new Error("UID must be a non-empty alphanumeric string.")
    );
  }
  return getStored().then((users) => {
    if (users.some((u) => u.uid === uid)) {
      throw new Error("This UID is already in the list.");
    }
    const user = { uid, color: assignColor(uid) };
    return setStored(users.concat([user])).then(() => user);
  });
}

function setUserColor(uid, color) {
  if (typeof color !== "string" || !COLOR_RE.test(color)) {
    return Promise.reject(
      new Error("Colour must be a #rrggbb hex string.")
    );
  }
  return getStored().then((users) => {
    const idx = users.findIndex((u) => u.uid === uid);
    if (idx === -1) throw new Error("UID not found: " + uid);
    const updated = users.slice();
    updated[idx] = Object.assign({}, updated[idx], {
      color: color.toLowerCase(),
    });
    return setStored(updated);
  });
}

function setUserName(uid, name) {
  return getStored().then((users) => {
    const idx = users.findIndex((u) => u.uid === uid);
    if (idx === -1) throw new Error("UID not found: " + uid);
    if (users[idx].name === name) return;
    const updated = users.slice();
    updated[idx] = Object.assign({}, updated[idx], { name });
    return setStored(updated);
  });
}

function removeUser(uid) {
  return getStored().then((users) =>
    setStored(users.filter((u) => u.uid !== uid))
  );
}

function clearUsers() {
  return setStored([]);
}

const listEl = document.getElementById("user-list");
const countEl = document.getElementById("user-count");
const emptyEl = document.getElementById("empty-state");
const clearAllBtn = document.getElementById("clear-all");
const errorEl = document.getElementById("error-message");
const form = document.getElementById("add-form");
const input = document.getElementById("uid-input");
const addBtn = form.querySelector("button[type=submit]");

function showError(msg) {
  errorEl.textContent = msg;
  errorEl.hidden = false;
}

function clearError() {
  errorEl.textContent = "";
  errorEl.hidden = true;
}

function setBusy(busy) {
  addBtn.disabled = busy;
}

function render(users) {
  listEl.innerHTML = "";
  countEl.textContent = users.length + (users.length === 1 ? " user" : " users");
  emptyEl.hidden = users.length > 0;
  clearAllBtn.hidden = users.length === 0;
  for (const u of users) {
    const li = document.createElement("li");

    const colorInput = document.createElement("input");
    colorInput.type = "color";
    colorInput.className = "swatch";
    colorInput.value = u.color;
    colorInput.title = "Edit colour for " + u.uid;
    colorInput.setAttribute("aria-label", "Colour for " + u.uid);
    colorInput.addEventListener("change", () => {
      setUserColor(u.uid, colorInput.value).catch((err) =>
        showError(err.message)
      );
    });

    const textWrap = document.createElement("div");
    textWrap.className = "user-text";

    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.className = "user-name";
    nameInput.value = u.name || "";
    nameInput.placeholder = "Label";
    nameInput.title = u.uid;
    nameInput.setAttribute("aria-label", "Name for " + u.uid);
    nameInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        nameInput.blur();
      }
    });
    nameInput.addEventListener("change", () => {
      const name = nameInput.value.trim();
      setUserName(u.uid, name || null)
        .then(() => {})
        .catch((err) => showError(err.message));
    });

    const uidSpan = document.createElement("span");
    uidSpan.className = "uid";
    uidSpan.textContent = u.uid;

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "remove";
    removeBtn.textContent = "Remove";
    removeBtn.setAttribute("aria-label", "Remove " + u.uid);
    removeBtn.addEventListener("click", () => {
      removeBtn.disabled = true;
      removeUser(u.uid)
        .then(renderAll)
        .catch((err) => showError(err.message));
    });

    textWrap.append(nameInput, uidSpan);
    li.append(colorInput, textWrap, removeBtn);
    listEl.appendChild(li);
  }
}

function renderAll() {
  return getUsers()
    .then(render)
    .catch((err) => showError(err.message));
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  clearError();
  const uid = input.value.trim();
  setBusy(true);
  addUser(uid)
    .then(() => {
      input.value = "";
      return renderAll();
    })
    .catch((err) => {
      showError(err.message);
      return renderAll();
    })
    .finally(() => setBusy(false));
});

clearAllBtn.addEventListener("click", () => {
  clearUsers()
    .then(renderAll)
    .catch((err) => showError(err.message));
});

browser.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.ratpack_users) {
    renderAll();
  }
});

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", renderAll);
} else {
  renderAll();
}