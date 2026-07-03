(function () {
  const rp = (window.ratpack = window.ratpack || {});
  rp.planners = rp.planners || {};

  rp.planners.brouter = {
    isPathSupported: function () {
      return (
        location.pathname.includes("brouter-web") ||
        location.href.includes("bikerouter.de/#map=") ||
        location.href.includes("brouter.m11n.de/#map=")
      );
    },
    findMap: function () {
      const BR = window.wrappedJSObject && window.wrappedJSObject.BR;
      if (!BR || !BR.debug) {
        console.log("[ratpack] map not found (BR.debug missing)");
        return null;
      }
      const map = BR.debug.map;
      if (!map) {
        console.log("[ratpack] map not found (BR.debug.map missing)");
        return null;
      }
      console.log("[ratpack] BRouter map found");
      return map;
    },
  };
})();
