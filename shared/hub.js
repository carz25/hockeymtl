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
  var SCHED = window.SCHED || [], TEAMS = window.TEAMS, SHORT = window.SHORT || window.TEAMS, BADGE = window.BADGE || {}, R = window.R || {}, G = window.G || [], OFF = window.OFF;
  var DIVS = window.DIVS || null;
  var ORDER = window.ORDER || DIVS.reduce(function (a, d) { return a.concat(d.teams); }, []);
  if (!DIVS) DIVS = [{ id: "C", name: L.groupName || "Conference", teams: ORDER.slice() }];
  var MULTI = DIVS.length > 1;            // more than one division: division picker and division sections
  var PSTATS = window.PSTATS || [], GSTATS = window.GSTATS || [], AS_OF = window.AS_OF, DATA_THROUGH = window.DATA_THROUGH;
  var GLEN = window.GLEN || L.gameMinutes || 60;
  var PPX = window.PPX || [], TIMED = window.TIMED || [];
  var NUM = window.NUM || {};             // optional jersey numbers: NUM[team][name] = number

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
    '<main class="in">\n  <section id="p-home"></section>\n  <section id="p-standings" hidden></section>\n  <section id="p-schedule" hidden></section>\n  <section id="p-teams" hidden></section>\n  <section id="p-players" hidden></section>\n  <section id="p-game" hidden></section>\n  <section id="p-player" hidden></section>\n  <section id="p-preview" hidden></section>\n</main>\n\n' +
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
  /* badge colours: BADGE in data.js, or a steady colour picked from the team code */
  var PAL = ["#1F4E8C", "#8C1F2E", "#1F7A4D", "#6B3FA0", "#B45F06", "#0E7C86", "#7A5C1F", "#3D4A5C", "#A0306E", "#2F6B2F"];
  ORDER.forEach(function (t, i) { if (!BADGE[t]) BADGE[t] = PAL[i % PAL.length]; });
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
  var FIRST = (GAMES.filter(function (g) { return g.date !== TBD_DATE; })[0] || { date: "" }).date;
  if (!AS_OF) AS_OF = LAST || FIRST;
  /* "through Sun, Nov 8" once games are played; "Season starts Sat, Oct 3" before that */
  function thru(prefix) { return LAST ? prefix + " " + dlong(LAST) : FIRST ? "Season starts " + dlong(FIRST) : "Schedule coming soon"; }

  /* Official standings (OFF) are optional: when they are missing, or a team is missing from them, the row is
     counted from the scores in SCHED (2 points a win, 1 a tie or overtime loss; PIM from the game sheets when there are any)
     and each division is ordered by points, points %, then goal difference. */
  var OFF_GIVEN = !!window.OFF;
  OFF = OFF || {};
  (function () {
    var calc = {}, pim = {};
    ORDER.forEach(function (t) { calc[t] = { gp: 0, w: 0, l: 0, t: 0, gf: 0, ga: 0 }; pim[t] = 0; });
    PLAYED.forEach(function (g) {
      [[g.a, g.sa, g.sh], [g.h, g.sh, g.sa]].forEach(function (x) {
        var c = calc[x[0]]; if (!c) return;
        c.gp++; c.gf += x[1]; c.ga += x[2]; if (x[1] > x[2]) c.w++; else if (x[1] < x[2]) c.l++; else c.t++;
      });
    });
    G.forEach(function (gm) { (gm.p || []).forEach(function (x) { if (pim[x[0]] !== undefined) pim[x[0]] += 2; }); });
    var missing = false;
    ORDER.forEach(function (t) {
      if (OFF[t]) return;
      missing = true;
      var c = calc[t], pts = 2 * c.w + c.t, pct = c.gp ? (pts / (2 * c.gp)).toFixed(3).replace(/^0/, "") : ".000";
      OFF[t] = OT ? [c.gp, c.w, c.l, c.t, pts, pct, c.gf, c.ga, c.gf - c.ga, pim[t], c.w, 0, 0, false] : [c.gp, c.w, c.t, c.l, pts, pct, c.gf, c.ga, c.gf - c.ga, pim[t]];
    });
    if (missing && !OFF_GIVEN) {
      var by = function (a, b) { var x = OFF[a], y = OFF[b]; return y[4] - x[4] || parseFloat(y[5] || 0) - parseFloat(x[5] || 0) || y[8] - x[8] || ORDER.indexOf(a) - ORDER.indexOf(b); };
      DIVS.forEach(function (d) { d.teams.sort(by); });
      ORDER.sort(by);
    }
  })();
  function per(x, gp) { return gp ? x / gp : 0; }

  var ST = {};
  DIVS.forEach(function (d) {
    d.teams.forEach(function (t, i) {
      var o = OFF[t], gp = o[0] || 0;
      // ties format: GP W T L PTS PTS% GF GA DIFF PIM
      if (!OT) { ST[t] = { t: t, div: d.id, rank: i + 1, gp: gp, w: o[1], tie: o[2], l: o[3], otl: 0, pts: o[4], pct: o[5], pctn: parseFloat(o[5]) || 0, gf: o[6], ga: o[7], diff: o[8], pim: o[9], gfg: per(o[6], gp), gag: per(o[7], gp), pimg: per(o[9], gp), dg: per(o[8], gp) }; return; }
      ST[t] = { t: t, div: d.id, rank: i + 1, gp: gp, w: o[1], l: o[2], otl: o[3], tie: 0, pts: o[4], pct: o[5], pctn: parseFloat(o[5]) || 0, gf: o[6], ga: o[7], diff: o[8], pim: o[9], rw: o[10], sow: o[11], sp: o[12], pend: o[13],
        gfg: per(o[6], gp), gag: per(o[7], gp), pimg: per(o[9], gp), dg: per(o[8], gp) };
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
  function skater(t, key) { var id = t + ":" + key; return sk[id] || (sk[id] = { id: id, team: t, name: nm(t, key), gp: 0, g: 0, a: 0, pen: 0, mp: 0, gd: 0, pwg: 0, pwa: 0, shg: 0, sha: 0, gwg: 0, gtg: 0 }); }
  function goalie(t, key) { var id = t + ":" + key; return gk[id] || (gk[id] = { id: id, team: t, name: nm(t, key), gp: 0, gs: 0, w: 0, l: 0, t: 0, min: 0, ga: 0, so: 0 }); }
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
    /* game-winning goal: the winner's goal that put them one ahead of the loser's final score; game-tying goal: the last goal of a tied game */
    var sa = gm.s[0], sh = gm.s[1];
    if (sa !== sh) {
      var wt = sa > sh ? gm.a : gm.h, need = Math.min(sa, sh) + 1, n = 0;
      gm.g.some(function (x) { if (x[0] === wt && ++n === need) { if (x[1]) skater(x[0], x[1]).gwg++; return true; } return false; });
    } else if (gm.g.length) { var lg = gm.g[gm.g.length - 1]; if (lg[1]) skater(lg[0], lg[1]).gtg++; }
    gm.p.forEach(function (x) { if (x[1]) skater(x[0], x[1]).pen += 2; });
    [[gm.a, gm.s[0], gm.s[1]], [gm.h, gm.s[1], gm.s[0]]].forEach(function (tt) {
      var played = gm.k.filter(function (x) { return x[0] === tt[0] && x[2] > 0; });
      played.forEach(function (x, i) {
        var r = goalie(x[0], x[1]); r.gp++; r.min += x[2]; r.ga += x[3]; if (i === 0) r.gs++;
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
    SK = Object.keys(sk).map(function (k) { var r = sk[k]; r.pts = r.g + r.a; r.ppg = r.gp ? r.pts / r.gp : 0; r.gpg = r.gp ? r.g / r.gp : 0; r.apg = r.gp ? r.a / r.gp : 0; r.pimg = r.gp ? r.pen / r.gp : 0; r.gsh = TGOALS[r.team] ? r.g / TGOALS[r.team] * 100 : 0; r.ppp = r.pwg + r.pwa; r.shp = r.shg + r.sha; return r; });
    GK = Object.keys(gk).map(function (k) { var r = gk[k]; r.gaa = r.min ? r.ga * 60 / r.min : 0; r.wpct = r.gp ? r.w / r.gp : 0; return r; });
  }
  function topSkaters(t, n) { return SK.filter(function (r) { return r.team === t; }).sort(function (a, b) { return b.pts - a.pts || b.g - a.g || a.name.localeCompare(b.name); }).slice(0, n); }
  function topGoalie(t) { return GK.filter(function (r) { return r.team === t; }).sort(function (a, b) { return b.min - a.min; })[0]; }

  /* ---------- state ---------- */
  var state = { div: "ALL", team: "ALL", sf: "upcoming", ptab: "skaters", q: "", open: 0, sk: { key: "pts", dir: -1 }, gk: { key: "gaa", dir: 1 }, pm: 10, adv: false, view: "auto", sv: "table", sadv: false, pv: "cards", pteam: "ALL" };
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
  var MONTHL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
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
      return g.played ? '<div class="wkc done">' + inner + '<span class="wkf">' + fin(g) + '</span></div>' : '<button class="wkc" data-open="' + g.id + '" aria-label="' + esc(SHORT[g.a]) + ' at ' + esc(SHORT[g.h]) + ', win probability ' + wp.a + ' to ' + wp.h + ' percent' + (OT ? "" : ", tie " + wp.t + " percent") + '">' + inner + '<span class="wkf">' + (OT ? "" : "Tie " + wp.t + "% · ") + 'Preview →</span></button>';
    }).join("");
    return '<div class="wk"><div class="wkh"><h3>This weekend</h3><span>' + dlong(w[0]) + " – " + dlong(w[1]) + " · " + list.length + " game" + (list.length === 1 ? "" : "s") + (state.team === "ALL" ? "" : " for " + esc(SHORT[state.team])) + '</span></div><div class="wkrow">' + cards + "</div></div>";
  }
  function hLine(g, t, win) {
    var pc = "", wp = null;
    if (g.played) pc = "<i>" + (t === g.a ? g.sa : g.sh) + "</i>";
    else { wp = winProb(g.a, g.h); var v = t === g.a ? wp.a : wp.h; pc = '<em class="wpc' + (v === Math.max(wp.a, wp.h) && wp.a !== wp.h ? " fav" : "") + '">' + v + "%</em>"; }
    return '<span class="wkl' + (g.played && !win ? " lose" : "") + '">' + badge(t) + '<b><span class="tpl" data-tp="' + t + '">' + esc(SHORT[t]) + "</span></b>" + pc + "</span>";
  }
  function homeGame(g) {
    var inner = '<span class="hd">' + (g.played ? dshort(g.date) : dshort(g.date)) + "<small>" + (g.played ? fin(g) : g.time) + '</small></span><span class="hls">' + (g.played ? "" : '<span class="wph">Win probability</span>') + hLine(g, g.a, g.sa >= g.sh) + hLine(g, g.h, g.sh >= g.sa) + "</span>";
    return '<button class="hg" data-open="' + g.id + '">' + inner + "</button>";
  }
  /* ---------- desktop home pieces ---------- */
  (window.LEAGUES || []).forEach(function (l) { if (l.label === LEAGUE.title) document.documentElement.style.setProperty("--lgc", l.color); });
  var DAYL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  function lastName(n) { var p = String(n).split(" "); return p.length > 1 ? p.slice(1).join(" ") : n; }
  function scorers(g, t) {
    var sh = SHEET[g.id]; if (!sh || !sh.g) return "";
    var c = {}, order = [];
    sh.g.forEach(function (x) { if (x[0] !== t || !x[1]) return; if (!c[x[1]]) { c[x[1]] = 0; order.push(x[1]); } c[x[1]]++; });
    return order.map(function (k) { return esc(lastName(nm(t, k))) + (c[k] > 1 ? " " + c[k] : ""); }).join(", ");
  }
  function hotTeam() {
    var best = null, bn = 0;
    DT().forEach(function (t) { var rs = results(t), n = 0; for (var i = rs.length - 1; i >= 0 && rs[i].r === "W"; i--) n++; if (n > bn || (n === bn && best && ST[t].pts > ST[best].pts)) { bn = n; best = t; } });
    return bn ? { t: best, n: bn } : null;
  }
  function pickFeature(list) {
    var best = null, bs = 1e9;
    list.forEach(function (g) {
      var a = ST[g.a], h = ST[g.h]; if (!a || !h) return;
      var sc = a.rank + h.rank + 2 * Math.abs(a.rank - h.rank) + (a.div === h.div ? 0 : 6);
      if (sc < bs) { bs = sc; best = g; }
    });
    return best;
  }
  function featureHTML(g, label) {
    if (!g) return "";
    var wp = winProb(g.a, g.h), last = PLAYED.filter(function (x) { return (x.a === g.a && x.h === g.h) || (x.a === g.h && x.h === g.a); }).slice(-1)[0];
    var side = function (t, pc, home) {
      var s = ST[t];
      return '<div class="gf-t' + (home ? " home" : "") + '">' + badge(t, 1) + '<div><div class="gf-n">' + esc(TEAMS[t]) + '</div><div class="gf-r">' + ord(s.rank) + (MULTI ? " in " + esc(divOf(t).name) : "") + " · " + rec(s) + " · " + (s.pend ? "–" : s.pts) + " PTS</div>" +
        '<div class="gf-f">' + formChips(t, 5) + "</div></div><div class=\"gf-p\">" + pc + "<small>%</small></div></div>";
    };
    var lastTxt = last ? "Last meeting " + dshort(last.date) + ": " + esc(SHORT[last.a]) + " " + last.sa + "–" + last.sh + " " + esc(SHORT[last.h]) : "First meeting this season";
    return '<section class="gf"><div class="gf-h"><span>' + label + "</span><span>" + esc(when(g)) + (g.venue ? " · " + esc(g.venue) : "") + "</span></div>" +
      '<div class="gf-m">' + side(g.a, wp.a, 0) + '<div class="gf-vs">at</div>' + side(g.h, wp.h, 1) + "</div>" +
      '<div class="gf-bar" role="img" aria-label="Win probability ' + esc(SHORT[g.a]) + " " + wp.a + "%" + TIETXT(wp, ", ") + ", " + esc(SHORT[g.h]) + " " + wp.h + '%"><i style="flex:' + wp.a + '"></i>' + (OT ? "" : '<i class="t" style="flex:' + wp.t + '"></i>') + '<i class="h" style="flex:' + wp.h + '"></i></div>' +
      '<div class="gf-foot"><span>' + esc(SHORT[g.a]) + " " + wp.a + "%" + TIETXT(wp, " · ") + " · " + esc(SHORT[g.h]) + " " + wp.h + "%</span><span>" + lastTxt + '</span><button class="btn pri" data-open="' + g.id + '">Matchup preview</button></div></section>';
  }
  function dayCards(list) {
    var days = [], by = {};
    list.forEach(function (g) { if (!by[g.date]) { by[g.date] = []; days.push(g.date); } by[g.date].push(g); });
    return '<div class="dcards">' + days.map(function (dt) {
      var d = pd(dt);
      return '<div class="card dc"><h4>' + DAYL[d.getDay()] + "<span>" + MONTH[d.getMonth()] + " " + d.getDate() + "</span></h4>" + by[dt].map(function (g) {
        var wp = winProb(g.a, g.h), fa = wp.a > wp.h, fh = wp.h > wp.a;
        var ln = function (t, pc, fav) { return '<span class="dl' + (mine(t) ? " mine" : "") + '">' + badge(t) + "<b>" + esc(SHORT[t]) + '</b><em class="' + (fav ? "fav" : "") + '">' + pc + "%</em></span>"; };
        return '<button class="dg" data-open="' + g.id + '"><span class="dt">' + g.time + '</span><span class="dls">' + ln(g.a, wp.a, fa) + ln(g.h, wp.h, fh) + "</span></button>";
      }).join("") + "</div>";
    }).join("") + "</div>";
  }
  function resultTiles(list) {
    return '<div class="rgrid">' + list.map(function (g) {
      var ln = function (t, sc, win) { var who = scorers(g, t); return '<div class="rl' + (win ? " w" : "") + '">' + badge(t) + '<b><span class="tpl" data-tp="' + t + '">' + esc(SHORT[t]) + "</span></b><i>" + sc + "</i></div>" + (who ? '<div class="rs">' + who + "</div>" : ""); };
      return '<button class="card rt2" data-open="' + g.id + '" aria-label="' + esc(SHORT[g.a]) + " " + g.sa + ", " + esc(SHORT[g.h]) + " " + g.sh + ', game summary"><div class="rh"><span>' + dshort(g.date) + "</span><span>" + fin(g) + "</span></div>" + ln(g.a, g.sa, g.sa > g.sh) + ln(g.h, g.sh, g.sh > g.sa) + "</button>";
    }).join("") + "</div>";
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
    var wk = weekendDates(), wkList = UPCOMING.filter(function (g) { return g.date >= wk[0] && g.date <= wk[1] && gIn(g); });
    var upList = wkList.length ? wkList : next, ft = pickFeature(upList), hot = hotTeam(), pl = PLAYED.filter(gIn).length, tg = GAMES.filter(gIn).length;
    var band = '<div class="sband desk"><div class="sb"><span>Games played</span><b>' + pl + "<small> / " + tg + '</small></b><div class="hprog"><i style="width:' + (tg ? Math.round(pl / tg * 100) : 0) + '%"></i></div></div>' +
      '<div class="sb"><span>Goals per game</span><b>' + (totGP ? f2(totGF / totGP) : "–") + "</b><em>" + totGF + " goals so far</em></div>" +
      '<div class="sb"><span>' + (MULTI ? "Best record" : "Leader") + "</span>" + (PLAYED.length ? "<b>" + badge(lead.t) + esc(SHORT[lead.t]) + "</b><em>" + rec(lead) + " · " + lead.pts + " PTS</em>" : "<b>–</b><em>No games played yet</em>") + "</div>" +
      '<div class="sb"><span>Hottest team</span>' + (hot ? "<b>" + badge(hot.t) + esc(SHORT[hot.t]) + "</b><em>" + hot.n + "-game win streak</em>" : "<b>–</b><em>No active win streak</em>") + "</div></div>";
    var deskHome = '<div class="desk hdesk">' + band + featureHTML(ft, wkList.length ? "Game of the weekend" : "Game to watch") +
      (upList.length ? '<div class="hcol"><div class="hh"><h3>' + (wkList.length ? "This weekend" : "Upcoming games") + '</h3><button class="hlink" data-sfgo="upcoming">Full schedule →</button></div>' + dayCards(upList) + "</div>" : "") +
      (recent.length ? '<div class="hcol"><div class="hh"><h3>Recent results</h3><button class="hlink" data-sfgo="results">All results →</button></div>' + resultTiles(recent) + "</div>" : "") + "</div>";
    var defs = [["Points", SK, "pts"], ["Goals", SK, "g"], ["Assists", SK, "a"], ["Goalie wins", GK, "w"]];
    var perf = defs.map(function (d) {
      var top = d[1].filter(function (r) { return r[d[2]] > 0; }).sort(function (a, b) { return b[d[2]] - a[d[2]] || (b.pts || 0) - (a.pts || 0) || b.gp - a.gp || a.name.localeCompare(b.name); }).slice(0, 3);
      return '<div class="card pf"><h4>' + d[0] + "</h4><ol>" + (top.map(function (r, i) {
        return '<li><span class="pr">' + (i + 1) + "</span>" + badge(r.team) + '<span class="pn">' + plink(r.team, r.name) + "<small>" + esc(SHORT[r.team]) + '</small></span><span class="pv">' + r[d[2]] + "</span></li>";
      }).join("") || '<li><span></span><span class="pr">No data yet</span><span></span></li>') + "</ol></div>";
    }).join("");
    $("p-home").innerHTML = '<div class="home"><div class="hhero"><div class="sec-head"><div><h2>Current season</h2><p class="lede">' + (GAMES.length ? PLAYED.filter(gIn).length + " of " + GAMES.filter(gIn).length + " games played" + (LAST ? " through " + dlong(LAST) : "") + "." : thru("Standings as of") + ". The schedule and game sheets will be added soon.") + '</p></div></div>' +
      '<div class="hprog" role="img" aria-label="' + PLAYED.length + " of " + GAMES.length + ' games played"><i style="width:' + (GAMES.length ? Math.round(PLAYED.filter(gIn).length / GAMES.filter(gIn).length * 100) : 0) + '%"></i></div>' +
      '<div class="hstat mob"><span><b>' + (totGP ? f2(totGF / totGP) : "–") + "</b> goals per game</span><span>Leader <b>" + esc(SHORT[lead.t]) + "</b> · " + lead.pts + " PTS</span><span>Best offence <b>" + esc(SHORT[off]) + "</b> · " + f2(ST[off].gfg) + " per game</span></div></div>" +
      deskHome + '<div class="mob hmob">' + weekendHTML() +
      '<div class="hgrid"><div class="hcol"><div class="hh"><h3>Recent results</h3><button class="hlink" data-sfgo="results">All results →</button></div><div class="hlist">' + (recent.map(homeGame).join("") || '<p class="mfoot">Results appear here once the schedule is loaded.</p>') + "</div></div>" +
      '<div class="hcol"><div class="hh"><h3>Upcoming games</h3><button class="hlink" data-sfgo="upcoming">Full schedule →</button></div><div class="hlist">' + (next.map(homeGame).join("") || '<p class="mfoot">Upcoming games appear here once the schedule is loaded.</p>') + "</div></div></div></div>" +
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

    /* Desktop table: columns grouped Record | Scoring | Special teams | Form, ending with each team's next game. */
    var nextCell = function (t) {
      var g = nextGame(t); if (!g || g.date === TBD_DATE) return '<td class="l nxt">–</td>';
      var home = g.h === t, opp = home ? g.a : g.h;
      return '<td class="l nxt"><button class="nxtb" data-open="' + g.id + '" title="' + esc(when(g)) + '"><span>' + DOW[pd(g.date).getDay()] + " " + g.time + "</span>" + (home ? "vs" : "at") + " " + badge(opp) + "<b>" + esc(SHORT[opp]) + "</b></button></td>";
    };
    var nRec = 1 + RC.length + 2 + (OT ? 2 : 0), nSpt = 3 + (SPT_AGAINST ? 2 : 0);
    var deskFor = function (cls) { return curDivs().map(function (d) {
      var body = d.teams.map(function (t) {
        var s = ST[t];
        return '<tr class="' + (mine(t) ? "me" : "") + '"><td class="rk num">' + s.rank + "</td>" + teamCell(t) +
          '<td class="g0">' + s.gp + "</td>" + rtd(s) + '<td class="strong ptsc">' + dash(s, s.pts) + "</td><td>" + s.pct + "</td>" + (OT ? "<td>" + s.rw + "</td><td>" + dash(s, s.sp) + "</td>" : "") +
          '<td class="g0">' + s.gf + "</td><td>" + s.ga + "</td><td>" + sgn(s) + "</td>" +
          '<td class="g0">' + dash(s, s.pim) + "</td><td>" + SPT[t].ppg + "</td>" + (SPT_AGAINST ? "<td>" + SPT[t].ppga + "</td>" : "") + "<td>" + SPT[t].shg + "</td>" + (SPT_AGAINST ? "<td>" + SPT[t].shga + "</td>" : "") +
          '<td class="g0">' + remaining(t) + '</td><td class="l">' + formChips(t, 5) + "</td>" + nextCell(t) + "</tr>";
      }).join("");
      return divHead(d) + '<div class="card"><div class="wrap"><table class="stt' + (cls ? " " + cls : "") + '"><thead>' +
        '<tr class="grp"><th colspan="2"></th><th colspan="' + nRec + '" class="g0">Record</th><th colspan="3" class="g0">Scoring</th><th colspan="' + nSpt + '" class="g0">Special teams</th><th colspan="3" class="g0">Summary</th></tr>' +
        '<tr><th class="rk">#</th><th class="l stick">Team</th><th class="g0" title="Games played">GP</th>' + rth(true) + '<th class="ptsc" title="Points">PTS</th><th title="Points percentage">PTS%</th>' + (OT ? '<th title="Regulation wins">RW</th><th title="Sportsmanship points, included in PTS">SP</th>' : "") +
        '<th class="g0" title="Goals for">GF</th><th title="Goals against">GA</th><th title="Goal difference">DIFF</th>' +
        '<th class="g0" title="Penalty minutes">PIM</th><th title="Power-play goals">PPG</th>' + (SPT_AGAINST ? '<th title="Power-play goals against">PPGA</th>' : "") + '<th title="Short-handed goals">SHG</th>' + (SPT_AGAINST ? '<th title="Short-handed goals against">SHGA</th>' : "") +
        '<th class="g0" title="Games remaining">GR</th><th class="l">Last 5</th><th class="l">Next game</th></tr></thead><tbody>' + body + "</tbody></table></div></div>";
    }).join(""); };
    var desk = deskFor("");
    var lede = LAST ? "Updated as of " + dlong(LAST) : thru("");
    $("p-standings").innerHTML =
      '<div class="sec-head"><div><h2>Standings</h2><p class="lede">' + lede + ".</p></div></div>" +
      '<div style="display:flex;flex-direction:column;gap:16px;margin-top:16px">' + focus +
      '<div class="tiles">' + tile("Best offence", esc(SHORT[bo]), f2(ST[bo].gfg) + " goals per game · " + ST[bo].gf + " total" + (MULTI ? " · " + esc(divOf(bo).name) : "")) +
      tile("Highest diff", esc(SHORT[bdf]), (ST[bdf].diff > 0 ? "+" : "") + ST[bdf].diff + " goal difference · " + ST[bdf].gf + " for, " + ST[bdf].ga + " against" + (MULTI ? " · " + esc(divOf(bdf).name) : "")) +
      tile("Best points %", esc(SHORT[bp.t]), bp.pct + (MULTI ? " · " + esc(divOf(bp.t).name) : "")) +
      tile("Best defence", esc(SHORT[bd]), f2(ST[bd].gag) + " allowed per game" + (MULTI ? " · " + esc(divOf(bd).name) : "")) + "</div>" +
      '<div class="mob">' + svSeg + (state.sadv ? deskFor("advt ctable") : state.sv === "grid" ? mobGrid : mobTable) + '</div><div class="desk">' + desk + "</div>" +
      "</div>";
    $("p-standings").insertAdjacentHTML("beforeend", recapsHTML());
    /* Phones: Advanced stats keeps the normal table's first columns exactly where they were and only adds columns to the right.
       Lay out a hidden copy of the normal table, then give the matching Advanced columns the same widths. */
    if (state.sadv && document.body.classList.contains("m")) {
      var mob = document.querySelector("#p-standings .mob"), probe = document.createElement("div");
      probe.style.cssText = "position:absolute;left:0;right:0;visibility:hidden;pointer-events:none";
      probe.innerHTML = mobTable; mob.style.position = "relative"; mob.appendChild(probe);
      var ref = probe.querySelector("table.ctable thead tr"), n = 3 + RC.length + 1;
      if (ref) {
        var w = Array.prototype.slice.call(ref.children, 0, n).map(function (th) { return th.getBoundingClientRect().width; });
        mob.querySelectorAll("table.advt").forEach(function (tb) {
          var row = tb.querySelector("thead tr:not(.grp)");
          w.forEach(function (px, i) { var th = row.children[i]; if (th) { th.style.width = th.style.minWidth = th.style.maxWidth = px + "px"; th.style.boxSizing = "border-box"; } });
        });
      }
      probe.remove();
    }
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
  function gbar(g) { var wp = winProb(g.a, g.h); return '<div class="gbar" aria-hidden="true"><i style="flex:' + wp.a + '"></i>' + (wp.t ? '<i class="t" style="flex:' + wp.t + '"></i>' : "") + '<i class="h" style="flex:' + wp.h + '"></i></div>'; }
  function gameInner(g, sheet) {
    return '<div class="gtime"><b>' + g.time + "</b><span>#" + g.id + '</span></div><div class="gteams">' + (g.played ? "" : '<div class="wph">Win probability</div>') + teamLine(g, "a") + teamLine(g, "h") + (g.played ? "" : gbar(g)) + '</div><div class="gmeta"><span class="gven">' + (g.played ? '<span class="final">' + fin(g) + "</span> · " : "") + esc(g.venue) + "</span>" +
      '<span class="more">' + (g.played ? "Game summary" : "Matchup preview") + " ›</span></div>";
  }
  function goalList(sh, t) {
    var items = sh.g.filter(function (x) { return x[0] === t; }).map(function (x) {
      var as = x.slice(2).map(function (k) { return nm(t, k); });
      return "<li><span>" + esc(x[1] ? nm(t, x[1]) : "Unknown") + "</span> <small>" + (as.length ? esc(as.join(", ")) : "unassisted") + "</small></li>";
    });
    return items.length ? items.join("") : "<li><small>No goals</small></li>";
  }
  /* a played game without a game sheet: the final, both records now, and the season series */
  function resultDetail(g) {
    var w = g.sa > g.sh ? g.a : g.sh > g.sa ? g.h : null;
    var side = function (t) { var x = ST[t]; return "<li><span>" + badge(t) + " " + esc(TEAMS[t]) + "</span><small>" + ord(x.rank) + " · " + rec(x) + " · " + (x.pend ? "–" : x.pts) + " PTS</small></li>"; };
    return '<div class="gdetail"><div><h4>Final' + (fin(g) && fin(g) !== "Final" ? " · " + esc(fin(g)) : "") + "</h4><p>" + (w ? "<b>" + esc(TEAMS[w]) + "</b> won " + Math.max(g.sa, g.sh) + "–" + Math.min(g.sa, g.sh) + (w === g.h ? " at home" : " on the road") : "Tied " + g.sa + "–" + g.sh) + ".</p><h4>Standing now</h4><ul>" + side(g.a) + side(g.h) + "</ul></div>" +
      "<div>" + seriesBlock(g) + '</div><div class="gfoot"><span>Goal scorers appear here once the game sheet is added.</span></div></div>';
  }
  /* ---------- game summary (a played game with a game sheet) ----------
     Header with the line score, three stars, then scoring and penalty summaries. Sheets that carry times ("gt" for goals,
     "pt" for penalties: period, m:ss, situation / infraction code) get the period-by-period view; older sheets get the same
     sections without times. */
  var PCODE = { 22: "Slashing", 23: "Spearing", 24: "Butt-ending", 25: "Cross-checking", 26: "High-sticking", 31: "Charging", 35: "Kneeing", 39: "Body checking", 40: "Checking from behind",
    44: "Boarding", 47: "Roughing", 48: "Head contact", 50: "Holding", 51: "Holding the stick", 52: "Hooking", 53: "Tripping", 54: "Slew-footing", 55: "Clipping", 56: "Interference",
    57: "Bench interference", 58: "Goaltender interference", 61: "Unsportsmanlike conduct", 63: "Unsportsmanlike conduct (team)", 80: "Too many players", 92: "Delay of game", 94: "Ineligible player" };
  /* Hockey Québec codes: the letter is the penalty type, the number the infraction */
  function penInfo(code) {
    var m = /^([A-F])(\d+)$/.exec(code || ""), kind = m ? m[1] : "A";
    var mins = { A: 2, B: 5, C: 10, D: 10, E: 10, F: 0 }[kind], what = m && PCODE[+m[2]] ? PCODE[+m[2]] : "Penalty";
    var lbl = { A: "2 min", B: "5 min major", C: "10 min misconduct", D: "Game misconduct", E: "Match penalty", F: "Penalty shot" }[kind];
    return { mins: mins, what: what, lbl: lbl };
  }
  function mmss(min) { var t = Math.round(min * 60); return Math.floor(t / 60) + ":" + ("0" + t % 60).slice(-2); }
  function perName(p) { return p === 4 ? "Overtime" : p > 4 ? "Overtime " + (p - 3) : ["1st", "2nd", "3rd"][p - 1] + " period"; }
  function perShort(p) { return p >= 4 ? "OT" + (p > 4 ? p - 3 : "") : ["1st", "2nd", "3rd"][p - 1]; }
  function tag(t, cls) { return '<span class="gtag ' + cls + '">' + t + "</span>"; }
  function gameData(g, sh) {
    var a = g.a, h = g.h, win = g.sa > g.sh ? a : g.sh > g.sa ? h : null, lose = win === a ? h : a;
    var ppx = PPX.filter(function (x) { return x[0] === g.id; }).map(function (x) { return x.slice(); });
    var run = {}; run[a] = 0; run[h] = 0;
    var nth = {}; nth[a] = 0; nth[h] = 0;
    /* goals in time order when the sheet gives times (g itself is in sheet order: visitors' goals, then home) */
    var gi = sh.g.map(function (x, i) { return i; });
    if (sh.gt) gi.sort(function (i, j) { var p = sh.gt[i], q = sh.gt[j]; return (p[0] - q[0]) || (toSec(p[1]) - toSec(q[1])) || (i - j); });
    var goals = gi.map(function (i) {
      var x = sh.g[i], t = x[0], tm = sh.gt && sh.gt[i], kind = tm ? tm[2] : "";
      if (!tm) { var j = -1; ppx.some(function (q, k) { if (q[1] === t && q[2] === x[1]) { j = k; return true; } return false; }); if (j >= 0) { kind = ppx[j][3] === "PP" ? "pp" : "sh"; ppx.splice(j, 1); } }
      run[t]++; nth[t]++;
      var gw = !!win && !sh.so && t === win && nth[t] === (win === a ? g.sh : g.sa) + 1;
      return { t: t, k: x[1] || "", as: x.slice(2), per: tm ? tm[0] : 0, time: tm ? tm[1] : "", kind: kind, gw: gw, sa: run[a], sh: run[h] };
    });
    var pens = sh.pt ? sh.pt.map(function (x) { var pi = penInfo(x[4]); return { t: x[0], k: x[1], per: x[2], time: x[3], code: x[4], mins: pi.mins, what: pi.what, lbl: pi.lbl }; })
      : sh.p.map(function (x) { return { t: x[0], k: x[1], per: 0, time: "", mins: 2, what: "", lbl: "2 min" }; });
    var timed = !!sh.gt, periods = [];
    if (timed) { goals.concat(pens).forEach(function (e) { if (periods.indexOf(e.per) < 0) periods.push(e.per); }); [1, 2, 3].forEach(function (p) { if (periods.indexOf(p) < 0) periods.push(p); }); periods.sort(); }
    /* game length from the goalies' minutes, for the goalie part of the three stars */
    var glen = Math.max.apply(null, [a, h].map(function (t) { return sh.k.filter(function (x) { return x[0] === t; }).reduce(function (s2, x) { return s2 + x[2]; }, 0); })) || GLEN;
    return { a: a, h: h, win: win, lose: lose, goals: goals, pens: pens, timed: timed, periods: periods, glen: glen };
  }
  /* Three stars: goal 3, assist 2, game-winning goal +1; goalie win +2, full-game shutout +5, +1 per full period in net with no goal against.
     Ties: more points, then more goals, then fewer penalty minutes. */
  function threeStars(g, sh, D) {
    var P = {}, add = function (t, k, v, kind) { if (!k) return; var id = t + ":" + k; var r = P[id] || (P[id] = { t: t, k: k, sc: 0, g: 0, a: 0, gw: 0, pp: 0, pim: 0, gk: null }); r.sc += v; if (kind === "g") r.g++; if (kind === "a") r.a++; return r; };
    D.goals.forEach(function (x) { var r = add(x.t, x.k, 3, "g"); if (r) { if (x.gw) { r.sc += 1; r.gw++; } if (x.kind === "pp") r.pp++; } x.as.forEach(function (k) { add(x.t, k, 2, "a"); }); });
    D.pens.forEach(function (x) { var id = x.t + ":" + x.k; if (P[id]) P[id].pim += x.mins; });
    var plen = D.glen / 3;
    [D.a, D.h].forEach(function (t) {
      var gs = sh.k.filter(function (x) { return x[0] === t && x[2] > 0; }), main = gs.slice().sort(function (p, q) { return q[2] - p[2]; })[0];
      gs.forEach(function (x) {
        var v = 0, ga = x[3], sh0 = gs.length === 1 && ga === 0 && x[2] >= D.glen - 1;
        if (D.win === t && x === main) v += 2;
        if (sh0) v += 5;
        if (ga === 0) v += Math.floor((x[2] + 0.05) / plen);
        var r = P[t + ":" + x[1]] || (P[t + ":" + x[1]] = { t: t, k: x[1], sc: 0, g: 0, a: 0, gw: 0, pp: 0, pim: 0 });
        r.sc += v; r.gk = { min: x[2], ga: ga, so: sh0, w: D.win === t && x === main };
      });
    });
    return Object.keys(P).map(function (id) { return P[id]; }).filter(function (r) { return r.sc > 0; })
      .sort(function (p, q) { return q.sc - p.sc || q.g - p.g || (q.g + q.a) - (p.g + p.a) || p.pim - q.pim || nm(p.t, p.k).localeCompare(nm(q.t, q.k)); }).slice(0, 3);
  }
  function starLine(r, short) {
    if (r.gk) return short ? mmss(r.gk.min) + " · " + r.gk.ga + " GA" : mmss(r.gk.min) + " in net · " + r.gk.ga + " GA" + (r.gk.so ? " · shutout" : r.gk.w ? " · win" : "");
    var pts = r.g + r.a, tags = [];
    if (r.pp) tags.push("PPG"); if (r.gw) tags.push("GWG");
    return short ? (r.g ? r.g + " G · " : r.a + " A · ") + pts + " PT" + (pts === 1 ? "" : "S") : r.g + " G · " + r.a + " A · " + pts + " PT" + (pts === 1 ? "" : "S") + (tags.length ? " · " + tags.join(", ") : "");
  }
  var STARC = ["#D98E04", "#8C98A8", "#B0703C"], STARN = ["1st", "2nd", "3rd"];
  function starSvg(i, px) { return '<svg width="' + px + '" height="' + px + '" viewBox="0 0 24 24" role="img" aria-label="' + STARN[i] + ' star"><path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z" fill="' + STARC[i] + '"/></svg>'; }
  function sheetDetail(g, sh) {
    var D = gameData(g, sh), a = D.a, h = D.h, stars = threeStars(g, sh, D);
    var per = function (t, p) { return D.goals.filter(function (x) { return x.t === t && x.per === p; }).length; };
    var pimOf = function (t, p) { return D.pens.filter(function (x) { return x.t === t && (p == null || x.per === p); }).reduce(function (s2, x) { return s2 + x.mins; }, 0); };
    var ppg = function (t) { return D.goals.filter(function (x) { return x.t === t && x.kind === "pp"; }).length; };
    var ppo = function (t) { var o = t === a ? h : a; return D.pens.filter(function (x) { return x.t === o && (x.code || "A")[0] !== "C" && (x.code || "A")[0] !== "D"; }).length; };
    /* header: score and line score */
    var cols = D.timed ? D.periods : [];
    var so = D.goals.length < g.sa + g.sh && D.win;   /* decided by a shootout: the winner's extra goal is not on the goal list */
    var lineRow = function (t) {
      return '<tr><th scope="row">' + esc(SHORT[t]) + "</th>" + cols.map(function (p) { return "<td>" + per(t, p) + "</td>"; }).join("") + (so ? "<td>" + (D.win === t ? 1 : 0) + "</td>" : "") + '<td class="tot">' + (t === a ? g.sa : g.sh) + "</td>" +
        (D.timed ? '<td class="sep">' + ppg(t) + "/" + ppo(t) + "</td>" : '<td class="sep">' + ppg(t) + "</td>") + "<td>" + pimOf(t) + "</td></tr>";
    };
    var head = '<div class="gs-head"><div class="gs-score"><div class="gs-meta">' + esc(fin(g) || "Final") + " · " + esc(dlong(g.date)) + (g.venue && g.venue !== "TBD" ? " · " + esc(g.venue) : "") + "</div>" +
      '<div class="gs-line">' + badge(a, 1) + '<span class="gs-tn' + (D.win === h ? " lost" : "") + '">' + esc(SHORT[a]) + '</span><b class="gs-n' + (D.win === h ? " lost" : "") + '">' + g.sa + '</b><span class="gs-dash">–</span><b class="gs-n' + (D.win === a ? " lost" : "") + '">' + g.sh + '</b><span class="gs-tn' + (D.win === a ? " lost" : "") + '">' + esc(SHORT[h]) + "</span>" + badge(h, 1) + "</div></div>" +
      '<table class="gs-ls"><thead><tr><th></th>' + cols.map(function (p) { return "<th>" + (p >= 4 ? perShort(p) : p) + "</th>"; }).join("") + (so ? "<th>SO</th>" : "") + '<th class="tot">T</th><th class="sep">' + (D.timed ? "PP" : "PPG") + "</th><th>PIM</th></tr></thead><tbody>" + lineRow(a) + lineRow(h) + "</tbody></table></div>";
    /* three stars */
    var starsD = stars.length ? '<div class="gs-sec"><h4>Three stars</h4><div class="gs-stars">' + stars.map(function (r, i) {
      return '<div class="gs-star' + (i ? "" : " first") + '"><div class="gs-sr">' + starSvg(i, 30 - i * 3) + "<span>" + STARN[i] + "</span></div>" + badge(r.t) + '<div class="gs-sw"><b>' + plinkK(r.t, r.k) + "</b><small>" + esc(SHORT[r.t]) + (r.gk ? " · goalie" : "") + "</small><span>" + starLine(r) + "</span></div></div>";
    }).join("") + "</div></div>" : "";
    var starsM = stars.length ? '<div class="gs-sec"><h4>Three stars</h4><div class="gs-stars3">' + stars.map(function (r, i) {
      return '<div class="gs-s3' + (i ? "" : " first") + '"><div>' + starSvg(i, 18) + badge(r.t) + "</div><b>" + plinkK(r.t, r.k, lastName(nm(r.t, r.k))) + "</b><span>" + starLine(r, true) + "</span></div>";
    }).join("") + "</div></div>" : "";
    /* scoring and penalty tables (desktop) */
    var gTags = function (x, desk) { return (desk ? "" : tag("GOAL", "g")) + (x.kind === "pp" ? tag("PPG", "pp") : x.kind === "sh" ? tag("SHG", "pp") : "") + (x.gw ? tag("GWG", "gw") : ""); };
    var scoreTxt = function (x) { var d = x.sa - x.sh; return d === 0 ? x.sa + "–" + x.sh : esc(SHORT[d > 0 ? a : h]) + " " + Math.max(x.sa, x.sh) + "–" + Math.min(x.sa, x.sh); };
    var asTxt = function (x) { return x.as.length ? x.as.map(function (k) { return plinkK(x.t, k); }).join(", ") : "unassisted"; };
    var byPer = function (list, row, empty, extra) {
      if (!D.timed) return list.map(row).join("") || '<tr><td colspan="5" class="gs-none">' + empty + "</td></tr>";
      return D.periods.map(function (p) {
        var l = list.filter(function (x) { return x.per === p; });
        return '<tr class="gs-ph"><th colspan="' + (extra ? 4 : 5) + '" scope="rowgroup">' + perName(p) + "</th>" + (extra ? '<th class="r">' + extra(p) + "</th>" : "") + "</tr>" + (l.map(row).join("") || '<tr><td colspan="5" class="gs-none">' + empty + "</td></tr>");
      }).join("");
    };
    var scoring = '<div class="gs-sec"><h3>Scoring summary</h3><table class="gs-t"><thead><tr><th>' + (D.timed ? "Time" : "#") + "</th><th>Team</th><th>Goal (assists)</th><th>Type</th><th class=\"r\">Score</th></tr></thead><tbody>" +
      (so ? "" : "") + byPer(D.goals, function (x, i) { return "<tr><td>" + (D.timed ? x.time : D.goals.indexOf(x) + 1) + "</td><td>" + badge(x.t) + "</td><td><b>" + plinkK(x.t, x.k) + "</b> <small>(" + asTxt(x) + ")</small></td><td class=\"gs-tags\">" + gTags(x, 1) + '</td><td class="r b">' + scoreTxt(x) + "</td></tr>"; }, "No scoring.") + (so ? '<tr class="gs-ph"><th colspan="5" scope="rowgroup">Shootout</th></tr><tr><td></td><td>' + badge(D.win) + '</td><td colspan="2"><b>' + esc(SHORT[D.win]) + '</b> wins the shootout</td><td class="r b">' + esc(SHORT[D.win]) + " " + Math.max(g.sa, g.sh) + "–" + Math.min(g.sa, g.sh) + "</td></tr>" : "") + "</tbody></table></div>";
    var penalties = '<div class="gs-sec"><h3>Penalty summary</h3><table class="gs-t"><thead><tr><th>' + (D.timed ? "Time" : "#") + "</th><th>Team</th><th>Player</th>" + (D.timed ? "<th>Infraction</th>" : "") + '<th class="r">Min</th></tr></thead><tbody>' +
      byPer(D.pens, function (x) { return "<tr><td>" + (D.timed ? x.time : D.pens.indexOf(x) + 1) + "</td><td>" + badge(x.t) + "</td><td><b>" + (x.k ? plinkK(x.t, x.k) : "Bench") + "</b></td>" + (D.timed ? "<td>" + esc(x.what) + (x.mins !== 2 && x.lbl ? " <small>(" + x.lbl + ")</small>" : "") + "</td>" : "") + '<td class="r">' + x.mins + "</td></tr>"; }, "No penalties.",
        function (p) { return esc(SHORT[a]) + " " + pimOf(a, p) + " · " + esc(SHORT[h]) + " " + pimOf(h, p); }) + "</tbody></table></div>";
    /* phone: one list by period, who leads after each */
    var ev = D.goals.map(function (x) { return { goal: 1, x: x }; }).concat(D.pens.map(function (x) { return { goal: 0, x: x }; }));
    var mrow = function (e) {
      var x = e.x;
      var nt = D.timed ? "" : " nt";
      if (e.goal) return '<div class="gs-ev goal' + nt + '"><span class="tm">' + (x.time || "") + "</span>" + badge(x.t) + '<div class="who"><b>' + plinkK(x.t, x.k) + " " + gTags(x) + "</b><small>" + asTxt(x) + '</small></div><b class="gsc ' + (x.t === a ? "a" : "h") + '">' + x.sa + "–" + x.sh + "</b></div>";
      return '<div class="gs-ev' + nt + '"><span class="tm">' + (x.time || "") + "</span>" + badge(x.t) + '<div class="who"><span><b>' + (x.k ? plinkK(x.t, x.k, lastName(nm(x.t, x.k))) : "Bench") + "</b>" + (x.what ? " · " + esc(x.what) : "") + ", " + x.lbl + "</span></div></div>";
    };
    var leadTxt = function (sa, s2, last) {
      if (sa === s2) return { t: (last ? "Final: tied " : "Tied ") + sa + "–" + s2, c: "tie" };
      var w = sa > s2 ? a : h;
      return { t: (last ? "Final: " : "Lead: ") + esc(SHORT[w]) + " " + Math.max(sa, s2) + "–" + Math.min(sa, s2), c: w === a ? "a" : "h" };
    };
    var mob;
    if (D.timed) {
      mob = D.periods.map(function (p, i) {
        var l = ev.filter(function (e) { return e.x.per === p; }).sort(function (u, v) { return toSec(u.x.time) - toSec(v.x.time) || v.goal - u.goal; });
        var ca = D.goals.filter(function (x) { return x.t === a && x.per <= p; }).length, ch = D.goals.filter(function (x) { return x.t === h && x.per <= p; }).length;
        var last = i === D.periods.length - 1 && !so, ld = last ? leadTxt(g.sa, g.sh, true) : leadTxt(ca, ch, false), pa = per(a, p), ph2 = per(h, p);
        return '<div class="gs-mp"><div class="gs-mph"><b>' + perName(p) + '</b><span class="lead ' + ld.c + '">' + ld.t + "</span></div><small>" + (pa + ph2 ? "This period: " + esc(SHORT[a]) + " " + pa + ", " + esc(SHORT[h]) + " " + ph2 : "No goals this period") + "</small></div>" + l.map(mrow).join("");
      }).join("") + (so ? '<div class="gs-mp"><div class="gs-mph"><b>Shootout</b><span class="lead ' + (D.win === a ? "a" : "h") + '">Final: ' + esc(SHORT[D.win]) + " " + Math.max(g.sa, g.sh) + "–" + Math.min(g.sa, g.sh) + "</span></div><small>" + esc(SHORT[D.win]) + " wins the shootout</small></div>" : "");
    } else {
      mob = '<div class="gs-mp"><div class="gs-mph"><b>Goals</b>' + (function () { var ld = leadTxt(g.sa, g.sh, true); return '<span class="lead ' + ld.c + '">' + ld.t + "</span>"; })() + "</div></div>" + (D.goals.map(function (x) { return mrow({ goal: 1, x: x }); }).join("") || '<p class="gs-none">No scoring.</p>') +
        '<div class="gs-mp"><div class="gs-mph"><b>Penalties</b></div></div>' + (D.pens.map(function (x) { return mrow({ goal: 0, x: x }); }).join("") || '<p class="gs-none">No penalties.</p>');
    }
    /* goalies */
    var gk = [a, h].map(function (t) {
      var gs = sh.k.filter(function (x) { return x[0] === t && x[2] > 0; }), main = gs.slice().sort(function (p, q) { return q[2] - p[2]; })[0];
      return '<div><h4>' + esc(SHORT[t]) + " goalies</h4>" + gs.map(function (x) {
        var dec = x === main && D.win ? (D.win === t ? " · W" : sh.so ? " · OTL" : " · L") : "";
        return "<div><b>" + plinkK(t, x[1]) + "</b> · " + mmss(x[2]) + " · " + x[3] + " GA" + dec + "</div>";
      }).join("") + "</div>";
    }).join("");
    var tab = state.gtab || "recap";
    var tabs = '<div class="ttabs gtabs" role="tablist" aria-label="Game summary sections">' + [["recap", "Recap"], ["pbp", "Play by play"], ["box", "Box score"]].map(function (x) {
      return '<button role="tab" data-gtab="' + x[0] + '" aria-selected="' + (tab === x[0]) + '">' + x[1] + "</button>";
    }).join("") + "</div>";
    var body;
    if (tab === "recap") {
      body = '<div class="desk">' + starsD + '</div><div class="mob">' + starsM + "</div>" +
        (D.timed && D.goals.length ? '<div class="card gsec2"><div class="tc-hd"><h3>Game flow</h3><span class="tc-leg"><i class="k-a"></i>' + abbr(a) + ' ahead<i class="k-h"></i>' + abbr(h) + ' ahead · circles are goals (jersey #) · bars are penalties</span></div>' + gameFlow(g, D) + "</div>" : "") +
        keyMoments(g, sh, D) +
        '<div class="g2">' + (D.timed ? '<div class="card gsec2"><h3>By period</h3>' + periodSplit(g, D) + "</div>" : "") + whatItMeans(g) + "</div>";
    } else if (tab === "pbp") {
      body = '<div class="desk"><div class="gs-two">' + scoring + penalties + '</div></div><div class="mob"><div class="gs-sec gs-mlist">' + mob + "</div></div>";
    } else {
      body = boxScore(g, sh, D) + '<div class="gs-gk">' + gk + "</div>";
    }
    return '<div class="gsum gsum2" id="gsum" style="' + teamPair(a, h) + '">' + head + tabs + '<div class="gbody">' + body + "</div></div>";
  }
  function toSec(t) { var m = /^(\d+):(\d+)$/.exec(t || ""); return m ? +m[1] * 60 + +m[2] : 0; }
  function isoOf(d) { return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); }
  function mlabel(k) { return k === TBD_DATE.slice(0, 7) ? "TBD" : MONTH[+k.slice(5) - 1] + (FIRST && k.slice(0, 4) !== FIRST.slice(0, 4) ? " " + k.slice(0, 4) : ""); }
  function renderSchedule() {
    /* Show: Upcoming (this weekend, or the next game day when the weekend is empty), Results, one month, or All. */
    var today = isoOf(new Date()), wkd = weekendDates();
    if (state.sf === "week") state.sf = "upcoming";
    var mine2 = GAMES.filter(function (g) { return gIn(g) && (state.team === "ALL" || g.a === state.team || g.h === state.team); });
    var smonths = []; mine2.forEach(function (g) { var k = g.date.slice(0, 7); if (smonths.indexOf(k) < 0) smonths.push(k); }); smonths.sort();
    var upFrom = wkd[0] < today ? today : wkd[0], upTo = wkd[1];
    if (!mine2.some(function (g) { return !g.played && g.date >= upFrom && g.date <= upTo; })) {
      var nx = mine2.filter(function (g) { return !g.played && g.date >= today; })[0];
      if (nx) { upFrom = nx.date; upTo = nx.date; }
    }
    var list = mine2.filter(function (g) {
      if (state.sf === "upcoming") return !g.played && g.date >= upFrom && g.date <= upTo;
      if (state.sf === "results") return g.played;
      if (state.sf.slice(0, 2) === "m:") return g.date.slice(0, 7) === state.sf.slice(2);
      return true;
    });
    if (state.sf === "results") list = list.slice().reverse();
    var html = "", cur = "", months = [], mark = state.sf === "all" ? list.findIndex(function (g) { return g.date >= today; }) : -1;
    list.forEach(function (g, i) {
      var mk = g.date.slice(0, 7), isNewMonth = months.indexOf(mk) < 0;
      if (isNewMonth) months.push(mk);
      if (i === mark && i > 0) { if (cur) { html += "</div>"; cur = ""; } html += '<div class="todaybar"><span>Today · ' + dlong(today) + "</span></div>"; }
      if (g.date !== cur) {
        if (cur) html += "</div>";
        cur = g.date; html += '<div class="day"' + (isNewMonth ? ' data-month="' + mk + '"' : "") + "><h3>" + dlong(g.date) + "</h3>" + (g.date === today ? '<span class="todaychip">Today</span>' : "") + '</div><div class="dgrid">';
      }
      var sheet = SHEET[g.id];
      if (!g.played) html += '<div class="grow" id="m' + g.id + '"><a class="grs" href="#preview/' + g.id + '">' + gameInner(g, false) + "</a></div>";
      else html += '<div class="grow" id="m' + g.id + '"><a class="grs" href="#game/' + g.id + '">' + gameInner(g, !!sheet) + "</a></div>";
    });
    if (cur) html += "</div>";
    var who = state.team === "ALL" ? (state.div === "ALL" ? "all teams" : curDivs()[0].name) : TEAMS[state.team];
    var sopts = [["upcoming", "Upcoming"], ["results", "Results"]].concat(smonths.map(function (k) { return ["m:" + k, MONTHL[+k.slice(5, 7) - 1]]; })).concat([["all", "All"]]);
    var scur = sopts.filter(function (o) { return o[0] === state.sf; })[0] || sopts[0];
    var seg = '<label class="pick"><span>' + scur[1] + '</span><select id="sfsel" aria-label="Show games">' + sopts.map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === scur[0] ? " selected" : "") + ">" + o[1] + "</option>"; }).join("") + "</select></label>";
    var jump = "";
    var pending = list.some(function (g) { return g.played && !SHEET[g.id]; });
    var empty = state.sf === "upcoming" ? "No upcoming games." : "No games to show.";
    $("p-schedule").innerHTML =
      '<div class="sec-head schead"><div><h2>Schedule</h2></div><div class="tools">' + seg + "</div></div>" + jump +
      '<div class="games" style="margin-top:4px">' + (html || '<p class="empty">' + empty + "</p>") + "</div>" +
      (pending ? '<p class="mfoot" style="margin-top:12px">A few results do not have a scoring summary yet because their game sheet has not been added.</p>' : "");
  }

  /* ---------- players ---------- */
  function filt(rows) {
    var q = norm(state.q.trim());
    return rows.filter(function (r) { return inDiv(r.team) && (state.team === "ALL" || r.team === state.team) && (state.pteam === "ALL" || r.team === state.pteam) && (!q || norm(r.name).indexOf(q) >= 0); });
  }
  function sortRows(rows, cfg, tie) {
    return rows.slice().sort(function (x, y) {
      var a = x[cfg.key], b = y[cfg.key];
      if (typeof a === "string") return cfg.dir * a.localeCompare(b);
      return cfg.dir * (a - b) || tie(x, y);
    });
  }
  /* column groups shown above the player tables on desktop */
  var PGRP = { GP: "", G: "Scoring", A: "Scoring", PTS: "Scoring", "P/GP": "Scoring", PIM: "Scoring", PPG: "Power play", PPA: "Power play", PPP: "Power play", SHG: "Short-handed", SHA: "Short-handed", SHP: "Short-handed", GWG: "Clutch", GTG: "Clutch", MP: "Clutch",
    GS: "", W: "Record", L: "Record", T: "Record", OTL: "Record", "W%": "Record", MIN: "Goaltending", GA: "Goaltending", GAA: "Goaltending", SO: "Goaltending" };
  function groupRow(cols) {
    var runs = [];
    cols.forEach(function (c) {
      var g = c[0] === "rank" || c[0] === "name" || c[0] === "team" ? "" : (PGRP[c[1]] !== undefined ? PGRP[c[1]] : "");
      if (c[1] === "GP" || c[1] === "GS") g = cols.some(function (x) { return x[1] === "W"; }) ? "Record" : "Scoring";
      var last = runs[runs.length - 1];
      if (last && last.g === g) last.n++; else runs.push({ g: g, n: 1 });
    });
    return '<tr class="grp">' + runs.map(function (r, i) { return '<th colspan="' + r.n + '"' + (r.g && i ? ' class="g0"' : "") + ">" + r.g + "</th>"; }).join("") + "</tr>";
  }
  function head(cols, cfg) {
    return "<thead>" + groupRow(cols) + "<tr>" + cols.map(function (c) {
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
      var k = c[0] === "name" ? "nm" : c[0] === "rank" ? "rk" : c[0] === "team" ? "tm" : "nu";
      return "<col" + (k ? ' class="' + k + '"' : "") + ">";
    }).join("");
    return '<table class="pt"><colgroup>' + cg + "</colgroup>" + head(cols, cfg);
  }
  function msortCtlC(cfg) {
    var opts = MSORT_C[state.ptab].concat(state.adv && state.ptab === "skaters" ? ADV_C : []), cur = opts.some(function (o) { return o[0] === cfg.key; }) ? cfg.key : opts[0][0];
    var lbl = opts.filter(function (o) { return o[0] === cur; })[0][1];
    return '<div class="mtools"><label class="pick"><span>' + esc(lbl) + '</span><select id="msort" aria-label="Sort by">' + opts.map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === cur ? " selected" : "") + ">" + o[1] + "</option>"; }).join("") + "</select></label>" + teamPick() + "</div>";
  }
  function teamPick() {
    if (state.team !== "ALL") return "";
    var cur = state.pteam === "ALL" ? "All teams" : SHORT[state.pteam];
    return '<label class="pick"><span>' + esc(cur) + '</span><select id="mteam" aria-label="Team">' + [["ALL", "All teams"]].concat(DT().map(function (t) { return [t, SHORT[t]]; })).map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === state.pteam ? " selected" : "") + ">" + esc(o[1]) + "</option>"; }).join("") + "</select></label>";
  }
  /* one player row in the phone List view: logo, name, team and stats underneath, big value on the right */
  function pcard(r, i, gk, v) {
    var dot = '<i class="dt">·</i>';
    var line = gk ? "<span><b>" + r.w + "-" + r.l + "-" + r.t + "</b> " + (OT ? "W-L-OTL" : "W-L-T") + "</span>" + dot + "<span><b>" + r.so + "</b> SO</span>" + dot + "<span><b>" + r.ga + "</b> GA</span>"
      : "<span><b>" + r.g + "</b> Goals</span>" + dot + "<span><b>" + r.a + "</b> Assists</span>" + dot + "<span><b>" + r.pts + "</b> Points</span>";
    var x = r[v.k], val = typeof x !== "number" ? "–" : v.k === "wpct" ? f3(x) : v.k === "min" ? f1(x) : x % 1 ? f2(x) : x;
    return '<div class="pc pc2' + (mine(r.team) ? " me" : "") + '"><div class="r">' + (i + 1) + '</div><div class="pn"><div class="pl">' + badge(r.team) + '<b class="nm">' + plink(r.team, r.name) + '</b></div><div class="pst"><span class="ptm">' + esc(SHORT[r.team]) + "</span>" + dot + line + "</div></div>" +
      '<div class="pv">' + val + "<small>" + v.l + "</small></div></div>";
  }
  /* which stat the big number on the right shows: the one the list is sorted by */
  function pval(cols, cfg, def) {
    var k = cfg.key === "rank" || cfg.key === "name" || cfg.key === "team" ? def : cfg.key;
    var c = cols.filter(function (c) { return c[0] === k; })[0];
    return { k: k, l: c ? c[1].replace(/[▾▴]/g, "") : k.toUpperCase() };
  }
  var MINGP_SK = 5, MINGP_GK = 3;
  function ptStart(cols, cfg) {
    var n = 0, cg = cols.map(function (c) {
      var k = c[0] === "name" ? "nm" : c[0] === "rank" ? "rk" : c[0] === "team" ? "tm" : "nu";
      if (k === "nu") n++;
      return "<col" + (k ? ' class="' + k + '"' : "") + ">";
    }).join("");
    var w = 40 + 170 + n * 52 + (cols.some(function (c) { return c[0] === "team"; }) ? 150 : 0);
    return '<table class="pt" style="min-width:' + w + 'px"><colgroup>' + cg + "</colgroup>" + head(cols, cfg);
  }
  var MSORT = { skaters: [["pts", "Points", -1], ["g", "Goals", -1], ["a", "Assists", -1], ["pgp", "Points per game", -1], ["ggp", "Goals per game", -1], ["ppg", "Power-play goals", -1], ["ppp", "Power-play points", -1], ["shp", "Short-handed points", -1], ["gwg", "Game-winning goals", -1], ["pen", "Penalty minutes", -1]], goalies: [["gaa", "Best GAA", 1], ["w", "Wins", -1], ["so", "Shutouts", -1], ["wpct", "Win %", -1], ["gp", "Games played", -1], ["gs", "Games started", -1], ["min", "Minutes", -1]] };
  function msortCtl(cfg) {
    var opts = MSORT[state.ptab], cur = opts.some(function (o) { return o[0] === cfg.key; }) ? cfg.key : opts[0][0];
    var lbl = opts.filter(function (o) { return o[0] === cur; })[0][1];
    return '<div class="mtools"><label class="pick"><span>' + esc(lbl) + '</span><select id="msort" aria-label="Sort by">' + opts.map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === cur ? " selected" : "") + ">" + o[1] + "</option>"; }).join("") + "</select></label>" + teamPick() + "</div>";
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
        return '<li><span class="lrk">' + (i + 1) + '</span><span class="ln">' + plink(r.team, r.name) + (all ? " " + badgeC(r.team) : "") + (di === 0 ? ' <small class="lsub">' + r.g + "G " + r.a + "A</small>" : "") + '</span><b class="lv">' + r[d[2]] + '</b>' + (di === 0 ? '<span class="lbar" aria-hidden="true"><i class="sg" style="width:' + (r.g / mx * 100).toFixed(1) + '%"></i><i class="sa" style="width:' + (r.a / mx * 100).toFixed(1) + '%"></i></span></li>' : '<span class="lbar" aria-hidden="true"><i class="' + (di === 3 ? "h" : "") + '" style="width:' + Math.max(4, Math.round(r[d[2]] / mx * 100)) + '%"></i></span></li>');
      }).join("") || '<li class="lnone">No data yet</li>') + "</ol></div>";
    }).join("");
    return '<div><h3 style="margin:8px 0 12px">Top 8 leaders · ' + (all ? "All " + DT().length + " teams" : esc(TEAMS[state.team])) + '</h3><div class="lgrid">' + cards + '</div><p class="mfoot" style="margin-top:10px">PIM assumes 2 minutes per penalty. Goalie wins are credited when one goalie played the whole game. Power-play stats are counted for ' + TIMED.length + ' of ' + G.length + ' games read so far.</p></div>';
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
        return '<li><span class="lrk">' + (i + 1) + '</span><span class="ln">' + plink(r.team, r.name) + (all ? " " + badgeC(r.team) : "") + (d.special ? ' <small class="lsub">' + r.g + "G " + r.a + "A</small>" : (d.sub ? ' <small class="lsub">' + d.sub(r) + "</small>" : "")) + '</span><b class="lv">' + f(r[d.k]) + (d.unit || "") + "</b>" +
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
        { t: "Penalty minutes", rows: sks, k: "pen", u: "PIM", tie: byPts },
        { t: "Points per game", rows: sks.filter(function (r) { return r.gp >= MINGP_SK; }), k: OFFICIAL ? "pgp" : "ppg", u: "P/GP", f: f2, tie: byPts, sub: function (r) { return r.pts + " PTS · " + r.gp + " GP"; }, note: "Minimum " + MINGP_SK + " games" },
        { t: "Short-handed goals", rows: sks, k: "shg", u: "SHG", tie: byPts }
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
    return '<div class="fsil">' + silhouette(r.team) + '</div><div class="fwho"><div class="frank">#' + (i + 1) + (i === 0 ? " · Leader" : "") + '</div><div class="fname">' + plink(r.team, r.name) + '</div><div class="fteam">' + esc(TEAMS[r.team]) + "</div>" +
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
    var pv = '<div class="seg pvseg" role="group" aria-label="Players view">' + [["cards", "Cards"], ["list", "List"], ["table", "Table"]].map(function (x) { return '<button data-pv="' + x[0] + '"' + (x[0] === "table" ? ' class="mo"' : "") + ' aria-pressed="' + (state.pv === x[0] || (x[0] === "list" && state.pv === "table" && !document.body.classList.contains("m"))) + '">' + x[1] + "</button>"; }).join("") + "</div>";
    if (state.pv === "cards") return '<div class="tools"><div class="seg ptseg" role="group" aria-label="Player type">' + seg + "</div>" + pv + "</div>";
    return tools.replace('<div class="seg" role="group" aria-label="Player type">' + seg + "</div>", '<div class="seg ptseg" role="group" aria-label="Player type">' + seg + "</div>" + pv + '<span class="tbrk"></span>');
  }
  function renderPlayersC() {
    var all = state.team === "ALL", out = "", mrow = "";
    var seg = [["skaters", "Skaters"], ["goalies", "Goalies"]].map(function (x) { return '<button data-pt="' + x[0] + '" aria-pressed="' + (state.ptab === x[0]) + '">' + x[1] + "</button>"; }).join("");
    var advBtn = state.ptab === "skaters" ? '<button class="advbtn" data-adv aria-pressed="' + state.adv + '">' + (state.adv ? "Hide advanced" : "Advanced stats") + "</button>" : "";
    var tools = '<div class="tools"><div class="seg" role="group" aria-label="Player type">' + seg + '</div><input class="search" id="q" type="search" placeholder="Search a player" value="' + esc(state.q) + '" aria-label="Search players">' + advBtn + "</div>";
    var scope = all ? "All " + DT().length + " teams" : esc(TEAMS[state.team]);
    if (state.ptab === "skaters") {
      var rows = filt(SK), cfg = state.sk;
      var cols = [["rank", "#", "rk"], ["name", "Player", "l stick"]].concat(all ? [["team", "Team", "l"]] : []).concat([["gp", "GP"], ["g", "G"], ["a", "A"], ["pts", "PTS", "pts"], ["ppg", "P/GP"], ["pen", "PIM"], ["pwg", "PPG", "adv", "Power-play goals"], ["pwa", "PPA", "adv", "Power-play assists"], ["shg", "SHG", "adv", "Short-handed goals"], ["sha", "SHA", "adv", "Short-handed assists"], ["mp", "MP", "adv", "Multi-point games (2 or more points)"]]);
      var sorted = sortRows(rows, cfg.key === "rank" ? { key: "pts", dir: -1 } : cfg, function (x, y) { return y.pts - x.pts || y.g - x.g || x.name.localeCompare(y.name); });
      var body = sorted.slice(0, state.pm).map(function (r, i) {
        return '<tr class="' + (mine(r.team) && all ? "me" : "") + '"><td class="rk num">' + (i + 1) + '</td><td class="l strong stick">' + plink(r.team, r.name) + "</td>" + (all ? '<td class="l">' + tname(r.team) + "</td>" : "") +
          "<td>" + r.gp + "</td><td>" + r.g + "</td><td>" + r.a + '</td><td class="strong pts">' + r.pts + "</td><td>" + f2(r.ppg) + "</td><td>" + r.pen + '</td><td class="adv">' + r.pwg + '</td><td class="adv">' + r.pwa + '</td><td class="adv">' + r.shg + '</td><td class="adv">' + r.sha + '</td><td class="adv">' + r.mp + "</td>" + "</tr>";
      }).join("");
      var mxp = Math.max.apply(null, sorted.map(function (r) { return r.pts; }).concat([1]));
      mrow = msortCtlC(cfg);
      var pv = pval(cols, cfg, "pts");
      var mobSk = sorted.slice(0, state.pm).map(function (r, i) { return pcard(r, i, 0, pv); }).join("") + (sorted.length ? "" : '<p class="empty">No players match.</p>') + moreBtn(sorted.length);
      out = '<div class="tiles">' + leaderTile(rows, "pts", "Points leader", all) + leaderTile(rows, "g", "Goals leader", all) + leaderTile(rows, "a", "Assists leader", all) + leaderTile(GK.filter(function (r) { return state.team === "ALL" || r.team === state.team; }), "w", "Goalie wins", all) + "</div>" +
        '<div class="mob">' + mobSk + '</div><div class="card desk"><div class="wrap">' + ptStartC(cols, cfg.key === "rank" ? { key: "pts", dir: -1 } : cfg) + "<tbody>" + (body || '<tr><td class="empty" colspan="22">No players match.</td></tr>') + "</tbody></table></div>" +
        '<div class="morerow">' + moreBtn(sorted.length) + '</div></div>';
    } else {
      var grows = filt(GK), gc = state.gk;
      var gcols = [["rank", "#", "rk"], ["name", "Goalie", "l stick"]].concat(all ? [["team", "Team", "l"]] : []).concat([["gp", "GP"], ["w", "W"], ["l", "L"], ["t", "T"], ["min", "MIN"], ["ga", "GA"], ["gaa", "GAA"], ["so", "SO"]]);
      var gs = sortRows(grows, gc.key === "rank" ? { key: "gaa", dir: 1 } : gc, function (x, y) { return y.gp - x.gp || x.name.localeCompare(y.name); });
      var gb = gs.slice(0, state.pm).map(function (r, i) {
        return '<tr class="' + (mine(r.team) && all ? "me" : "") + '"><td class="rk num">' + (i + 1) + '</td><td class="l strong stick">' + plink(r.team, r.name) + "</td>" + (all ? '<td class="l">' + tname(r.team) + "</td>" : "") +
          "<td>" + r.gp + "</td><td>" + r.w + "</td><td>" + r.l + "</td><td>" + r.t + "</td><td>" + f1(r.min) + "</td><td>" + r.ga + '</td><td class="strong">' + f2(r.gaa) + "</td><td>" + r.so + "</td></tr>";
      }).join("");
      var best = grows.filter(function (r) { return r.min >= 60; }).sort(function (a, b) { return a.gaa - b.gaa; })[0];
      var mw = grows.slice().sort(function (a, b) { return b.w - a.w; })[0];
      var ms = grows.slice().sort(function (a, b) { return b.so - a.so; })[0];
      mrow = msortCtlC(gc);
      var pv = pval(gcols, gc, "gaa");
      var mobGk = gs.slice(0, state.pm).map(function (r, i) { return pcard(r, i, 1, pv); }).join("") + (gs.length ? "" : '<p class="empty">No goalies match.</p>') + moreBtn(gs.length);
      out = '<div class="tiles">' + (best ? tile("Best GAA", f2(best.gaa), esc(best.name) + (all ? " (" + best.team + ")" : "") + ", 60+ min") : tile("Best GAA", "–", "needs 60+ min")) +
        (mw ? tile("Most wins", mw.w, esc(mw.name) + (all ? " (" + mw.team + ")" : "")) : "") + (ms ? tile("Most shutouts", ms.so, esc(ms.name) + (all ? " (" + ms.team + ")" : "")) : "") + tile("Goalies", grows.length, "in this view") + "</div>" +
        '<div class="mob">' + mobGk + '</div><div class="card desk"><div class="wrap">' + ptStartC(gcols, gc.key === "rank" ? { key: "gaa", dir: 1 } : gc) + "<tbody>" + (gb || '<tr><td class="empty" colspan="22">No goalies match.</td></tr>') + "</tbody></table></div>" +
        '<div class="morerow">' + moreBtn(gs.length) + '</div><p class="note">GAA is goals against per 60 minutes in net. W, L and T are credited when one goalie played the whole game. Sheets do not record shots, so there is no save percentage.</p></div>';
    }
    var focusQ = document.activeElement && document.activeElement.id === "q";
    $("p-players").innerHTML = '<div class="sec-head"><div><h2>Players</h2></div></div>' +
      '<div style="display:flex;flex-direction:column;gap:16px;margin-top:16px">' + pvTools(tools, seg) + (state.pv === "cards" ? cardsHTML() : mrow + '<div class="pout' + (state.pv === "table" ? " ptable" : "") + '">' + out + "</div>" + leadersHTML()) + "</div>";
    if (focusQ) { var el = $("q"); el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
  }
  function renderPlayers() {
    if (!OFFICIAL) return renderPlayersC();
    var all = state.team === "ALL", out = "", mrow = "";
    var seg = [["skaters", "Skaters"], ["goalies", "Goalies"]].map(function (x) { return '<button data-pt="' + x[0] + '" aria-pressed="' + (state.ptab === x[0]) + '">' + x[1] + "</button>"; }).join("");
    var tools = '<div class="tools"><div class="seg" role="group" aria-label="Player type">' + seg + '</div><input class="search" id="q" type="search" placeholder="Search a player" value="' + esc(state.q) + '" aria-label="Search players">' + '<button class="advbtn" data-adv aria-pressed="' + state.adv + '">' + (state.adv ? "Hide advanced" : "Advanced stats") + "</button></div>";
    if (state.ptab === "skaters") {
      var rows = filt(SK), cfg = state.sk;
      var cols = [["rank", "#", "rk"], ["name", "Player", "l stick"]].concat(all ? [["team", "Team", "l"]] : []).concat([["gp", "GP", "", "Games played"], ["g", "G", "", "Goals"], ["a", "A", "", "Assists"], ["pts", "PTS", "pts", "Points"], ["pgp", "P/GP", "", "Points per game"], ["pen", "PIM", "", "Penalty minutes"], ["ppg", "PPG", "grp", "Power-play goals"], ["ppa", "PPA", "", "Power-play assists"], ["ppp", "PPP", "", "Power-play points"], ["shg", "SHG", "grp", "Short-handed goals"], ["sha", "SHA", "", "Short-handed assists"], ["shp", "SHP", "", "Short-handed points"], ["gwg", "GWG", "grp", "Game-winning goals"], ["gtg", "GTG", "", "Game-tying goals"]]);
      var sorted = sortRows(rows, cfg.key === "rank" ? { key: "pts", dir: -1 } : cfg, function (x, y) { return y.pts - x.pts || y.g - x.g || x.name.localeCompare(y.name); });
      var body = sorted.slice(0, state.pm).map(function (r, i) {
        return '<tr class="' + (mine(r.team) && all ? "me" : "") + '"><td class="rk num">' + (i + 1) + '</td><td class="l strong stick">' + plink(r.team, r.name) + "</td>" + (all ? '<td class="l">' + tname(r.team) + "</td>" : "") +
          "<td>" + r.gp + "</td><td>" + r.g + "</td><td>" + r.a + '</td><td class="strong pts">' + r.pts + "</td><td>" + f2(r.pgp) + "</td><td>" + r.pen + '</td><td class="grp">' + r.ppg + "</td><td>" + r.ppa + "</td><td>" + r.ppp + '</td><td class="grp">' + r.shg + "</td><td>" + r.sha + "</td><td>" + r.shp + '</td><td class="grp">' + r.gwg + "</td><td>" + r.gtg + "</td></tr>";
      }).join("");
      var mxp = Math.max.apply(null, sorted.map(function (r) { return r.pts; }).concat([1]));
      mrow = msortCtl(cfg);
      var pv = pval(cols, cfg, "pts");
      var mobSk = sorted.slice(0, state.pm).map(function (r, i) { return pcard(r, i, 0, pv); }).join("") + (sorted.length ? "" : '<p class="empty">No players match.</p>') + moreBtn(sorted.length);
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
        return '<tr class="' + (mine(r.team) && all ? "me" : "") + '"><td class="rk num">' + (i + 1) + '</td><td class="l strong stick">' + plink(r.team, r.name) + "</td>" + (all ? '<td class="l">' + tname(r.team) + "</td>" : "") +
          "<td>" + r.gp + "</td><td>" + r.gs + "</td><td>" + r.w + "</td><td>" + r.l + "</td><td>" + r.t + "</td><td>" + f3(r.wpct) + "</td><td>" + f1(r.min) + "</td><td>" + r.ga + '</td><td class="strong">' + f2(r.gaa) + "</td><td>" + r.so + "</td></tr>";
      }).join("");
      var qual = grows.filter(function (r) { return r.gp >= MINGP_GK; });
      var best = qual.slice().sort(function (a, b) { return a.gaa - b.gaa; })[0];
      var mw = grows.slice().sort(function (a, b) { return b.w - a.w; })[0];
      var ms = grows.slice().sort(function (a, b) { return b.so - a.so; })[0];
      mrow = msortCtl(gc);
      var pv = pval(gcols, gc, "gaa");
      var mobGk = gs.slice(0, state.pm).map(function (r, i) { return pcard(r, i, 1, pv); }).join("") + (gs.length ? "" : '<p class="empty">No goalies match.</p>') + moreBtn(gs.length);
      out = '<div class="tiles">' + (best ? tile("Best GAA", f2(best.gaa), esc(best.name) + (all ? " (" + best.team + ")" : "") + ", min " + MINGP_GK + " GP") : tile("Best GAA", "–", "needs " + MINGP_GK + " GP")) +
        (mw ? tile("Most wins", mw.w, esc(mw.name) + (all ? " (" + mw.team + ")" : "")) : "") + (ms ? tile("Most shutouts", ms.so, esc(ms.name) + (all ? " (" + ms.team + ")" : "")) : "") + tile("Goalies", grows.length, "in this view") + "</div>" +
        '<div class="mob">' + mobGk + '</div><div class="card desk"><div class="wrap">' + ptStart(gcols, gc.key === "rank" ? { key: "gaa", dir: 1 } : gc) + "<tbody>" + (gb || '<tr><td class="empty" colspan="13">No goalies match.</td></tr>') + "</tbody></table></div>" +
        '<div class="morerow">' + moreBtn(gs.length) + '</div><p class="note">GAA is goals against per ' + GLEN + '-minute game. W% is wins divided by games played. GAA sorts goalies with fewer than ' + MINGP_GK + " games last. Shots against and save percentage are not in the league stats. Official goalie stats through " + dlong(AS_OF) + (DATA_THROUGH && DATA_THROUGH > AS_OF ? ", plus game sheets through " + dlong(DATA_THROUGH) : "") + ".</p></div>";
    }
    var focusQ = document.activeElement && document.activeElement.id === "q";
    $("p-players").innerHTML = '<div class="sec-head"><div><h2>Players</h2></div></div>' +
      '<div style="display:flex;flex-direction:column;gap:16px;margin-top:16px">' + pvTools(tools, seg) + (state.pv === "cards" ? cardsHTML() : mrow + '<div class="pout' + (state.pv === "table" ? " ptable" : "") + '">' + out + "</div>" + leadersHTML()) + "</div>";
    if (focusQ) { var el = $("q"); el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
  }

  /* ---------- team pages ---------- */
  /* home/away record from scores. Overtime leagues: scores can't tell an overtime loss from a regulation one, so W-L (plus T for a rare tie). */
  function recOf(list) {
    var w = 0, tt = 0, l = 0;
    list.forEach(function (x) { if (x.r === "W") w++; else if (x.r === "T") tt++; else l++; });
    return OT ? w + "-" + l + (tt ? "-" + tt : "") : w + "-" + tt + "-" + l;
  }
  function recOfLbl(list) { return OT ? (list.some(function (x) { return x.r === "T"; }) ? "W-L-T" : "W-L") : "W-T-L"; }
  /* Teams tab: one layout for every league. Sheet leagues count player stats from the game sheets; official leagues use the league's tables. */
  function renderTeams() {
    var el = $("p-teams");
    var recLbl = OT ? "W-L-OTL" : "W-T-L";
    if (state.team === "ALL") {
      el.innerHTML = '<div class="sec-head"><div><h2>Teams</h2></div></div><div style="margin-top:16px">' +
        curDivs().map(function (d) { return (MULTI ? '<h3 class="divh">' + esc(d.name) + "</h3>" : "") + '<div class="teamgrid">' + d.teams.map(function (t) {
          var s = ST[t];
          return '<button class="tcard" data-team="' + t + '">' + badge(t, 1) + '<span class="tc-n">' + esc(TEAMS[t]) + '</span><span class="tc-r">' + ord(s.rank) + " · " + rec(s) + " · " + (s.pend ? "–" : s.pts) + " PTS</span></button>";
        }).join("") + "</div>"; }).join("") + "</div>";
      return;
    }
    var t = state.team, s = ST[t], rs = results(t), ng = nextGame(t), tab = state.ttab || "overview";
    var homeR = rs.filter(function (x) { return x.home; }), awayR = rs.filter(function (x) { return !x.home; });
    var NT = ORDER.length;
    var pill = function (r, fewest) {
      if (!r) return "";
      var cls = r <= Math.max(1, Math.round(NT / 4)) ? "good" : r > NT - Math.max(1, Math.round(NT / 4)) ? "bad" : "";
      return '<span class="rkp ' + cls + '" title="' + ord(r) + " of " + NT + '">' + ord(r) + (fewest ? " fewest" : "") + "</span>";
    };
    var GOALIE_LBL = OT ? "W-L-OTL" : "W-T-L";
    var gameHref = function (g) { return "#game/" + g.id; };

    /* ---- banner in the team's colours ---- */
    var last10 = rs.slice(-10), mxm = Math.max.apply(null, last10.map(function (x) { return Math.abs(x.us - x.them); }).concat([1]));
    var formBar = last10.length ? '<div class="tb-form"><span class="tb-k">Last ' + last10.length + '</span><div class="tb-bars">' + last10.map(function (x) {
      var h = 10 + Math.round(Math.abs(x.us - x.them) / mxm * 26);
      return '<a class="grs fb ' + x.r + '" href="' + gameHref(x.g) + '" style="height:' + h + 'px" title="' + (x.r === "W" ? "Win" : x.r === "L" ? "Loss" : "Tie") + " " + x.us + "–" + x.them + (x.home ? " vs " : " at ") + esc(SHORT[x.opp]) + ", " + dshort(x.g.date) + '"><span class="sr">' + x.r + " " + x.us + "–" + x.them + "</span></a>";
    }).join("") + "</div></div>" : "";
    var nextBox = ng ? '<div class="tb-next"><span class="tb-k">Next game</span><b>' + esc(dshort(ng.date)) + (ng.time === "TBD" ? "" : " · " + esc(ng.time)) + "</b>" +
      '<span class="tb-opp">' + (ng.h === t ? "vs " : "at ") + badge(ng.h === t ? ng.a : ng.h) + "<em>" + esc(TEAMS[ng.h === t ? ng.a : ng.h]) + "</em></span>" +
      '<button class="tb-btn" data-open="' + ng.id + '">Matchup preview</button></div>' : '<div class="tb-next"><span class="tb-k">Next game</span><b>No games left</b></div>';
    var head = '<section class="tban" id="tban"><div class="tb-in">' +
      '<div class="tb-id"><span class="tb-logo">' + badge(t, 1) + "</span><div>" +
      '<span class="tb-k">' + ord(s.rank) + " in the " + (MULTI ? esc(divOf(t).name) : GROUP) + "</span>" +
      '<h2 class="tname">' + esc(TEAMS[t]) + "</h2>" +
      '<div class="tb-big"><span><b>' + rec(s) + "</b><small>" + RECL + "</small></span><span><b>" + (s.pend ? "–" : s.pts) + "</b><small>Points</small></span><span>" + streakOf(t) + "<small>Streak</small></span></div>" +
      "</div></div>" + formBar + nextBox + "</div></section>";

    /* ---- one strip of key numbers, ranks coloured ---- */
    var strip = '<div class="tstrip">' +
      '<div><span class="k">Points %</span><b>' + s.pct + "</b>" + pill(RK.pctn[t]) + "</div>" +
      '<div><span class="k"><span class="lo">Goals for / game</span><span class="sh">GF / game</span></span><b>' + f2(s.gfg) + "</b>" + pill(RK.gfg[t]) + "</div>" +
      '<div><span class="k"><span class="lo">Goals against / game</span><span class="sh">GA / game</span></span><b>' + f2(s.gag) + "</b>" + pill(RK.gag[t], 1) + "</div>" +
      '<div><span class="k">Home</span><b>' + recOf(homeR) + '</b><span class="s">' + recOfLbl(homeR) + "</span></div>" +
      '<div><span class="k">Away</span><b>' + recOf(awayR) + '</b><span class="s">' + recOfLbl(awayR) + "</span></div>" +
      '<div><span class="k">PIM / game</span><b>' + f1(s.pimg) + "</b>" + pill(RK.pimg[t], 1) + "</div></div>";

    var TABS_T = [["overview", "Overview"], ["roster", "Roster"], ["games", "Games"], ["insights", "Insights"]];
    var tabs = '<div class="ttabs" role="tablist" aria-label="Team page sections">' + TABS_T.map(function (x) {
      return '<button role="tab" data-ttab="' + x[0] + '" aria-selected="' + (tab === x[0]) + '">' + x[1] + "</button>";
    }).join("") + "</div>";

    /* ---- shared pieces ---- */
    var V = OFFICIAL ? { pgp: "pgp", ppg: "ppg", ppa: "ppa" } : { pgp: "ppg", ppg: "pwg", ppa: "pwa" };
    var sks = SK.filter(function (r) { return r.team === t; }).sort(function (a, b) { return b.pts - a.pts || b.g - a.g || a.name.localeCompare(b.name); });
    var gks = GK.filter(function (r) { return r.team === t; }).sort(function (a, b) { return b.min - a.min; });
    var n0 = function (v) { return v || 0; };
    var jn = function (r) { return NUM[t] && NUM[t][r.name] != null ? NUM[t][r.name] : ""; };
    var resRow = function (x) {
      return '<a class="grs trow tr2 ' + x.r + '" href="' + gameHref(x.g) + '"><span class="tdt">' + dshort(x.g.date) + '</span><span class="to">' + (x.home ? "vs " : "at ") + badge(x.opp) + "<b>" + esc(SHORT[x.opp]) + '</b></span><span class="tres ' + x.r + '"><b>' + x.r + "</b> " + x.us + "–" + x.them + "</span></a>";
    };
    var upAll = UPCOMING.filter(function (g) { return g.a === t || g.h === t; });
    var upRow = function (g) {
      var home = g.h === t, opp = home ? g.a : g.h;
      return '<div class="trow up"><span class="tdt">' + dshort(g.date) + (g.time === "TBD" ? "" : "<small>" + g.time + "</small>") + '</span><span class="to">' + (home ? "vs " : "at ") + tname(opp) + "<small>" + esc(g.venue) + '</small></span><button class="btn" data-open="' + g.id + '">Preview</button></div>';
    };
    var more = function (to, label) { return '<button class="tmore" data-ttab="' + to + '">' + label + " <span aria-hidden=\"true\">→</span></button>"; };
    var I = teamInsightData(t);
    var insItem = function (x) { return '<div class="ins2 ' + x.tone + '"><b>' + x.big + "</b><p>" + x.text + "</p></div>"; };

    var body = "";
    if (tab === "overview") {
      var top = sks[0], gl = sks.slice().sort(function (a, b) { return b.g - a.g || b.pts - a.pts; })[0], gk = gks[0];
      var leader = function (r, lbl, big, unit, sub) {
        return '<div class="ldr"><span class="ldr-n">' + (jn(r) !== "" ? "#" + jn(r) : "") + '</span><div><span class="k">' + lbl + "</span>" +
          '<span class="ldr-nm">' + plink(t, r.name) + '</span><span class="ldr-s">' + sub + "</span></div>" + '<span class="ldr-v"><b>' + big + "</b><small>" + unit + "</small></span></div>";
      };
      var leaders = (top ? leader(top, "Points leader", top.pts, "PTS", top.g + " G · " + top.a + " A · " + top.gp + " GP") : "") +
        (gl && gl.g ? leader(gl, "Goals leader", gl.g, "G", f2(gl.g / Math.max(1, gl.gp)) + " per game") : "") +
        (gk ? leader(gk, "Goalie", f2(gk.gaa), "GAA", gk.w + "-" + gk.l + "-" + gk.t + " · " + gk.so + " SO") : "");
      var picks = I.items.filter(function (x) { return x.tone === "good"; }).slice(0, 2).concat(I.items.filter(function (x) { return x.tone === "bad"; }).slice(0, 1));
      body = '<div class="tov">' +
        '<div class="card tchart"><div class="tc-hd"><h3>Game by game</h3><span class="tc-leg"><i class="k-gf"></i>Goals for<i class="k-ga"></i>Goals against</span></div>' + gameChart(rs) + "</div>" +
        '<div class="card tldrs"><h3>Team leaders</h3>' + (leaders || '<p class="empty">No player stats yet.</p>') + more("roster", "Full roster") + "</div>" +
        '<div class="card tlst"><h3>Recent results</h3>' + (rs.slice(-5).reverse().map(resRow).join("") || '<p class="empty">No games played yet.</p>') + more("games", "All results") + "</div>" +
        '<div class="card tlst"><h3>Coming up</h3>' + (upAll.slice(0, 3).map(upRow).join("") || '<p class="empty">No games left on the schedule.</p>') + more("games", "Full schedule") + "</div>" +
        (picks.length ? '<div class="card tins"><h3>What stands out</h3>' + picks.map(insItem).join("") + more("insights", "All insights") + "</div>" : "") +
        "</div>";
    } else if (tab === "roster") {
      var full = !!state.tmore, mxp = Math.max.apply(null, sks.map(function (r) { return r.pts; }).concat([1]));
      var extra = full ? '<th class="grp">PPG</th><th>PPA</th><th>PPP</th><th class="grp">SHG</th><th>SHA</th><th>SHP</th><th class="grp">GWG</th><th>GTG</th>' : "";
      var skT = '<div class="card"><div class="wrap"><table class="rt jt"><thead><tr><th class="jn stick" title="Jersey number">#</th><th class="l stick s2">Skater</th><th>GP</th><th>G</th><th>A</th><th class="ptsh">PTS</th><th>P/GP</th><th>PIM</th>' + extra + "</tr></thead><tbody>" + sks.map(function (r, i) {
        var ex = full ? '<td class="grp">' + n0(r[V.ppg]) + "</td><td>" + n0(r[V.ppa]) + "</td><td>" + n0(r.ppp) + '</td><td class="grp">' + n0(r.shg) + "</td><td>" + n0(r.sha) + "</td><td>" + n0(r.shp) + '</td><td class="grp">' + n0(r.gwg) + "</td><td>" + n0(r.gtg) + "</td>" : "";
        return '<tr class="' + (i === 0 && r.pts ? "top" : "") + '"><td class="jn stick">' + jn(r) + '</td><td class="l strong stick s2">' + plink(r.team, r.name) + "</td><td>" + r.gp + "</td><td>" + r.g + "</td><td>" + r.a + '</td><td class="ptsb"><span class="pbar2" style="width:' + Math.round(r.pts / mxp * 100) + '%"></span><b>' + r.pts + "</b></td><td>" + f2(r[V.pgp]) + "</td><td>" + r.pen + "</td>" + ex + "</tr>";
      }).join("") + "</tbody></table></div></div>";
      var gkT = '<div class="card"><div class="wrap"><table class="rt"><thead><tr><th class="l stick">Goalie</th><th>GP</th><th>GS</th><th>' + GOALIE_LBL + "</th><th>W%</th><th>MIN</th><th>GA</th><th>GAA</th><th>SO</th></tr></thead><tbody>" + gks.map(function (r) {
        return '<tr><td class="l strong stick">' + plink(r.team, r.name) + "</td><td>" + r.gp + "</td><td>" + n0(r.gs) + "</td><td>" + r.w + "-" + r.l + "-" + r.t + "</td><td>" + f3(r.wpct || 0) + "</td><td>" + f1(r.min) + "</td><td>" + r.ga + '</td><td class="strong">' + f2(r.gaa) + "</td><td>" + r.so + "</td></tr>";
      }).join("") + "</tbody></table></div></div>";
      var foot = OFFICIAL ? "Official player stats through " + dlong(AS_OF) + (DATA_THROUGH && DATA_THROUGH > AS_OF ? ", plus game sheets through " + dlong(DATA_THROUGH) : "") + "." : "";
      body = '<div class="trost"><div class="tr-hd"><h3>Skaters</h3><button class="btn" data-tmore="1" aria-pressed="' + full + '">' + (full ? "Fewer stats" : "More stats") + "</button></div>" + skT +
        "<h3>Goalies</h3>" + gkT + (foot ? '<p class="mfoot">' + foot + "</p>" : "") + "</div>";
    } else if (tab === "games") {
      var one = rs.filter(function (x) { return Math.abs(x.us - x.them) === 1; }), blow = rs.filter(function (x) { return Math.abs(x.us - x.them) >= 3; });
      var sum = function (lbl, list) { return list.length ? '<div><span class="k">' + lbl + "</span><b>" + recOf(list) + '</b><span class="s">' + recOfLbl(list) + "</span></div>" : ""; };
      body = '<div class="tgames"><div class="tstrip sm">' + sum("Home", homeR) + sum("Away", awayR) + sum("One-goal games", one) + sum("Won or lost by 3+", blow) + "</div>" +
        '<div class="tg2"><div><h3>Results</h3><div class="card tlst">' + (rs.slice().reverse().map(resRow).join("") || '<p class="empty">No games played yet.</p>') + "</div></div>" +
        '<div><h3>Upcoming</h3><div class="card tlst">' + (upAll.map(upRow).join("") || '<p class="empty">No games left on the schedule.</p>') + "</div></div></div></div>";
    } else {
      var good = I.items.filter(function (x) { return x.tone === "good"; }), bad = I.items.filter(function (x) { return x.tone === "bad"; });
      body = '<div class="tinsp">' + (I.S.length >= 3 ? '<div class="card tchart"><div class="tc-hd"><h3>By period</h3><span class="tc-leg"><i class="k-gf"></i>Goals for<i class="k-ga"></i>Goals against<i class="k-pn"></i>Penalties</span></div>' + periodChart(I) + "</div>" : "") +
        '<div class="tins2"><div><h3 class="ins-good">Strengths</h3>' + (good.map(insItem).join("") || '<p class="empty">Nothing stands out yet.</p>') + "</div>" +
        '<div><h3 class="ins-bad">Watch-outs</h3>' + (bad.map(insItem).join("") || '<p class="empty">Nothing stands out yet.</p>') + "</div></div>" +
        '<p class="mfoot">Trends use every result' + (I.S.length ? "; periods, penalties and special teams use the " + I.S.length + " game sheet" + (I.S.length === 1 ? "" : "s") + " with goal times" + (I.S.length < I.n ? " (of " + I.n + " games played)" : "") : "") + ". A power-play chance starts each time the other team goes a man down.</p></div>";
    }
    el.innerHTML = '<div class="tpage" id="tpage" style="--tc:' + teamColor(t) + '">' + head + strip + tabs + '<div class="tbody" role="tabpanel">' + body + "</div></div>";
    paintTeamColor(t);
  }

  /* ---------- team colours: the strongest colour in the team's logo, worked out once in the browser ---------- */
  var TCOL = {};
  function teamColor(t) { return TCOL[t] || BADGE[t] || "#1F4E8C"; }
  function paintTeamColor(t) { logoColor(t, function (hex) { var pg = $("tpage"); if (pg && state.team === t) pg.style.setProperty("--tc", hex); }); }
  function logoColor(t, cb) {
    var fb = BADGE[t] || "#1F4E8C";
    if (TCOL[t]) { cb(TCOL[t]); return; }
    if (!LOGOS) { TCOL[t] = fb; cb(fb); return; }
    var probe = document.createElement("div"); probe.style.cssText = "position:absolute;left:-9999px;top:0"; probe.innerHTML = badge(t, 1); document.body.appendChild(probe);
    var el = probe.querySelector(".lg"), m = el && /url\(["']?(.*?)["']?\)/.exec(getComputedStyle(el).backgroundImage || "");
    probe.parentNode.removeChild(probe);
    if (!m) { TCOL[t] = fb; cb(fb); return; }
    var img = new Image();
    img.onerror = function () { TCOL[t] = fb; cb(fb); };
    img.onload = function () {
      try {
        var c = document.createElement("canvas"), N = 40; c.width = c.height = N;
        var x = c.getContext("2d"); x.drawImage(img, 0, 0, N, N);
        var d = x.getImageData(0, 0, N, N).data, bins = {};
        for (var i = 0; i < d.length; i += 4) {
          if (d[i + 3] < 200) continue;
          var r = d[i], g = d[i + 1], b = d[i + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 510, sat = mx === mn ? 0 : (mx - mn) / (255 - Math.abs(mx + mn - 255));
          if (sat < 0.3 || l < 0.12 || l > 0.85) continue;
          var hue = mx === r ? ((g - b) / (mx - mn) + 6) % 6 : mx === g ? (b - r) / (mx - mn) + 2 : (r - g) / (mx - mn) + 4, k = Math.round(hue * 2) % 12;   // 12 hue families
          var o = bins[k] || (bins[k] = { n: 0, r: 0, g: 0, b: 0 }); o.n++; o.r += r; o.g += g; o.b += b;
        }
        var best = null; Object.keys(bins).forEach(function (k) { if (!best || bins[k].n > best.n) best = bins[k]; });
        TCOL[t] = !best || best.n < 40 ? fb : "#" + [best.r, best.g, best.b].map(function (v) { return ("0" + Math.round(v / best.n).toString(16)).slice(-2); }).join("");
      } catch (e) { TCOL[t] = fb; }
      cb(TCOL[t]);
    };
    img.src = m[1];
  }

  /* ---------- team colours for two-team pages (game summary, matchup preview) ---------- */
  function teamPair(a, h) {
    var ca = teamColor(a), ch = teamColor(h);
    var rgb = function (x) { var m = /^#?([0-9a-f]{6})$/i.exec(x || ""); if (!m) return [0, 0, 0]; var n = parseInt(m[1], 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
    var p = rgb(ca), q = rgb(ch), d = Math.sqrt(Math.pow(p[0] - q[0], 2) + Math.pow(p[1] - q[1], 2) + Math.pow(p[2] - q[2], 2));
    if (d < 90) ch = "#5B6B80";                           // two teams in near-identical colours: keep them apart on the charts
    return "--ca:" + ca + ";--ch:" + ch;
  }
  function paintPair(id, a, h) {
    var n = 0, done = function () { if (++n < 2) return; var el = $(id); if (el) el.setAttribute("style", teamPair(a, h)); };
    logoColor(a, done); logoColor(h, done);
  }
  function abbr(t) { return esc(SHORT[t]); }

  /* ---------- game summary extras ---------- */
  /* when each goal and penalty happened, in seconds from the opening face-off */
  function flowTimes(D) {
    var plen = Math.round(D.glen / 3 * 60), ab = function (p, t) { return (p - 1) * plen + Math.min(toSec(t), plen); };
    var ot = D.periods.filter(function (p) { return p >= 4; }).length;
    var otMax = 0; D.goals.concat(D.pens).forEach(function (e) { if (e.per >= 4) otMax = Math.max(otMax, toSec(e.time)); });
    var end = 3 * plen + (ot ? Math.max(300, otMax + 30) : 0);
    return { plen: plen, end: end, ab: ab, ot: ot };
  }
  function gameFlow(g, D) {
    var T = flowTimes(D), W = document.body.classList.contains("m") ? 480 : 1200, H = 230, top = 26, mid = 104, lane = 182;
    var marg = 0, maxM = 2; D.goals.forEach(function (x) { maxM = Math.max(maxM, Math.abs(x.sa - x.sh)); });
    var u = (mid - top) / maxM, X = function (s) { return (s / T.end * W).toFixed(1); };
    var segs = "", prev = 0, out = "";
    D.goals.forEach(function (x) {
      var s = T.ab(x.per, x.time);
      if (marg) segs += '<rect class="' + (marg > 0 ? "fa" : "fh") + '" x="' + X(prev) + '" y="' + (marg > 0 ? mid - marg * u : mid).toFixed(1) + '" width="' + (X(s) - X(prev)).toFixed(1) + '" height="' + Math.abs(marg * u).toFixed(1) + '"/>';
      prev = s; marg = x.sa - x.sh;
    });
    if (marg) segs += '<rect class="' + (marg > 0 ? "fa" : "fh") + '" x="' + X(prev) + '" y="' + (marg > 0 ? mid - marg * u : mid).toFixed(1) + '" width="' + (W - X(prev)).toFixed(1) + '" height="' + Math.abs(marg * u).toFixed(1) + '"/>';
    // step line
    var path = "M0 " + mid, m2 = 0;
    D.goals.forEach(function (x) { var s = X(T.ab(x.per, x.time)); path += " H" + s + " V" + (mid - (x.sa - x.sh) * u).toFixed(1); m2 = x.sa - x.sh; });
    path += " H" + W;
    // period lines
    var per = "";
    for (var p = 1; p <= 3 + T.ot; p++) {
      var x0 = p === 1 ? 0 : X((p - 1) * T.plen), x1 = p <= 3 ? X(p * T.plen) : W;
      if (p > 1) per += '<line class="pl" x1="' + x0 + '" x2="' + x0 + '" y1="' + (top - 14) + '" y2="' + (lane + 30) + '"/>';
      per += '<text class="plb" x="' + ((+x0 + +x1) / 2).toFixed(1) + '" y="12">' + (p >= 4 ? "OT" : ["1st", "2nd", "3rd"][p - 1]) + "</text>";
    }
    // penalties: one lane per team under the chart, each box as long as the penalty
    var pens = D.pens.filter(function (x) { return x.mins > 0 && x.per; }).map(function (x) {
      var s = T.ab(x.per, x.time), e = Math.min(s + x.mins * 60, x.per <= 3 ? x.per * T.plen : T.end), y = x.t === D.a ? lane : lane + 16;
      return '<rect class="' + (x.t === D.a ? "pa" : "ph") + '" x="' + X(s) + '" y="' + y + '" width="' + Math.max(3, X(e) - X(s)).toFixed(1) + '" height="11" rx="2"><title>' + esc(x.time) + " " + perShort(x.per) + " · " + esc(x.k ? nm(x.t, x.k) : "Bench") + " (" + abbr(x.t) + ") · " + esc(x.what || "Penalty") + ", " + x.mins + " min</title></rect>";
    }).join("");
    // goal markers: jersey number where we have it
    var dots = D.goals.map(function (x) {
      var s = X(T.ab(x.per, x.time)), y = (mid - (x.sa - x.sh) * u).toFixed(1), name = x.k ? nm(x.t, x.k) : "Unknown";
      var num = NUM[x.t] && NUM[x.t][name] != null ? String(NUM[x.t][name]) : "";
      return '<g class="gm ' + (x.t === D.a ? "a" : "h") + '"><title>' + esc(x.time) + " " + perShort(x.per) + " · " + esc(name) + " (" + abbr(x.t) + ")" + (x.kind === "pp" ? ", power play" : x.kind === "sh" ? ", short-handed" : "") + (x.gw ? ", game-winner" : "") + " · " + x.sa + "–" + x.sh + "</title>" +
        '<circle cx="' + s + '" cy="' + y + '" r="12"/><text x="' + s + '" y="' + (+y + 4) + '">' + esc(num || "•") + "</text></g>";
    }).join("");
    var lbl = '<text class="yl a" x="6" y="' + (top + 4) + '">' + abbr(D.a) + " ahead</text>" + '<text class="yl h" x="6" y="' + (mid + maxM * u - 4).toFixed(1) + '">' + abbr(D.h) + " ahead</text>";
    return '<svg class="gflow" viewBox="0 0 ' + W + " " + (lane + 32) + '" role="img" aria-label="Game flow: who led, by how much, and when each goal and penalty happened">' + per +
      '<line class="mid" x1="0" x2="' + W + '" y1="' + mid + '" y2="' + mid + '"/>' + segs + '<path class="step" d="' + path + '"/>' + pens + dots + lbl + "</svg>";
  }
  function keyMoments(g, sh, D) {
    var c = [], card = function (k, big, txt, tm) { c.push('<div class="km' + (tm ? " " + tm : "") + '"><span class="k">' + k + "</span><b>" + big + "</b><p>" + txt + "</p></div>"); };
    var who = function (x) { return plinkK(x.t, x.k) + " <small>" + abbr(x.t) + "</small>"; };
    var side = function (t) { return t === D.a ? "a" : "h"; };
    var f = D.goals[0];
    if (f && D.timed) card("First goal", esc(f.time) + " " + perShort(f.per), who(f), side(f.t));
    var gw = D.goals.filter(function (x) { return x.gw; })[0];
    if (gw) card("Game-winner", gw.time ? esc(gw.time) + " " + perShort(gw.per) : "GWG", who(gw) + (gw.kind === "pp" ? " · power play" : gw.kind === "sh" ? " · short-handed" : ""), side(gw.t));
    if (D.timed && D.goals.length) {
      var T = flowTimes(D), led = {}, prev = 0, m = 0; led.a = 0; led.h = 0; led.t = 0;
      D.goals.forEach(function (x) { var s = T.ab(x.per, x.time); led[m > 0 ? "a" : m < 0 ? "h" : "t"] += s - prev; prev = s; m = x.sa - x.sh; });
      var endS = D.periods.filter(function (p) { return p >= 4; }).length ? T.ab(D.goals[D.goals.length - 1].per, D.goals[D.goals.length - 1].time) : 3 * T.plen;
      led[m > 0 ? "a" : m < 0 ? "h" : "t"] += Math.max(0, endS - prev);
      var tot = led.a + led.h + led.t || 1, mm = function (s) { return Math.floor(s / 60) + ":" + ("0" + Math.round(s % 60)).slice(-2); };
      var top = led.a >= led.h ? "a" : "h";
      c.push('<div class="km wide"><span class="k">Time leading</span><b>' + abbr(top === "a" ? D.a : D.h) + " " + mm(led[top]) + '</b><div class="kbar"><i class="a" style="flex:' + led.a + '"></i><i class="t" style="flex:' + led.t + '"></i><i class="h" style="flex:' + led.h + '"></i></div>' +
        "<p>" + abbr(D.a) + " " + mm(led.a) + " · tied " + mm(led.t) + " · " + abbr(D.h) + " " + mm(led.h) + "</p></div>");
      var big = 0, bx = null; D.goals.forEach(function (x) { if (Math.abs(x.sa - x.sh) > big) { big = Math.abs(x.sa - x.sh); bx = x; } });
      if (bx && big >= 2) card("Biggest lead", "+" + big + " " + abbr(bx.sa > bx.sh ? D.a : D.h), "Reached at " + esc(bx.time) + " of the " + perShort(bx.per) + ", at " + bx.sa + "–" + bx.sh + ".", side(bx.sa > bx.sh ? D.a : D.h));
      var best = null;
      [D.a, D.h].forEach(function (t) {
        var l = D.goals.filter(function (x) { return x.t === t; });
        for (var i = 1; i < l.length; i++) { var gap = T.ab(l[i].per, l[i].time) - T.ab(l[i - 1].per, l[i - 1].time); if (gap <= 150 && (!best || gap < best.gap)) best = { gap: gap, t: t, x: l[i] }; }
      });
      if (best) card("Quick strike", "2 goals in " + mm(best.gap), abbr(best.t) + " struck twice, finishing at " + esc(best.x.time) + " of the " + perShort(best.x.per) + ".", side(best.t));
      if (D.win) {
        var deficit = 0; D.goals.forEach(function (x) { var d = D.win === D.a ? x.sh - x.sa : x.sa - x.sh; if (d > deficit) deficit = d; });
        if (deficit) card("Comeback", "Down " + deficit + ", won", abbr(D.win) + " trailed by " + deficit + " goal" + (deficit === 1 ? "" : "s") + " and came back.", side(D.win));
      }
    }
    var ppg = function (t) { return D.goals.filter(function (x) { return x.t === t && x.kind === "pp"; }).length; };
    var ppo = function (t) { var o = t === D.a ? D.h : D.a; return D.pens.filter(function (x) { return x.t === o && (x.code || "A")[0] !== "C" && (x.code || "A")[0] !== "D"; }).length; };
    if (D.timed) card("Power plays", ppg(D.a) + "/" + ppo(D.a) + " · " + ppg(D.h) + "/" + ppo(D.h), abbr(D.a) + " " + ppg(D.a) + " of " + ppo(D.a) + ", " + abbr(D.h) + " " + ppg(D.h) + " of " + ppo(D.h) + " (goals / chances).");
    return c.length ? '<div class="kms">' + c.join("") + "</div>" : "";
  }
  /* goals in each period, one side each */
  function periodSplit(g, D) {
    if (!D.timed) return "";
    var per = function (t, p) { return D.goals.filter(function (x) { return x.t === t && x.per === p; }).length; };
    var pim = function (t, p) { return D.pens.filter(function (x) { return x.t === t && x.per === p; }).reduce(function (s, x) { return s + x.mins; }, 0); };
    var mx = 1; D.periods.forEach(function (p) { mx = Math.max(mx, per(D.a, p), per(D.h, p)); });
    return '<div class="psplit"><div class="ps-hd"><span>' + abbr(D.a) + "</span><span></span><span>" + abbr(D.h) + "</span></div>" + D.periods.map(function (p) {
      var a = per(D.a, p), h = per(D.h, p);
      return '<div class="ps-r"><span class="ps-v">' + a + '</span><span class="ps-b a"><i style="width:' + (a / mx * 100) + '%"></i></span><span class="ps-l">' + perShort(p) + "<small>PIM " + pim(D.a, p) + "–" + pim(D.h, p) + '</small></span><span class="ps-b h"><i style="width:' + (h / mx * 100) + '%"></i></span><span class="ps-v">' + h + "</span></div>";
    }).join("") + "</div>";
  }
  /* each player's line for this game */
  function boxScore(g, sh, D) {
    return '<div class="box2">' + [D.a, D.h].map(function (t) {
      var P = {}, get = function (k) { return P[k] || (P[k] = { k: k, g: 0, a: 0, pim: 0, pp: 0, gw: 0 }); };
      String((sh.d && sh.d[t]) || "").split(" ").forEach(function (k) { if (k) get(k); });
      D.goals.forEach(function (x) { if (x.t !== t) return; if (x.k) { var r = get(x.k); r.g++; if (x.kind === "pp") r.pp++; if (x.gw) r.gw++; } x.as.forEach(function (k) { get(k).a++; }); });
      D.pens.forEach(function (x) { if (x.t === t && x.k) get(x.k).pim += x.mins; });
      var gks = sh.k.filter(function (x) { return x[0] === t; }).map(function (x) { return x[1]; });
      var rows = Object.keys(P).map(function (k) { return P[k]; }).filter(function (r) { return gks.indexOf(r.k) < 0; })
        .sort(function (p, q) { return (q.g + q.a) - (p.g + p.a) || q.g - p.g || q.pim - p.pim || nm(t, p.k).localeCompare(nm(t, q.k)); });
      var jn = function (k) { var n = nm(t, k); return NUM[t] && NUM[t][n] != null ? NUM[t][n] : ""; };
      return '<div class="card"><h3>' + badge(t) + " " + esc(TEAMS[t]) + '</h3><div class="wrap"><table class="rt jt"><thead><tr><th class="jn">#</th><th class="l">Player</th><th>G</th><th>A</th><th>PTS</th><th>PIM</th></tr></thead><tbody>' +
        rows.map(function (r) { var pts = r.g + r.a; return '<tr class="' + (pts ? "" : "z") + '"><td class="jn">' + jn(r.k) + '</td><td class="l strong">' + plinkK(t, r.k) + (r.gw ? ' <span class="gtag gw">GWG</span>' : "") + "</td><td>" + r.g + "</td><td>" + r.a + '</td><td class="strong">' + pts + "</td><td>" + (r.pim || "–") + "</td></tr>"; }).join("") +
        "</tbody></table></div></div>";
    }).join("") + "</div>";
  }
  function whatItMeans(g) {
    var side = function (t) {
      var s = ST[t], ng = nextGame(t);
      return '<div class="wim"><div class="wim-t">' + badge(t) + "<b>" + esc(TEAMS[t]) + '</b></div><div class="wim-n"><span><b>' + ord(s.rank) + "</b><small>" + (MULTI ? esc(divOf(t).name) : GROUP) + "</small></span><span><b>" + rec(s) + "</b><small>" + RECL + "</small></span><span>" + streakOf(t) + "<small>Streak</small></span></div>" +
        (ng ? '<p class="wim-x">Next: ' + dshort(ng.date) + " " + (ng.h === t ? "vs " : "at ") + abbr(ng.h === t ? ng.a : ng.h) + "</p>" : "") + "</div>";
    };
    return '<div class="card gsec2"><h3>Where they stand now</h3><div class="wims">' + side(g.a) + side(g.h) + '</div><div class="gser">' + seriesBlock(g) + "</div></div>";
  }

  /* ---------- matchup preview extras ---------- */
  /* bars measured against the whole league: a full bar is the league's best, an empty one its worst */
  function taleOfTape(g) {
    var A = ST[g.a], H = ST[g.h], rows = [];
    var span = function (key, low, fn) {
      var vals = ORDER.map(function (t) { return fn ? fn(t) : ST[t][key]; }).filter(function (v) { return v != null && !isNaN(v); });
      var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
      return function (v) { if (hi === lo) return 0.5; var r = (v - lo) / (hi - lo); return low ? 1 - r : r; };
    };
    var row = function (lbl, va, vh, fa, fh, sc) {
      var ra = sc(va), rh = sc(vh), lead = ra === rh ? 0 : ra > rh ? 1 : 2;
      rows.push('<div class="tt-r"><span class="tt-v a' + (lead === 1 ? " on" : "") + '">' + fa + '</span><span class="tt-b a"><i style="width:' + Math.round(8 + 92 * ra) + '%"' + (lead === 1 ? ' class="on"' : "") + '></i></span><span class="tt-l">' + lbl + '</span><span class="tt-b h"><i style="width:' + Math.round(8 + 92 * rh) + '%"' + (lead === 2 ? ' class="on"' : "") + '></i></span><span class="tt-v h' + (lead === 2 ? " on" : "") + '">' + fh + "</span></div>");
    };
    var NR = function (t) { return MULTI ? divOf(t).teams.length : ORDER.length; };
    var rk = function (t) { var n = NR(t); return n > 1 ? 1 - (ST[t].rank - 1) / (n - 1) : 0.5; };
    row("Rank", rk(g.a), rk(g.h), ord(A.rank), ord(H.rank), function (v) { return v; });
    row("Points %", parseFloat(A.pct), parseFloat(H.pct), A.pct, H.pct, span(null, 0, function (t) { return parseFloat(ST[t].pct); }));
    row("Goals for / game", A.gfg, H.gfg, f2(A.gfg), f2(H.gfg), span("gfg"));
    row("Goals against / game", A.gag, H.gag, f2(A.gag), f2(H.gag), span("gag", 1));
    row("Goal diff / game", A.dg, H.dg, sgn2(A.dg), sgn2(H.dg), span("dg"));
    row("Penalty min / game", A.pimg, H.pimg, f1(A.pimg), f1(H.pimg), span("pimg", 1));
    var L5 = function (t) { return results(t).slice(-5).reduce(function (s, x) { return s + (x.r === "W" ? 2 : x.r === "T" ? 1 : 0); }, 0); };
    row("Points, last 5", L5(g.a), L5(g.h), L5(g.a), L5(g.h), span(null, 0, L5));
    var S = leagueST();
    if (S[g.a] && S[g.h] && S[g.a].pp != null && S[g.h].pp != null) {
      var ks = Object.keys(S);
      var sp = function (k) { var v = ks.map(function (t) { return S[t][k]; }).filter(function (x) { return x != null; }), lo = Math.min.apply(null, v), hi = Math.max.apply(null, v); return function (x) { return hi === lo ? 0.5 : (x - lo) / (hi - lo); }; };
      row("Power play %", S[g.a].pp, S[g.h].pp, pct0(S[g.a].pp), pct0(S[g.h].pp), sp("pp"));
      row("Penalty kill %", S[g.a].pk, S[g.h].pk, pct0(S[g.a].pk), pct0(S[g.h].pk), sp("pk"));
    }
    return '<div class="tt"><div class="tt-hd"><span>' + abbr(g.a) + "</span><span></span><span>" + abbr(g.h) + "</span></div>" + rows.join("") + "</div>";
  }
  function sgn2(v) { return (v > 0 ? "+" : "") + f2(v); }
  /* last 10 games for each team, goal difference per game */
  function formChart(g) {
    return '<div class="fch">' + [g.a, g.h].map(function (t) {
      var l = results(t).slice(document.body.classList.contains("m") ? -5 : -10), mx = Math.max.apply(null, l.map(function (x) { return Math.abs(x.us - x.them); }).concat([3]));
      var w = l.filter(function (x) { return x.r === "W"; }).length, lo = l.filter(function (x) { return x.r === "L"; }).length;
      return '<div class="fch-r"><span class="fch-t">' + badge(t) + "<b>" + abbr(t) + "</b><small>" + w + "-" + lo + (l.length - w - lo ? "-" + (l.length - w - lo) : "") + " last " + l.length + '</small></span><span class="fch-b">' + l.map(function (x) {
        var d = x.us - x.them, h = Math.max(3, Math.round(Math.abs(d) / mx * 26));
        return '<a class="grs fcb" href="#game/' + x.g.id + '" title="' + dshort(x.g.date) + (x.home ? " vs " : " at ") + esc(SHORT[x.opp]) + ": " + x.r + " " + x.us + "–" + x.them + '"><i class="' + (d > 0 ? "up" : d < 0 ? "dn" : "ev") + '" style="height:' + h + 'px"></i></a>';
      }).join("") + "</span></div>";
    }).join("") + "</div>";
  }
  /* most likely final scores from the projected goals of each team */
  function likelyScores(g, wp) {
    var po = function (l, k) { var p = Math.exp(-l); for (var i = 1; i <= k; i++) p *= l / i; return p; };
    var all = [], tie = 0, a3 = 0, h3 = 0;
    for (var i = 0; i <= 12; i++) for (var j = 0; j <= 12; j++) {
      var p = po(wp.la, i) * po(wp.lh, j); all.push([i, j, p]);
      if (i === j) tie += p; if (i - j >= 3) a3 += p; if (j - i >= 3) h3 += p;
    }
    all.sort(function (x, y) { return y[2] - x[2]; });
    var pc = function (v) { return Math.max(1, Math.round(v * 100)) + "%"; };
    return '<div class="lsc"><div class="lsc-top">' + all.slice(0, 3).map(function (x, i) {
      var who = x[0] > x[1] ? abbr(g.a) + " win" : x[1] > x[0] ? abbr(g.h) + " win" : OT ? "Tied, to overtime" : "Tie";
      return '<div class="lsc-s' + (i ? "" : " on") + '"><b>' + x[0] + "–" + x[1] + "</b><small>" + who + "</small><span>" + pc(x[2]) + "</span></div>";
    }).join("") + '</div><div class="lsc-x"><span><b>' + pc(tie) + "</b>" + (OT ? "Tied after regulation, goes to overtime" : "Ends in a tie") + "</span><span><b>" + pc(a3) + "</b>" + abbr(g.a) + " win by 3+</span><span><b>" + pc(h3) + "</b>" + abbr(g.h) + " win by 3+</span></div>" +
      '<p class="mfoot">From the projected score, ' + abbr(g.a) + " " + f1(wp.la) + " – " + abbr(g.h) + " " + f1(wp.lh) + ".</p></div>";
  }
  /* each team's goal difference per game in each period, from game sheets with goal times */
  function periodMatch(g) {
    var A = teamInsightData(g.a), H = teamInsightData(g.h);
    if (A.S.length < 3 || H.S.length < 3) return "";
    var P = ["1st", "2nd", "3rd"], v = function (I, i) { return (I.per[i].gf - I.per[i].ga) / I.S.length; };
    var mx = 0.5; [0, 1, 2].forEach(function (i) { mx = Math.max(mx, Math.abs(v(A, i)), Math.abs(v(H, i))); });
    var bar = function (x, cls) { return '<span class="pm-b"><i class="' + cls + (x < 0 ? " neg" : "") + '" style="width:' + Math.round(Math.abs(x) / mx * 50) + "%;" + (x < 0 ? "right:50%" : "left:50%") + '"></i></span><span class="pm-v ' + (x > 0 ? "pos" : x < 0 ? "neg" : "") + '">' + sgn2(x) + "</span>"; };
    return '<div class="pm"><div class="pm-hd"><span></span><span>' + abbr(g.a) + "</span><span>" + abbr(g.h) + "</span></div>" + P.map(function (p, i) {
      return '<div class="pm-r"><span class="pm-l">' + p + '</span><span class="pm-c">' + bar(v(A, i), "a") + '</span><span class="pm-c">' + bar(v(H, i), "h") + "</span></div>";
    }).join("") + '<p class="mfoot">Goal difference per game in each period, from ' + A.S.length + " and " + H.S.length + " game sheets with goal times.</p></div>";
  }
  function stMatch(g) {
    var S = leagueST(), A = S[g.a], H = S[g.h];
    if (!A || !H || A.pp == null || H.pp == null) return "";
    var pair = function (x, y, tx, ty, cx, cy) {
      return '<div class="stm-r"><div class="stm-s"><span class="k">' + abbr(tx) + ' power play</span><b>' + pct0(x.pp) + '</b><span class="stm-g ' + cx + '"><i style="width:' + Math.round(x.pp * 100) + '%"></i></span></div>' +
        '<span class="stm-vs">vs</span><div class="stm-s"><span class="k">' + abbr(ty) + ' penalty kill</span><b>' + pct0(y.pk) + '</b><span class="stm-g ' + cy + '"><i style="width:' + Math.round(y.pk * 100) + '%"></i></span></div></div>';
    };
    return '<div class="stm">' + pair(A, H, g.a, g.h, "a", "h") + pair(H, A, g.h, g.a, "h", "a") + '<p class="mfoot">Counted from game sheets; a power-play chance starts each time the other team goes a man down.</p></div>';
  }
  /* players to watch, as cards; a flame when he has a point in each of his last 3 game sheets */
  function watchCards(t) {
    var sk3 = topSkaters(t, 3), gl = topGoalie(t);
    var card = function (r, line, big, unit, gk) {
      var n = NUM[t] && NUM[t][r.name] != null ? NUM[t][r.name] : "";
      var hot = !gk && (function () { var l = playerLog(t, r.name).slice(-3); return l.length === 3 && l.every(function (x) { return x.pts > 0; }); })();
      return '<div class="wc"><span class="wc-n">' + (n !== "" ? n : "") + '</span><div class="wc-w"><b>' + plink(t, r.name) + (hot ? ' <span class="hot" title="A point in each of his last 3 games">🔥</span>' : "") + "</b><small>" + line + '</small></div><span class="wc-v"><b>' + big + "</b><small>" + unit + "</small></span></div>";
    };
    return '<div class="wcs"><h4>' + badge(t) + " " + esc(TEAMS[t]) + "</h4>" + sk3.map(function (r) { return card(r, r.g + " G · " + r.a + " A · " + r.gp + " GP", r.pts, "PTS"); }).join("") +
      (gl ? card(gl, "Goalie · " + gl.w + "-" + gl.l + "-" + gl.t + " · " + gl.so + " SO", f2(gl.gaa), "GAA", 1) : "") + "</div>";
  }
  /* every meeting this season, played and still to come, with the series score on top */
  function seriesCards(g) {
    var between = GAMES.filter(function (x) { return (x.a === g.a && x.h === g.h) || (x.a === g.h && x.h === g.a); });
    var wa = 0, wh = 0, ti = 0, gfa = 0, gfh = 0;
    between.forEach(function (x) { if (!x.played) return; var sa = x.a === g.a ? x.sa : x.sh, shh = x.a === g.a ? x.sh : x.sa; gfa += sa; gfh += shh; if (sa > shh) wa++; else if (shh > sa) wh++; else ti++; });
    var n = wa + wh + ti;
    var lead = !n ? "First meeting of the season" : wa === wh ? "Series tied " + wa + "–" + wh + (ti ? "–" + ti : "") : (wa > wh ? abbr(g.a) : abbr(g.h)) + " lead the series " + Math.max(wa, wh) + "–" + Math.min(wa, wh) + (ti ? "–" + ti : "");
    var head = '<div class="ss-hd"><div class="ss-t a">' + badge(g.a, 1) + "<b>" + wa + '</b></div><div class="ss-m"><b>' + lead + "</b>" + (n ? "<small>Goals " + abbr(g.a) + " " + gfa + " · " + abbr(g.h) + " " + gfh + "</small>" : "") + '</div><div class="ss-t h"><b>' + wh + "</b>" + badge(g.h, 1) + "</div></div>";
    var cards = between.map(function (x) {
      var cur = x.id === g.id, side = function (t, sc, win) { return '<span class="ss-r' + (win ? " w" : "") + '">' + badge(t) + "<em>" + abbr(t) + "</em>" + (x.played ? "<b>" + sc + "</b>" : "") + "</span>"; };
      var inner = '<span class="ss-d">' + dshort(x.date) + (x.played ? " · Final" : cur ? " · This game" : " · " + esc(x.time)) + "</span>" +
        side(x.a, x.sa, x.played && x.sa > x.sh) + side(x.h, x.sh, x.played && x.sh > x.sa);
      if (cur) return '<div class="ss-c cur">' + inner + "</div>";
      return '<a class="grs ss-c' + (x.played ? "" : " up") + '" href="#' + (x.played ? "game/" : "preview/") + x.id + '">' + inner + "</a>";
    }).join("");
    return head + '<div class="ss-cs">' + cards + "</div>";
  }
  /* results against teams both have played */
  function commonOpp(g) {
    var ra = results(g.a), rh = results(g.h);
    var opps = ORDER.filter(function (o) { return o !== g.a && o !== g.h && ra.some(function (x) { return x.opp === o; }) && rh.some(function (x) { return x.opp === o; }); });
    if (!opps.length) return '<p class="empty">They have no opponents in common yet.</p>';
    var tot = { a: { w: 0, l: 0, t: 0, d: 0 }, h: { w: 0, l: 0, t: 0, d: 0 } };
    var chips = function (list, o, key) {
      return list.filter(function (x) { return x.opp === o; }).map(function (x) {
        var T = tot[key]; if (x.r === "W") T.w++; else if (x.r === "L") T.l++; else T.t++; T.d += x.us - x.them;
        return '<a class="grs co-g ' + x.r + '" href="#game/' + x.g.id + '" title="' + dshort(x.g.date) + (x.home ? " vs " : " at ") + esc(SHORT[o]) + '"><b>' + x.r + "</b> " + x.us + "–" + x.them + "</a>";
      }).join("");
    };
    var rows = opps.map(function (o) { return '<div class="co-r"><span class="co-o">' + badge(o) + "<b>" + esc(SHORT[o]) + '</b></span><span class="co-cell">' + chips(ra, o, "a") + '</span><span class="co-cell">' + chips(rh, o, "h") + "</span></div>"; }).join("");
    var sum = function (k, t) {
      var T = tot[k];
      return '<div class="co-s ' + k + '">' + badge(t) + '<div><b>' + T.w + " win" + (T.w === 1 ? "" : "s") + ", " + T.l + " loss" + (T.l === 1 ? "" : "es") + (T.t ? ", " + T.t + " tie" + (T.t === 1 ? "" : "s") : "") + '</b><small>Goal difference <span class="' + (T.d > 0 ? "pos" : T.d < 0 ? "neg" : "") + '">' + (T.d > 0 ? "+" : T.d < 0 ? "−" : "") + Math.abs(T.d) + "</span></small></div></div>";
    };
    var body = '<div class="co-r co-h"><span>Opponent</span><span>' + esc(TEAMS[g.a]) + "</span><span>" + esc(TEAMS[g.h]) + "</span></div>" + rows;
    return '<p class="co-lead">How each team did against the ' + opps.length + " opponent" + (opps.length === 1 ? "" : "s") + " they have both played.</p>" +
      '<div class="co-sum">' + sum("a", g.a) + sum("h", g.h) + "</div>" + '<div class="co-t">' + body + "</div>";
  }


  /* ---------- charts ---------- */
  /* every game: goals for above the line, goals against below; each pair opens the game summary */
  function gameChart(rs) {
    if (!rs.length) return '<p class="empty">No games played yet.</p>';
    var W = 640, H = 210, mid = 105, top = 14, n = rs.length, bw = W / n;
    var mx = Math.max.apply(null, rs.map(function (x) { return Math.max(x.us, x.them); }).concat([4])), u = (mid - top) / mx;
    var bars = rs.map(function (x, i) {
      var cx = i * bw, w = Math.max(4, Math.min(26, bw * 0.62)), x0 = cx + (bw - w) / 2;
      return '<a class="grs" href="#game/' + x.g.id + '"><title>' + dshort(x.g.date) + (x.home ? " vs " : " at ") + esc(SHORT[x.opp]) + ": " + (x.r === "W" ? "won" : x.r === "L" ? "lost" : "tied") + " " + x.us + "–" + x.them + "</title>" +
        '<rect class="hit" x="' + cx.toFixed(1) + '" y="0" width="' + bw.toFixed(1) + '" height="' + H + '"/>' +
        '<rect class="c-gf" x="' + x0.toFixed(1) + '" y="' + (mid - x.us * u).toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + Math.max(0.5, x.us * u).toFixed(1) + '" rx="2"/>' +
        '<rect class="c-ga" x="' + x0.toFixed(1) + '" y="' + (mid + 1) + '" width="' + w.toFixed(1) + '" height="' + Math.max(0.5, x.them * u).toFixed(1) + '" rx="2"/>' +
        '<circle class="dot ' + x.r + '" cx="' + (cx + bw / 2).toFixed(1) + '" cy="' + (H - 4) + '" r="3"/></a>';
    }).join("");
    var first = rs[0].g.date, last = rs[n - 1].g.date;
    return '<svg class="gch" viewBox="0 0 ' + W + " " + (H + 2) + '" role="img" aria-label="Goals for and against in each of ' + n + ' games">' +
      '<line class="base" x1="0" x2="' + W + '" y1="' + mid + '" y2="' + mid + '"/>' + bars + "</svg>" +
      '<div class="gch-x"><span>' + dshort(first) + '</span><span class="gch-k"><i class="W"></i>Win<i class="L"></i>Loss</span><span>' + dshort(last) + "</span></div>";
  }
  /* goals for, goals against and penalties in each period */
  function periodChart(I) {
    var cols = I.cols, P = ["1st", "2nd", "3rd", "OT"], per = I.per.slice(0, cols);
    var mx = Math.max.apply(null, per.map(function (p) { return Math.max(p.gf, p.ga, p.pen); }).concat([1]));
    return '<div class="prc">' + per.map(function (p, i) {
      var d = p.gf - p.ga, bar = function (cls, v) { return '<span class="prc-b ' + cls + '" style="height:' + Math.round(v / mx * 100) + '%"><em>' + v + "</em></span>"; };
      return '<div class="prc-col"><span class="prc-d ' + (d > 0 ? "pos" : d < 0 ? "neg" : "") + '">' + sgn(d) + '</span><div class="prc-bars">' + bar("c-gf", p.gf) + bar("c-ga", p.ga) + bar("c-pn", p.pen) + '</div><span class="prc-l">' + P[i] + "</span></div>";
    }).join("") + "</div>";
  }
  /* ---------- team insights: trends worked out from scores and game sheets ---------- */
  function secOf(tm) { var p = String(tm).split(":"); return +p[0] * 60 + +(p[1] || 0); }
  function perNo(p) { return p === "OT" || p === "SO" ? 4 : +p || 1; }
  /* one game seen from team t: score, goals and penalties by period, in time order */
  function sheetView(gm, t) {
    var me = gm.a === t ? 0 : 1, ev = [];
    gm.g.forEach(function (x, i) { var tt = gm.gt[i]; ev.push({ p: perNo(tt[0]), s: secOf(tt[1]), mine: x[0] === t, kind: tt[2] }); });
    ev.sort(function (a, b) { return a.p - b.p || a.s - b.s; });
    var pens = (gm.pt || []).map(function (x) { return { mine: x[0] === t, p: perNo(x[2]), s: secOf(x[3]), code: x[4] || "A" }; });
    return { id: gm.id, date: (GBYID[gm.id] || {}).date || "", gf: gm.s[me], ga: gm.s[1 - me], ev: ev, pens: pens };
  }
  function teamSheets(t) {
    return G.filter(function (gm) { return (gm.a === t || gm.h === t) && gm.gt && gm.gt.length === gm.g.length && GBYID[gm.id] && GBYID[gm.id].played; })
      .map(function (gm) { return sheetView(gm, t); })
      .sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : a.id - b.id; });
  }
  /* power play and penalty kill from game sheets. A chance starts each time a team goes up a man
     (minors 2:00, ending early on a power-play goal; majors 5:00; matching penalties cancel). */
  function stFrom(list, t) {
    var o = { ppg: 0, ppo: 0, ppga: 0, pko: 0, games: list.length };
    list.forEach(function (v) {
      var T = function (p, s) { return p * 10000 + s; };
      var pens = v.pens.filter(function (x) { return x.code[0] === "A" || x.code[0] === "B"; }).map(function (x) { var st = T(x.p, x.s); return { mine: x.mine, st: st, end: st + (x.code[0] === "B" ? 300 : 120), minor: x.code[0] === "A" }; });
      var at = {}; pens.forEach(function (x) { (at[x.st] = at[x.st] || []).push(x); });
      Object.keys(at).forEach(function (k) { var a = at[k].filter(function (x) { return x.mine; }), b = at[k].filter(function (x) { return !x.mine; }); for (var i = 0; i < Math.min(a.length, b.length); i++) a[i].co = b[i].co = true; });
      var goals = v.ev.map(function (e) { return { mine: e.mine, t: T(e.p, e.s) }; });
      var active = function (tm) { return pens.filter(function (x) { return !x.co && x.st <= tm && tm < x.end; }); };
      var times = []; pens.forEach(function (x) { times.push(x.st, x.end); }); goals.forEach(function (g) { times.push(g.t); });
      times = times.filter(function (x, i) { return times.indexOf(x) === i; }).sort(function (a, b) { return a - b; });
      var prev = 0;
      times.forEach(function (tm) {
        goals.filter(function (g) { return g.t === tm; }).forEach(function (g) {
          var act = active(tm), me = act.filter(function (x) { return x.mine; }).length, op = act.length - me;
          var shortSide = g.mine && op > me ? false : !g.mine && me > op ? true : null;
          if (shortSide === null) return;
          if (shortSide) o.ppga++; else o.ppg++;
          var m = act.filter(function (x) { return x.mine === shortSide && x.minor; }).sort(function (a, b) { return a.st - b.st; })[0]; if (m) m.end = tm;
        });
        var act = active(tm), me = act.filter(function (x) { return x.mine; }).length, op = act.length - me, st = op > me ? 1 : me > op ? -1 : 0;
        if (st === 1 && prev !== 1) o.ppo++; if (st === -1 && prev !== -1) o.pko++; prev = st;
      });
    });
    /* official leagues: the league's power-play goal count is more complete than the sheets' labels */
    if (OFFICIAL && t && list.length >= GAMES.filter(function (g) { return g.played && (g.a === t || g.h === t); }).length && SPT[t]) o.ppg = Math.max(o.ppg, SPT[t].ppg);
    o.pp = o.ppo ? o.ppg / o.ppo : null; o.pk = o.pko ? 1 - o.ppga / o.pko : null;
    return o;
  }
  var ST_SHEETS = null;
  function leagueST() {
    if (ST_SHEETS) return ST_SHEETS;
    ST_SHEETS = {};
    ORDER.forEach(function (t) { var l = teamSheets(t); if (l.length >= 5) ST_SHEETS[t] = stFrom(l, t); });
    return ST_SHEETS;
  }
  function sgn(n) { return n > 0 ? "+" + n : n < 0 ? "−" + -n : "0"; }
  function pct0(x) { return Math.round(x * 100) + "%"; }
  function teamInsightData(t) {
    var played = GAMES.filter(function (g) { return g.played && (g.a === t || g.h === t); }).sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : a.id - b.id; });
    var res = played.map(function (g) { var me = g.a === t, f = me ? g.sa : g.sh, a = me ? g.sh : g.sa; return { gf: f, ga: a, r: f > a ? "W" : f < a ? "L" : "T", date: g.date }; });
    var S = teamSheets(t), cards = [], n = res.length, PN = ["1st", "2nd", "3rd", "OT"];
    var rtxt = function (xs) { var w = 0, l = 0, tt = 0; xs.forEach(function (x) { if (x.r === "W") w++; else if (x.r === "L") l++; else tt++; }); return w + "–" + l + (tt ? "–" + tt : ""); };
    var card = function (big, text, tone) { cards.push({ big: big, text: text, tone: tone || "good" }); };

    /* period by period (game sheets) */
    var per = [1, 2, 3, 4].map(function () { return { gf: 0, ga: 0, pen: 0 }; }), table = "";
    S.forEach(function (v) { v.ev.forEach(function (e) { per[Math.min(4, e.p) - 1][e.mine ? "gf" : "ga"]++; }); v.pens.forEach(function (x) { if (x.mine) per[Math.min(4, x.p) - 1].pen++; }); });
    var cols = per[3].gf + per[3].ga + per[3].pen ? 4 : 3;
    if (S.length >= 3) {
      /* 1. the period that decides games */
      var diffs = per.slice(0, 3).map(function (x) { return x.gf - x.ga; }), bi = diffs.indexOf(Math.max.apply(null, diffs)), wi = diffs.indexOf(Math.min.apply(null, diffs));
      var tot = diffs[0] + diffs[1] + diffs[2];
      if (diffs[bi] - diffs[wi] >= 4) card(sgn(diffs[bi]), "Goal difference in the <b>" + PN[bi] + " period</b>, the team's best" + (tot > 0 && diffs[bi] > 0 && diffs[bi] < tot * 1.01 ? " (" + pct0(diffs[bi] / tot) + " of its " + sgn(tot) + " over the season)" : "") + ". The " + PN[wi] + " is its weakest at " + sgn(diffs[wi]) + ".", diffs[bi] > 0 ? "good" : "bad");
    }
    /* 2. goals against, early games vs recent games */
    if (n >= 6) {
      var hf = Math.floor(n / 2), a1 = res.slice(0, hf).reduce(function (a, x) { return a + x.ga; }, 0) / hf, a2 = res.slice(n - hf).reduce(function (a, x) { return a + x.ga; }, 0) / hf;
      if (a1 > 0 && Math.abs(a2 - a1) / a1 >= 0.15) card(f2(a1) + " → " + f2(a2), "Goals against per game, first " + hf + " games vs the last " + hf + ": <b>" + (a2 < a1 ? "down" : "up") + " " + pct0(Math.abs(a2 - a1) / a1) + "</b>.", a2 < a1 ? "good" : "bad");
    }
    /* 3. the goals-against line that decides results */
    if (n >= 6) {
      var best = null;
      for (var k = 1; k <= 8; k++) {
        var lo = res.filter(function (x) { return x.ga <= k; }), hi = res.filter(function (x) { return x.ga > k; });
        if (lo.length < 2 || hi.length < 2) continue;
        var wp = function (xs) { return xs.reduce(function (a, x) { return a + (x.r === "W" ? 1 : x.r === "T" ? 0.5 : 0); }, 0) / xs.length; };
        var gap = wp(lo) - wp(hi);
        if (!best || gap > best.gap) best = { k: k, gap: gap, lo: lo, hi: hi };
      }
      if (best && best.gap >= 0.5) card(rtxt(best.lo), "Record when allowing <b>" + best.k + " goal" + (best.k === 1 ? "" : "s") + " or fewer</b>. When allowing " + (best.k + 1) + " or more: " + rtxt(best.hi) + ".");
    }
    /* 4. slow starts */
    var gaS = per[0].ga + per[1].ga + per[2].ga + per[3].ga;
    if (S.length >= 5 && gaS >= 10 && per[0].ga / gaS >= 0.4) card(pct0(per[0].ga / gaS), "of goals against come in the <b>1st period</b> (" + per[0].ga + " of " + gaS + "). Starts are the place to tighten up.", "bad");
    /* 5. offence every game */
    if (n >= 5) { var mn = Math.min.apply(null, res.map(function (x) { return x.gf; })); if (mn >= 2) card(mn + "+", "goals in <b>every game</b> this season (" + n + " games)."); }
    /* 6. penalties: when, and the score at the time */
    var pens = [], lead2 = 0;
    S.forEach(function (v) { v.pens.forEach(function (x) { if (!x.mine) return; pens.push(x); var m = 0, o = 0; v.ev.forEach(function (e) { if (e.p < x.p || (e.p === x.p && e.s < x.s)) { if (e.mine) m++; else o++; } }); if (m - o >= 2) lead2++; }); });
    if (S.length >= 5 && pens.length >= 10) {
      var pp = [0, 0, 0, 0]; pens.forEach(function (x) { pp[Math.min(4, x.p) - 1]++; });
      var mi = pp.indexOf(Math.max.apply(null, pp));
      card(pct0(pp[mi] / pens.length), "of penalties are taken in the <b>" + PN[mi] + " period</b> (" + pp[mi] + " of " + pens.length + ")." + (lead2 ? " " + lead2 + " came while leading by 2 or more." : ""), "bad");
    }
    /* 7. the 1st period and the result */
    if (S.length >= 5) {
      var ahead = [], dW = 0, dL = 0, nW = 0, nL = 0;
      S.forEach(function (v) { var d = 0; v.ev.forEach(function (e) { if (e.p === 1) d += e.mine ? 1 : -1; }); var r = v.gf > v.ga ? "W" : v.gf < v.ga ? "L" : "T"; if (d > 0) ahead.push({ r: r }); if (r === "W") { dW += d; nW++; } if (r === "L") { dL += d; nL++; } });
      if (ahead.length >= 3) card(rtxt(ahead), "when <b>leading after the 1st period</b>." + (nW >= 2 && nL >= 2 ? " 1st-period goal difference: " + sgn(dW) + " in wins, " + sgn(dL) + " in losses." : ""), ahead.filter(function (x) { return x.r === "W"; }).length / ahead.length >= 0.6 ? "good" : "bad");
    }
    /* 8. longest run of periods without a goal against */
    if (S.length >= 3) {
      var run = 0, bestRun = 0, from = "", to = "", cs = "";
      S.forEach(function (v) { for (var p = 1; p <= 3; p++) { var ga = v.ev.filter(function (e) { return e.p === p && !e.mine; }).length; if (!ga) { if (!run) cs = v.date; run++; if (run > bestRun) { bestRun = run; from = cs; to = v.date; } } else run = 0; } });
      if (bestRun >= 4) card(bestRun, "straight <b>periods without a goal against</b>, the longest run" + (from ? " (" + dshort(from) + (to !== from ? " to " + dshort(to) : "") + ")" : "") + ".");
    }
    /* 9. special teams, ranked among teams with game sheets */
    var L = leagueST(), me = L[t];
    if (me && me.pp != null && me.pk != null) {
      var ts = Object.keys(L).filter(function (x) { return L[x].pp != null && L[x].pk != null; });
      var rk = function (key) { return 1 + ts.filter(function (x) { return L[x][key] > me[key]; }).length; };
      var comb = function (x) { return L[x].pp + L[x].pk; }, rc = 1 + ts.filter(function (x) { return comb(x) > comb(t); }).length;
      card(pct0(me.pp) + " / " + pct0(me.pk), "<b>Power play / penalty kill</b>: " + ord(rk("pp")) + " and " + ord(rk("pk")) + ", " + ord(rc) + " combined, among the " + ts.length + " teams with game sheets. " + me.ppo + " power plays, " + me.pko + " times short-handed.", rc <= Math.ceil(ts.length / 2) ? "good" : "bad");
    }
    return { per: per, cols: cols, S: S, n: n, items: cards };
  }
  /* team page: Upcoming shows 5 games and scrolls beyond that; on desktop Results is no taller than the roster */
  function fitTeamLists() {
    var r = $("tres"), u = $("tup"); if (!r || !u) return;
    r.style.maxHeight = u.style.maxHeight = "";
    if ($("p-teams").hidden) return;
    var rows = u.querySelectorAll(".trow");
    if (rows.length > 5) u.style.maxHeight = Math.round(rows[5].getBoundingClientRect().top - u.getBoundingClientRect().top) + "px";
    if (document.body.classList.contains("m")) return;
    var f = $("tfoot"), room = f.getBoundingClientRect().bottom - r.getBoundingClientRect().top;
    var upH = u.getBoundingClientRect().height + (u.getBoundingClientRect().top - r.getBoundingClientRect().bottom);
    var max = Math.max(200, room - upH);
    if (r.scrollHeight > max) r.style.maxHeight = max + "px";
  }

  /* ---------- matchups ---------- */
  /* one comparison line: the stronger side's value in bold (mode: "high" = more is better, "low" = less is better, "diff" = more is better) */
  function cmpRow(label, va, vh, fa, fh, mode) {
    var lead = va === vh ? 0 : ((mode !== "low") === (va > vh) ? 1 : 2);
    return '<div class="cmp"><div class="cv a' + (lead === 1 ? " lead" : "") + '">' + fa + '</div><div class="cl">' + label + '</div><div class="cv h' + (lead === 2 ? " lead" : "") + '">' + fh + "</div></div>";
  }
  function watch(t) {
    var sk3 = topSkaters(t, 3), gl = topGoalie(t);
    return "<div><h4>" + esc(SHORT[t]) + "</h4><ul>" + sk3.map(function (r) { return "<li><span>" + plink(r.team, r.name) + "</span><small>" + r.g + "G " + r.a + "A · <b>" + r.pts + " P</b></small></li>"; }).join("") +
      (gl ? "<li><span>" + plink(gl.team, gl.name) + "</span><small>Goalie · " + f2(gl.gaa) + " GAA, " + gl.gp + " GP</small></li>" : "") + "</ul></div>";
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
      '<p style="margin-top:8px;color:var(--mute);font-size:13px">' + (other.length ? "Also scheduled: " + other.map(function (x) { return dshort(x.date); }).join(", ") + "." : g.played ? "No more meetings scheduled." : "This is their only scheduled meeting.") + "</p>";
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
  var TIE = o.noTie ? 0 : (nt + o.tp * o.tprior) / (gs.length + o.tp);
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
  /* tie chance: the league's tie rate, raised for evenly matched teams and lowered for lopsided ones
     (each matchup's Poisson draw chance relative to the average over all pairs) */
  var MD = null;
  function drawP(a, h) { var pa = pois(LG * att[a] * def[h]), ph = pois(LG * att[h] * def[a]), d = 0; for (var i = 0; i <= 20; i++) d += pa[i] * ph[i]; return d; }
  function meanDraw() { if (MD != null) return MD; var s = 0, c = 0; teams.forEach(function (a) { teams.forEach(function (h) { if (a !== h) { s += drawP(a, h); c++; } }); }); return (MD = c ? s / c : 0); }
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
    var s = w + l; var ptie = !TIE ? 0 : o.flatTie || !meanDraw() ? TIE : Math.min(0.5, TIE * tt / meanDraw()); w = (1 - ptie) * w / s; l = (1 - ptie) * l / s; tt = ptie;
    if (o.sh) { w = (1 - o.sh) * w + o.sh * (1 - tt) / 2; l = (1 - o.sh) * l + o.sh * (1 - tt) / 2; }
    var e = 1 / (1 + Math.pow(10, (elo[h] - elo[a]) / 400));
    var wa = (1 - o.beta) * w + o.beta * (1 - tt) * e, wh = (1 - o.beta) * l + o.beta * (1 - tt) * (1 - e);
    var A = Math.round(wa * 100), H = Math.round(wh * 100);
    return { a: A, h: H, t: 100 - A - H, pa: wa, ph: wh, pt: tt, la: la, lh: lh, elo: [elo[a], elo[h]], h2h: { n: hn, m: hn ? hm / hn : 0 }, info: [info[a], info[h]], att: [att[a], att[h]], def: [def[a], def[h]], LG: LG };
  }
  return { predict: predict, elo: elo, att: att, def: def, info: info, LG: LG, games: n };
}

  // Leagues that play overtime have no ties, so the model gives a tie no chance there.
  var MODEL = makeModel(PLAYED.map(function (g) { return { id: g.id, date: g.date, a: g.a, h: g.h, sa: g.sa, sh: g.sh }; }), G, ORDER, OT ? { noTie: 1 } : null);
  var ELORANK = ORDER.slice().sort(function (x, y) { return MODEL.elo[y] - MODEL.elo[x]; });
  function winProb(a, h) { var p = MODEL.predict(a, h); if (OT) return { a: p.a, h: 100 - p.a, t: 0, la: p.la, lh: p.lh, full: p }; return { a: p.a, h: p.h, t: p.t, la: p.la, lh: p.lh, full: p }; }
  var TIETXT = function (wp, sep) { return OT ? "" : sep + "tie " + wp.t + "%"; };
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
    var wpBar = '<div class="wsum"><div class="wpbar" role="img" aria-label="Win probability: ' + SHORT[g.a] + " " + wp.a + " percent" + (OT ? "" : ", tie " + wp.t + " percent") + ", " + SHORT[g.h] + " " + wp.h + ' percent"><i class="wa" style="width:' + wp.a + '%"></i>' + (OT ? "" : '<i class="wt" style="width:' + wp.t + '%"></i>') + '<i class="wh" style="width:' + wp.h + '%"></i></div>' +
      '<div class="wpl"><span><b>' + wp.a + "%</b>" + esc(SHORT[g.a]) + '</span><span class="mid">Win probability' + (OT ? "" : " · Tie " + wp.t + "%") + '</span><span>' + esc(SHORT[g.h]) + ' <b style="margin:0 0 0 4px">' + wp.h + "%</b></span></div></div>";
    var A = ST[g.a], H = ST[g.h];
    var atk = function (x, y) { return "<p><b>" + esc(SHORT[x.t]) + " offence</b> scores " + f2(x.gfg) + " per game (" + ord(RK.gfg[x.t]) + " in the " + GROUP + "). <b>" + esc(SHORT[y.t]) + " defence</b> allows " + f2(y.gag) + " (" + ord(RK.gag[y.t]) + " fewest).</p>"; };
    var rows = cmpRow("Rank", -A.rank, -H.rank, ord(A.rank), ord(H.rank), "diff") +
      cmpRow("Record", A.w * 2 + A.tie, H.w * 2 + H.tie, rec(A), rec(H), "high") +
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
  /* ---------- matchup preview page: #preview/<id> ---------- */
  function renderPreview(id) {
    var g = GAMES.filter(function (x) { return x.id === id; })[0];
    if (!g || g.played) return false;
    var wp = winProb(g.a, g.h), A = ST[g.a], H = ST[g.h], fav = wp.a === wp.h ? null : wp.a > wp.h ? g.a : g.h;
    var side = function (t, s, pct, cls) {
      return '<div class="pvs ' + cls + '"><div class="pvb">' + badge(t, 1) + '</div><div class="pvn"><span class="pvt" data-tp="' + t + '">' + esc(TEAMS[t]) + '</span><span class="sub">' + ord(s.rank) + " · " + rec(s) + " · " + (s.pend ? "–" : s.pts) + ' PTS</span><span class="pvf">' + formChips(t, 5) + '</span></div><div class="pvp' + (t === fav ? " fav" : "") + '"><b>' + pct + '%</b><span>to win</span></div></div>';
    };
    var bar = '<div class="pvbar" role="img" aria-label="Win probability: ' + esc(SHORT[g.a]) + " " + wp.a + " percent" + (OT ? "" : ", tie " + wp.t + " percent") + ", " + esc(SHORT[g.h]) + " " + wp.h + ' percent"><i class="wa" style="flex:' + wp.a + '"></i>' + (OT || !wp.t ? "" : '<i class="wt" style="flex:' + wp.t + '"></i>') + '<i class="wh" style="flex:' + wp.h + '"></i></div>' +
      '<div class="pvbl"><span>' + esc(SHORT[g.a]) + "</span><span>" + (OT ? "" : "Tie " + wp.t + "% · ") + "Projected score " + f1(wp.la) + "–" + f1(wp.lh) + "</span><span>" + esc(SHORT[g.h]) + "</span></div>";
    var hero = '<div class="card pvhero"><div class="pvmeta">' + esc(when(g)) + " · " + esc(g.venue) + " · Game #" + g.id + "</div>" +
      '<div class="pvteams">' + side(g.a, A, wp.a, "a") + '<div class="pvat">at</div>' + side(g.h, H, wp.h, "h") + "</div>" + bar + "</div>";
    if (state.pid !== id) { state.pid = id; state.ptab = "preview"; }
    var tab = state.ptab || "preview", small = Math.min(A.gp, H.gp);
    var tabs = '<div class="ttabs gtabs" role="tablist" aria-label="Matchup preview sections">' + [["preview", "Preview"], ["teams", "Scouting"], ["history", "History"], ["model", "Model"]].map(function (x) {
      return '<button role="tab" data-ptab="' + x[0] + '" aria-selected="' + (tab === x[0]) + '">' + x[1] + "</button>";
    }).join("") + "</div>";
    var keys = keysFor(g.a, g.h), body;
    if (tab === "preview") {
      body = '<div class="pv2"><div class="pv2c">' +
        '<div class="card gsec2"><h3>Keys to the game</h3>' + (keys.length ? '<ol class="keys2">' + keys.map(function (x) { return "<li>" + x + "</li>"; }).join("") + "</ol>" : '<p class="empty">No clear mismatch. Both teams profile similarly, so execution and discipline decide it.</p>') + "</div>" +
        '<div class="card gsec2"><h3>Tale of the tape</h3>' + taleOfTape(g) + "</div></div>" +
        '<div class="pv2c"><div class="card gsec2"><div class="tc-hd"><h3>Recent form</h3><span class="tc-leg">Goal difference, last ' + (document.body.classList.contains("m") ? 5 : 10) + ' games</span></div>' + formChart(g) + "</div>" +
        '<div class="card gsec2"><h3>Likely scores</h3>' + likelyScores(g, wp) + "</div></div></div>";
    } else if (tab === "teams") {
      var pm = periodMatch(g), stm = stMatch(g);
      body = '<div class="card gsec2"><h3>Scouting report</h3><div class="scout"><div class="scrg">' + scoutCard(g.a, g.h) + scoutCard(g.h, g.a) + "</div></div></div>" +
        (pm || stm ? '<div class="pv2">' + (pm ? '<div class="card gsec2"><h3>Period by period</h3>' + pm + "</div>" : "") + (stm ? '<div class="card gsec2"><h3>Special teams</h3>' + stm + "</div>" : "") + "</div>" : "") +
        '<div class="card gsec2"><h3>Players to watch</h3><div class="pv2">' + watchCards(g.a) + watchCards(g.h) + "</div></div>";
    } else if (tab === "history") {
      body = '<div class="card gsec2"><h3>Season series</h3>' + seriesCards(g) + '</div><div class="card gsec2"><h3>Common opponents</h3>' + commonOpp(g) + "</div>";
    } else {
      body = '<div class="card gsec2 pvm pvm-open"><h3>How the odds are set</h3>' + modelNotes(g, wp).replace('<details class="mdet">', '<details class="mdet" open>') + "</div>";
    }
    $("p-preview").innerHTML = '<div class="ptop">' + backBtn("Back to Schedule") + '<button class="pshare" data-share="1">Share</button></div><div id="pvwrap" class="pvwrap" style="' + teamPair(g.a, g.h) + '">' + hero + tabs + '<div class="gbody">' + body + "</div></div>" +
      '<p class="mfoot">Season stats come from the ' + (OFFICIAL ? "official table" : "standings") + ", with " + (small === Math.max(A.gp, H.gp) ? small : small + " to " + Math.max(A.gp, H.gp)) + " games played per team, so small samples can swing. Player lines come from available game sheets.</p>";
    paintPair("pvwrap", g.a, g.h);
    document.title = SHORT[g.a] + " at " + SHORT[g.h] + " · " + (LEAGUE.title || "") + " · Hockey MTL";
    return true;
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
  /* sub-pages (#game/<id>, #player/<team>/<name>) and the way back.
     Each in-site jump to a sub-page pushes where it came from, so "Back" returns to the same place and scroll position. */
  var BACKSVG = '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M10 3 5 8l5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var NAV = [];
  function hereLabel() {
    var h = location.hash.slice(1) || "home";
    if (h.slice(0, 5) === "game/") return "Back to game summary";
    if (h.slice(0, 8) === "preview/") return "Back to matchup preview";
    if (h.slice(0, 7) === "player/") { var pp = h.split("/"); return "Back to " + decodeURIComponent(pp.slice(2).join("/")); }
    if (h === "schedule") return state.sf === "results" ? "Back to Results" : "Back to Schedule";
    if (h === "teams") return "Back to " + (state.team !== "ALL" ? TEAMS[state.team] : "Teams");
    return "Back to " + h.charAt(0).toUpperCase() + h.slice(1);
  }
  function openSub(hash) {
    if (location.hash.slice(1) === hash) return;
    NAV.push({ hash: location.hash.slice(1) || "home", label: hereLabel(), y: window.scrollY, tab: navTab() });
    location.hash = hash;
  }
  function backBtn(def) {
    var top = NAV[NAV.length - 1];
    return '<button class="gback" data-back="1">' + BACKSVG + esc(top ? top.label : def) + "</button>";
  }
  function goBack(defHash) {
    if (NAV.length) { history.back(); return; }
    if (defHash === "results") { state.sf = "results"; renderSchedule(); goto("schedule"); } else goto(defHash);
  }
  function navTab() {
    var h = location.hash.slice(1) || "home";
    if (TABS.indexOf(h) >= 0) return h;
    var top = NAV[NAV.length - 1]; if (top) return top.tab;
    return h.slice(0, 7) === "player/" ? "players" : "schedule";
  }
  function setNav(tab) { Array.prototype.forEach.call(document.querySelectorAll(".nav a"), function (a) { if (a.dataset.tab === tab) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); }); }
  function renderGame(id) {
    var g = GAMES.filter(function (x) { return x.id === id; })[0];
    if (!g || !g.played) return false;
    var sheet = SHEET[g.id];
    if (state.gid !== id) { state.gid = id; state.gtab = "recap"; }
    $("p-game").innerHTML = '<div class="gpage">' + backBtn("Back to Results") + '<div class="gpbody">' + (sheet ? sheetDetail(g, sheet) : resultDetail(g)) + "</div></div>";
    if (sheet) paintPair("gsum", g.a, g.h);
    return true;
  }
  /* ---------- player profile: #player/<team>/<name> ---------- */
  function plink(t, name, label) { if (!name || name === "Unknown") return esc(label || name || ""); return '<a class="plink" href="#player/' + t + "/" + encodeURIComponent(name) + '">' + esc(label || name) + "</a>"; }
  function plinkK(t, k, label) { return k ? plink(t, nm(t, k), label) : esc(label || "Unknown"); }
  var GBYID = {}; GAMES.forEach(function (g) { GBYID[g.id] = g; });
  function seasonLbl() { var d = FIRST || LAST || isoOf(new Date()), y = +d.slice(0, 4), m = +d.slice(5, 7); if (m < 8) y--; return y + "–" + String(y + 1).slice(2); }
  function rankTxt(rows, r, key, asc) {
    var v = r[key]; if (!rows.length || v == null) return "";
    var better = rows.filter(function (x) { return asc ? x[key] < v : x[key] > v; }).length, same = rows.filter(function (x) { return x[key] === v; }).length;
    return (same > 1 ? "T-" : "") + ord(better + 1) + '<span class="rkx"> in the ' + (MULTI ? "league" : GROUP) + "</span>";
  }
  /* every game sheet this player appears on, oldest first */
  function playerLog(t, name) {
    var keys = Object.keys(R[t] || {}).filter(function (k) { return nm(t, k) === name; }); if (keys.indexOf(name) < 0) keys.push(name);
    var has = function (k) { return keys.indexOf(k) >= 0; }, out = [];
    G.forEach(function (gm) {
      var g = GBYID[gm.id]; if (!g || (gm.a !== t && gm.h !== t)) return;
      var home = gm.h === t, opp = home ? gm.a : gm.h, my = home ? gm.s[1] : gm.s[0], th = home ? gm.s[0] : gm.s[1];
      var dressed = ((gm.d && gm.d[t]) || "").split(" ").some(has);
      var gkr = (gm.k || []).filter(function (x) { return x[0] === t && has(x[1]) && x[2] > 0; })[0];
      if (!dressed && !gkr) return;
      var r = { id: gm.id, date: g.date, opp: opp, home: home, my: my, th: th, res: my > th ? "W" : my < th ? "L" : "T", g: 0, a: 0, pim: 0, pp: 0, sh: 0, gw: 0, goalie: !!gkr };
      var ppx = PPX.filter(function (q) { return q[0] === gm.id && q[1] === t; }).slice();
      var wt = my > th ? t : null, need = Math.min(gm.s[0], gm.s[1]) + 1, n = 0;
      gm.g.forEach(function (x, i) {
        var mine = x[0] === t; if (mine && wt) n++;
        if (!mine) return;
        if (has(x[1])) {
          r.g++;
          var kind = gm.gt && gm.gt[i] ? gm.gt[i][2] : "";
          if (!gm.gt) { var j = -1; ppx.some(function (q, qi) { if (has(q[2])) { j = qi; return true; } return false; }); if (j >= 0) { kind = ppx[j][3] === "PP" ? "pp" : "sh"; ppx.splice(j, 1); } }
          if (kind === "pp") r.pp++; else if (kind === "sh") r.sh++;
          if (wt && n === need) r.gw++;
        }
        for (var a = 2; a < x.length; a++) if (has(x[a])) r.a++;
      });
      (gm.p || []).forEach(function (x) { if (x[0] === t && has(x[1])) r.pim += 2; });
      if (gkr) { r.min = gkr[2]; r.ga = gkr[3]; var tg = (gm.k || []).filter(function (x) { return x[0] === t && x[2] > 0; }); r.dec = tg.length === 1 ? r.res : ""; r.so = tg.length === 1 && th === 0; }
      r.pts = r.g + r.a; out.push(r);
    });
    return out.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : a.id - b.id; });
  }
  function oppTxt(x) { return (x.home ? "vs " : "at ") + esc(SHORT[x.opp]); }
  function resTxt(x) { return '<span class="pres ' + x.res.toLowerCase() + '">' + x.res + " " + x.my + "–" + x.th + "</span>"; }
  function barChart(vals, labels, title, sub, col) {
    var mx = Math.max.apply(null, vals.concat([1]));
    return '<div class="card pcard2 o-chart"><div class="pch"><h3>' + title + '</h3><span class="sub">' + sub + '</span></div><div class="pbars" style="--bc:' + col + '">' +
      vals.map(function (v, i) { return '<div class="pbar"><b>' + v + '</b><span class="pbf' + (v ? "" : " z") + '" style="height:' + (v ? Math.max(6, v / mx * 100) : 2) + '%"></span><small>' + esc(labels[i]) + "</small></div>"; }).join("") + "</div></div>";
  }
  function streak(log, test) {
    var best = 0, cur = 0, bs = -1, be = -1, cs = 0;
    log.forEach(function (x, i) { if (test(x)) { if (!cur) cs = i; cur++; if (cur > best) { best = cur; bs = cs; be = i; } } else cur = 0; });
    return { n: best, from: bs >= 0 ? log[bs].date : "", to: be >= 0 ? log[be].date : "" };
  }
  function hl(n, txt) { return '<li><b>' + n + "</b><span>" + txt + "</span></li>"; }
  function renderPlayer(t, name) {
    if (!TEAMS[t]) return false;
    var r = SK.filter(function (x) { return x.team === t && x.name === name; })[0], gr = GK.filter(function (x) { return x.team === t && x.name === name; })[0];
    var log = playerLog(t, name);
    if (!r && !gr && !log.length) return false;
    var isG = !!gr && (!r || gr.gp >= (r.gp || 0) || log.every(function (x) { return x.goalie; }));
    var s = ST[t], col = BADGE[t] || "var(--lgc)", season = seasonLbl();
    var share = '<button class="pshare" data-share="1">Share</button>';
    var num = NUM[t] && NUM[t][name] != null ? NUM[t][name] : null;
    var hero = '<div class="ptop">' + backBtn("Back to Players") + share + "</div>" + '<div class="phero" style="--tc:' + col + '">' + (num != null ? '<span class="pbig" aria-hidden="true">' + num + "</span>" : "") + '<div class="in2">' +
      '<div class="phm"><div class="phb">' + badge(t, 1) + '</div><div class="phw"><div class="pcr">' + (num != null ? "#" + num + " · " : "") + (isG ? "Goalie" : "Skater") + " · " + esc(L.title || "") + " · " + season + '</div><h1 class="pnm">' + esc(name) + '</h1><div class="pteam"><span data-tp="' + t + '" class="ptl">' + esc(TEAMS[t]) + "</span>" +
      (s ? '<span class="sub">' + ord(s.rank) + " in the " + (MULTI ? esc(divOf(t).name) : GROUP) + ' · <span class="nw">' + rec(s) + "</span></span>" : "") + "</div></div>" + "</div></div></div>";
    var tiles, chart, hls = [], logT, split;
    var nlog = log.length, note = OFFICIAL ? "Season totals are official league stats. The chart, game log and splits use the " + nlog + " game sheet" + (nlog === 1 ? "" : "s") + " we have for " + esc(lastName(name)) + "." : "Counted from game sheets.";
    if (!isG) {
      var rows = SK.filter(function (x) { return x.gp > 0; }), tgp = s ? s.gp : 0;
      tiles = [["Games", r.gp, tgp && r.gp >= tgp ? "Every team game" : tgp ? "of " + tgp + " team games" : ""], ["Goals", r.g, rankTxt(rows, r, "g")], ["Assists", r.a, rankTxt(rows, r, "a")], ["Points", r.pts, rankTxt(rows, r, "pts")],
        ["Points per game", r.gp ? f2(r.pts / r.gp) : "0.00", ""], ["Penalty min", r.pen, r.gp ? f2(r.pen / r.gp) + " per game" : ""]];
      chart = nlog ? barChart(log.map(function (x) { return x.pts; }), log.map(function (x) { return x.opp; }), "Points by game", "Oldest to latest · " + log.reduce(function (a, x) { return a + x.pts; }, 0) + " points", col) : "";
      if (nlog) {
        var pg = log.filter(function (x) { return x.pts > 0; }).length, st = streak(log, function (x) { return x.pts > 0; }), mp = log.filter(function (x) { return x.pts >= 2; }), best = log.slice().sort(function (a, b) { return b.pts - a.pts || b.g - a.g; })[0];
        var gs = streak(log, function (x) { return x.g > 0; }), ht = log.filter(function (x) { return x.g >= 3; });
        hls.push(hl(pg, "game" + (pg === 1 ? "" : "s") + " with at least one point, out of " + nlog));
        if (st.n >= 2) hls.push(hl(st.n, "game point streak, his longest (" + dshort(st.from) + " to " + dshort(st.to) + ")"));
        if (mp.length) hls.push(hl(mp.length, "multi-point game" + (mp.length === 1 ? "" : "s") + ", including " + best.pts + " points " + (best.home ? "vs " : "at ") + esc(SHORT[best.opp]) + " on " + dshort(best.date)));
        if (ht.length) hls.push(hl(ht.length, "hat trick" + (ht.length === 1 ? "" : "s") + " (" + ht.map(function (x) { return dshort(x.date); }).join(", ") + ")"));
        else if (gs.n >= 3) hls.push(hl(gs.n, "game goal streak (" + dshort(gs.from) + " to " + dshort(gs.to) + ")"));
      }
      logT = '<table class="plog"><thead><tr><th class="l">Date</th><th class="l">Opponent</th><th class="l">Result</th><th>G</th><th>A</th><th>PTS</th><th>PIM</th></tr></thead><tbody>' +
        log.slice().reverse().map(function (x) { return '<tr data-g="' + x.id + '" tabindex="0"><td class="l mute">' + dshort(x.date) + '</td><td class="l strong">' + oppTxt(x) + '</td><td class="l">' + resTxt(x) + "</td><td>" + x.g + "</td><td>" + x.a + '</td><td class="strong">' + x.pts + "</td><td>" + (x.pim || "–") + "</td></tr>"; }).join("") + "</tbody></table>";
      var sp = function (lbl, xs) { var g = 0, a = 0; xs.forEach(function (x) { g += x.g; a += x.a; }); return '<tr><td class="l">' + lbl + "</td><td>" + xs.length + "</td><td>" + g + "</td><td>" + a + '</td><td class="strong">' + (g + a) + "</td></tr>"; };
      var sum = function (k) { return log.reduce(function (a, x) { return a + x[k]; }, 0); }, tg = sum("g");
      split = nlog ? '<table class="plog sp"><thead><tr><th class="l">Situation</th><th>GP</th><th>G</th><th>A</th><th>PTS</th></tr></thead><tbody>' + sp("Home", log.filter(function (x) { return x.home; })) + sp("Away", log.filter(function (x) { return !x.home; })) + sp("Wins", log.filter(function (x) { return x.res === "W"; })) + "</tbody></table>" +
        '<div class="gtypes"><div><b>' + (tg - sum("pp") - sum("sh")) + "</b><span>Even strength</span></div><div><b>" + sum("pp") + "</b><span>Power play</span></div><div><b>" + sum("sh") + "</b><span>Short-handed</span></div><div><b>" + sum("gw") + "</b><span>Game-winning</span></div></div>" : "";
    } else {
      var grs = GK.filter(function (x) { return x.gp > 0; }), recG = gr.w + "-" + (OT ? gr.l + "-" + gr.t : gr.t + "-" + gr.l);
      tiles = [["Games", gr.gp, gr.gs != null ? gr.gs + " starts" : ""], ["Record", recG, OT ? "W-L-OTL" : "W-T-L"], ["GAA", f2(gr.gaa), rankTxt(grs.filter(function (x) { return x.min >= GLEN; }), gr, "gaa", true)], ["Goals against", gr.ga, ""], ["Shutouts", gr.so, gr.so ? rankTxt(grs, gr, "so") : ""], ["Minutes", Math.round(gr.min), ""]];
      chart = nlog ? barChart(log.map(function (x) { return x.goalie ? x.ga : 0; }), log.map(function (x) { return x.opp; }), "Goals against by game", "Oldest to latest", col) : "";
      if (nlog) {
        var gl = log.filter(function (x) { return x.goalie; }), w = gl.filter(function (x) { return x.dec === "W"; }).length, so = gl.filter(function (x) { return x.so; }), ws = streak(gl, function (x) { return x.dec === "W"; }), lo = gl.filter(function (x) { return x.ga <= 1; }).length;
        hls.push(hl(w, "win" + (w === 1 ? "" : "s") + " in " + gl.length + " game" + (gl.length === 1 ? "" : "s") + " in net"));
        if (so.length) hls.push(hl(so.length, "shutout" + (so.length === 1 ? "" : "s") + " (" + so.map(function (x) { return dshort(x.date); }).join(", ") + ")"));
        if (ws.n >= 2) hls.push(hl(ws.n, "game winning streak (" + dshort(ws.from) + " to " + dshort(ws.to) + ")"));
        if (lo) hls.push(hl(lo, "game" + (lo === 1 ? "" : "s") + " allowing one goal or fewer"));
      }
      logT = '<table class="plog"><thead><tr><th class="l">Date</th><th class="l">Opponent</th><th class="l">Result</th><th>MIN</th><th>GA</th><th>DEC</th></tr></thead><tbody>' +
        log.slice().reverse().map(function (x) { return '<tr data-g="' + x.id + '" tabindex="0"><td class="l mute">' + dshort(x.date) + '</td><td class="l strong">' + oppTxt(x) + '</td><td class="l">' + resTxt(x) + "</td><td>" + (x.goalie ? mmss(x.min) : "–") + '</td><td class="strong">' + (x.goalie ? x.ga : "–") + "</td><td>" + (x.dec || "–") + "</td></tr>"; }).join("") + "</tbody></table>";
      var gsp = function (lbl, xs) { xs = xs.filter(function (x) { return x.goalie; }); var ga = 0, mn = 0, w2 = 0; xs.forEach(function (x) { ga += x.ga; mn += x.min; if (x.dec === "W") w2++; }); return '<tr><td class="l">' + lbl + "</td><td>" + xs.length + "</td><td>" + w2 + "</td><td>" + ga + '</td><td class="strong">' + (mn ? f2(ga * GLEN / mn) : "–") + "</td></tr>"; };
      split = nlog ? '<table class="plog sp"><thead><tr><th class="l">Situation</th><th>GP</th><th>W</th><th>GA</th><th>GAA</th></tr></thead><tbody>' + gsp("Home", log.filter(function (x) { return x.home; })) + gsp("Away", log.filter(function (x) { return !x.home; })) + "</tbody></table>" : "";
    }
    /* too few game sheets (official-stats leagues) for a chart, highlights or splits to mean anything */
    if (OFFICIAL && nlog < 3) { chart = ""; hls = []; split = ""; }
    var tilesH = '<div class="ptiles">' + tiles.map(function (x, i) { return '<div class="ptile' + (i > 3 ? " x" : "") + '"><span class="k">' + x[0] + '</span><span class="v">' + x[1] + '</span><span class="s">' + (x[2] || "&nbsp;") + "</span></div>"; }).join("") + "</div>";
    var hlH = hls.length ? '<div class="card pcard2 o-hl"><div class="pch"><h3>Season highlights</h3></div><ul class="phl">' + hls.join("") + "</ul></div>" : "";
    var logH = '<div class="card pcard2 o-log"><div class="pch"><h3>Game log</h3><span class="sub">' + (nlog ? nlog + " game" + (nlog === 1 ? "" : "s") + " · tap a game for its summary" : "") + "</span></div>" + (nlog ? '<div class="wrap">' + logT + "</div>" : '<p class="sub">No game sheets yet.</p>') + "</div>";
    var spH = split ? '<div class="card pcard2 o-sp"><div class="pch"><h3>Splits</h3></div>' + split + "</div>" : "";
    $("p-player").innerHTML = hero + '<div class="pbody"><div class="sub pseason">' + season + " regular season · " + esc(TEAMS[t]) + "</div>" + tilesH +
      (chart + hlH + spH ? '<div class="pcols"><div class="pcol">' + chart + hlH + spH + '</div><div class="pcol">' + logH + "</div></div>" : logH) + '<p class="pnote">' + note + "</p></div>";
    document.title = name + " · " + (L.title || "") + " · Hockey MTL";
    return true;
  }
  function showSub(id) { TABS.concat(["game", "player", "preview"]).forEach(function (t) { $("p-" + t).hidden = t !== id; }); setNav(navTab()); }
  var TITLE0 = document.title;
  function route() {
    var h = location.hash.slice(1);
    document.title = TITLE0;
    if (h.slice(0, 5) === "game/") {
      if (renderGame(+h.slice(5))) { showSub("game"); return "game"; }
      h = "schedule";
    }
    if (h.slice(0, 8) === "preview/") {
      if (renderPreview(+h.slice(8))) { showSub("preview"); return "preview"; }
      h = "schedule";
    }
    if (h.slice(0, 7) === "player/") {
      var pp = h.split("/");
      if (renderPlayer(pp[1], decodeURIComponent(pp.slice(2).join("/")))) { showSub("player"); return "player"; }
      h = "players";
    }
    $("p-player").hidden = true; $("p-game").hidden = true; $("p-preview").hidden = true;
    if (h === "matchups") h = "schedule";
    if (TABS.indexOf(h) < 0) h = "home";
    TABS.forEach(function (t) { $("p-" + t).hidden = t !== h; });
    if (h === "teams") setTimeout(fitTeamLists, 0);
    Array.prototype.forEach.call(document.querySelectorAll(".nav a"), function (a) { if (a.dataset.tab === h) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
    return h;
  }
  function goto(tab) { if (location.hash.slice(1) === tab) { route(); } else location.hash = tab; window.scrollTo(0, 0); }

  function openTeam(t) { if (!inDiv(t)) { state.div = "ALL"; syncDiv(); } if (state.team !== t) { state.ttab = "overview"; state.tmore = false; } state.team = t; state.open = 0; state.pm = 10; renderAll(); goto("teams"); }
  function curTab() { var h = location.hash.slice(1); return TABS.indexOf(h) >= 0 ? h : "home"; }
  function leaveFor(id) { openSub("game/" + id); }
  document.addEventListener("click", function (e) {
    var gl = e.target.closest && e.target.closest("a.grs");
    if (gl && !e.metaKey && !e.ctrlKey && !e.shiftKey) { e.preventDefault(); openSub(gl.getAttribute("href").slice(1)); return; }
    var plk = e.target.closest && e.target.closest("a.plink");
    if (plk && !e.metaKey && !e.ctrlKey && !e.shiftKey) { e.preventDefault(); openSub(plk.getAttribute("href").slice(1)); return; }
    var glog = e.target.closest && e.target.closest("tr[data-g]");
    if (glog) { leaveFor(+glog.dataset.g); return; }
    var frow = e.target.closest && e.target.closest(".frow"); if (frow) { featureRow(frow); return; }
    var tp = e.target.closest("[data-tp]");
    if (tp && !tp.closest(".wkc") && !tp.closest("#p-teams .tcard")) { e.preventDefault(); openTeam(tp.dataset.tp); return; }
    var tab = e.target.closest("a[data-tab]");
    if (tab && state.team !== "ALL") { state.team = "ALL"; state.open = 0; state.pm = 10; renderAll(); }
    if (tab && tab.dataset.tab === "schedule" && state.sf !== "upcoming") { state.sf = "upcoming"; renderSchedule(); }
    var b = e.target.closest("button"); if (!b) return;
    if (b.dataset.team) { openTeam(b.dataset.team); return; }
    if (b.dataset.ttab) { state.ttab = b.dataset.ttab; renderTeams(); var tt = document.querySelector(".ttabs"); if (tt && tt.getBoundingClientRect().top < 0) tt.scrollIntoView(); var sel = document.querySelector('.ttabs [data-ttab="' + state.ttab + '"]'); if (sel) sel.focus(); return; }
    if (b.dataset.tmore) { state.tmore = !state.tmore; renderTeams(); return; }
    if (b.dataset.gtab) { state.gtab = b.dataset.gtab; renderGame(state.gid); var gb = document.querySelector('[data-gtab="' + state.gtab + '"]'); if (gb) gb.focus(); return; }
    if (b.dataset.ptab) { state.ptab = b.dataset.ptab; renderPreview(state.pid); var pb = document.querySelector('[data-ptab="' + state.ptab + '"]'); if (pb) pb.focus(); return; }
    if (b.dataset.back) { var bh = location.hash.slice(1); goBack(bh.slice(0, 7) === "player/" ? "players" : bh.slice(0, 8) === "preview/" ? "schedule" : "results"); return; }
    if (b.dataset.share) { var u = location.href; if (navigator.share) navigator.share({ title: document.title, url: u }).catch(function () { }); else if (navigator.clipboard) navigator.clipboard.writeText(u).then(function () { b.textContent = "Link copied"; setTimeout(function () { b.textContent = "Share"; }, 1800); }); return; }
    if (b.dataset.open) { var pg = GAMES.filter(function (x) { return x.id === +b.dataset.open; })[0];
      if (pg) { e.preventDefault(); openSub((pg.played ? "game/" : "preview/") + pg.id); return; } }
    if (b.dataset.open) { e.preventDefault(); state.open = +b.dataset.open; var og = GAMES.filter(function (x) { return x.id === state.open; })[0] || { date: isoOf(new Date()) }; state.sf = "m:" + og.date.slice(0, 7);
      /* make sure the opened game is not hidden by the team or division filter */
      if (og.a && state.team !== "ALL" && og.a !== state.team && og.h !== state.team) state.team = "ALL";
      if (og.a && !gIn(og)) { state.div = "ALL"; syncDiv(); } renderSchedule(); goto("schedule"); var m = $("m" + state.open); if (m) { m.open = true; setTimeout(function () { m.scrollIntoView({ block: "start" }); }, 30); } return; }
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
    if (e.target.id === "sfsel") { state.sf = e.target.value; renderSchedule(); return; }
    if (e.target.id === "mteam") { state.pteam = e.target.value; state.pm = 10; renderPlayers(); return; }
    if (e.target.id !== "msort") return;
    var o = (OFFICIAL ? MSORT : MSORT_C)[state.ptab].concat(OFFICIAL ? [] : ADV_C).filter(function (x) { return x[0] === e.target.value; })[0], cfg = state.ptab === "skaters" ? state.sk : state.gk;
    cfg.key = o[0]; cfg.dir = o[2]; state.pm = 10; renderPlayers();
  });
  if (mq.addEventListener) mq.addEventListener("change", applyView);
  window.addEventListener("resize", function () { clearTimeout(fitTeamLists.t); fitTeamLists.t = setTimeout(fitTeamLists, 150); });
  window.addEventListener("hashchange", function () {
    /* back (our button or the browser's): return to the same spot */
    var h = location.hash.slice(1) || "home", top = NAV[NAV.length - 1], y = null;
    if (top && top.hash === h) { NAV.pop(); y = top.y; } else if (TABS.indexOf(h) >= 0) NAV.length = 0;
    route();
    if (y != null) { window.scrollTo(0, y); setTimeout(function () { window.scrollTo(0, y); }, 0); } else window.scrollTo(0, 0);
  });

  var YR = function (d) { return d && d !== TBD_DATE ? ", " + d.slice(0, 4) : ""; };
  $("asof").textContent = GAMES.length ? (LAST ? "Standings and results through " + dlong(LAST) + YR(LAST) : thru("") + YR(FIRST)) + " · " + PLAYED.length + " of " + GAMES.length + " regular-season games played." : "Standings as of " + (LAST ? dlong(LAST) + YR(LAST) : "today") + ". Schedule and game sheets coming soon.";
  applyView(); renderAll(); route();
  window.__hub = { ST: ST, GAMES: GAMES, results: results, ORDER: ORDER };
})();
