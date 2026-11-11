/* hockeymtl.ca landing page: one full-height panel per division, cut on a slant like a broadcast
   matchup screen. Divisions come from shared/leagues.js, so a new division is one line there. */
(function () {
  "use strict";
  // Google ads: switch on once AdSense is approved, then put the ad code in the slots below.
  var SHOW_ADS = false;

  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;"); }
  var LOGO = window.HMTL_LOGO || "";

  // a few skate scratches per panel, fixed so they look the same on every visit
  function scratches(seed) {
    var out = "";
    function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
    for (var i = 0; i < 26; i++) {
      var x = rnd() * 600, y = rnd() * 1000, a = (rnd() - 0.5) * 1.4, L = 80 + rnd() * 260, b = (rnd() - 0.5) * 60;
      var x2 = x + Math.cos(a) * L, y2 = y + Math.sin(a) * L;
      out += '<path d="M' + x.toFixed(0) + " " + y.toFixed(0) + "Q" + ((x + x2) / 2).toFixed(0) + " " + ((y + y2) / 2 + b).toFixed(0) + " " + x2.toFixed(0) + " " + y2.toFixed(0) + '"/>';
    }
    return '<svg class="hp-scr" viewBox="0 0 600 1000" preserveAspectRatio="none" aria-hidden="true">' + out + "</svg>";
  }

  function ad(size, cls) {
    if (!SHOW_ADS) return "";
    return '<aside class="lp-ad ' + cls + '" aria-label="Advertisement"><span class="lp-adl">Advertisement</span><div class="lp-adbox" data-ad-size="' + size + '"></div></aside>';
  }

  var panels = LEAGUES.map(function (l, i) {
    var num = (String(l.label).match(/\d+/) || [""])[0];
    return '<a class="hp-p" href="' + l.folder + '/" style="--c:' + l.color + ";--i:" + i + '">' +
      '<span class="hp-in">' + scratches(11 + i * 97) +
      '<span class="hp-num" aria-hidden="true">' + esc(num) + "</span>" +
      '<span class="hp-name"><span class="hp-bar" aria-hidden="true"></span>' + esc(l.label) + "</span></span></a>";
  }).join("");

  document.body.insertAdjacentHTML("afterbegin",
    '<div class="lp">' +
    '<header class="lp-top"><a class="lp-brand" href="./" aria-label="Hockey MTL home">' + LOGO + (window.HMTL_WORDMARK || "Hockey MTL") + "</a><h1>Choose a division</h1></header>" +
    ad("728x90", "lp-ad-top") +
    '<nav class="hp" aria-label="Divisions" style="--n:' + LEAGUES.length + '">' + panels + "</nav>" +
    '<footer class="lp-foot">Unofficial fan site, not affiliated with any league or club. &copy; 2026 Hockey MTL</footer>' +
    "</div>");
})();
