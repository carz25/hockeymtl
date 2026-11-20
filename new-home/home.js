/* hockeymtl.ca landing page, test version (served at /new-home/). One panel per division, cut on a
   slant, each with live numbers read from that division's own data.js; latest final scores along the
   bottom. Divisions come from shared/leagues.js; colours for each panel are in THEME below. */
(function () {
  "use strict";
  var LOGO = window.HMTL_LOGO || "";
  var BASE = window.HMTL_BASE || "/";
  var D = Math.floor(Date.now() / 900000);      // same 15-minute key as the division pages, so their data is already cached

  // panel colours: bg = panel, tag = score-chip label and top strip, soft = small text on the panel
  var THEME = {
    M11BB: { bg: "#071A36", glow: "220,236,255", tag: "#2B6CB0", soft: "#7DD3FC" },
    M13AAA: { bg: "#811823", glow: "255,236,236", tag: "#C8202F", soft: "#FFE1E1" }
  };
  function theme(l) { return THEME[l.folder] || { bg: l.color, glow: "255,255,255", tag: l.color, soft: "#E8EEF5" }; }

  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;"); }
  var ARROW = '<svg aria-hidden="true" width="22" height="14" viewBox="0 0 22 14"><path d="M0 7h19M13 1l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.5"/></svg>';
  var WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], MO = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function ymd(d) { return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); }
  function day(s) { var p = s.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
  var now = new Date(), today = ymd(now);
  // the weekend shown as "This weekend": the current one on Sat/Sun, otherwise the next
  var sat = new Date(now); sat.setDate(now.getDate() + ((6 - now.getDay() + 7) % 7) - (now.getDay() === 0 ? 7 : 0));
  var sun = new Date(sat); sun.setDate(sat.getDate() + 1);
  var WEEKEND = [ymd(sat), ymd(sun)];
  function when(s, t) {
    var d = day(s), ahead = (d - day(today)) / 864e5;
    return (s === today ? "Today" : ahead > 0 && ahead < 7 ? WD[d.getDay()] : WD[d.getDay()] + ", " + MO[d.getMonth()] + " " + d.getDate()) + (t ? " " + t : "");
  }
  function arena(a) { return String(a || "").split(" (")[0].split(" - ")[0]; }

  /* ---------- page shell, drawn at once; numbers fill in when each division's data arrives ---------- */
  var many = LEAGUES.length !== 2;
  var panels = LEAGUES.map(function (l, i) {
    var th = theme(l), num = (String(l.label).match(/\d+/) || [""])[0];
    return '<section class="nh-p' + (i === 0 ? " first" : "") + '" aria-label="' + esc(l.label) + '" style="--bg:' + th.bg + ";--glow:" + th.glow + ";--soft:" + th.soft + '">' +
      '<div class="nh-in">' +
      '<span class="nh-num" aria-hidden="true">' + esc(num) + "</span>" +
      '<div class="nh-hd"><span class="nh-eye" id="nh-eye-' + i + '">Under ' + esc(num) + "</span>" +
      '<h2><a href="' + BASE + l.folder + '/">' + esc(l.label) + "</a></h2></div>" +
      '<dl class="nh-dl" id="nh-dl-' + i + '"></dl>' +
      '<p class="nh-next" id="nh-next-' + i + '"></p>' +
      '<a class="nh-go" href="' + BASE + l.folder + '/">Enter ' + esc(l.label) + ARROW + "</a>" +
      "</div></section>";
  }).join("");
  var strip = LEAGUES.map(function (l) { return '<span style="background:' + theme(l).tag + '"></span>'; }).join("");

  document.body.classList.add("nh-body");
  document.body.insertAdjacentHTML("afterbegin",
    '<div class="nh">' +
    '<div class="nh-strip" aria-hidden="true">' + strip + "</div>" +
    '<header class="nh-top"><a class="nh-brand" href="' + BASE + '" aria-label="Hockey MTL home">' + LOGO +
    '<span class="nh-wm"><span>Hockey</span><span>MTL</span></span></a>' +
    '<span class="nh-rule" aria-hidden="true"></span>' +
    "<h1>Scores, standings and stats for Montréal youth hockey. Pick your division.</h1></header>" +
    '<main class="nh-main' + (many ? " many" : "") + '" style="--last:' + theme(LEAGUES[LEAGUES.length - 1]).bg + '">' + panels + "</main>" +
    '<section class="nh-fin" aria-label="Latest final scores"><div class="nh-fin-in" id="nh-fin">' +
    '<div class="nh-fin-hd"><span id="nh-fin-d"></span><b>Latest finals</b></div></div></section>' +
    '<footer class="nh-foot"><span><span class="nh-long">Unofficial fan site, not affiliated with any league or club. </span><span class="nh-short">Unofficial fan site · </span>&copy; 2026 Hockey MTL</span>' +
    '<button type="button" data-contact="1">Contact</button></footer>' +
    "</div>");

  /* ---------- division data: each data.js and league.js read in its own scope (they declare the same names) ---------- */
  function load(url, names) {
    return fetch(url).then(function (r) { if (!r.ok) throw r.status; return r.text(); }).then(function (src) {
      return new Function(src + "\n;return {" + names.map(function (n) { return n + ":typeof " + n + '!=="undefined"?' + n + ":null"; }).join(",") + "};")();
    });
  }

  var finals = [], pending = LEAGUES.length;
  LEAGUES.forEach(function (l, i) {
    var root = BASE + l.folder + "/";
    load(root + "league.js", ["LEAGUE"]).then(function (o) {
      if (o.LEAGUE && o.LEAGUE.subtitle) document.getElementById("nh-eye-" + i).textContent += " · " + o.LEAGUE.subtitle;
    }).catch(function () {});
    load(root + "data.js?v=" + D, ["SCHED", "OFF", "SHORT", "TEAMS"]).then(function (o) {
      var S = o.SCHED || [], OFF = o.OFF || {}, name = function (t) { return (o.SHORT && o.SHORT[t]) || (o.TEAMS && o.TEAMS[t]) || t; };
      var played = S.filter(function (g) { return g[6] != null && g[7] != null; });
      // leader: most points, then points %, then goal difference (as on the standings page)
      var lead = Object.keys(OFF).sort(function (a, b) { var x = OFF[a], y = OFF[b]; return y[4] - x[4] || parseFloat(y[5] || 0) - parseFloat(x[5] || 0) || y[8] - x[8]; })[0];
      var wk = S.filter(function (g) { return WEEKEND.indexOf(g[1]) >= 0; }).length;
      var stats = [];
      if (lead) stats.push(["Leader", name(lead) + " · " + OFF[lead][4] + " pts"]);
      stats.push(["This weekend", wk ? wk + " game" + (wk === 1 ? "" : "s") : "No games"]);
      stats.push(["Season", played.length + " of " + S.length + " played"]);
      document.getElementById("nh-dl-" + i).innerHTML = stats.map(function (s) { return "<div><dt>" + esc(s[0]) + "</dt><dd>" + esc(s[1]) + "</dd></div>"; }).join("");
      var next = S.filter(function (g) { return g[6] == null && g[1] >= today; }).sort(function (a, b) { return a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0; })[0];
      if (next) document.getElementById("nh-next-" + i).innerHTML = '<a href="' + root + "#preview/" + next[0] + '"><strong>Next up</strong> · ' + esc(when(next[1], next[2])) + " · " + esc(name(next[4]) + " at " + name(next[5])) + (arena(next[3]) ? '<span class="nh-arena"> · ' + esc(arena(next[3])) + "</span>" : "") + "</a>";
      played.slice(-5).forEach(function (g) { finals.push({ l: l, g: g, name: name, root: root }); });
    }).catch(function () {}).then(function () { if (--pending === 0) drawFinals(); });
  });

  function drawFinals() {
    if (!finals.length) { document.querySelector(".nh-fin").hidden = true; return; }
    finals.sort(function (a, b) { return a.g[1] < b.g[1] ? 1 : a.g[1] > b.g[1] ? -1 : 0; });
    document.getElementById("nh-fin-d").textContent = when(finals[0].g[1]);
    document.getElementById("nh-fin").insertAdjacentHTML("beforeend", finals.map(function (f) {
      var g = f.g, aw = g[6] > g[7], hw = g[7] > g[6];
      var rows = [[g[4], g[6], aw], [g[5], g[7], hw]];
      if (hw) rows.reverse();                                  // winner on top
      return '<a class="nh-g" href="' + f.root + "#game/" + g[0] + '"><span class="nh-tag" style="background:' + theme(f.l).tag + '">' + esc(f.l.label) + "</span>" +
        '<span class="nh-sc">' + rows.map(function (r) { return '<span class="' + (r[2] || g[6] === g[7] ? "w" : "") + '">' + esc(f.name(r[0])) + "</span><span class=\"n" + (r[2] || g[6] === g[7] ? " w" : "") + '">' + r[1] + "</span>"; }).join("") + "</span></a>";
    }).join(""));
  }
})();
