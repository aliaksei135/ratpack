(function () {
  const rp = (window.ratpack = window.ratpack || {});

  rp.config = {
    mainframeUrl: "https://mainframe-api.squadrats.com",
    apiPath: "/anonymous/squadrants/",
    alpha: 0.4,
    zoom: {
      squadrats: 14,
      squadratinhos: 17,
    },
    cacheTtlMs: 3600000,
    maxConcurrentFetches: 3,
  };
})();