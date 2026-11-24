(function () {
  var BUILD = "gLgvalGAq5PZhSAM3x1sz98wH8WNmrIusntcX4-Xtsw";
  window.__APPVER__ = BUILD;
  try {
    fetch("./appver.txt", { cache: "no-store" }).then(function (r) { return r.ok ? r.text() : ""; }).then(function (v) {
      var live = (v || "").trim();
      if (live && live !== BUILD && !sessionStorage.getItem("nijip2p-heal")) {
        sessionStorage.setItem("nijip2p-heal", "1");
        location.reload();
      }
    }).catch(function () {});
  } catch (e) {}
})();
