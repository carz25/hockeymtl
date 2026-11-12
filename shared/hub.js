/* Hockey MTL league hub: shared engine for every league site.
   One copy of the code and design lives here (shared/hub.js and shared/hub.css).
   Each league folder supplies:
     league.js  settings (LEAGUE), header logo, and the division list when the league has divisions
     logos.css  team logo images (optional; without it teams get coloured text badges)
     data.js    schedule, standings, rosters and game sheets (the only file updated week to week)
   See shared/README.md for the settings and the data format. */
(function () {
  "use strict";
  var L = window.LEAGUE || {};
  var OT = L.record === "OTL";            // standings are W-L-OTL (true) or W-T-L with ties (false)
  var OFFICIAL = L.stats === "official";  // player stats from league stat tables (true) or counted from game sheets (false)
  var LOGOS = !!L.logos;                  // team logo images in logos.css (true) or coloured text badges (false)
  var KEY = L.id || "hub";                // prefix for saved settings in the browser
  var GROUP = L.group || "conference";    // word used in "1st in the ..."
  var SCHED = window.SCHED || [], TEAMS = window.TEAMS, SHORT = window.SHORT, BADGE = window.BADGE || {}, R = window.R || {}, G = window.G || [], OFF = window.OFF;
  var DIVS = window.DIVS || null;
  var ORDER = window.ORDER || DIVS.reduce(function (a, d) { return a.concat(d.teams); }, []);
  if (!DIVS) DIVS = [{ id: "C", name: L.groupName || "Conference", teams: ORDER.slice() }];
  var MULTI = DIVS.length > 1;            // more than one division: division picker and division sections
  var PSTATS = window.PSTATS || [], GSTATS = window.GSTATS || [], AS_OF = window.AS_OF, DATA_THROUGH = window.DATA_THROUGH;
  var GLEN = window.GLEN || L.gameMinutes || 60;
  var PPX = window.PPX || [], TIMED = window.TIMED || [];

  /* Hockey MTL shield logo (same on every league site). Clicking it goes to the hockeymtl.ca home page. */
  var LOGO = window.HMTL_LOGO || "";

  /* page skeleton */
  document.body.classList.add(OFFICIAL ? "st-off" : "st-sheet");
  if (MULTI) document.body.classList.add("multi");
  document.body.insertAdjacentHTML("afterbegin",
    '\n<div class="hdr">\n<header class="top">\n  <div class="in brand">' + ('<a class="home" href="' + (L.homeUrl || "https://hockeymtl.ca/") + '" aria-label="Hockey MTL home" title="Hockey MTL home">' + LOGO + (window.HMTL_WORDMARK || "") + "</a>") + "<h1>" + L.title + " <span>" + L.subtitle + "</span></h1>" +
    (MULTI ? '<select id="divsel" class="divsel" aria-label="Filter by division"></select>' : "") + "</div>\n</header>\n" +
    '<nav class="nav" aria-label="Sections">\n  <div class="in">\n    <div class="tabs">\n' +
    '      <a href="#home" data-tab="home">Home</a>\n      <a href="#standings" data-tab="standings">Standings</a>\n      <a href="#players" data-tab="players">Players</a>\n' +
    '      <a href="#schedule" data-tab="schedule">Schedule</a>\n      <a href="#teams" data-tab="teams">Teams</a>\n    </div>\n  </div>\n</nav>\n</div>\n\n' +
    '<main class="in">\n  <section id="p-home"></section>\n  <section id="p-standings" hidden></section>\n  <section id="p-schedule" hidden></section>\n  <section id="p-teams" hidden></section>\n  <section id="p-players" hidden></section>\n</main>\n\n' +
    '<footer>\n  <div class="in">\n    <p id="asof"></p>\n    <div class="viewsw"><span>View</span><div class="seg" role="group" aria-label="Page layout"><button data-view="auto">Auto</button><button data-view="mobile">Mobile</button><button data-view="desktop">Desktop</button></div></div>\n' +
    "    <p>" + L.footerNote + "</p>\n" +
    '    <p class="copy">The design, layout and code of this page may not be copied, reproduced or used to train AI models without written permission.</p>\n  </div>\n</footer>\n' +
    (window.HMTL_SITEBAR ? window.HMTL_SITEBAR("../") : "") + "\n");

  var TABS = ["home", "standings", "players", "schedule", "teams"];
  var MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;"); }
  function f1(x) { return (Math.round(x * 10) / 10).toFixed(1); }
  function f2(x) { return (Math.round(x * 100) / 100).toFixed(2); }
  function norm(s) { return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); }
  function ord(n) { if (typeof n !== "number" || !isFinite(n)) return "–";  var s = ["th", "st", "nd", "rd"], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); }
  function pd(s) { var p = s.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
  var TBD_DATE = "9999-12-31";
  function isTbd(r) { return r[3] === "TBD" && r[2] === "12:00 AM"; }
  function dlong(s) { if (s === TBD_DATE) return "Date TBD"; var d = pd(s); return DOW[d.getDay()] + ", " + MONTH[d.getMonth()] + " " + d.getDate(); }
  function when(g) { return g.time === "TBD" ? "Date and time TBD" : dlong(g.date) + " · " + g.time; }
  function dshort(s) { if (s === TBD_DATE) return "Date TBD"; var d = pd(s); return MONTH[d.getMonth()] + " " + d.getDate(); }
  function tmin(t) { var m = t.match(/(\d+):(\d+) ([AP])M/); var h = +m[1] % 12 + (m[3] === "P" ? 12 : 0); return h * 60 + +m[2]; }
  function badge(t, big) {
    if (LOGOS) return '<span class="lg t-' + t + (big ? " big" : "") + '" data-tp="' + t + '" aria-hidden="true"></span>';
    return '<span class="lg cb' + (big ? " big" : "") + '" style="background:' + BADGE[t] + '" data-tp="' + t + '" aria-hidden="true"><i>' + t + "</i></span>";
  }
  var RECL = OT ? "W-L-OTL" : "W-T-L";
  function rec(s) { return OT ? s.w + "-" + s.l + "-" + s.otl : s.w + "-" + s.tie + "-" + s.l; }
  function badgeC(t) { return '<span class="lgc">' + badge(t) + "<em>" + t + "</em></span>"; }
  function tname(t, cls) { return '<span class="tn" data-tp="' + t + '">' + badge(t) + "<b>" + esc(cls === "full" ? TEAMS[t] : SHORT[t]) + "</b></span>"; }
  function nm(t, k) { return (R[t] && R[t][k]) || k; }

  /* ---------- data ---------- */
  var GAMES = SCHED.map(function (r) {
    return { id: r[0], date: isTbd(r) ? TBD_DATE : r[1], time: isTbd(r) ? "TBD" : r[2], venue: r[3] === "TBD" ? "Venue to be announced" : r[3], a: r[4], h: r[5], played: r.length === 8, sa: r[6], sh: r[7] };
  }).sort(function (x, y) { return x.date < y.date ? -1 : x.date > y.date ? 1 : (x.time === "TBD" ? 0 : tmin(x.time) - tmin(y.time)) || x.id - y.id; });
  var SHEET = {};
  G.forEach(function (g) { SHEET[g.id] = g; });
  var PLAYED = GAMES.filter(function (g) { return g.played; });
  var UPCOMING = GAMES.filter(function (g) { return !g.played; });
  var LAST = DATA_THROUGH || (PLAYED.length ? PLAYED[PLAYED.length - 1].date : "");

  var ST = {};
  DIVS.forEach(function (d) {
    d.teams.forEach(function (t, i) {
      var o = OFF[t], gp = o[0];
      // ties format: GP W T L PTS PTS% GF GA DIFF PIM
      if (!OT) { ST[t] = { t: t, div: d.id, rank: i + 1, gp: gp, w: o[1], tie: o[2], l: o[3], otl: 0, pts: o[4], pct: o[5], pctn: parseFloat(o[5]), gf: o[6], ga: o[7], diff: o[8], pim: o[9], gfg: o[6] / gp, gag: o[7] / gp, pimg: o[9] / gp, dg: o[8] / gp }; return; }
      ST[t] = { t: t, div: d.id, rank: i + 1, gp: gp, w: o[1], l: o[2], otl: o[3], tie: 0, pts: o[4], pct: o[5], pctn: parseFloat(o[5]) || 0, gf: o[6], ga: o[7], diff: o[8], pim: o[9], rw: o[10], sow: o[11], sp: o[12], pend: o[13],
        gfg: o[6] / gp, gag: o[7] / gp, pimg: o[9] / gp, dg: o[8] / gp };
    });
  });
  function divOf(t) { return DIVS.filter(function (d) { return d.id === ST[t].div; })[0]; }
  /* ranks are within each division */
  function rankMap(key, high) {
    var out = {};
    DIVS.forEach(function (d) {
      var arr = d.teams.filter(function (t) { return !ST[t].pend || (key !== "pctn" && key !== "pimg"); }).sort(function (a, b) { return high ? ST[b][key] - ST[a][key] : ST[a][key] - ST[b][key]; });
      arr.forEach(function (t, i) { out[t] = i > 0 && ST[arr[i - 1]][key] === ST[t][key] ? out[arr[i - 1]] : i + 1; });
    });
    return out;
  }
  var RK = { gfg: rankMap("gfg", true), gag: rankMap("gag", false), pctn: rankMap("pctn", true), pimg: rankMap("pimg", false) };

  function results(t) {
    return PLAYED.filter(function (g) { return g.a === t || g.h === t; }).map(function (g) {
      var home = g.h === t, us = home ? g.sh : g.sa, them = home ? g.sa : g.sh;
      return { g: g, us: us, them: them, r: us > them ? "W" : us < them ? "L" : "T", opp: home ? g.a : g.h, home: home };
    });
  }
  function formChips(t, n) {
    var rs = results(t).slice(-n).reverse();
    return '<span class="form" aria-label="Recent results">' + rs.map(function (x) {
      return '<span class="chip ' + x.r + '" title="' + x.r + " " + x.us + "–" + x.them + (x.home ? " vs " : " at ") + SHORT[x.opp] + '">' + x.r + "</span>";
    }).join("") + "</span>";
  }
  function streakOf(t) {
    var rs = results(t); if (!rs.length) return '<span class="stk">–</span>';
    var last = rs[rs.length - 1].r, n = 0;
    for (var i = rs.length - 1; i >= 0 && rs[i].r === last; i--) n++;
    return '<span class="stk ' + last + '" title="' + n + (last === "W" ? "-game win streak" : last === "L" ? "-game losing streak" : "-game tie streak") + '">' + last + " " + n + "</span>";
  }
  function remaining(t) { return UPCOMING.filter(function (g) { return g.a === t || g.h === t; }).length; }
  function nextGame(t) { return UPCOMING.filter(function (g) { return g.a === t || g.h === t; })[0]; }

  /* ---------- player aggregation (from game sheets) ---------- */
  var sk = {}, gk = {};
  function skater(t, key) { var id = t + ":" + key; return sk[id] || (sk[id] = { id: id, team: t, name: nm(t, key), gp: 0, g: 0, a: 0, pen: 0, mp: 0, gd: 0, pwg: 0, pwa: 0, shg: 0, sha: 0 }); }
  function goalie(t, key) { var id = t + ":" + key; return gk[id] || (gk[id] = { id: id, team: t, name: nm(t, key), gp: 0, w: 0, l: 0, t: 0, min: 0, ga: 0, so: 0 }); }
  var TGOALS = {};
  G.forEach(function (gm) {
    var gpts = {};
    [[gm.a, gm.s[0] - gm.s[1]], [gm.h, gm.s[1] - gm.s[0]]].forEach(function (tt) { gm.d[tt[0]].split(" ").forEach(function (k) { var q = skater(tt[0], k); q.gp++; q.gd += tt[1]; }); });
    gm.g.forEach(function (x) {
      TGOALS[x[0]] = (TGOALS[x[0]] || 0) + 1;
      if (x[1]) { skater(x[0], x[1]).g++; gpts[x[0] + ":" + x[1]] = (gpts[x[0] + ":" + x[1]] || 0) + 1; }
      for (var i = 2; i < x.length; i++) { skater(x[0], x[i]).a++; gpts[x[0] + ":" + x[i]] = (gpts[x[0] + ":" + x[i]] || 0) + 1; }
    });
    Object.keys(gpts).forEach(function (id) { if (gpts[id] >= 2 && sk[id]) sk[id].mp++; });
    gm.p.forEach(function (x) { if (x[1]) skater(x[0], x[1]).pen += 2; });
    [[gm.a, gm.s[0], gm.s[1]], [gm.h, gm.s[1], gm.s[0]]].forEach(function (tt) {
      var played = gm.k.filter(function (x) { return x[0] === tt[0] && x[2] > 0; });
      played.forEach(function (x) {
        var r = goalie(x[0], x[1]); r.gp++; r.min += x[2]; r.ga += x[3];
        if (played.length === 1) { if (tt[1] > tt[2]) r.w++; else if (tt[1] < tt[2]) r.l++; else r.t++; if (tt[2] === 0) r.so++; }
      });
    });
  });
  PPX.forEach(function (x) {
    var up = x[3] === "PP";
    var q = skater(x[1], x[2]); if (up) q.pwg++; else q.shg++;
    for (var i = 4; i < x.length; i++) { var w = skater(x[1], x[i]); if (up) w.pwa++; else w.sha++; }
  });
  var SK, GK;
  if (OFFICIAL) {
    /* Skater table: official stats through AS_OF. Game sheets for games after AS_OF will be added on top. */
    SK = PSTATS.map(function (p) { var pts = p[3] + p[4]; return { id: p[0] + ":" + p[1], team: p[0], name: p[1], gp: p[2], g: p[3], a: p[4], pen: p[5], ppg: p[6], ppa: p[7], ppp: p[6] + p[7], shg: p[8], sha: p[9], shp: p[8] + p[9], gwg: p[10], gtg: p[11], pts: pts, pgp: p[2] ? pts / p[2] : 0, ggp: p[2] ? p[3] / p[2] : 0 }; });
    GK = GSTATS.filter(function (p) { return p[2] > 0; }).map(function (p) { return { id: p[0] + ":" + p[1], team: p[0], name: p[1], gp: p[2], w: p[3], l: p[4], t: p[5], so: p[6], ga: p[7], min: p[8], gaa: p[8] ? p[7] * GLEN / p[8] : 0, gs: p[9], wpct: p[2] ? p[3] / p[2] : 0 }; });
  } else {
    SK = Object.keys(sk).map(function (k) { var r = sk[k]; r.pts = r.g + r.a; r.ppg = r.gp ? r.pts / r.gp : 0; r.gpg = r.gp ? r.g / r.gp : 0; r.apg = r.gp ? r.a / r.gp : 0; r.pimg = r.gp ? r.pen / r.gp : 0; r.gsh = TGOALS[r.team] ? r.g / TGOALS[r.team] * 100 : 0; return r; });
    GK = Object.keys(gk).map(function (k) { var r = gk[k]; r.gaa = r.min ? r.ga * 60 / r.min : 0; return r; });
  }
  function topSkaters(t, n) { return SK.filter(function (r) { return r.team === t; }).sort(function (a, b) { return b.pts - a.pts || b.g - a.g || a.name.localeCompare(b.name); }).slice(0, n); }
  function topGoalie(t) { return GK.filter(function (r) { return r.team === t; }).sort(function (a, b) { return b.min - a.min; })[0]; }

  /* ---------- state ---------- */
  var state = { div: "ALL", team: "ALL", sf: "upcoming", ptab: "skaters", q: "", open: 0, sk: { key: "pts", dir: -1 }, gk: { key: "gaa", dir: 1 }, pm: 10, adv: false, view: "auto", sv: "table", sadv: false, pv: "cards" };
  try { var sd = localStorage.getItem(KEY + "-div"); if (DIVS.some(function (d) { return d.id === sd; })) state.div = sd; } catch (e) { }
  try { var stv = localStorage.getItem(KEY + "-standings"); if (stv === "grid") state.sv = "grid"; if (stv === "special" || localStorage.getItem(KEY + "-standings-adv") === "1") { state.sadv = true; state.sv = "table"; } } catch (e) { }
  try { var sv = localStorage.getItem(KEY + "-view"); if (sv === "mobile" || sv === "desktop") state.view = sv; } catch (e) { }
  var mq = window.matchMedia("(max-width:720px)");
  function applyView() {
    document.body.classList.toggle("m", state.view === "mobile" || (state.view === "auto" && mq.matches));
    Array.prototype.forEach.call(document.querySelectorAll("[data-view]"), function (b) { b.setAttribute("aria-pressed", String(b.dataset.view === state.view)); });
  }
  function inDiv(t) { return state.div === "ALL" || ST[t].div === state.div; }
  function DT() { return ORDER.filter(inDiv); }
  function curDivs() { return DIVS.filter(function (d) { return state.div === "ALL" || d.id === state.div; }); }
  function fin(g) { return SHEET[g.id] && SHEET[g.id].so ? "Final/SO" : "Final"; }
  function gIn(g) { return inDiv(g.a) || inDiv(g.h); }
  function scopeLbl() { return state.div === "ALL" ? "All " + ORDER.length + " teams" : curDivs()[0].name; }
  function syncDiv() { var el = document.getElementById("divsel"); if (el) el.value = state.div; }
  function mine(t) { return state.team !== "ALL" && state.team === t; }

  /* ---------- standings ---------- */
  function tile(k, v, s) { return '<div class="tile"><span class="k">' + k + '</span><span class="v">' + v + '</span><span class="s">' + s + "</span></div>"; }
  function weekendDates() {
    var d = new Date(), dow = d.getDay(), sat = new Date(d), sun;
    if (dow === 0) sat.setDate(d.getDate() - 1); else sat.setDate(d.getDate() + (6 - dow));
    sun = new Date(sat); sun.setDate(sat.getDate() + 1);
    return [isoOf(sat), isoOf(sun)];
  }
  function weekendHTML() {
    var w = weekendDates();
    var list = GAMES.filter(function (g) { return g.date >= w[0] && g.date <= w[1] && gIn(g) && (state.team === "ALL" || g.a === state.team || g.h === state.team); });
    if (!list.length) return "";
    var cards = list.map(function (g) {
      var day = DOW[pd(g.date).getDay()] + " · " + g.time;
      var wp = g.played ? null : winProb(g.a, g.h);
      var line = function (t, sc, win) { var pc = wp ? (t === g.a ? wp.a : wp.h) : 0, fav = wp && pc === Math.max(wp.a, wp.h) && wp.a !== wp.h; return '<span class="wkl' + (mine(t) ? " mine" : "") + (g.played && !win ? " lose" : "") + '">' + badge(t).replace(/alt="[^"]*"/, 'alt=""') + "<b>" + esc(SHORT[t]) + "</b>" + (g.played ? "<i>" + sc + "</i>" : '<em class="wpc' + (fav ? " fav" : "") + '" title="Win probability">' + pc + "%</em>") + "</span>"; };
      var inner = '<span class="wkd">' + day + "</span>" + (g.played ? "" : '<span class="wph">Win probability</span>') + line(g.a, g.sa, g.sa >= g.sh) + line(g.h, g.sh, g.sh >= g.sa);
      return g.played ? '<div class="wkc done">' + inner + '<span class="wkf">' + fin(g) + '</span></div>' : '<button class="wkc" data-open="' + g.id + '" aria-label="' + esc(SHORT[g.a]) + ' at ' + esc(SHORT[g.h]) + ', win probability ' + wp.a + ' to ' + wp.h + ' percent, tie ' + wp.t + ' percent">' + inner + '<span class="wkf">Tie ' + wp.t + '% · Preview →</span></button>';
    }).join("");
    return '<div class="wk"><div class="wkh"><h3>This weekend</h3><span>' + dlong(w[0]) + " – " + dlong(w[1]) + " · " + list.length + " game" + (list.length === 1 ? "" : "s") + (state.team === "ALL" ? "" : " for " + esc(SHORT[state.team])) + '</span></div><div class="wkrow">' + cards + "</div></div>";
  }
  function hLine(g, t, win) {
    var pc = "", wp = null;
    if (g.played) pc = "<i>" + (t === g.a ? g.sa : g.sh) + "</i>";
    else { wp = winProb(g.a, g.h); var v = t === g.a ? wp.a : wp.h; pc = '<em class="wpc' + (v === Math.max(wp.a, wp.h) && wp.a !== wp.h ? " fav" : "") + '">' + v + "%</em>"; }
    return '<span class="wkl' + (g.played && !win ? " lose" : "") + '">' + badge(t) + '<b data-tp="' + t + '">' + esc(SHORT[t]) + "</b>" + pc + "</span>";
  }
  function homeGame(g) {
    var inner = '<span class="hd">' + (g.played ? dshort(g.date) : dshort(g.date)) + "<small>" + (g.played ? fin(g) : g.time) + '</small></span><span class="hls">' + (g.played ? "" : '<span class="wph">Win probability</span>') + hLine(g, g.a, g.sa >= g.sh) + hLine(g, g.h, g.sh >= g.sa) + "</span>";
    return g.played ? '<div class="hg">' + inner + "</div>" : '<button class="hg" data-open="' + g.id + '">' + inner + "</button>";
  }
  function renderHome() {
    var totGF = DT().reduce(function (s, t) { return s + ST[t].gf; }, 0), totGP = DT().reduce(function (s, t) { return s + ST[t].gp; }, 0) / 2;
    var lead = MULTI ? ST[bestBy("pctn", true)] : ST[ORDER[0]], off = bestBy("gfg", true);
    var recent = PLAYED.filter(gIn).sort(function (x, y) { return x.date < y.date ? 1 : x.date > y.date ? -1 : y.id - x.id; }).slice(0, 6);
    var next = UPCOMING.filter(function (g) { return g.date !== TBD_DATE && gIn(g); }).slice(0, 6);
    var snap = MULTI ? '<div class="card"><table class="snap"><thead><tr><th class="rk">#</th><th class="l">Team</th><th>GP</th><th>W-L-OTL</th><th>PTS</th></tr></thead><tbody>' + curDivs().map(function (d) {
      return '<tr class="divr"><td colspan="5" class="l">' + esc(d.name) + "</td></tr>" + d.teams.slice(0, 3).map(function (t) {
        var s = ST[t];
        return '<tr><td class="rk">' + s.rank + '</td><td class="l">' + tname(t) + "</td><td>" + s.gp + "</td><td>" + rec(s) + '</td><td class="strong">' + (s.pend ? "–" : s.pts) + "</td></tr>";
      }).join("");
    }).join("") + "</tbody></table></div>"
      : '<div class="card"><table class="snap"><thead><tr><th class="rk">#</th><th class="l">Team</th><th>GP</th><th>W-T-L</th><th>PTS</th><th>STRK</th></tr></thead><tbody>' + ORDER.slice(0, 5).map(function (t) {
      var s = ST[t];
      return '<tr><td class="rk">' + s.rank + '</td><td class="l">' + tname(t) + "</td><td>" + s.gp + "</td><td>" + s.w + "-" + s.tie + "-" + s.l + '</td><td class="strong">' + s.pts + "</td><td>" + streakOf(t) + "</td></tr>";
    }).join("") + "</tbody></table></div>";
    var defs = [["Points", SK, "pts"], ["Goals", SK, "g"], ["Assists", SK, "a"], ["Goalie wins", GK, "w"]];
    var perf = defs.map(function (d) {
      var top = d[1].filter(function (r) { return r[d[2]] > 0; }).sort(function (a, b) { return b[d[2]] - a[d[2]] || (b.pts || 0) - (a.pts || 0) || b.gp - a.gp || a.name.localeCompare(b.name); }).slice(0, 3);
      return '<div class="card pf"><h4>' + d[0] + "</h4><ol>" + (top.map(function (r, i) {
        return '<li><span class="pr">' + (i + 1) + '</span><span class="pn">' + esc(r.name) + " " + badgeC(r.team) + '</span><span class="pv">' + r[d[2]] + "</span></li>";
      }).join("") || '<li><span></span><span class="pr">No data yet</span><span></span></li>') + "</ol></div>";
    }).join("");
    $("p-home").innerHTML = '<div class="home"><div class="hhero"><div class="sec-head"><div><h2>Current season</h2><p class="lede">' + (GAMES.length ? PLAYED.filter(gIn).length + " of " + GAMES.filter(gIn).length + " games played through " + dlong(LAST) + "." : "Standings as of " + dlong(LAST) + ". The schedule and game sheets will be added soon.") + '</p></div></div>' +
      '<div class="hprog" role="img" aria-label="' + PLAYED.length + " of " + GAMES.length + ' games played"><i style="width:' + (GAMES.length ? Math.round(PLAYED.filter(gIn).length / GAMES.filter(gIn).length * 100) : 0) + '%"></i></div>' +
      '<div class="hstat"><span><b>' + f2(totGF / totGP) + "</b> goals per game</span><span>Leader <b>" + esc(SHORT[lead.t]) + "</b> · " + lead.pts + " PTS</span><span>Best offence <b>" + esc(SHORT[off]) + "</b> · " + f2(ST[off].gfg) + " per game</span></div></div>" +
      weekendHTML() +
      '<div class="hgrid"><div class="hcol"><div class="hh"><h3>Recent results</h3><button class="hlink" data-sfgo="results">All results →</button></div><div class="hlist">' + (recent.map(homeGame).join("") || '<p class="mfoot">Results appear here once the schedule is loaded.</p>') + "</div></div>" +
      '<div class="hcol"><div class="hh"><h3>Upcoming games</h3><button class="hlink" data-sfgo="upcoming">Full schedule →</button></div><div class="hlist">' + (next.map(homeGame).join("") || '<p class="mfoot">Upcoming games appear here once the schedule is loaded.</p>') + "</div></div></div>" +
      '<div class="hgrid"><div class="hcol"><div class="hh"><h3>Standings</h3><button class="hlink" data-go="standings">Full standings →</button></div>' + snap + "</div>" +
      '<div class="hcol"><div class="hh"><h3>Top performers</h3><button class="hlink" data-go="players">All players →</button></div><div class="pfgrid">' + perf + "</div></div></div></div>";
  }
  /* Special teams per team. Sheet leagues: power-play and short-handed goals for and against, from the timed game sheets.
     Official-stat leagues: power-play and short-handed goals for, summed from the league's player stats (no "against"). */
  var SPT = (function () {
    var out = {}, byId = {};
    ORDER.forEach(function (t) { out[t] = { ppg: 0, shg: 0, ppga: 0, shga: 0 }; });
    GAMES.forEach(function (g) { byId[g.id] = g; });
    if (OFFICIAL) {
      PSTATS.forEach(function (p) { if (out[p[0]]) { out[p[0]].ppg += p[6] || 0; out[p[0]].shg += p[8] || 0; } });
    } else {
      PPX.forEach(function (x) {
        var g = byId[x[0]], t = x[1], opp = g ? (g.a === t ? g.h : g.a) : null;
        if (!out[t]) return;
        if (x[3] === "PP") { out[t].ppg++; if (out[opp]) out[opp].ppga++; }
        if (x[3] === "SH") { out[t].shg++; if (out[opp]) out[opp].shga++; }
      });
    }
    return out;
  })();
  var SPT_AGAINST = !OFFICIAL;   // goals-against columns only when every goal's situation is known

  function renderStandings() {
    // One layout for every league. Record columns follow the league format (W-L-OTL or W-T-L);
    // on phones a Table / Grid switch picks compact tables (default) or team cards.
    var totGP = Math.round(DT().reduce(function (s, t) { return s + ST[t].gp; }, 0) / 2);
    var totGF = DT().reduce(function (s, t) { return s + ST[t].gf; }, 0);
    var bp = ST[bestBy("pctn", true)], bo = bestBy("gfg", true), bd = bestBy("gag", false), bdf = bestBy("diff", true);
    var where = function (t) { return MULTI ? esc(divOf(t).name) : "the " + GROUP; };
    var focus = "";
    if (state.team !== "ALL") {
      var s = ST[state.team], ng = nextGame(state.team);
      focus = '<div class="focus"><div style="display:flex;gap:14px;align-items:center">' + badge(state.team, 1) + '<div><div class="big">' + esc(TEAMS[state.team]) + '</div><div class="sub">' + ord(s.rank) + " in " + where(state.team) + " · " + rec(s) + " · " + (s.pend ? "–" : s.pts) + " PTS · last 5 " + formChips(state.team, 5) + "</div></div></div>" +
        (ng ? '<div class="nextg"><span class="sub">Next game</span><b>' + when(ng) + "</b><span>" + (ng.h === state.team ? "vs " + esc(TEAMS[ng.a]) : "at " + esc(TEAMS[ng.h])) + '</span><button class="btn pri" data-open="' + ng.id + '">Matchup preview</button> <button class="btn" data-go="teams">Team page</button></div>' : '<div class="nextg"><button class="btn" data-go="teams">Team page</button></div>') + "</div>";
    }
    var dash = function (s, v) { return s.pend ? "–" : v; };
    var sgn = function (s) { return (s.diff > 0 ? "+" : "") + s.diff; };
    // record columns in league order
    var RC = OT ? [["W", "Wins, all kinds", "w"], ["L", "Regulation losses", "l"], ["OTL", "Overtime and shootout losses", "otl"]]
                : [["W", "Wins", "w"], ["T", "Ties", "tie"], ["L", "Losses", "l"]];
    var rth = function (full) { return RC.map(function (c) { return "<th" + (full ? ' title="' + c[1] + '"' : "") + ">" + c[0] + "</th>"; }).join(""); };
    var rtd = function (s) { return RC.map(function (c) { return "<td>" + s[c[2]] + "</td>"; }).join(""); };
    var divHead = function (d) { return MULTI ? '<h3 class="divh">' + esc(d.name) + "</h3>" : ""; };
    var teamCell = function (t) { return '<td class="l stick"><button class="teamlink" data-team="' + t + '">' + tname(t) + "</button></td>"; };

    var mobTable = curDivs().map(function (d) {
      return divHead(d) + '<div class="card"><div class="wrap"><table class="ctable"><thead><tr><th class="rk">#</th><th class="l stick">Team</th><th>GP</th>' + rth() + '<th class="pts">PTS</th><th>DIFF</th><th>STRK</th></tr></thead><tbody>' + d.teams.map(function (t) {
        var s = ST[t];
        return '<tr class="' + (mine(t) ? "me" : "") + '"><td class="rk num">' + s.rank + "</td>" + teamCell(t) + "<td>" + s.gp + "</td>" + rtd(s) + '<td class="strong">' + dash(s, s.pts) + "</td><td>" + sgn(s) + "</td><td>" + streakOf(t) + "</td></tr>";
      }).join("") + "</tbody></table></div></div>";
    }).join("");
    var mobGrid = curDivs().map(function (d) {
      return divHead(d) + '<div class="scg">' + d.teams.map(function (t) {
        var s = ST[t];
        return '<div class="sc' + (mine(t) ? " me" : "") + '"><div class="r">' + s.rank + '</div><div><button class="teamlink" data-team="' + t + '">' + tname(t, "full") + '</button><div class="rec">' + rec(s) + " · " + s.gp + " GP · " + remaining(t) + ' to play</div></div><div class="p">' + dash(s, s.pts) + "<small>PTS</small></div>" +
          '<div class="bar" aria-hidden="true"><i style="width:' + Math.round(s.pctn * 100) + '%"></i></div><div class="row"><span>GF <b>' + s.gf + "</b></span><span>GA <b>" + s.ga + "</b></span><span>DIFF <b>" + sgn(s) + "</b></span>" + formChips(t, 5) + "</div></div>";
      }).join("") + "</div>";
    }).join("");
    var svSeg = '<div class="svbar"><div class="seg svseg" role="group" aria-label="Standings view">' + [["table", "Table"], ["grid", "Grid"]].map(function (x) { return '<button data-sv="' + x[0] + '" aria-pressed="' + (state.sv === x[0]) + '">' + x[1] + "</button>"; }).join("") + '</div><button class="advtog" data-sadv="1" role="switch" aria-checked="' + state.sadv + '"><i aria-hidden="true"></i>Advanced stats</button></div>';

    var deskFor = function (cls) { return curDivs().map(function (d) {
      var body = d.teams.map(function (t) {
        var s = ST[t];
        return '<tr class="' + (mine(t) ? "me" : "") + '"><td class="rk num">' + s.rank + "</td>" + teamCell(t) +
          "<td>" + s.gp + "</td>" + rtd(s) + '<td class="strong">' + dash(s, s.pts) + "</td><td>" + s.pct + "</td>" +
          "<td>" + s.gf + "</td><td>" + s.ga + "</td><td>" + sgn(s) + "</td><td>" + dash(s, s.pim) + "</td><td>" + SPT[t].ppg + "</td>" + (SPT_AGAINST ? "<td>" + SPT[t].ppga + "</td>" : "") + "<td>" + SPT[t].shg + "</td>" + (SPT_AGAINST ? "<td>" + SPT[t].shga + "</td>" : "") + (OT ? "<td>" + s.rw + "</td><td>" + dash(s, s.sp) + "</td>" : "") + "<td>" + remaining(t) + '</td><td class="l">' + formChips(t, 5) + "</td></tr>";
      }).join("");
      return divHead(d) + '<div class="card"><div class="wrap"><table' + (cls ? ' class="' + cls + '"' : "") + '><thead><tr><th class="rk">#</th><th class="l stick">Team</th><th title="Games played">GP</th>' + rth(true) + '<th title="Points">PTS</th><th title="Points percentage">PTS%</th><th title="Goals for">GF</th><th title="Goals against">GA</th><th title="Goal difference">DIFF</th><th title="Penalty minutes">PIM</th><th title="Power-play goals">PPG</th>' + (SPT_AGAINST ? '<th title="Power-play goals against">PPGA</th>' : "") + '<th title="Short-handed goals">SHG</th>' + (SPT_AGAINST ? '<th title="Short-handed goals against">SHGA</th>' : "") +
        (OT ? '<th title="Regulation wins">RW</th><th title="Sportsmanship points, included in PTS">SP</th>' : "") + '<th title="Games remaining">GR</th><th class="l">Last 5</th></tr></thead><tbody>' + body + "</tbody></table></div></div>";
    }).join(""); };
    var desk = deskFor("");
    var lede = MULTI ? (state.div === "ALL" ? DIVS.length + " divisions of " + DIVS[0].teams.length : esc(curDivs()[0].name)) + ", as of " + dlong(LAST) : "League table through " + dlong(LAST);
    $("p-standings").innerHTML =
      '<div class="sec-head"><div><h2>Standings</h2><p class="lede">' + lede + ".</p></div></div>" +
      '<div style="display:flex;flex-direction:column;gap:16px;margin-top:16px">' + focus +
      '<div class="tiles">' + tile("Best offence", esc(SHORT[bo]), f2(ST[bo].gfg) + " goals per game · " + ST[bo].gf + " total" + (MULTI ? " · " + esc(divOf(bo).name) : "")) +
      tile("Highest diff", esc(SHORT[bdf]), (ST[bdf].diff > 0 ? "+" : "") + ST[bdf].diff + " goal difference · " + ST[bdf].gf + " for, " + ST[bdf].ga + " against" + (MULTI ? " · " + esc(divOf(bdf).name) : "")) +
      tile("Best points %", esc(SHORT[bp.t]), bp.pct + (MULTI ? " · " + esc(divOf(bp.t).name) : "")) +
      tile("Best defence", esc(SHORT[bd]), f2(ST[bd].gag) + " allowed per game" + (MULTI ? " · " + esc(divOf(bd).name) : "")) + "</div>" +
      '<div class="mob">' + svSeg + (state.sadv ? deskFor("advt") : state.sv === "grid" ? mobGrid : mobTable) + '</div><div class="desk">' + desk + "</div>" +
      "</div>";
    $("p-standings").insertAdjacentHTML("beforeend", recapsHTML());
  }
  /* ---------- game recaps (generated from the game sheets) ---------- */
  function clean(n) { return n.replace(/\s*†$/, ""); }
  function ptsWords(r) { var p = []; if (r.g) p.push(r.g === 1 ? "a goal" : r.g + " goals"); if (r.a) p.push(r.a === 1 ? "an assist" : r.a + " assists"); return p.join(" and "); }
  function recapOf(g) {
    var sh = SHEET[g.id]; if (!sh || !g.played) return null;
    var tie = g.sa === g.sh, aw = g.sa > g.sh;
    var W = aw ? g.a : g.h, L = aw ? g.h : g.a, ws = Math.max(g.sa, g.sh), ls = Math.min(g.sa, g.sh), m = ws - ls, head;
    if (tie) head = ws === 0 ? SHORT[g.a] + " and " + SHORT[g.h] + " play to a scoreless draw" : SHORT[g.a] + " and " + SHORT[g.h] + " share the points, " + ws + "–" + ws;
    else if (ls === 0) head = SHORT[W] + " shut out " + SHORT[L] + " " + ws + "–0";
    else if (m >= 4) head = SHORT[W] + " roll past " + SHORT[L] + " " + ws + "–" + ls;
    else if (m === 1) head = SHORT[W] + " edge " + SHORT[L] + " " + ws + "–" + ls;
    else head = SHORT[W] + " beat " + SHORT[L] + " " + ws + "–" + ls;
    var per = {};
    function P(t2, k) { var id = t2 + ":" + k; return per[id] || (per[id] = { t: t2, k: k, g: 0, a: 0, name: clean(nm(t2, k)) }); }
    sh.g.forEach(function (x) { if (x[1]) P(x[0], x[1]).g++; for (var i = 2; i < x.length; i++) P(x[0], x[i]).a++; });
    var list = Object.keys(per).map(function (k) { var r = per[k]; r.score = (r.g + r.a) * 2 + r.g; r.txt = (r.g ? r.g + "G " : "") + (r.a ? r.a + "A" : ""); return r; });
    var shutoutBy = {};
    [[g.a, g.sh], [g.h, g.sa]].forEach(function (z) {
      var gl = sh.k.filter(function (x) { return x[0] === z[0] && x[2] > 0; }), oppScore = z[1], won = (z[0] === W && !tie);
      if (gl.length === 1) {
        var x = gl[0], sc = 0, txt = "";
        if (oppScore === 0) { sc = 5; txt = "Shutout"; shutoutBy[z[0]] = x[1]; } else if (won && x[3] <= 1) { sc = 3; txt = x[3] + " GA"; }
        if (sc) list.push({ t: z[0], k: x[1], name: clean(nm(z[0], x[1])), score: sc, g: 0, a: 0, txt: txt, goalie: true });
      }
    });
    list.sort(function (a, b) { return b.score - a.score || (b.t === W ? 1 : 0) - (a.t === W ? 1 : 0) || b.g - a.g || a.name.localeCompare(b.name); });
    var stars = list.filter(function (r) { return r.score > 0; }).slice(0, 3);
    var skaters = list.filter(function (r) { return !r.goalie; }), hat = skaters.filter(function (r) { return r.g >= 3; }), two = skaters.filter(function (r) { return r.g === 2; });
    var parts = [];
    if (hat.length) parts.push(esc(hat[0].name) + " scored " + (hat[0].g === 3 ? "a hat trick" : hat[0].g + " goals") + " for " + SHORT[hat[0].t] + ".");
    else if (two.length === 1) parts.push(esc(two[0].name) + " scored twice for " + SHORT[two[0].t] + ".");
    else if (two.length >= 2 && two.length <= 3) parts.push(two.map(function (r) { return esc(r.name); }).join(", ").replace(/, ([^,]*)$/, " and $1") + " each scored twice.");
    else if (two.length > 3) parts.push(two.length + " players scored twice.");
    else if (stars.length && !stars[0].goalie) parts.push(esc(stars[0].name) + " led " + SHORT[stars[0].t] + " with " + ptsWords(stars[0]) + ".");
    else if (ws === 0) parts.push("Neither team found the net.");
    Object.keys(shutoutBy).forEach(function (t2) { parts.push(esc(clean(nm(t2, shutoutBy[t2]))) + " posted the shutout for " + SHORT[t2] + "."); });
    return { head: head, line: parts.join(" "), stars: stars };
  }
  function recapBlock(g) {
    var r = recapOf(g); if (!r) return "";
    return '<div class="recap"><b class="rh">' + esc(r.head) + "</b>" + (r.line ? "<p>" + r.line + "</p>" : "") +
      (r.stars.length ? '<ul class="rstars">' + r.stars.map(function (s) { return "<li>" + badge(s.t).replace(/alt="[^"]*"/, 'alt=""') + "<span><b>" + esc(s.name) + "</b><small>" + esc(s.txt.trim()) + "</small></span></li>"; }).join("") + "</ul>" : "") + "</div>";
  }
  function recapsHTML() {
    var one = state.team !== "ALL";
    var list = PLAYED.filter(function (g) { return SHEET[g.id] && gIn(g) && (!one || g.a === state.team || g.h === state.team); }).slice(one ? -4 : -6).reverse();
    if (!list.length) return "";
    return '<div style="margin-top:28px"><div class="sec-head"><h3>Latest recaps' + (one ? " · " + esc(SHORT[state.team]) : "") + '</h3></div><div class="rgrid" style="margin-top:12px">' + list.map(function (g) {
      return '<div class="card rcard"><div class="rmeta"><span>' + dlong(g.date) + '</span><span class="rscore">' + badge(g.a).replace(/alt="[^"]*"/, 'alt=""') + "<b>" + g.sa + "</b> – <b>" + g.sh + "</b>" + badge(g.h).replace(/alt="[^"]*"/, 'alt=""') + "</span></div>" + recapBlock(g) + "</div>";
    }).join("") + "</div></div>";
  }
  function bestBy(key, high) { return ORDER.filter(function (t) { return inDiv(t) && (!ST[t].pend || (key !== "pctn" && key !== "pimg")); }).sort(function (a, b) { return high ? ST[b][key] - ST[a][key] : ST[a][key] - ST[b][key]; })[0]; }

  /* ---------- schedule ---------- */
  function teamLine(g, side) {
    var t = side === "a" ? g.a : g.h, sc = side === "a" ? g.sa : g.sh, opp = side === "a" ? g.sh : g.sa;
    var cls = "gl" + (g.played && sc < opp ? " lose" : "") + (mine(t) ? " mine" : "");
    var pc = "";
    if (!g.played) { var wp = winProb(g.a, g.h), v = side === "a" ? wp.a : wp.h; pc = '<em class="wpc' + (v === Math.max(wp.a, wp.h) && wp.a !== wp.h ? " fav" : "") + '" title="Win probability">' + v + "%</em>"; }
    return '<div class="' + cls + '">' + tname(t) + (g.played ? '<span class="sc">' + sc + "</span>" : pc) + "</div>";
  }
  function gameInner(g, sheet) {
    return '<div class="gtime"><b>' + g.time + "</b><span>#" + g.id + '</span></div><div class="gteams">' + (g.played ? "" : '<div class="wph">Win probability</div>') + teamLine(g, "a") + teamLine(g, "h") + '</div><div class="gmeta"><span>' + esc(g.venue) + "</span>" +
      (g.played ? '<span><span class="final">' + fin(g) + '</span>' + (sheet ? ' · <span class="more">Scoring summary</span>' : "") + "</span>" : '<span><span class="more">Matchup preview</span></span>') + "</div>";
  }
  function goalList(sh, t) {
    var items = sh.g.filter(function (x) { return x[0] === t; }).map(function (x) {
      var as = x.slice(2).map(function (k) { return nm(t, k); });
      return "<li><span>" + esc(x[1] ? nm(t, x[1]) : "Unknown") + "</span> <small>" + (as.length ? esc(as.join(", ")) : "unassisted") + "</small></li>";
    });
    return items.length ? items.join("") : "<li><small>No goals</small></li>";
  }
  function sheetDetail(g, sh) {
    var gl = sh.k.filter(function (x) { return x[2] > 0; }).map(function (x) { return esc(nm(x[0], x[1])) + " (" + SHORT[x[0]] + ", " + f1(x[2]) + " min, " + x[3] + " GA)"; }).join(" · ");
    var pa = sh.p.filter(function (x) { return x[0] === g.a; }).length, ph = sh.p.filter(function (x) { return x[0] === g.h; }).length;
    return '<div class="gdetail">' + recapBlock(g) + '<div><h4>' + esc(TEAMS[g.a]) + " goals</h4><ul>" + goalList(sh, g.a) + "</ul></div><div><h4>" + esc(TEAMS[g.h]) + " goals</h4><ul>" + goalList(sh, g.h) + "</ul></div>" +
      '<div class="gfoot"><span>Goalies: ' + gl + "</span><span>PIM: " + SHORT[g.a] + " " + pa * 2 + ", " + SHORT[g.h] + " " + ph * 2 + "</span></div></div>";
  }
  function isoOf(d) { return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); }
  function mlabel(k) { return k === TBD_DATE.slice(0, 7) ? "TBD" : MONTH[+k.slice(5) - 1] + (k.slice(0, 4) === "2027" ? " 2027" : ""); }
  function renderSchedule() {
    var today = isoOf(new Date()), wk = new Date(); wk.setDate(wk.getDate() + 6); var weekEnd = isoOf(wk);
    var list = GAMES.filter(function (g) {
      if (!gIn(g)) return false;
      if (state.team !== "ALL" && g.a !== state.team && g.h !== state.team) return false;
      if (state.sf === "week") return g.date >= today && g.date <= weekEnd;
      return state.sf === "all" || (state.sf === "upcoming" ? !g.played : g.played);
    });
    if (state.sf === "results") list = list.slice().reverse();
    var html = "", cur = "", months = [], mark = state.sf === "all" ? list.findIndex(function (g) { return g.date >= today; }) : -1;
    list.forEach(function (g, i) {
      var mk = g.date.slice(0, 7), isNewMonth = months.indexOf(mk) < 0;
      if (isNewMonth) months.push(mk);
      if (i === mark && i > 0) html += '<div class="todaybar"><span>Today · ' + dlong(today) + "</span></div>";
      if (g.date !== cur) {
        cur = g.date; html += '<div class="day"' + (isNewMonth ? ' data-month="' + mk + '"' : "") + "><h3>" + dlong(g.date) + "</h3>" + (g.date === today ? '<span class="todaychip">Today</span>' : "") + "</div>";
      }
      var sheet = SHEET[g.id];
      if (!g.played) html += '<details class="grow" id="m' + g.id + '"' + (g.id === state.open ? " open" : "") + "><summary>" + gameInner(g, false) + "</summary>" + matchBody(g) + "</details>";
      else html += sheet ? '<details class="grow"><summary>' + gameInner(g, true) + "</summary>" + sheetDetail(g, sheet) + "</details>" : '<div class="g">' + gameInner(g, false) + "</div>";
    });
    var who = state.team === "ALL" ? (state.div === "ALL" ? "all teams" : curDivs()[0].name) : TEAMS[state.team];
    var seg = [["week", "This week"], ["upcoming", "Upcoming"], ["results", "Results"], ["all", "All"]].map(function (x) { return '<button data-sf="' + x[0] + '" aria-pressed="' + (state.sf === x[0]) + '">' + x[1] + "</button>"; }).join("");
    var jump = months.length > 1 && state.sf !== "week" ? '<div class="mjump" role="group" aria-label="Jump to month">' + months.map(function (k) { return '<button class="btn" data-jump="' + k + '">' + mlabel(k) + "</button>"; }).join("") + "</div>" : "";
    var pending = list.some(function (g) { return g.played && !SHEET[g.id]; });
    var empty = state.sf === "week" ? "No games this week." : "No games to show.";
    $("p-schedule").innerHTML =
      '<div class="sec-head"><div><h2>Schedule</h2><p class="lede">' + list.length + " game" + (list.length === 1 ? "" : "s") + " for " + esc(who) + ". Open a game for the matchup preview or, once played, the scoring summary.</p></div><div class=\"tools\"><div class=\"seg\" role=\"group\" aria-label=\"Show\">" + seg + "</div></div></div>" + jump +
      '<div class="games" style="margin-top:4px">' + (html || '<p class="empty">' + empty + "</p>") + "</div>" +
      (pending ? '<p class="mfoot" style="margin-top:12px">A few results do not have a scoring summary yet because their game sheet has not been added.</p>' : "");
  }

  /* ---------- players ---------- */
  function filt(rows) {
    var q = norm(state.q.trim());
    return rows.filter(function (r) { return inDiv(r.team) && (state.team === "ALL" || r.team === state.team) && (!q || norm(r.name).indexOf(q) >= 0); });
  }
  function sortRows(rows, cfg, tie) {
    return rows.slice().sort(function (x, y) {
      var a = x[cfg.key], b = y[cfg.key];
      if (typeof a === "string") return cfg.dir * a.localeCompare(b);
      return cfg.dir * (a - b) || tie(x, y);
    });
  }
  function head(cols, cfg) {
    return "<thead><tr>" + cols.map(function (c) {
      var on = cfg.key === c[0];
      return '<th class="' + (c[2] || "") + (on ? " on" : "") + '" aria-sort="' + (on ? (cfg.dir < 0 ? "descending" : "ascending") : "none") + '"><button class="sort" data-key="' + c[0] + '"' + (c[3] ? ' title="' + c[3] + '"' : "") + '>' + c[1] + (on ? '<span class="arr">' + (cfg.dir < 0 ? "▾" : "▴") + "</span>" : "") + "</button></th>";
    }).join("") + "</tr></thead>";
  }
  function leaderTile(rows, key, label, all) {
    if (!rows.length) return tile(label, "–", "");
    var m = Math.max.apply(null, rows.map(function (r) { return r[key]; }));
    var who = rows.filter(function (r) { return r[key] === m; });
    var names = who.slice(0, 3).map(function (r) { return esc(r.name) + (all ? " (" + r.team + ")" : ""); }).join(", ") + (who.length > 3 ? " +" + (who.length - 3) : "");
    return tile(label, m, names);
  }
  var ADV_C = [["pwg", "Power-play goals", -1], ["pwa", "Power-play assists", -1], ["shg", "Short-handed goals", -1], ["sha", "Short-handed assists", -1], ["mp", "Multi-point games", -1]];
  var MSORT_C = { skaters: [["pts", "Points", -1], ["g", "Goals", -1], ["a", "Assists", -1], ["ppg", "Points per game", -1], ["pen", "PIM", -1]], goalies: [["gaa", "Best GAA", 1], ["w", "Wins", -1], ["so", "Shutouts", -1], ["gp", "Games played", -1]] };
  function ptStartC(cols, cfg) {
    var cg = cols.map(function (c) {
      var k = c[0] === "name" ? "" : c[0] === "rank" ? "rk" : c[0] === "team" ? "tm" : "nu";
      return "<col" + (k ? ' class="' + k + '"' : "") + ">";
    }).join("");
    return '<table class="pt"><colgroup>' + cg + "</colgroup>" + head(cols, cfg);
  }
  function msortCtlC(cfg) {
    var opts = MSORT_C[state.ptab].concat(state.adv && state.ptab === "skaters" ? ADV_C : []), cur = opts.some(function (o) { return o[0] === cfg.key; }) ? cfg.key : opts[0][0];
    return '<div class="mtools"><select id="msort" aria-label="Sort by">' + opts.map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === cur ? " selected" : "") + ">Sort: " + o[1] + "</option>"; }).join("") + "</select></div>";
  }
  var MINGP_SK = 5, MINGP_GK = 3;
  function ptStart(cols, cfg) {
    var n = 0, cg = cols.map(function (c) {
      var k = c[0] === "name" ? "" : c[0] === "rank" ? "rk" : c[0] === "team" ? "tm" : "nu";
      if (k === "nu") n++;
      return "<col" + (k ? ' class="' + k + '"' : "") + ">";
    }).join("");
    var w = 40 + 170 + n * 52 + (cols.some(function (c) { return c[0] === "team"; }) ? 150 : 0);
    return '<table class="pt" style="min-width:' + w + 'px"><colgroup>' + cg + "</colgroup>" + head(cols, cfg);
  }
  var MSORT = { skaters: [["pts", "Points", -1], ["g", "Goals", -1], ["a", "Assists", -1], ["pgp", "Points per game", -1], ["ggp", "Goals per game", -1], ["ppg", "Power-play goals", -1], ["ppp", "Power-play points", -1], ["shp", "Short-handed points", -1], ["gwg", "Game-winning goals", -1], ["pen", "Penalty minutes", -1]], goalies: [["gaa", "Best GAA", 1], ["w", "Wins", -1], ["so", "Shutouts", -1], ["wpct", "Win %", -1], ["gp", "Games played", -1], ["gs", "Games started", -1], ["min", "Minutes", -1]] };
  function msortCtl(cfg) {
    var opts = MSORT[state.ptab], cur = opts.some(function (o) { return o[0] === cfg.key; }) ? cfg.key : opts[0][0];
    return '<div class="mtools"><select id="msort" aria-label="Sort by">' + opts.map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === cur ? " selected" : "") + ">Sort: " + o[1] + "</option>"; }).join("") + "</select></div>";
  }
  function moreBtn(n) { return n > state.pm ? '<button class="btn" data-more="1">Show 10 more</button> <button class="btn" data-all="1">Show all ' + n + "</button>" : ""; }
  function f3(x) { return x.toFixed(3).replace(/^0/, ""); }
  function leadersHTMLC() {
    var inTeam = function (r) { return state.team === "ALL" || r.team === state.team; };
    var sks = SK.filter(inTeam), gks = GK.filter(inTeam), all = state.team === "ALL";
    var defs = [
      ["Points", sks, "pts", function (a, b) { return b.g - a.g; }, ""],
      ["Goals", sks, "g", function (a, b) { return b.pts - a.pts; }, ""],
      ["Assists", sks, "a", function (a, b) { return b.pts - a.pts; }, ""],
      ["PIM", sks, "pen", function (a, b) { return a.name.localeCompare(b.name); }, " min"],
      ["Goalie wins", gks, "w", function (a, b) { return b.gp - a.gp; }, " pen"],
      ["Power-play goals", sks, "pwg", function (a, b) { return b.pts - a.pts; }, ""],
      ["Power-play assists", sks, "pwa", function (a, b) { return b.pts - a.pts; }, ""]
    ];
    var cards = defs.map(function (d, di) {
      var top = d[1].filter(function (r) { return r[d[2]] > 0; }).sort(function (a, b) { return b[d[2]] - a[d[2]] || d[3](a, b) || a.name.localeCompare(b.name); }).slice(0, 8);
      var mx = top.length ? top[0][d[2]] : 1;
      return '<div class="card lcard" data-k="' + d[2] + '"><h3>' + d[0] + '</h3>' + (di === 0 ? '<div class="lkey"><span><i class="kg"></i>Goals</span><span><i class="ka"></i>Assists</span></div>' : "") + '<ol class="lbars">' + (top.map(function (r, i) {
        return '<li><span class="lrk">' + (i + 1) + '</span><span class="ln">' + esc(r.name) + (all ? " " + badgeC(r.team) : "") + (di === 0 ? ' <small class="lsub">' + r.g + "G " + r.a + "A</small>" : "") + '</span><b class="lv">' + r[d[2]] + '</b>' + (di === 0 ? '<span class="lbar" aria-hidden="true"><i class="sg" style="width:' + (r.g / mx * 100).toFixed(1) + '%"></i><i class="sa" style="width:' + (r.a / mx * 100).toFixed(1) + '%"></i></span></li>' : '<span class="lbar" aria-hidden="true"><i class="' + (di === 3 ? "h" : "") + '" style="width:' + Math.max(4, Math.round(r[d[2]] / mx * 100)) + '%"></i></span></li>');
      }).join("") || '<li class="lnone">No data yet</li>') + "</ol></div>";
    }).join("");
    return '<div><h3 style="margin:8px 0 12px">Top 8 leaders · ' + (all ? "All 12 teams" : esc(TEAMS[state.team])) + '</h3><div class="lgrid">' + cards + '</div><p class="mfoot" style="margin-top:10px">PIM assumes 2 minutes per penalty. Goalie wins are credited when one goalie played the whole game. Power-play stats are counted for ' + TIMED.length + ' of ' + G.length + ' games read so far.</p></div>';
  }
  function leadersHTML() {
    if (!OFFICIAL) return leadersHTMLC();
    var inTeam = function (r) { return inDiv(r.team) && (state.team === "ALL" || r.team === state.team); };
    var all = state.team === "ALL", defs;
    var byPts = function (a, b) { return b.pts - a.pts || b.g - a.g; }, byG = function (a, b) { return b.g - a.g || b.pts - a.pts; }, byGp = function (a, b) { return b.gp - a.gp; };
    if (state.ptab === "skaters") {
      var sks = SK.filter(inTeam), rate = sks.filter(function (r) { return r.gp >= MINGP_SK; });
      var gp = function (r) { return r.gp + " GP"; };
      defs = [
        { t: "Points", rows: sks, k: "pts", tie: byG, special: 1 },
        { t: "Goals", rows: sks, k: "g", tie: byPts },
        { t: "Assists", rows: sks, k: "a", tie: byPts },
        { t: "Points per game", rows: rate, k: "pgp", f: f2, tie: byPts, sub: gp, note: "min " + MINGP_SK + " GP" },
        { t: "Goals per game", rows: rate, k: "ggp", f: f2, tie: byG, sub: gp, note: "min " + MINGP_SK + " GP" },
        { t: "Power-play goals", rows: sks, k: "ppg", tie: byPts },
        { t: "Power-play assists", rows: sks, k: "ppa", tie: byPts },
        { t: "Power-play points", rows: sks, k: "ppp", tie: byPts },
        { t: "Short-handed goals", rows: sks, k: "shg", tie: byPts },
        { t: "Short-handed points", rows: sks, k: "shp", tie: byPts },
        { t: "Game-winning goals", rows: sks, k: "gwg", tie: byPts },
        { t: "Penalty minutes", rows: sks, k: "pen", tie: byPts, cls: "h", unit: " min" }
      ];
    } else {
      var gks = GK.filter(inTeam), grate = gks.filter(function (r) { return r.gp >= MINGP_GK; });
      defs = [
        { t: "Goals against average", rows: grate, k: "gaa", f: f2, asc: 1, tie: byGp, sub: function (r) { return r.gp + " GP"; }, note: "min " + MINGP_GK + " GP", zero: 1 },
        { t: "Wins", rows: gks, k: "w", tie: byGp },
        { t: "Shutouts", rows: gks, k: "so", tie: byGp },
        { t: "Win %", rows: grate, k: "wpct", f: f3, tie: byGp, sub: function (r) { return r.w + "-" + r.l + "-" + r.t; }, note: "min " + MINGP_GK + " GP" },
        { t: "Games played", rows: gks, k: "gp", tie: function (a, b) { return b.min - a.min; } },
        { t: "Minutes played", rows: gks, k: "min", f: f1, tie: byGp, sub: function (r) { return r.gp + " GP"; } }
      ];
    }
    var cards = defs.map(function (d) {
      var f = d.f || function (v) { return v; };
      var top = d.rows.filter(function (r) { return d.zero || r[d.k] > 0; }).sort(function (a, b) { return (d.asc ? a[d.k] - b[d.k] : b[d.k] - a[d.k]) || d.tie(a, b) || a.name.localeCompare(b.name); }).slice(0, 8);
      var mx = top.length ? top[0][d.k] : 1, mn = top.length ? top[0][d.k] : 0;
      return '<div class="card lcard" data-k="' + d.k + '"><h3>' + d.t + (d.note ? ' <small class="lsub">' + d.note + "</small>" : "") + "</h3>" + (d.special ? '<div class="lkey"><span><i class="kg"></i>Goals</span><span><i class="ka"></i>Assists</span></div>' : "") + '<ol class="lbars">' + (top.map(function (r, i) {
        var w = d.asc ? (r[d.k] ? mn / r[d.k] * 100 : 100) : r[d.k] / mx * 100;
        return '<li><span class="lrk">' + (i + 1) + '</span><span class="ln">' + esc(r.name) + (all ? " " + badgeC(r.team) : "") + (d.special ? ' <small class="lsub">' + r.g + "G " + r.a + "A</small>" : (d.sub ? ' <small class="lsub">' + d.sub(r) + "</small>" : "")) + '</span><b class="lv">' + f(r[d.k]) + (d.unit || "") + "</b>" +
          (d.special ? '<span class="lbar" aria-hidden="true"><i class="sg" style="width:' + (r.g / mx * 100).toFixed(1) + '%"></i><i class="sa" style="width:' + (r.a / mx * 100).toFixed(1) + '%"></i></span></li>' : '<span class="lbar" aria-hidden="true"><i class="' + (d.cls || "") + '" style="width:' + Math.max(4, Math.round(w)) + '%"></i></span></li>');
      }).join("") || '<li class="lnone">No data yet</li>') + "</ol></div>";
    }).join("");
    return '<div><h3 style="margin:8px 0 12px">Top 8 leaders · ' + (all ? scopeLbl() : esc(TEAMS[state.team])) + '</h3><div class="lgrid">' + cards + '</div><p class="mfoot" style="margin-top:10px">PIM is penalty minutes. Rate leaders need ' + (state.ptab === "skaters" ? MINGP_SK + " games for skaters" : MINGP_GK + " games for goalies") + ".</p></div>";
  }
  /* ---------- leader cards (Players, Cards view) ----------
     One card per stat: the leader large with a silhouette in team colour, then the next four. */
  /* picture beside the featured player: the team logo (or, for leagues without logos, the team colour and code) */
  function silhouette(t) {
    if (LOGOS) return '<span class="fbg t-' + t + '" aria-hidden="true"></span>';
    return '<span class="fbg fcode" style="background:' + (BADGE[t] || "#2B6CB0") + '" aria-hidden="true">' + t + "</span>";
  }
  function cardsHTML() {
    var all = state.team === "ALL";
    var inTeam = function (r) { return inDiv(r.team) && (all || r.team === state.team); };
    var byPts = function (a, b) { return b.pts - a.pts || b.g - a.g; }, byGp = function (a, b) { return b.gp - a.gp; };
    var defs;
    if (state.ptab === "skaters") {
      var sks = SK.filter(inTeam);
      defs = [
        { t: "Points", rows: sks, k: "pts", u: "PTS", tie: function (a, b) { return b.g - a.g; }, sub: function (r) { return "<b>" + r.g + " G · " + r.a + " A</b>"; } },
        { t: "Goals", rows: sks, k: "g", u: "G", tie: byPts },
        { t: "Assists", rows: sks, k: "a", u: "A", tie: byPts },
        { t: "Penalty minutes", rows: sks, k: "pen", u: "PIM", tie: byPts }
      ];
    } else {
      var gks = GK.filter(inTeam), q = gks.filter(function (r) { return OFFICIAL ? r.gp >= MINGP_GK : r.min >= 60; });
      defs = [
        { t: "Wins", rows: gks, k: "w", u: "W", tie: byGp, gk: 1, sub: function (r) { return r.w + "-" + r.l + "-" + r.t + " · " + r.gp + " GP"; } },
        { t: "Goals against average", rows: q, k: "gaa", u: "GAA", f: f2, asc: 1, zero: 1, tie: byGp, gk: 1, sub: function (r) { return r.gp + " GP"; }, note: OFFICIAL ? "Minimum " + MINGP_GK + " games" : "Minimum 60 minutes in net" },
        { t: "Shutouts", rows: gks, k: "so", u: "SO", tie: byGp, gk: 1 }
      ];
    }
    FCARDS = [];
    var html = defs.map(function (d, ci) {
      var f = d.f || function (v) { return v; };
      var top = d.rows.filter(function (r) { return d.zero || r[d.k] > 0; }).sort(function (a, b) { return (d.asc ? a[d.k] - b[d.k] : b[d.k] - a[d.k]) || d.tie(a, b) || a.name.localeCompare(b.name); }).slice(0, 10);
      if (!top.length) return '<div class="card fcard"><h3>' + d.t + '</h3><p class="fnone">No leader yet.</p></div>';
      FCARDS[ci] = { d: d, f: f, top: top };
      return '<div class="card fcard"><h3>' + d.t + "</h3>" + '<div class="fbody"><div class="fhero" id="fh' + ci + '">' + heroHTML(ci, 0) + "</div>" +
        '<ol class="flist">' + top.map(function (r, i) {
          return '<li><button class="frow' + (i === 0 ? " on" : "") + (mine(r.team) ? " me" : "") + '" data-fc="' + ci + '" data-fi="' + i + '"><span class="frk">' + (i + 1) + "</span>" + badge(r.team) + '<span class="fn">' + esc(r.name) + "<small>" + esc(SHORT[r.team]) + '</small></span><b class="fv">' + f(r[d.k]) + "</b></button></li>";
        }).join("") + "</ol></div>" + (d.note ? '<p class="fnote">' + d.note + "</p>" : "") + "</div>";
    }).join("");
    return '<div class="fgrid">' + html + "</div>" +
      '<p class="mfoot">Top 10 in each category' + (all ? "" : " for " + esc(TEAMS[state.team])) + ". Tap a name to feature that player. Switch to List for every player and more stats.</p>";
  }
  var FCARDS = [];
  function heroHTML(ci, i) {
    var c = FCARDS[ci], r = c.top[i], d = c.d;
    return '<div class="fsil">' + silhouette(r.team) + '</div><div class="fwho"><div class="frank">#' + (i + 1) + (i === 0 ? " · Leader" : "") + '</div><div class="fname">' + esc(r.name) + '</div><div class="fteam">' + esc(TEAMS[r.team]) + "</div>" +
      (d.sub ? '<div class="fsub">' + d.sub(r) + "</div>" : "") + '<div class="fval">' + c.f(r[d.k]) + "<small>" + d.u + "</small></div></div>";
  }
  function featureRow(btn) {
    var ci = +btn.dataset.fc, i = +btn.dataset.fi, h = $("fh" + ci);
    if (!h || !FCARDS[ci] || btn.classList.contains("on")) return;
    h.innerHTML = heroHTML(ci, i);
    Array.prototype.forEach.call(btn.closest("ol").querySelectorAll(".frow"), function (x) { x.classList.toggle("on", x === btn); });
  }
  document.addEventListener("mouseover", function (e) { var b = e.target.closest && e.target.closest(".frow"); if (b && !document.body.classList.contains("m")) featureRow(b); });
  function pvTools(tools, seg) {
    var pv = '<div class="seg pvseg" role="group" aria-label="Players view">' + [["cards", "Cards"], ["list", "List"]].map(function (x) { return '<button data-pv="' + x[0] + '" aria-pressed="' + (state.pv === x[0]) + '">' + x[1] + "</button>"; }).join("") + "</div>";
    if (state.pv === "cards") return '<div class="tools"><div class="seg ptseg" role="group" aria-label="Player type">' + seg + "</div>" + pv + "</div>";
    return tools.replace('<div class="seg" role="group" aria-label="Player type">' + seg + "</div>", '<div class="seg ptseg" role="group" aria-label="Player type">' + seg + "</div>" + pv + '<span class="tbrk"></span>');
  }
  function renderPlayersC() {
    var all = state.team === "ALL", out = "";
    var seg = [["skaters", "Skaters"], ["goalies", "Goalies"]].map(function (x) { return '<button data-pt="' + x[0] + '" aria-pressed="' + (state.ptab === x[0]) + '">' + x[1] + "</button>"; }).join("");
    var advBtn = state.ptab === "skaters" ? '<button class="advbtn" data-adv aria-pressed="' + state.adv + '">' + (state.adv ? "Hide advanced" : "Advanced stats") + "</button>" : "";
    var tools = '<div class="tools"><div class="seg" role="group" aria-label="Player type">' + seg + '</div><input class="search" id="q" type="search" placeholder="Search a player" value="' + esc(state.q) + '" aria-label="Search players">' + advBtn + "</div>";
    var scope = all ? "All 12 teams" : esc(TEAMS[state.team]);
    if (state.ptab === "skaters") {
      var rows = filt(SK), cfg = state.sk;
      var cols = [["rank", "#", "rk"], ["name", "Player", "l stick"]].concat(all ? [["team", "Team", "l"]] : []).concat([["gp", "GP"], ["g", "G"], ["a", "A"], ["pts", "PTS", "pts"], ["ppg", "P/GP"], ["pen", "PIM"], ["pwg", "PPG", "adv", "Power-play goals"], ["pwa", "PPA", "adv", "Power-play assists"], ["shg", "SHG", "adv", "Short-handed goals"], ["sha", "SHA", "adv", "Short-handed assists"], ["mp", "MP", "adv", "Multi-point games (2 or more points)"]]);
      var sorted = sortRows(rows, cfg.key === "rank" ? { key: "pts", dir: -1 } : cfg, function (x, y) { return y.pts - x.pts || y.g - x.g || x.name.localeCompare(y.name); });
      var body = sorted.slice(0, state.pm).map(function (r, i) {
        return '<tr class="' + (mine(r.team) && all ? "me" : "") + '"><td class="rk num">' + (i + 1) + '</td><td class="l strong stick">' + esc(r.name) + "</td>" + (all ? '<td class="l">' + tname(r.team) + "</td>" : "") +
          "<td>" + r.gp + "</td><td>" + r.g + "</td><td>" + r.a + '</td><td class="strong pts">' + r.pts + "</td><td>" + f2(r.ppg) + "</td><td>" + r.pen + '</td><td class="adv">' + r.pwg + '</td><td class="adv">' + r.pwa + '</td><td class="adv">' + r.shg + '</td><td class="adv">' + r.sha + '</td><td class="adv">' + r.mp + "</td>" + "</tr>";
      }).join("");
      var mxp = Math.max.apply(null, sorted.map(function (r) { return r.pts; }).concat([1]));
      var mobSk = msortCtlC(cfg) + sorted.slice(0, state.pm).map(function (r, i) {
        return '<div class="pc' + (mine(r.team) && all ? " me" : "") + '"><div class="r">' + (i + 1) + '</div><div class="pn"><div class="pl"><b class="nm">' + esc(r.name) + '</b>' + (all ? badgeC(r.team) : "") + '</div><div class="pst"><span>GP <b>' + r.gp + '</b></span><span>G <b>' + r.g + '</b></span><span>A <b>' + r.a + '</b></span>' + (state.adv ? '<span class="sm">PPG <b>' + r.pwg + '</b></span><span class="sm">PPA <b>' + r.pwa + '</b></span><span class="sm">SHG <b>' + r.shg + '</b></span><span class="sm">SHA <b>' + r.sha + '</b></span>' : "") + "</div></div>" +
          '<div class="pv">' + r.pts + "<small>PTS</small></div>" + '<div class="bar" aria-hidden="true"><i style="width:' + Math.round(r.pts / mxp * 100) + '%"></i></div></div>';
      }).join("") + (sorted.length ? "" : '<p class="empty">No players match.</p>') + moreBtn(sorted.length);
      out = '<div class="tiles">' + leaderTile(rows, "pts", "Points leader", all) + leaderTile(rows, "g", "Goals leader", all) + leaderTile(rows, "a", "Assists leader", all) + leaderTile(GK.filter(function (r) { return state.team === "ALL" || r.team === state.team; }), "w", "Goalie wins", all) + "</div>" +
        '<div class="mob">' + mobSk + '</div><div class="card desk"><div class="wrap">' + ptStartC(cols, cfg.key === "rank" ? { key: "pts", dir: -1 } : cfg) + "<tbody>" + (body || '<tr><td class="empty" colspan="22">No players match.</td></tr>') + "</tbody></table></div>" +
        '<div class="morerow">' + moreBtn(sorted.length) + '</div></div>';
    } else {
      var grows = filt(GK), gc = state.gk;
      var gcols = [["rank", "#", "rk"], ["name", "Goalie", "l stick"]].concat(all ? [["team", "Team", "l"]] : []).concat([["gp", "GP"], ["w", "W"], ["l", "L"], ["t", "T"], ["min", "MIN"], ["ga", "GA"], ["gaa", "GAA"], ["so", "SO"]]);
      var gs = sortRows(grows, gc.key === "rank" ? { key: "gaa", dir: 1 } : gc, function (x, y) { return y.gp - x.gp || x.name.localeCompare(y.name); });
      var gb = gs.slice(0, state.pm).map(function (r, i) {
        return '<tr class="' + (mine(r.team) && all ? "me" : "") + '"><td class="rk num">' + (i + 1) + '</td><td class="l strong stick">' + esc(r.name) + "</td>" + (all ? '<td class="l">' + tname(r.team) + "</td>" : "") +
          "<td>" + r.gp + "</td><td>" + r.w + "</td><td>" + r.l + "</td><td>" + r.t + "</td><td>" + f1(r.min) + "</td><td>" + r.ga + '</td><td class="strong">' + f2(r.gaa) + "</td><td>" + r.so + "</td></tr>";
      }).join("");
      var best = grows.filter(function (r) { return r.min >= 60; }).sort(function (a, b) { return a.gaa - b.gaa; })[0];
      var mw = grows.slice().sort(function (a, b) { return b.w - a.w; })[0];
      var ms = grows.slice().sort(function (a, b) { return b.so - a.so; })[0];
      var mobGk = msortCtlC(gc) + gs.slice(0, state.pm).map(function (r, i) {
        return '<div class="pc' + (mine(r.team) && all ? " me" : "") + '"><div class="r">' + (i + 1) + '</div><div class="pn"><b>' + esc(r.name) + '</b><span class="ps">' + (all ? badgeC(r.team) : "") + "<span>GP <b>" + r.gp + "</b></span><span>W-L-T <b>" + r.w + "-" + r.l + "-" + r.t + "</b></span><span>SO <b>" + r.so + "</b></span><span>GA <b>" + r.ga + "</b></span></span></div>" +
          '<div class="pv">' + f2(r.gaa) + "<small>GAA</small></div></div>";
      }).join("") + (gs.length ? "" : '<p class="empty">No goalies match.</p>') + moreBtn(gs.length);
      out = '<div class="tiles">' + (best ? tile("Best GAA", f2(best.gaa), esc(best.name) + (all ? " (" + best.team + ")" : "") + ", 60+ min") : tile("Best GAA", "–", "needs 60+ min")) +
        (mw ? tile("Most wins", mw.w, esc(mw.name) + (all ? " (" + mw.team + ")" : "")) : "") + (ms ? tile("Most shutouts", ms.so, esc(ms.name) + (all ? " (" + ms.team + ")" : "")) : "") + tile("Goalies", grows.length, "in this view") + "</div>" +
        '<div class="mob">' + mobGk + '</div><div class="card desk"><div class="wrap">' + ptStartC(gcols, gc.key === "rank" ? { key: "gaa", dir: 1 } : gc) + "<tbody>" + (gb || '<tr><td class="empty" colspan="22">No goalies match.</td></tr>') + "</tbody></table></div>" +
        '<div class="morerow">' + moreBtn(gs.length) + '</div><p class="note">GAA is goals against per 60 minutes in net. W, L and T are credited when one goalie played the whole game. Sheets do not record shots, so there is no save percentage.</p></div>';
    }
    var focusQ = document.activeElement && document.activeElement.id === "q";
    $("p-players").innerHTML = '<div class="sec-head"><div><h2>Players</h2></div></div>' +
      '<div style="display:flex;flex-direction:column;gap:16px;margin-top:16px">' + pvTools(tools, seg) + (state.pv === "cards" ? cardsHTML() : out + leadersHTML()) + "</div>";
    if (focusQ) { var el = $("q"); el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
  }
  function renderPlayers() {
    if (!OFFICIAL) return renderPlayersC();
    var all = state.team === "ALL", out = "";
    var seg = [["skaters", "Skaters"], ["goalies", "Goalies"]].map(function (x) { return '<button data-pt="' + x[0] + '" aria-pressed="' + (state.ptab === x[0]) + '">' + x[1] + "</button>"; }).join("");
    var tools = '<div class="tools"><div class="seg" role="group" aria-label="Player type">' + seg + '</div><input class="search" id="q" type="search" placeholder="Search a player" value="' + esc(state.q) + '" aria-label="Search players">' + '<button class="advbtn" data-adv aria-pressed="' + state.adv + '">' + (state.adv ? "Hide advanced" : "Advanced stats") + "</button></div>";
    if (state.ptab === "skaters") {
      var rows = filt(SK), cfg = state.sk;
      var cols = [["rank", "#", "rk"], ["name", "Player", "l stick"]].concat(all ? [["team", "Team", "l"]] : []).concat([["gp", "GP", "", "Games played"], ["g", "G", "", "Goals"], ["a", "A", "", "Assists"], ["pts", "PTS", "pts", "Points"], ["pgp", "P/GP", "", "Points per game"], ["pen", "PIM", "", "Penalty minutes"], ["ppg", "PPG", "grp", "Power-play goals"], ["ppa", "PPA", "", "Power-play assists"], ["ppp", "PPP", "", "Power-play points"], ["shg", "SHG", "grp", "Short-handed goals"], ["sha", "SHA", "", "Short-handed assists"], ["shp", "SHP", "", "Short-handed points"], ["gwg", "GWG", "grp", "Game-winning goals"], ["gtg", "GTG", "", "Game-tying goals"]]);
      var sorted = sortRows(rows, cfg.key === "rank" ? { key: "pts", dir: -1 } : cfg, function (x, y) { return y.pts - x.pts || y.g - x.g || x.name.localeCompare(y.name); });
      var body = sorted.slice(0, state.pm).map(function (r, i) {
        return '<tr class="' + (mine(r.team) && all ? "me" : "") + '"><td class="rk num">' + (i + 1) + '</td><td class="l strong stick">' + esc(r.name) + "</td>" + (all ? '<td class="l">' + tname(r.team) + "</td>" : "") +
          "<td>" + r.gp + "</td><td>" + r.g + "</td><td>" + r.a + '</td><td class="strong pts">' + r.pts + "</td><td>" + f2(r.pgp) + "</td><td>" + r.pen + '</td><td class="grp">' + r.ppg + "</td><td>" + r.ppa + "</td><td>" + r.ppp + '</td><td class="grp">' + r.shg + "</td><td>" + r.sha + "</td><td>" + r.shp + '</td><td class="grp">' + r.gwg + "</td><td>" + r.gtg + "</td></tr>";
      }).join("");
      var mxp = Math.max.apply(null, sorted.map(function (r) { return r.pts; }).concat([1]));
      var mobSk = msortCtl(cfg) + sorted.slice(0, state.pm).map(function (r, i) {
        return '<div class="pc' + (mine(r.team) && all ? " me" : "") + '"><div class="r">' + (i + 1) + '</div><div class="pn"><div class="pl"><b class="nm">' + esc(r.name) + '</b>' + (all ? badgeC(r.team) : "") + '</div><div class="pst"><span>GP <b>' + r.gp + '</b></span><span>G <b>' + r.g + '</b></span><span>A <b>' + r.a + '</b></span>' +
          (state.adv ? '<span class="sm">P/GP <b>' + f2(r.pgp) + '</b></span><span class="sm">PIM <b>' + r.pen + '</b></span><span class="sm">PPG <b>' + r.ppg + '</b></span><span class="sm">PPA <b>' + r.ppa + '</b></span><span class="sm">PPP <b>' + r.ppp + '</b></span><span class="sm">SHG <b>' + r.shg + '</b></span><span class="sm">SHA <b>' + r.sha + '</b></span><span class="sm">SHP <b>' + r.shp + '</b></span><span class="sm">GWG <b>' + r.gwg + '</b></span><span class="sm">GTG <b>' + r.gtg + '</b></span>' : "") + "</div></div>" +
          '<div class="pv">' + r.pts + "<small>PTS</small></div>" + '<div class="bar" aria-hidden="true"><i style="width:' + Math.round(r.pts / mxp * 100) + '%"></i></div></div>';
      }).join("") + (sorted.length ? "" : '<p class="empty">No players match.</p>') + moreBtn(sorted.length);
      out = '<div class="tiles">' + leaderTile(rows, "pts", "Points leader", all) + leaderTile(rows, "g", "Goals leader", all) + leaderTile(rows, "a", "Assists leader", all) + leaderTile(rows, "ppg", "Power-play goals", all) + "</div>" +
        '<div class="mob">' + mobSk + '</div><div class="card desk"><div class="wrap">' + ptStart(cols, cfg.key === "rank" ? { key: "pts", dir: -1 } : cfg) + "<tbody>" + (body || '<tr><td class="empty" colspan="18">No players match.</td></tr>') + "</tbody></table></div>" +
        '<div class="morerow">' + moreBtn(sorted.length) + '</div></div>';
    } else {
      var grows = filt(GK), gc = state.gk;
      var gcols = [["rank", "#", "rk"], ["name", "Goalie", "l stick"]].concat(all ? [["team", "Team", "l"]] : []).concat([["gp", "GP", "", "Games played"], ["gs", "GS", "", "Games started"], ["w", "W", "", "Wins"], ["l", "L", "", "Losses"], ["t", "OTL", "", "Overtime and shootout losses"], ["wpct", "W%", "", "Win percentage"], ["min", "MIN", "", "Minutes played"], ["ga", "GA", "", "Goals against"], ["gaa", "GAA", "", "Goals against per 45-minute game"], ["so", "SO", "", "Shutouts"]]);
      var gdef = function (x, y) { return y.gp - x.gp || x.name.localeCompare(y.name); };
      var gs = sortRows(grows, gc.key === "rank" ? { key: "gaa", dir: 1 } : gc, gdef);
      if (gc.key === "gaa" || gc.key === "rank") gs = gs.filter(function (r) { return r.gp >= MINGP_GK; }).concat(gs.filter(function (r) { return r.gp < MINGP_GK; }));
      var gb = gs.slice(0, state.pm).map(function (r, i) {
        return '<tr class="' + (mine(r.team) && all ? "me" : "") + '"><td class="rk num">' + (i + 1) + '</td><td class="l strong stick">' + esc(r.name) + "</td>" + (all ? '<td class="l">' + tname(r.team) + "</td>" : "") +
          "<td>" + r.gp + "</td><td>" + r.gs + "</td><td>" + r.w + "</td><td>" + r.l + "</td><td>" + r.t + "</td><td>" + f3(r.wpct) + "</td><td>" + f1(r.min) + "</td><td>" + r.ga + '</td><td class="strong">' + f2(r.gaa) + "</td><td>" + r.so + "</td></tr>";
      }).join("");
      var qual = grows.filter(function (r) { return r.gp >= MINGP_GK; });
      var best = qual.slice().sort(function (a, b) { return a.gaa - b.gaa; })[0];
      var mw = grows.slice().sort(function (a, b) { return b.w - a.w; })[0];
      var ms = grows.slice().sort(function (a, b) { return b.so - a.so; })[0];
      var mobGk = msortCtl(gc) + gs.slice(0, state.pm).map(function (r, i) {
        return '<div class="pc' + (mine(r.team) && all ? " me" : "") + '"><div class="r">' + (i + 1) + '</div><div class="pn"><div class="pl"><b class="nm">' + esc(r.name) + '</b>' + (all ? badgeC(r.team) : "") + '</div><div class="pst"><span>GP <b>' + r.gp + '</b></span><span>W-L-OTL <b>' + r.w + "-" + r.l + "-" + r.t + '</b></span><span>SO <b>' + r.so + '</b></span>' +
          (state.adv ? '<span class="sm">GS <b>' + r.gs + '</b></span><span class="sm">GA <b>' + r.ga + '</b></span><span class="sm">W% <b>' + f3(r.wpct) + '</b></span><span class="sm">MIN <b>' + f1(r.min) + '</b></span>' : "") + "</div></div>" +
          '<div class="pv">' + f2(r.gaa) + "<small>GAA</small></div></div>";
      }).join("") + (gs.length ? "" : '<p class="empty">No goalies match.</p>') + moreBtn(gs.length);
      out = '<div class="tiles">' + (best ? tile("Best GAA", f2(best.gaa), esc(best.name) + (all ? " (" + best.team + ")" : "") + ", min " + MINGP_GK + " GP") : tile("Best GAA", "–", "needs " + MINGP_GK + " GP")) +
        (mw ? tile("Most wins", mw.w, esc(mw.name) + (all ? " (" + mw.team + ")" : "")) : "") + (ms ? tile("Most shutouts", ms.so, esc(ms.name) + (all ? " (" + ms.team + ")" : "")) : "") + tile("Goalies", grows.length, "in this view") + "</div>" +
        '<div class="mob">' + mobGk + '</div><div class="card desk"><div class="wrap">' + ptStart(gcols, gc.key === "rank" ? { key: "gaa", dir: 1 } : gc) + "<tbody>" + (gb || '<tr><td class="empty" colspan="13">No goalies match.</td></tr>') + "</tbody></table></div>" +
        '<div class="morerow">' + moreBtn(gs.length) + '</div><p class="note">GAA is goals against per 45-minute game. W% is wins divided by games played. GAA sorts goalies with fewer than ' + MINGP_GK + " games last. Shots against and save percentage are not in the league stats. Official goalie stats through " + dlong(AS_OF) + ", plus game sheets through " + dlong(DATA_THROUGH) + ".</p></div>";
    }
    var focusQ = document.activeElement && document.activeElement.id === "q";
    $("p-players").innerHTML = '<div class="sec-head"><div><h2>Players</h2></div></div>' +
      '<div style="display:flex;flex-direction:column;gap:16px;margin-top:16px">' + pvTools(tools, seg) + (state.pv === "cards" ? cardsHTML() : out + leadersHTML()) + "</div>";
    if (focusQ) { var el = $("q"); el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
  }

  /* ---------- team pages ---------- */
  function recOf(list) {
    var w = 0, tt = 0, l = 0;
    list.forEach(function (x) { if (x.r === "W") w++; else if (x.r === "T") tt++; else l++; });
    return w + "-" + tt + "-" + l;
  }
  function renderTeamsC() {
    var el = $("p-teams");
    if (state.team === "ALL") {
      el.innerHTML = '<div class="sec-head"><div><h2>Teams</h2><p class="lede">Pick a team to see its roster, results and upcoming games.</p></div></div><div class="teamgrid" style="margin-top:16px">' +
        ORDER.map(function (t) {
          var s = ST[t];
          return '<button class="tcard" data-team="' + t + '">' + badge(t, 1) + '<span class="tc-n">' + esc(TEAMS[t]) + '</span><span class="tc-r">' + ord(s.rank) + " · " + s.w + "-" + s.tie + "-" + s.l + " · " + s.pts + " PTS</span></button>";
        }).join("") + "</div>";
      return;
    }
    var t = state.team, s = ST[t], rs = results(t), ng = nextGame(t);
    var hr = recOf(rs.filter(function (x) { return x.home; })), ar = recOf(rs.filter(function (x) { return !x.home; }));
    var head = '<div class="card thead"><div class="thl">' + badge(t, 1) + '<div><h2 class="tname">' + esc(TEAMS[t]) + '</h2><div class="sub">' + ord(s.rank) + " in the conference · " + s.w + "-" + s.tie + "-" + s.l + " · " + s.pts + ' PTS</div><div class="sub">Last 5 ' + formChips(t, 5) + " · Streak " + streakOf(t) + "</div></div></div>" +
      '<div class="thr">' + (ng ? '<span class="sub">Next game</span><b>' + when(ng) + "</b><span>" + (ng.h === t ? "vs " + esc(TEAMS[ng.a]) : "at " + esc(TEAMS[ng.h])) + '</span><button class="btn pri" data-open="' + ng.id + '">Matchup preview</button>' : "") +
      '<button class="btn" data-allteams="1">All teams</button></div></div>';
    var tiles = '<div class="tiles">' + tile("Points %", s.pct, ord(RK.pctn[t]) + " in the conference") + tile("Goals for / GP", f2(s.gfg), ord(RK.gfg[t]) + " · " + s.gf + " total") + tile("Goals against / GP", f2(s.gag), ord(RK.gag[t]) + " fewest · " + s.ga + " total") +
      tile("Home record", hr, "W-T-L") + tile("Away record", ar, "W-T-L") + tile("PIM / GP", f1(s.pimg), ord(RK.pimg[t]) + " fewest · " + s.pim + " min") + "</div>";
    var sks = SK.filter(function (r) { return r.team === t; }).sort(function (a, b) { return b.pts - a.pts || b.g - a.g || a.name.localeCompare(b.name); });
    var gks = GK.filter(function (r) { return r.team === t; }).sort(function (a, b) { return b.min - a.min; });
    var skT = '<div class="card"><div class="wrap"><table class="rt"><thead><tr><th class="l stick">Skater</th><th>GP</th><th>G</th><th>A</th><th>PTS</th><th>P/GP</th><th>PIM</th></tr></thead><tbody>' + sks.map(function (r) {
      return '<tr><td class="l strong stick">' + esc(r.name) + "</td><td>" + r.gp + "</td><td>" + r.g + "</td><td>" + r.a + '</td><td class="strong">' + r.pts + "</td><td>" + f2(r.ppg) + "</td><td>" + r.pen + "</td></tr>";
    }).join("") + "</tbody></table></div></div>";
    var gkT = '<div class="card"><div class="wrap"><table class="rt"><thead><tr><th class="l stick">Goalie</th><th>GP</th><th>W-L-T</th><th>MIN</th><th>GA</th><th>GAA</th><th>SO</th></tr></thead><tbody>' + gks.map(function (r) {
      return '<tr><td class="l strong stick">' + esc(r.name) + "</td><td>" + r.gp + "</td><td>" + r.w + "-" + r.l + "-" + r.t + "</td><td>" + f1(r.min) + "</td><td>" + r.ga + '</td><td class="strong">' + f2(r.gaa) + "</td><td>" + r.so + "</td></tr>";
    }).join("") + "</tbody></table></div></div>";
    var resL = rs.slice().reverse().map(function (x) {
      return '<div class="trow"><span class="tdt">' + dshort(x.g.date) + '</span><span class="to">' + (x.home ? "vs " : "at ") + tname(x.opp) + '</span><span class="tres ' + x.r + '"><b>' + x.r + "</b> " + x.us + "–" + x.them + "</span></div>";
    }).join("") || '<p class="empty">No games played yet.</p>';
    var upL = UPCOMING.filter(function (g) { return g.a === t || g.h === t; }).map(function (g) {
      var home = g.h === t, opp = home ? g.a : g.h;
      return '<div class="trow up"><span class="tdt">' + dshort(g.date) + (g.time === "TBD" ? "" : "<small>" + g.time + "</small>") + '</span><span class="to">' + (home ? "vs " : "at ") + tname(opp) + "<small>" + esc(g.venue) + '</small></span><button class="btn" data-open="' + g.id + '">Preview</button></div>';
    }).join("") || '<p class="empty">No games left on the schedule.</p>';
    el.innerHTML = head + '<div style="display:flex;flex-direction:column;gap:16px;margin-top:16px">' + tiles +
      '<div class="tgrid"><div class="tcol"><h3>Skaters</h3>' + skT + "<h3>Goalies</h3>" + gkT + '<p class="mfoot">Counted from game sheets. PIM assumes 2 minutes per penalty.</p></div>' +
      '<div class="tcol"><h3>Results</h3><div class="card tlist">' + resL + "</div><h3>Upcoming</h3><div class=\"card tlist\">" + upL + "</div></div></div></div>";
  }
  function renderTeams() {
    if (!OFFICIAL) return renderTeamsC();
    var el = $("p-teams");
    if (state.team === "ALL") {
      el.innerHTML = '<div class="sec-head"><div><h2>Teams</h2><p class="lede">Pick a team to see its roster, results and upcoming games.</p></div></div><div style="margin-top:16px">' +
        curDivs().map(function (d) { return '<h3 class="divh">' + esc(d.name) + '</h3><div class="teamgrid">' + d.teams.map(function (t) {
          var s = ST[t];
          return '<button class="tcard" data-team="' + t + '">' + badge(t, 1) + '<span class="tc-n">' + esc(TEAMS[t]) + '</span><span class="tc-r">' + ord(s.rank) + " · " + rec(s) + " · " + (s.pend ? "–" : s.pts) + " PTS</span></button>";
        }).join("") + "</div>"; }).join("") + "</div>";
      return;
    }
    var t = state.team, s = ST[t], rs = results(t), ng = nextGame(t);
    var hr = recOf(rs.filter(function (x) { return x.home; })), ar = recOf(rs.filter(function (x) { return !x.home; }));
    var head = '<div class="card thead"><div class="thl">' + badge(t, 1) + '<div><h2 class="tname">' + esc(TEAMS[t]) + '</h2><div class="sub">' + ord(s.rank) + " in the " + GROUP + " · " + rec(s) + " · " + (s.pend ? "–" : s.pts) + ' PTS</div><div class="sub">Last 5 ' + formChips(t, 5) + " · Streak " + streakOf(t) + "</div></div></div>" +
      '<div class="thr">' + (ng ? '<span class="sub">Next game</span><b>' + when(ng) + "</b><span>" + (ng.h === t ? "vs " + esc(TEAMS[ng.a]) : "at " + esc(TEAMS[ng.h])) + '</span><button class="btn pri" data-open="' + ng.id + '">Matchup preview</button>' : "") +
      '<button class="btn" data-allteams="1">All teams</button></div></div>';
    var tiles = '<div class="tiles">' + tile("Points %", s.pct, ord(RK.pctn[t]) + " in the " + GROUP) + tile("Goals for / GP", f2(s.gfg), ord(RK.gfg[t]) + " · " + s.gf + " total") + tile("Goals against / GP", f2(s.gag), ord(RK.gag[t]) + " fewest · " + s.ga + " total") +
      tile("Home record", hr, "W-L-OTL") + tile("Away record", ar, "W-L-OTL") + tile("PIM / GP", f1(s.pimg), ord(RK.pimg[t]) + " fewest · " + s.pim + " min") + "</div>";
    var sks = SK.filter(function (r) { return r.team === t; }).sort(function (a, b) { return b.pts - a.pts || b.g - a.g || a.name.localeCompare(b.name); });
    var gks = GK.filter(function (r) { return r.team === t; }).sort(function (a, b) { return b.min - a.min; });
    var skT = '<div class="card"><div class="wrap"><table class="rt"><thead><tr><th class="l stick">Skater</th><th>GP</th><th>G</th><th>A</th><th>PTS</th><th>P/GP</th><th>PIM</th><th class="grp">PPG</th><th>PPA</th><th>PPP</th><th class="grp">SHG</th><th>SHA</th><th>SHP</th><th class="grp">GWG</th><th>GTG</th></tr></thead><tbody>' + sks.map(function (r) {
      return '<tr><td class="l strong stick">' + esc(r.name) + "</td><td>" + r.gp + "</td><td>" + r.g + "</td><td>" + r.a + '</td><td class="strong">' + r.pts + "</td><td>" + f2(r.pgp) + "</td><td>" + r.pen + '</td><td class="grp">' + r.ppg + "</td><td>" + r.ppa + "</td><td>" + r.ppp + '</td><td class="grp">' + r.shg + "</td><td>" + r.sha + "</td><td>" + r.shp + '</td><td class="grp">' + r.gwg + "</td><td>" + r.gtg + "</td></tr>";
    }).join("") + "</tbody></table></div></div>";
    var gkT = '<div class="card"><div class="wrap"><table class="rt"><thead><tr><th class="l stick">Goalie</th><th>GP</th><th>GS</th><th>W-L-OTL</th><th>W%</th><th>MIN</th><th>GA</th><th>GAA</th><th>SO</th></tr></thead><tbody>' + gks.map(function (r) {
      return '<tr><td class="l strong stick">' + esc(r.name) + "</td><td>" + r.gp + "</td><td>" + r.gs + "</td><td>" + r.w + "-" + r.l + "-" + r.t + "</td><td>" + f3(r.wpct) + "</td><td>" + f1(r.min) + "</td><td>" + r.ga + '</td><td class="strong">' + f2(r.gaa) + "</td><td>" + r.so + "</td></tr>";
    }).join("") + "</tbody></table></div></div>";
    var resL = rs.slice().reverse().map(function (x) {
      return '<div class="trow"><span class="tdt">' + dshort(x.g.date) + '</span><span class="to">' + (x.home ? "vs " : "at ") + tname(x.opp) + '</span><span class="tres ' + x.r + '"><b>' + x.r + "</b> " + x.us + "–" + x.them + "</span></div>";
    }).join("") || '<p class="empty">No games played yet.</p>';
    var upL = UPCOMING.filter(function (g) { return g.a === t || g.h === t; }).map(function (g) {
      var home = g.h === t, opp = home ? g.a : g.h;
      return '<div class="trow up"><span class="tdt">' + dshort(g.date) + (g.time === "TBD" ? "" : "<small>" + g.time + "</small>") + '</span><span class="to">' + (home ? "vs " : "at ") + tname(opp) + "<small>" + esc(g.venue) + '</small></span><button class="btn" data-open="' + g.id + '">Preview</button></div>';
    }).join("") || '<p class="empty">No games left on the schedule.</p>';
    el.innerHTML = head + '<div style="display:flex;flex-direction:column;gap:16px;margin-top:16px">' + tiles +
      '<div class="tgrid"><div class="tcol"><h3>Skaters</h3>' + skT + "<h3>Goalies</h3>" + gkT + '<p class="mfoot">PIM is penalty minutes. PP is power play, SH is short-handed, GWG is game-winning goals. Official player stats through ' + dlong(AS_OF) + ", plus game sheets through " + dlong(DATA_THROUGH) + '.</p></div>' +
      '<div class="tcol"><h3>Results</h3><div class="card tlist">' + resL + "</div><h3>Upcoming</h3><div class=\"card tlist\">" + upL + "</div></div></div></div>";
  }

  /* ---------- matchups ---------- */
  function cmpRow(label, va, vh, fa, fh, mode) {
    var lead = va === vh ? 0 : ((mode !== "low") === (va > vh) ? 1 : 2), share;
    if (mode === "diff") share = (va + 5) / (va + vh + 10);
    else if (va + vh === 0) share = 0.5;
    else share = mode === "high" ? va / (va + vh) : vh / (va + vh);
    share = Math.min(0.92, Math.max(0.08, share));
    return '<div class="cmp"><div class="cv a' + (lead === 1 ? " lead" : "") + '">' + fa + '</div><div class="cl">' + label + '</div><div class="cv h' + (lead === 2 ? " lead" : "") + '">' + fh + '</div><div class="track" aria-hidden="true"><i style="width:' + (share * 100).toFixed(1) + '%"></i></div></div>';
  }
  function watch(t) {
    var sk3 = topSkaters(t, 3), gl = topGoalie(t);
    return "<div><h4>" + esc(SHORT[t]) + "</h4><ul>" + sk3.map(function (r) { return "<li><span>" + esc(r.name) + "</span><small>" + r.g + "G " + r.a + "A · <b>" + r.pts + " P</b></small></li>"; }).join("") +
      (gl ? "<li><span>" + esc(gl.name) + "</span><small>Goalie · " + f2(gl.gaa) + " GAA, " + gl.gp + " GP</small></li>" : "") + "</ul></div>";
  }
  function seriesBlock(g) {
    var between = GAMES.filter(function (x) { return (x.a === g.a && x.h === g.h) || (x.a === g.h && x.h === g.a); });
    var done = between.filter(function (x) { return x.played; }), left = between.filter(function (x) { return !x.played; });
    var items = done.map(function (x) {
      var aw = x.sa > x.sh;
      return "<li><span>" + dshort(x.date) + "</span><span>" + (aw ? "<b>" : "") + SHORT[x.a] + " " + x.sa + (aw ? "</b>" : "") + " at " + (!aw && x.sh > x.sa ? "<b>" : "") + SHORT[x.h] + " " + x.sh + (!aw && x.sh > x.sa ? "</b>" : "") + "</span></li>";
    }).join("");
    var other = left.filter(function (x) { return x.id !== g.id; });
    return "<h4>Season series</h4>" + (items ? "<ul>" + items + "</ul>" : "<p>No meetings yet. This is their first game against each other.</p>") +
      '<p style="margin-top:8px;color:var(--mute);font-size:13px">' + (other.length ? "Also scheduled: " + other.map(function (x) { return dshort(x.date); }).join(", ") + "." : "This is their only scheduled meeting.") + "</p>";
  }
  var TOTGF = ORDER.reduce(function (s, t) { return s + ST[t].gf; }, 0), TOTGP = ORDER.reduce(function (s, t) { return s + ST[t].gp; }, 0);
  /* Win-prediction model v2.
   Inputs: played games [{id,date,a,h,sa,sh}], game sheets [{id,a,h,s,d,g,k}], team codes.
   Pure function, no DOM. predict(a, h) -> {a,h,t (percent), la, lh, parts}. */
function makeModel(played, sheets, teams, opt) {
  var o = { hl: 28, k: 3, kp: 4, kg: 58, beta: 0.3, kfac: 24, h2h: 0.06, lin: 1, gkw: 1, ha: 0, tp: 10, tprior: 0.1, sh: 0 };
  for (var q in (opt || {})) o[q] = opt[q];
  var DAY = function (s) { return Date.parse(s + "T12:00:00Z") / 864e5; };
  var gs = played.slice().sort(function (x, y) { return x.date < y.date ? -1 : x.date > y.date ? 1 : x.id - y.id; });
  var ref = gs.length ? DAY(gs[gs.length - 1].date) : 0;
  if (o.ref) ref = o.ref;
  var wt = function (g) { return Math.pow(0.5, Math.max(0, ref - DAY(g.date)) / o.hl); };
  gs.forEach(function (g) { g.w = wt(g); });
  var n = {}, i;
  teams.forEach(function (t) { n[t] = gs.filter(function (g) { return g.a === t || g.h === t; }).length; });

  /* 1. opponent-adjusted, recency-weighted Poisson ratings (attack / defence), shrunk to the league mean */
  var sw = 0, sg = 0;
  gs.forEach(function (g) { sw += g.w; sg += g.w * (g.sa + g.sh); });
  var LG = sw ? sg / (2 * sw) : 4;
  var nt = 0;
  gs.forEach(function (g) { if (g.sa === g.sh) nt++; });
  var TIE = (nt + o.tp * o.tprior) / (gs.length + o.tp);
  var att = {}, def = {};
  teams.forEach(function (t) { att[t] = 1; def[t] = 1; });
  for (var it = 0; it < 40; it++) {
    var na = {}, nd = {};
    teams.forEach(function (t) {
      var a1 = o.k * LG, a2 = o.k * LG, d1 = o.k * LG, d2 = o.k * LG;
      gs.forEach(function (g) {
        if (g.a !== t && g.h !== t) return;
        var gf = g.a === t ? g.sa : g.sh, ga = g.a === t ? g.sh : g.sa, op = g.a === t ? g.h : g.a;
        a1 += g.w * gf; a2 += g.w * LG * def[op];
        d1 += g.w * ga; d2 += g.w * LG * att[op];
      });
      na[t] = a1 / a2; nd[t] = d1 / d2;
    });
    var ma = 0, md = 0;
    teams.forEach(function (t) { ma += na[t]; md += nd[t]; });
    ma /= teams.length; md /= teams.length;
    teams.forEach(function (t) { att[t] = na[t] / ma; def[t] = nd[t] / md; });
  }

  /* 2. lineup and goalie layer from the game sheets */
  var sheetOf = {};
  sheets.forEach(function (s) { sheetOf[s.id] = s; });
  var info = {};
  teams.forEach(function (t) {
    var tg = gs.filter(function (g) { return (g.a === t || g.h === t) && sheetOf[g.id]; });
    var sk = {}, gk = {}, TW = 0, V = 0, GPW = 0, lastD = null, lastG = null, mins = 0, gaw = 0;
    tg.forEach(function (g) {
      var s = sheetOf[g.id], w = g.w, d = s.d[t].split(" ");
      TW += w;
      d.forEach(function (k) { (sk[k] = sk[k] || { gp: 0, v: 0 }).gp += w; GPW += w; });
      s.g.forEach(function (x) {
        if (x[0] !== t) return;
        if (x[1] && sk[x[1]]) { sk[x[1]].v += w; V += w; }
        for (var j = 2; j < x.length; j++) if (sk[x[j]]) { sk[x[j]].v += 0.5 * w; V += 0.5 * w; }
      });
      lastD = d;
      var gl = s.k.filter(function (x) { return x[0] === t && x[2] > 0; });
      gl.forEach(function (x) {
        var r = gk[x[1]] || (gk[x[1]] = { min: 0, ga: 0 });
        r.min += w * x[2]; r.ga += w * x[3]; mins += w * x[2]; gaw += w * x[3];
      });
      if (gl.length) lastG = gl.slice().sort(function (p, q2) { return q2[2] - p[2]; })[0][1];
    });
    var rt = GPW ? V / GPW : 0, lin = 1, gf = 1;
    if (TW && lastD && rt > 0) {
      var base = 0, nxt = 0;
      Object.keys(sk).forEach(function (k) {
        var r = (sk[k].v + o.kp * rt) / (sk[k].gp + o.kp), p = sk[k].gp / TW, pn = 0.6 * (lastD.indexOf(k) >= 0 ? 1 : 0) + 0.4 * p;
        base += p * r; nxt += pn * r;
      });
      if (base > 0) lin = Math.max(0.88, Math.min(1.12, nxt / base));
    }
    var gpm = mins ? gaw / mins : 0;
    if (gpm > 0 && lastG) {
      var m0 = o.kg, rate = function (r) { return (r.ga + m0 * gpm) / (r.min + m0); };
      var blend = 0, hist = 0;
      Object.keys(gk).forEach(function (k) {
        var share = gk[k].min / mins, p = 0.6 * (k === lastG ? 1 : 0) + 0.4 * share;
        blend += p * rate(gk[k]); hist += share * rate(gk[k]);
      });
      if (hist > 0) gf = Math.max(0.88, Math.min(1.12, blend / hist));
    }
    info[t] = { lin: lin, gk: gf, goalie: lastG };
  });

  /* 3. Elo style power ranking */
  var elo = {};
  teams.forEach(function (t) { elo[t] = 1500; });
  gs.forEach(function (g) {
    var e = 1 / (1 + Math.pow(10, (elo[g.h] - elo[g.a]) / 400)), r = g.sa > g.sh ? 1 : g.sa < g.sh ? 0 : 0.5, d = Math.abs(g.sa - g.sh);
    var mv = Math.log(d + 1) + 1, dl = o.kfac * mv * (r - e);
    elo[g.a] += dl; elo[g.h] -= dl;
  });

  function pois(l) { var p = [Math.exp(-l)]; for (var i2 = 1; i2 <= 20; i2++) p[i2] = p[i2 - 1] * l / i2; return p; }
  function predict(a, h) {
    /* head to head history between the two clubs */
    var hm = 0, hn = 0;
    gs.forEach(function (g) {
      if ((g.a === a && g.h === h) || (g.a === h && g.h === a)) { hn++; hm += (g.a === a ? g.sa - g.sh : g.sh - g.sa); }
    });
    var x = hn ? o.h2h * (hn / (hn + 2)) * Math.tanh(hm / hn / LG) * 2 : 0;
    var la = LG * att[a] * def[h] * Math.pow(info[a].lin, o.lin) * Math.pow(info[h].gk, o.gkw) * Math.exp(x);
    var lh = LG * att[h] * def[a] * Math.pow(info[h].lin, o.lin) * Math.pow(info[a].gk, o.gkw) * Math.exp(-x);
    var pa = pois(la), ph = pois(lh), w = 0, tt = 0, l = 0;
    for (var i3 = 0; i3 <= 20; i3++) for (var j = 0; j <= 20; j++) { var p = pa[i3] * ph[j]; if (i3 > j) w += p; else if (i3 === j) tt += p; else l += p; }
    var s = w + l; var ptie = TIE; w = (1 - ptie) * w / s; l = (1 - ptie) * l / s; tt = ptie;
    if (o.sh) { w = (1 - o.sh) * w + o.sh * (1 - tt) / 2; l = (1 - o.sh) * l + o.sh * (1 - tt) / 2; }
    var e = 1 / (1 + Math.pow(10, (elo[h] - elo[a]) / 400));
    var wa = (1 - o.beta) * w + o.beta * (1 - tt) * e, wh = (1 - o.beta) * l + o.beta * (1 - tt) * (1 - e);
    var A = Math.round(wa * 100), H = Math.round(wh * 100);
    return { a: A, h: H, t: 100 - A - H, pa: wa, ph: wh, pt: tt, la: la, lh: lh, elo: [elo[a], elo[h]], h2h: { n: hn, m: hn ? hm / hn : 0 }, info: [info[a], info[h]], att: [att[a], att[h]], def: [def[a], def[h]], LG: LG };
  }
  return { predict: predict, elo: elo, att: att, def: def, info: info, LG: LG, games: n };
}

  var MODEL = makeModel(PLAYED.map(function (g) { return { id: g.id, date: g.date, a: g.a, h: g.h, sa: g.sa, sh: g.sh }; }), G, ORDER);
  var ELORANK = ORDER.slice().sort(function (x, y) { return MODEL.elo[y] - MODEL.elo[x]; });
  function winProb(a, h) { var p = MODEL.predict(a, h); return { a: p.a, h: p.h, t: p.t, la: p.la, lh: p.lh, full: p }; }
  function pctDiff(x) { var d = Math.round((x - 1) * 100); return (d > 0 ? "+" : "") + d + "%"; }
  function modelNotes(g, wp) {
    var p = wp.full, A = SHORT[g.a], H = SHORT[g.h], li = [], hid = [], gp = Math.min(ST[g.a].gp, ST[g.h].gp);
    hid.push("<li><b>Ratings.</b> Opponent-adjusted scoring (1.00 is league average, higher attack and lower defence are better): " + esc(A) + " attack " + p.att[0].toFixed(2) + ", defence " + p.def[0].toFixed(2) + "; " + esc(H) + " attack " + p.att[1].toFixed(2) + ", defence " + p.def[1].toFixed(2) + ". Recent games count more, with a four week half-life.</li>");
    hid.push("<li><b>Power ranking.</b> " + esc(A) + " " + ord(ELORANK.indexOf(g.a) + 1) + " (" + Math.round(p.elo[0]) + "), " + esc(H) + " " + ord(ELORANK.indexOf(g.h) + 1) + " (" + Math.round(p.elo[1]) + "). An Elo style rating that rewards beating strong teams and bigger margins.</li>");
    [[g.a, 0], [g.h, 1]].forEach(function (x) {
      var inf = p.info[x[1]], t = x[0], bits = [];
      if (Math.abs(inf.lin - 1) >= 0.02) bits.push("its last lineup scores about " + pctDiff(inf.lin).replace("-", "") + (inf.lin > 1 ? " more" : " less") + " than its usual group");
      if (inf.goalie && Math.abs(inf.gk - 1) >= 0.02) bits.push("goalie " + esc(nm(t, inf.goalie)) + " has allowed " + (inf.gk < 1 ? "fewer" : "more") + " goals than the team's goalie average");
      else if (inf.goalie) bits.push("goalie " + esc(nm(t, inf.goalie)) + " started last");
      if (bits.length) { var txt = bits.join("; "); hid.push("<li><b>" + esc(SHORT[t]) + " players.</b> " + txt.charAt(0).toUpperCase() + txt.slice(1) + ".</li>"); }
    });
    if (p.h2h.n) { var m = p.h2h.m; li.push("<li><b>Head to head.</b> " + (p.h2h.n === 1 ? "They have met once" : "They have met " + p.h2h.n + " times") + " this season: " + (m === 0 ? "even" : esc(m > 0 ? A : H) + " by " + Math.abs(Math.round(m * 10) / 10) + " goal" + (Math.abs(m) === 1 ? "" : "s") + " per game") + ". Used lightly.</li>"); }
    li.push("<li><b>Confidence.</b> " + (gp < 6 ? "Low" : gp < 9 ? "Moderate" : "Good") + ". The fewest games played is " + gp + ", so one result can move these numbers.</li>");
    var det = '<details class="mdet"><summary><span class="show">Show model details</span><span class="hide">Hide model details</span></summary><p class="wpx">Projected score: ' + esc(A) + " " + f1(wp.la) + ", " + esc(H) + " " + f1(wp.lh) + ". Win chances blend a Poisson goal model (70%) with the power ranking (30%). Ties are possible but rare in this league.</p>" + '<ul class="mf">' + hid.join("") + "</ul></details>";
    return det + '<ul class="mf">' + li.join("") + "</ul>";
  }
  function favLine(g, wp) {
    var d = wp.a - wp.h;
    return Math.abs(d) < 10 ? "Close game" : (d > 0 ? SHORT[g.a] + " favoured · " + wp.a + "%" : SHORT[g.h] + " favoured · " + wp.h + "%");
  }

  /* ---------- coach scouting (rule based, from the table and game sheets) ---------- */
  var PROF = {};
  function profile(t) {
    if (PROF[t]) return PROF[t];
    var N = DIVS[0].teams.length, rs = results(t), st = ST[t], out = { t: t, str: [], weak: [] };
    var tops = topSkaters(t, 3), all = SK.filter(function (r) { return r.team === t; }), tg = 0;
    all.forEach(function (r) { tg += r.g; });
    var scorers = all.filter(function (r) { return r.g > 0; }).length;
    var top2 = tops.slice(0, 2).reduce(function (a, r) { return a + r.g + r.a; }, 0);
    var allpts = all.reduce(function (a, r) { return a + r.g + r.a; }, 0);
    var share = allpts ? top2 / allpts : 0;
    var l5 = rs.slice(-5), l5w = l5.filter(function (x) { return x.r === "W"; }).length, l5l = l5.filter(function (x) { return x.r === "L"; }).length;
    var close = rs.filter(function (x) { return Math.abs(x.us - x.them) <= 1; }), cw = close.filter(function (x) { return x.us > x.them; }).length;
    var blow = rs.filter(function (x) { return x.them - x.us >= 4; }).length;
    var gl = topGoalie(t), lgGAA = 0, ng = 0;
    GK.forEach(function (r) { if (r.min >= 60) { lgGAA += r.gaa; ng++; } }); lgGAA = ng ? lgGAA / ng : 0;
    var rk = RK, top = N <= 6 ? 2 : 3, bot = N - top + 1;
    function add(arr, key, txt, hint) { arr.push({ k: key, txt: txt, hint: hint }); }
    if (rk.gfg[t] <= top) add(out.str, "off", "<b>Offence.</b> " + f2(st.gfg) + " goals per game, " + ord(rk.gfg[t]) + " in the " + GROUP + ".", "off");
    if (rk.gfg[t] >= bot) add(out.weak, "off", "<b>Scoring.</b> Only " + f2(st.gfg) + " goals per game, " + ord(rk.gfg[t]) + " of " + N + ".", "off");
    if (rk.gag[t] <= top) add(out.str, "def", "<b>Defence.</b> Allows " + f2(st.gag) + " per game, " + ord(rk.gag[t]) + " fewest.", "def");
    if (rk.gag[t] >= bot) add(out.weak, "def", "<b>Defence.</b> Allows " + f2(st.gag) + " per game, " + ord(rk.gag[t]) + " of " + N + ". Chances against are getting through.", "def");
    if (gl && gl.gp >= 3 && lgGAA) {
      if (gl.gaa <= lgGAA * 0.85) add(out.str, "gk", "<b>Goaltending.</b> " + esc(gl.name) + " has a " + f2(gl.gaa) + " GAA over " + gl.gp + " games" + (gl.so ? " with " + gl.so + " shutout" + (gl.so > 1 ? "s" : "") : "") + ".", "gk");
      else if (gl.gaa >= lgGAA * 1.15) add(out.weak, "gk", "<b>Goaltending.</b> " + esc(gl.name) + " is at " + f2(gl.gaa) + " GAA, above the league average of " + f2(lgGAA) + ".", "gk");
    }
    if (rk.pimg[t] <= top) add(out.str, "pim", "<b>Discipline.</b> " + f1(st.pimg) + " penalty minutes per game, " + ord(rk.pimg[t]) + " cleanest.", "pim");
    if (rk.pimg[t] >= bot) add(out.weak, "pim", "<b>Discipline.</b> " + f1(st.pimg) + " penalty minutes per game, " + ord(rk.pimg[t]) + " of " + N + ". Power plays for the opponent are likely.", "pim");
    if (l5.length >= 4) {
      if (l5w >= 4) add(out.str, "form", "<b>Form.</b> " + l5w + " wins in the last " + l5.length + " games.", "form");
      if (l5l >= 3) add(out.weak, "form", "<b>Form.</b> " + l5l + " losses in the last " + l5.length + " games.", "form");
    }
    if (tg >= 12 && scorers >= 8) add(out.str, "dep", "<b>Depth.</b> " + scorers + " different players have scored, so no single line to shut down.", "dep");
    if (tg >= 12 && share >= 0.5) add(out.weak, "dep", "<b>Reliance on two players.</b> " + esc(tops[0].name) + " and " + esc(tops[1].name) + " are involved in " + Math.round(share * 100) + "% of the points on record.", "rely");
    if (close.length >= 3) {
      if (cw / close.length >= 0.67) add(out.str, "cls", "<b>Close games.</b> " + cw + " wins in " + close.length + " one-goal games.", "cls");
      else if (cw / close.length <= 0.25) add(out.weak, "cls", "<b>Close games.</b> Only " + cw + " wins in " + close.length + " one-goal games.", "cls");
    }
    if (blow >= 2) add(out.weak, "blow", "<b>Lopsided losses.</b> Beaten by 4 or more goals " + blow + " times.", "blow");
    out.tops = tops; out.gl = gl; out.share = share; out.l5 = l5; out.rs = rs;
    return (PROF[t] = out);
  }
  function keysFor(a, h) {
    var A = profile(a), H = profile(h), k = [], sa = SHORT[a], sh = SHORT[h];
    var has = function (p, side, key) { return p[side].some(function (x) { return x.k === key; }); };
    [[a, h, A, H], [h, a, H, A]].forEach(function (x) {
      var me = x[2], op = x[3], mn = SHORT[x[0]], on = SHORT[x[1]];
      if (has(op, "weak", "def") && (has(me, "str", "off") || ST[x[0]].gfg >= MODEL.LG)) k.push("<b>" + esc(mn) + " should test " + esc(on) + " early.</b> " + esc(on) + " have been leaking goals (" + f2(ST[x[1]].gag) + " per game), so shots and traffic in front are the best route.");
      if (has(me, "weak", "pim") && ST[x[1]].pimg < ST[x[0]].pimg - 1) k.push("<b>" + esc(mn) + " must stay out of the box.</b> " + esc(on) + " will get chances on the power play if " + esc(mn) + " keep taking penalties.");
      if (has(me, "weak", "rely") && me.tops.length) k.push("<b>Shut down " + esc(me.tops[0].name) + ".</b> " + mn + "'s top scorer (" + me.tops[0].g + "G " + me.tops[0].a + "A) drives their offence. " + esc(on) + " should match their best checkers against that group.");
    });
    var ra = ST[a].gfg + ST[h].gfg, rd = ST[a].gag + ST[h].gag;
    var gl = (ST[a].gfg + ST[h].gfg) / 2;
    if ((ST[a].gag + ST[h].gag) / 2 < MODEL.LG * 0.85 * 1 && gl < MODEL.LG * 1.05) k.push("<b>Expect a low-scoring game.</b> Both teams defend well, so the first goal and special teams carry extra weight.");
    else if ((ST[a].gag + ST[h].gag) / 2 > MODEL.LG * 1.15) k.push("<b>Expect goals.</b> Both teams are giving up a lot, so a quick response after conceding matters more than holding a lead.");
    [[a, A], [h, H]].forEach(function (x) {
      var oth = x[0] === a ? H : A;
      if (has(x[1], "str", "gk") && x[1].gl) k.push("<b>Be patient against " + esc(x[1].gl.name) + ".</b> " + f2(x[1].gl.gaa) + " GAA, so avoid forcing low-percentage shots and look for rebounds and screens.");
    });
    var st = function (p, who) { var rs = p.rs, n = 0, last = rs.length ? rs[rs.length - 1].r : ""; for (var i = rs.length - 1; i >= 0 && rs[i].r === last; i--) n++; if (n >= 3 && last === "W") k.push("<b>" + esc(who) + " arrive on a " + n + "-game win streak.</b> Confidence is high, so a strong first period from the other side matters."); if (n >= 3 && last === "L") k.push("<b>" + esc(who) + " have lost " + n + " straight.</b> A first goal can change how this game feels, so prepare for a desperate start."); };
    st(A, sa); st(H, sh);
    var s = MODEL.predict(a, h), d = Math.abs(s.a - s.h);
    if (d < 10) k.push("<b>This is close to a coin flip.</b> Special teams, goaltending and the first goal are likely to decide it.");
    return k.slice(0, 5);
  }
  function scoutCard(t, opp) {
    var P = profile(t), sc = function (arr, empty) { return arr.length ? "<ul>" + arr.slice(0, 4).map(function (x) { return "<li>" + x.txt + "</li>"; }).join("") + "</ul>" : '<p class="none">' + empty + "</p>"; };
    var look = P.tops.slice(0, 2).map(function (r) { return esc(r.name) + " (" + r.pts + " P)"; }).join(" and ");
    return '<div class="scr"><h5>' + esc(SHORT[t]) + '</h5><div><h6 class="up">Strengths</h6>' + sc(P.str, "No standout strength yet. Their numbers sit close to the middle of the " + GROUP + ".") +
      '<h6 class="dn">Weaknesses</h6>' + sc(P.weak, "No clear weakness in the numbers so far.") + "</div>" +
      (look ? '<p class="scrwo"><b>Watch out for:</b> ' + look + (P.gl ? ". In goal: " + esc(P.gl.name) + "." : ".") + "</p>" : "") + "</div>";
  }
  function scoutHTML(g) {
    var keys = keysFor(g.a, g.h);
    return '<div class="scout"><h4>Scouting report</h4><div class="scrg">' + scoutCard(g.a, g.h) + scoutCard(g.h, g.a) + "</div>" +
      '<div class="keys"><h4>Keys to the game</h4>' + (keys.length ? "<ol>" + keys.map(function (x) { return "<li>" + x + "</li>"; }).join("") + "</ol>" : '<p class="none">No clear mismatch. Both teams profile similarly, so execution and discipline decide it.</p>') + "</div>" +
      '</div>';
  }
  function matchBody(g) {
    var wp = winProb(g.a, g.h);
    var wpBar = '<div class="wsum"><div class="wpbar" role="img" aria-label="Win probability: ' + SHORT[g.a] + " " + wp.a + " percent, tie " + wp.t + " percent, " + SHORT[g.h] + " " + wp.h + ' percent"><i class="wa" style="width:' + wp.a + '%"></i><i class="wt" style="width:' + wp.t + '%"></i><i class="wh" style="width:' + wp.h + '%"></i></div>' +
      '<div class="wpl"><span><b>' + wp.a + "%</b>" + esc(SHORT[g.a]) + '</span><span class="mid">Win probability · Tie ' + wp.t + '%</span><span>' + esc(SHORT[g.h]) + ' <b style="margin:0 0 0 4px">' + wp.h + "%</b></span></div></div>";
    var A = ST[g.a], H = ST[g.h];
    var atk = function (x, y) { return "<p><b>" + esc(SHORT[x.t]) + " offence</b> scores " + f2(x.gfg) + " per game (" + ord(RK.gfg[x.t]) + " in the " + GROUP + "). <b>" + esc(SHORT[y.t]) + " defence</b> allows " + f2(y.gag) + " (" + ord(RK.gag[y.t]) + " fewest).</p>"; };
    var rows = cmpRow("Rank", -A.rank, -H.rank, ord(A.rank), ord(H.rank), "diff").replace(/<div class="track"[\s\S]*?<\/i><\/div>/, "") +
      cmpRow("Record", A.w * 2 + A.tie, H.w * 2 + H.tie, rec(A), rec(H), "high").replace(/<div class="track"[\s\S]*?<\/i><\/div>/, "") +
      cmpRow("PTS%", parseFloat(A.pct), parseFloat(H.pct), A.pct, H.pct, "high") +
      cmpRow("Goals for / GP", A.gfg, H.gfg, f2(A.gfg), f2(H.gfg), "high") +
      cmpRow("Goals against / GP", A.gag, H.gag, f2(A.gag), f2(H.gag), "low") +
      cmpRow("Goal diff / GP", A.dg, H.dg, (A.dg > 0 ? "+" : "") + f2(A.dg), (H.dg > 0 ? "+" : "") + f2(H.dg), "diff") +
      cmpRow("Penalty min / GP", A.pimg, H.pimg, f1(A.pimg), f1(H.pimg), "low");
    var small = Math.min(A.gp, H.gp);
    return '<div class="mbody">' + wpBar + '<div class="wp"><h4>Projection</h4>' +
      '' + modelNotes(g, wp) + '</div>' + scoutHTML(g) + '<div><h4>Team comparison</h4>' + rows + '<div class="vs" style="margin-top:14px"><h4>Offence against defence</h4>' + atk(A, H) + atk(H, A) + "</div></div>" +
      '<div class="mside"><div><h4>Recent form</h4><p>' + esc(SHORT[g.a]) + " " + formChips(g.a, 5) + "</p><p>" + esc(SHORT[g.h]) + " " + formChips(g.h, 5) + "</p></div>" +
      "<div>" + seriesBlock(g) + '</div><div class="watch">' + watch(g.a) + watch(g.h) + "</div></div>" +
      '<p class="mfoot">Game #' + g.id + " · " + esc(g.venue) + ". Season stats come from the official table, with only " + small + " to " + Math.max(A.gp, H.gp) + " games played per team, so small samples can swing. Player lines come from available game sheets.</p></div>";
  }
  /* ---------- wiring ---------- */
  if (MULTI) (function () {
    var sel = document.getElementById("divsel");
    sel.innerHTML = '<option value="ALL">All divisions</option>' + DIVS.map(function (d) { return '<option value="' + d.id + '">' + esc(d.name) + "</option>"; }).join("");
    sel.value = state.div;
    sel.addEventListener("change", function () {
      state.div = sel.value; try { localStorage.setItem(KEY + "-div", state.div); } catch (e) { }
      if (state.team !== "ALL" && !inDiv(state.team)) state.team = "ALL";
      state.pm = 10; renderAll();
    });
  })();
  function renderAll() { renderHome(); renderStandings(); renderSchedule(); renderTeams(); renderPlayers(); }
  function route() {
    var h = location.hash.slice(1);
    if (h === "matchups") h = "schedule";
    if (TABS.indexOf(h) < 0) h = "home";
    TABS.forEach(function (t) { $("p-" + t).hidden = t !== h; });
    Array.prototype.forEach.call(document.querySelectorAll(".nav a"), function (a) { if (a.dataset.tab === h) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
    return h;
  }
  function goto(tab) { if (location.hash.slice(1) === tab) { route(); } else location.hash = tab; window.scrollTo(0, 0); }

  function openTeam(t) { if (!inDiv(t)) { state.div = "ALL"; syncDiv(); } state.team = t; state.open = 0; state.pm = 10; renderAll(); goto("teams"); }
  document.addEventListener("click", function (e) {
    var frow = e.target.closest && e.target.closest(".frow"); if (frow) { featureRow(frow); return; }
    var tp = e.target.closest("[data-tp]");
    if (tp && !tp.closest(".wkc") && !tp.closest("#p-teams .tcard")) { e.preventDefault(); openTeam(tp.dataset.tp); return; }
    var tab = e.target.closest("a[data-tab]");
    if (tab && state.team !== "ALL") { state.team = "ALL"; state.open = 0; state.pm = 10; renderAll(); }
    var b = e.target.closest("button"); if (!b) return;
    if (b.dataset.team) { openTeam(b.dataset.team); return; }
    if (b.dataset.open) { e.preventDefault(); state.open = +b.dataset.open; state.sf = "upcoming"; renderSchedule(); goto("schedule"); var m = $("m" + state.open); if (m) { m.open = true; setTimeout(function () { m.scrollIntoView({ block: "start" }); }, 30); } return; }
    if (b.dataset.go) { goto(b.dataset.go); return; }
    if (b.dataset.sfgo) { state.sf = b.dataset.sfgo; renderSchedule(); goto("schedule"); return; }
    if (b.dataset.allteams) { state.team = "ALL"; try { localStorage.setItem(KEY + "-team", "ALL"); } catch (x) { } renderAll(); return; }
    if (b.dataset.view) { state.view = b.dataset.view; try { localStorage.setItem(KEY + "-view", state.view); } catch (x) { } applyView(); return; }
    if (b.dataset.more) { state.pm += 10; renderPlayers(); return; }
    if (b.dataset.all) { state.pm = 9999; renderPlayers(); return; }
    if (b.dataset.jump) { var jt = document.querySelector('#p-schedule [data-month="' + b.dataset.jump + '"]'); if (jt) jt.scrollIntoView({ block: "start", behavior: "smooth" }); return; }
    if (b.dataset.sf) { state.sf = b.dataset.sf; renderSchedule(); return; }
    if (b.dataset.sv) { state.sv = b.dataset.sv; state.sadv = false; try { localStorage.setItem(KEY + "-standings", state.sv); localStorage.setItem(KEY + "-standings-adv", "0"); } catch (x) { } renderStandings(); return; }
    if (b.dataset.sadv) { state.sadv = !state.sadv; if (state.sadv) state.sv = "table"; try { localStorage.setItem(KEY + "-standings", state.sv); localStorage.setItem(KEY + "-standings-adv", state.sadv ? "1" : "0"); } catch (x) { } renderStandings(); return; }
    if (b.hasAttribute("data-adv")) { state.adv = !state.adv; renderPlayers(); return; }
    if (b.dataset.pv) { state.pv = b.dataset.pv; renderPlayers(); return; }
    if (b.dataset.pt) { state.ptab = b.dataset.pt; state.pm = 10; renderPlayers(); return; }
    if (b.dataset.key) {
      var cfg = state.ptab === "skaters" ? state.sk : state.gk, k = b.dataset.key;
      if (cfg.key === k) cfg.dir = -cfg.dir; else { cfg.key = k; cfg.dir = (k === "name" || k === "team" || k === "gaa" || k === "ga" || k === "pen") ? 1 : -1; }
      renderPlayers();
    }
  });
  document.addEventListener("input", function (e) { if (e.target.id === "q") { state.q = e.target.value; state.pm = 10; renderPlayers(); } });
  document.addEventListener("change", function (e) {
    if (e.target.id !== "msort") return;
    var o = (OFFICIAL ? MSORT : MSORT_C)[state.ptab].concat(OFFICIAL ? [] : ADV_C).filter(function (x) { return x[0] === e.target.value; })[0], cfg = state.ptab === "skaters" ? state.sk : state.gk;
    cfg.key = o[0]; cfg.dir = o[2]; state.pm = 10; renderPlayers();
  });
  if (mq.addEventListener) mq.addEventListener("change", applyView);
  window.addEventListener("hashchange", function () { route(); window.scrollTo(0, 0); });

  $("asof").textContent = GAMES.length ? "Standings and results through " + dlong(LAST) + ", 2026 · " + PLAYED.length + " of " + GAMES.length + " regular-season games played." : "Standings as of " + dlong(LAST) + ", 2026. Schedule and game sheets coming soon.";
  applyView(); renderAll(); route();
  window.__hub = { ST: ST, GAMES: GAMES, results: results, ORDER: ORDER };
})();
