(function () {
  const rp = (window.ratpack = window.ratpack || {});

  const STORAGE_KEY = "ratpack_users";
  const UID_RE = /^[a-zA-Z0-9]+$/;
  const COLOR_RE = /^#[0-9a-f]{6}$/i;

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
    return getStored().then((users) => rp.colors.sortByUid(users));
  }

  function addUser(uid) {
    if (typeof uid !== "string" || uid.length === 0 || !UID_RE.test(uid)) {
      return Promise.reject(
        new Error("Invalid UID: must be a non-empty alphanumeric string.")
      );
    }
    return getStored().then((users) => {
      if (users.some((u) => u.uid === uid)) {
        throw new Error("UID already added.");
      }
      const user = { uid, color: rp.colors.assign(uid) };
      return setStored(users.concat([user])).then(() => user);
    });
  }

  function setUserColor(uid, color) {
    if (
      typeof color !== "string" ||
      !COLOR_RE.test(color)
    ) {
      return Promise.reject(
        new Error("Invalid colour: must be a #rrggbb hex string.")
      );
    }
    return getStored().then((users) => {
      const idx = users.findIndex((u) => u.uid === uid);
      if (idx === -1) {
        throw new Error("UID not found: " + uid);
      }
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
      if (idx === -1) {
        throw new Error("UID not found: " + uid);
      }
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

  rp.storage = { getUsers, addUser, setUserColor, setUserName, removeUser, clearUsers };
})();