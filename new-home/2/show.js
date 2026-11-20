/* hockeymtl.ca landing page, test version 2 (served at /new-home/2/): the animated "showpiece".
   A dark rink with sweeping arena lights, a big headline, a scoreboard that cycles through the latest
   results and counts down to the next game, and one slanted door per division with live numbers.
   Numbers are read from each division's own data.js. Divisions come from shared/leagues.js. */
(function () {
  "use strict";
  var LOGO = window.HMTL_LOGO || "";
  var BASE = window.HMTL_BASE || "/";
  var D = Math.floor(Date.now() / 900000);      // same 15-minute key as the division pages, so their data is already cached
  var REDUCED = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  // door colours per division: bg = door, edge = top edge, soft = small text, tag = score-chip label
  var THEME = {
    M11BB: { bg: "#0E3276", edge: "#7DD3FC", soft: "#CFE6FF", tag: "#2B6CB0" },
    M13AAA: { bg: "#9A1B29", edge: "#FF8A80", soft: "#FFE1E1", tag: "#C8202F" }
  };
  function theme(l) { return THEME[l.folder] || { bg: l.color, edge: "#fff", soft: "#E8EEF5", tag: l.color }; }
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;"); }
  var WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], MO = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function ymd(d) { return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); }
  function day(s) { var p = s.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function at(s, t) {                                   // "2026-11-21", "1:00 PM" -> Date
    var d = day(s), m = /(\d+):(\d+)\s*(AM|PM)?/i.exec(t || "");
    if (m) { var h = +m[1] % 12; if (/pm/i.test(m[3] || "")) h += 12; d.setHours(h, +m[2]); }
    return d;
  }
  var now = new Date(), today = ymd(now);
  var sat = new Date(now); sat.setDate(now.getDate() + ((6 - now.getDay() + 7) % 7) - (now.getDay() === 0 ? 7 : 0));
  var sun = new Date(sat); sun.setDate(sat.getDate() + 1);
  var WEEKEND = [ymd(sat), ymd(sun)];
  function when(s, t) {
    var d = day(s), ahead = (d - day(today)) / 864e5;
    return (s === today ? "Today" : ahead > 0 && ahead < 7 ? WD[d.getDay()] : MO[d.getMonth()] + " " + d.getDate()) + (t ? " " + t : "");
  }
  var season = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
  var ARROW = '<svg aria-hidden="true" width="26" height="16" viewBox="0 0 26 16"><path d="M0 8h23M16 1l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.6"/></svg>';

  /* ---------- page ---------- */
  var carve = [
    "M-20 240 C 260 180, 520 330, 860 250", "M120 620 C 420 520, 700 700, 1040 560", "M620 80 C 820 160, 1040 90, 1460 210",
    "M900 760 C 1080 700, 1260 800, 1460 720", "M200 420 C 360 380, 480 470, 640 430", "M1020 360 C 1160 330, 1300 420, 1440 380", "M-10 820 C 180 760, 340 860, 520 800"
  ].map(function (d, i) { return '<path class="sp-carve" style="animation-delay:' + (0.2 + i * 0.3).toFixed(1) + 's" d="' + d + '"/>'; }).join("");
  var rink = '<div class="sp-rink" aria-hidden="true"><svg viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice">' +
    '<g fill="none" opacity=".2"><path d="M720 0V900" stroke="#C8202F" stroke-width="6"/><path d="M300 0V900" stroke="#2B6CB0" stroke-width="10"/><path d="M1140 0V900" stroke="#2B6CB0" stroke-width="10"/>' +
    '<circle cx="720" cy="520" r="230" stroke="#2B6CB0" stroke-width="4"/><circle cx="150" cy="700" r="120" stroke="#C8202F" stroke-width="3"/><circle cx="1290" cy="700" r="120" stroke="#C8202F" stroke-width="3"/></g>' +
    '<circle cx="720" cy="520" r="9" fill="#2B6CB0" opacity=".3"/><g fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".2">' + carve + "</g></svg></div>";
  var lights = '<div class="sp-lights" aria-hidden="true"><div class="sp-beam a"></div><div class="sp-beam b"></div><div class="sp-vig"></div></div>';
  var strip = LEAGUES.map(function (l) { return '<span style="background:' + theme(l).tag + '"></span>'; }).join("");
  var doors = LEAGUES.map(function (l, i) {
    var th = theme(l), num = (String(l.label).match(/\d+/) || [""])[0];
    return '<a class="sp-door" href="' + BASE + l.folder + '/" style="--bg:' + th.bg + ";--edge:" + th.edge + ";--soft:" + th.soft + ";animation-delay:" + (1.1 + i * 0.15).toFixed(2) + 's">' +
      '<span class="sp-un">' +
      '<span class="sp-out" aria-hidden="true">' + esc(num) + "</span>" +
      '<span class="sp-dname"><span class="sp-deye" id="sp-eye-' + i + '">Under ' + esc(num) + "</span><b>" + esc(l.label) + "</b></span>" +
      '<span class="sp-dstats" id="sp-st-' + i + '"></span>' +
      '<span class="sp-enter">Enter' + ARROW + "</span></span></a>";
  }).join("");

  document.body.classList.add("sp-body");
  document.body.insertAdjacentHTML("afterbegin",
    '<div class="sp" id="sp">' + rink + lights +
    '<div class="sp-strip" aria-hidden="true">' + strip + "</div>" +
    '<header class="sp-top"><a class="sp-brand" href="' + BASE + '" aria-label="Hockey MTL home">' + LOGO + '<span class="sp-wm"><span>Hockey</span><span>MTL</span></span></a>' +
    '<nav class="sp-nav" aria-label="Divisions">' + LEAGUES.map(function (l) { return '<a href="' + BASE + l.folder + '/">' + esc(l.label) + "</a>"; }).join("") + "</nav></header>" +
    '<main class="sp-main"><div class="sp-hero"><div class="sp-copy">' +
    '<span class="sp-eye rise" style="animation-delay:.1s">Montréal youth hockey · ' + season + "–" + String(season + 1).slice(2) + " season</span>" +
    '<h1><span class="slam" style="animation-delay:.25s">Every score.</span><br><span class="slam" style="animation-delay:.45s">Every standing.</span><br><span class="slam sheen" style="animation-delay:.65s">Every weekend.</span></h1>' +
    '<p class="rise" style="animation-delay:1s">Scores, standings and stats for the ' + LEAGUES.map(function (l) { return esc(l.label); }).join(" and ") +
    " divisions, drawn from the league's standings, schedule and game sheets.</p></div>" +
    '<div class="sp-boardw rise" style="animation-delay:.8s"><section class="sp-board" id="sp-board" aria-label="Latest results and next game">' +
    '<div class="sp-bhd"><span id="sp-bdate">Latest results</span><span class="sp-lamp" aria-hidden="true"></span></div>' +
    '<div class="sp-slides" id="sp-slides"></div><div class="sp-dots" id="sp-dots" aria-hidden="true"></div>' +
    '<div class="sp-next" id="sp-next" hidden><a class="sp-nlbl" id="sp-nlbl"></a><div class="sp-clock" id="sp-clock" role="timer" aria-live="off"></div></div>' +
    "</section></div></div>" +
    '<nav class="sp-doors" aria-label="Divisions">' + doors + "</nav></main>" +
    '<section class="sp-tick" aria-label="Latest results"><div class="sp-track" id="sp-track"></div></section>' +
    '<footer class="sp-foot"><span><span class="sp-long">Unofficial fan site, not affiliated with any league or club. </span><span class="sp-short">Unofficial fan site · </span>&copy; 2026 Hockey MTL</span>' +
    '<button type="button" data-contact="1">Contact</button></footer></div>');

  /* ---------- pointer: the rink drifts and the scoreboard tilts a little (desktop only) ---------- */
  var sp = document.getElementById("sp"), rinkEl = sp.querySelector(".sp-rink"), board = document.getElementById("sp-board"), raf = 0, mx = 0, my = 0;
  if (!REDUCED && matchMedia("(hover: hover) and (min-width: 900px)").matches) {
    sp.addEventListener("mousemove", function (e) {
      mx = e.clientX / innerWidth - 0.5; my = e.clientY / innerHeight - 0.5;
      if (raf) return;
      raf = requestAnimationFrame(function () {
        raf = 0;
        rinkEl.style.transform = "translate(" + (-mx * 26).toFixed(1) + "px," + (-my * 18).toFixed(1) + "px)";
        board.style.transform = "perspective(900px) rotateY(" + (mx * 9).toFixed(2) + "deg) rotateX(" + (-my * 7).toFixed(2) + "deg)";
      });
    });
  }

  /* ---------- division data: each data.js and league.js read in its own scope (they declare the same names) ---------- */
  function load(url, names) {
    return fetch(url).then(function (r) { if (!r.ok) throw r.status; return r.text(); }).then(function (src) {
      return new Function(src + "\n;return {" + names.map(function (n) { return n + ":typeof " + n + '!=="undefined"?' + n + ":null"; }).join(",") + "};")();
    });
  }
  function countUp(el, to, dec) {
    if (REDUCED) { el.textContent = to.toFixed(dec); return; }
    var t0 = 0;
    requestAnimationFrame(function step(ts) {
      if (!t0) t0 = ts;
      var k = Math.min(1, (ts - t0) / 1700), e = 1 - Math.pow(1 - k, 3);
      el.textContent = (to * e).toFixed(dec);
      if (k < 1) requestAnimationFrame(step);
    });
  }

  var finals = [], nexts = [], pending = LEAGUES.length;
  LEAGUES.forEach(function (l, i) {
    var root = BASE + l.folder + "/";
    load(root + "league.js", ["LEAGUE"]).then(function (o) {
      if (o.LEAGUE && o.LEAGUE.subtitle) document.getElementById("sp-eye-" + i).textContent += " · " + o.LEAGUE.subtitle;
    }).catch(function () {});
    load(root + "data.js?v=" + D, ["SCHED", "SHORT", "TEAMS"]).then(function (o) {
      var S = o.SCHED || [], name = function (t) { return (o.SHORT && o.SHORT[t]) || (o.TEAMS && o.TEAMS[t]) || t; };
      var played = S.filter(function (g) { return g[6] != null && g[7] != null; });
      var wk = S.filter(function (g) { return WEEKEND.indexOf(g[1]) >= 0; }).length;
      var goals = played.reduce(function (a, g) { return a + g[6] + g[7]; }, 0), gpg = played.length ? goals / played.length : 0;
      var box = document.getElementById("sp-st-" + i);
      box.innerHTML = [[played.length, 0, "Games played"], [wk, 0, "This weekend"], [gpg, 2, "Goals a game"]].map(function (s) {
        return '<span class="sp-st"><b data-to="' + s[0] + '" data-dec="' + s[1] + '">0</b><small>' + s[2] + "</small></span>";
      }).join("");
      Array.prototype.forEach.call(box.querySelectorAll("b"), function (b) { countUp(b, +b.dataset.to, +b.dataset.dec); });
      played.slice(-6).forEach(function (g) { finals.push({ l: l, g: g, name: name, root: root }); });
      S.forEach(function (g) { if (g[6] == null && at(g[1], g[2]) > now) nexts.push({ l: l, g: g, name: name, root: root, t: at(g[1], g[2]) }); });
    }).catch(function () {}).then(function () { if (--pending === 0) drawBoard(); });
  });

  /* ---------- scoreboard, countdown and ticker ---------- */
  function rowsOf(f) {
    var g = f.g, rows = [[g[4], g[6]], [g[5], g[7]]];
    if (g[7] > g[6]) rows.reverse();                        // winner on top
    return rows;
  }
  function drawBoard() {
    finals.sort(function (a, b) { return a.g[1] < b.g[1] ? 1 : a.g[1] > b.g[1] ? -1 : 0; });
    var show = finals.slice(0, 6);
    if (!show.length) { document.getElementById("sp-board").hidden = true; document.querySelector(".sp-tick").hidden = true; return; }
    document.getElementById("sp-bdate").textContent = "Latest results · " + when(show[0].g[1]);
    document.getElementById("sp-slides").innerHTML = show.map(function (f, i) {
      var r = rowsOf(f), tie = f.g[6] === f.g[7];
      return '<a class="sp-slide' + (i ? "" : " on") + '" href="' + f.root + "#game/" + f.g[0] + '"' + (i ? ' tabindex="-1" aria-hidden="true"' : "") + ">" +
        '<span class="sp-tag" style="background:' + theme(f.l).tag + '">' + esc(f.l.label) + "</span>" +
        '<span class="sp-row w"><span>' + esc(f.name(r[0][0])) + "</span><b>" + r[0][1] + "</b></span>" +
        '<span class="sp-row' + (tie ? " w" : "") + '"><span>' + esc(f.name(r[1][0])) + "</span><b>" + r[1][1] + "</b></span></a>";
    }).join("");
    document.getElementById("sp-dots").innerHTML = show.map(function (_, i) { return "<span" + (i ? "" : ' class="on"') + "></span>"; }).join("");
    var slides = document.querySelectorAll(".sp-slide"), dots = document.querySelectorAll(".sp-dots span"), idx = 0, paused = false;
    var bd = document.getElementById("sp-board");
    bd.addEventListener("mouseenter", function () { paused = true; }); bd.addEventListener("mouseleave", function () { paused = false; });
    bd.addEventListener("focusin", function () { paused = true; }); bd.addEventListener("focusout", function () { paused = false; });
    if (show.length > 1) setInterval(function () {
      if (paused || document.hidden) return;
      slides[idx].classList.remove("on"); slides[idx].tabIndex = -1; slides[idx].setAttribute("aria-hidden", "true"); dots[idx].classList.remove("on");
      idx = (idx + 1) % show.length;
      slides[idx].classList.add("on"); slides[idx].removeAttribute("tabindex"); slides[idx].removeAttribute("aria-hidden"); dots[idx].classList.add("on");
    }, 4000);

    // next puck drop across every division, with a live countdown
    nexts.sort(function (a, b) { return a.t - b.t; });
    var n = nexts[0];
    if (n) {
      document.getElementById("sp-next").hidden = false;
      var lbl = document.getElementById("sp-nlbl");
      lbl.href = n.root + "#preview/" + n.g[0];
      lbl.textContent = "Next puck drop · " + when(n.g[1], n.g[2]) + " · " + n.name(n.g[4]) + " at " + n.name(n.g[5]);
      var clock = document.getElementById("sp-clock");
      var two = function (v) { return (v < 10 ? "0" : "") + v; };
      var tick = function () {
        var left = Math.max(0, Math.floor((n.t - Date.now()) / 1000));
        clock.innerHTML = [[Math.floor(left / 86400), "Days"], [Math.floor(left % 86400 / 3600), "Hours"], [Math.floor(left % 3600 / 60), "Min"], [left % 60, "Sec"]]
          .map(function (c) { return "<span><b>" + two(c[0]) + "</b><small>" + c[1] + "</small></span>"; }).join("");
      };
      tick(); setInterval(tick, 1000);
    }

    // ticker: every recent result, twice in a row so the loop has no gap; the copy is hidden from screen readers and Tab
    var chips = finals.map(function (f) {
      var r = rowsOf(f);
      return '<a class="sp-chip" href="' + f.root + "#game/" + f.g[0] + '"><span class="sp-tag" style="background:' + theme(f.l).tag + '">' + esc(f.l.label) + "</span>" +
        "<strong>" + esc(f.name(r[0][0])) + " " + r[0][1] + "</strong><span>" + esc(f.name(r[1][0])) + " " + r[1][1] + "</span></a>";
    }).join("");
    var track = document.getElementById("sp-track");
    track.innerHTML = '<div class="sp-set">' + chips + '</div><div class="sp-set" aria-hidden="true">' + chips.replace(/<a /g, '<a tabindex="-1" ') + "</div>";
    track.style.setProperty("--dur", Math.max(24, finals.length * 4) + "s");
  }
})();
