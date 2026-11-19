/* Contact form popup. Loaded on the first click of a footer "Contact" button (see logo.js).
   Sends to /api/contact (worker.js), which emails the site owner. */
(function () {
  /* Turnstile (Cloudflare's spam check) site key, public. Leave "" to skip the check. */
  var SITEKEY = "";
  var MAX = 250, dlg, lastBtn, widget = null;

  var css = '' +
    '.hc-dlg{border:0;padding:0;border-radius:10px;width:min(480px,calc(100vw - 24px));max-height:calc(100vh - 24px);color:#0F1B2A;background:#fff;box-shadow:0 20px 60px rgba(0,0,0,.35);font-family:"IBM Plex Sans",system-ui,sans-serif}' +
    '.hc-dlg::backdrop{background:rgba(8,12,18,.6)}' +
    '.hc-in{padding:22px 24px 20px;display:flex;flex-direction:column;gap:14px}' +
    '.hc-top{display:flex;justify-content:space-between;align-items:center;gap:12px}' +
    '.hc-top h2{margin:0;font-family:"Big Shoulders Display",Arial Narrow,sans-serif;font-weight:800;font-size:30px;text-transform:uppercase;letter-spacing:.02em;line-height:1}' +
    '.hc-x{width:36px;height:36px;border:0;border-radius:50%;background:#EEF1F5;color:#0F1B2A;font-size:22px;line-height:1;cursor:pointer}' +
    '.hc-x:hover{background:#DDE3EA}' +
    '.hc-lede{margin:-6px 0 0;font-size:14px;color:#5B6675}' +
    '.hc-f{display:flex;flex-direction:column;gap:5px}' +
    '.hc-f label{font-size:13px;font-weight:600}' +
    '.hc-f input,.hc-f textarea{font:inherit;font-size:15px;color:inherit;border:1px solid #C9D1DB;border-radius:6px;padding:9px 11px;background:#fff;width:100%;box-sizing:border-box}' +
    '.hc-f textarea{resize:vertical;min-height:110px}' +
    '.hc-f input:focus,.hc-f textarea:focus{outline:2px solid #2563EB;outline-offset:0;border-color:#2563EB}' +
    '.hc-row{display:grid;grid-template-columns:1fr 1fr;gap:12px}' +
    '.hc-cnt{align-self:flex-end;font-size:12px;color:#5B6675;font-variant-numeric:tabular-nums}' +
    '.hc-cnt.lo{color:#B42318;font-weight:600}' +
    '.hc-trap{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden}' +
    '.hc-act{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}' +
    '.hc-msg{font-size:14px;min-height:20px}' +
    '.hc-msg.err{color:#B42318}.hc-msg.ok{color:#1F7A4D;font-weight:600}' +
    '.hc-send{border:0;border-radius:999px;padding:10px 22px;background:#C8102E;color:#fff;font:inherit;font-weight:700;font-size:15px;cursor:pointer;margin-left:auto}' +
    '.hc-send:hover{background:#A50D26}.hc-send:disabled{opacity:.6;cursor:default}' +
    '.hc-send:focus-visible,.hc-x:focus-visible{outline:2px solid #2563EB;outline-offset:2px}' +
    '@media (max-width:520px){.hc-row{grid-template-columns:1fr}.hc-in{padding:18px 16px 16px}.hc-top h2{font-size:26px}}';

  function el(html) { var d = document.createElement("div"); d.innerHTML = html; return d.firstChild; }

  function build() {
    var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
    dlg = el('<dialog class="hc-dlg" aria-labelledby="hc-title"><form class="hc-in" novalidate>' +
      '<div class="hc-top"><h2 id="hc-title">Contact</h2><button type="button" class="hc-x" aria-label="Close">&times;</button></div>' +
      '<p class="hc-lede">Questions, corrections or ideas for the site? Send a note.</p>' +
      '<div class="hc-row"><div class="hc-f"><label for="hc-name">Name</label><input id="hc-name" name="name" maxlength="80" autocomplete="name" required></div>' +
      '<div class="hc-f"><label for="hc-email">Email</label><input id="hc-email" name="email" type="email" maxlength="120" autocomplete="email" required></div></div>' +
      '<div class="hc-f"><label for="hc-subject">Subject</label><input id="hc-subject" name="subject" maxlength="120" required></div>' +
      '<div class="hc-f"><label for="hc-message">Message</label><textarea id="hc-message" name="message" maxlength="' + MAX + '" rows="5" required aria-describedby="hc-cnt"></textarea><span class="hc-cnt" id="hc-cnt" aria-live="polite">' + MAX + ' characters left</span></div>' +
      '<div class="hc-trap" aria-hidden="true"><label for="hc-website">Website</label><input id="hc-website" name="website" tabindex="-1" autocomplete="off"></div>' +
      '<div class="hc-ts"></div>' +
      '<div class="hc-act"><span class="hc-msg" role="status" aria-live="polite"></span><button type="submit" class="hc-send">Send</button></div>' +
      "</form></dialog>");
    document.body.appendChild(dlg);
    var form = dlg.querySelector("form"), ta = form.message, cnt = dlg.querySelector(".hc-cnt");
    ta.addEventListener("input", function () { var left = MAX - ta.value.length; cnt.textContent = left + (left === 1 ? " character left" : " characters left"); cnt.classList.toggle("lo", left <= 20); });
    dlg.querySelector(".hc-x").addEventListener("click", close);
    dlg.addEventListener("click", function (e) { if (e.target === dlg) close(); });
    dlg.addEventListener("close", function () { if (lastBtn) lastBtn.focus(); });
    form.addEventListener("input", function () { var m = dlg.querySelector(".hc-msg"); if (m.classList.contains("err")) say(""); });
    form.addEventListener("submit", send);
  }

  function say(t, cls) { var m = dlg.querySelector(".hc-msg"); m.textContent = t || ""; m.className = "hc-msg" + (cls ? " " + cls : ""); }

  function turnstile() {
    if (!SITEKEY || widget !== null) return;
    widget = false;
    var go = function () { widget = window.turnstile.render(dlg.querySelector(".hc-ts"), { sitekey: SITEKEY, size: "flexible", appearance: "interaction-only" }); };
    if (window.turnstile) { go(); return; }
    var s = document.createElement("script"); s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"; s.async = true; s.onload = go; document.head.appendChild(s);
  }

  function send(e) {
    e.preventDefault();
    var f = e.target, btn = f.querySelector(".hc-send"), v = {};
    ["name", "email", "subject", "message", "website"].forEach(function (k) { v[k] = f[k].value.trim(); });
    if (!v.name || !v.email || !v.subject || !v.message) { say("Please fill in every field.", "err"); (f.name.value.trim() ? f.email.value.trim() ? f.subject.value.trim() ? f.message : f.subject : f.email : f.name).focus(); return; }
    if (!/^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(v.email)) { say("Please enter a valid email address.", "err"); f.email.focus(); return; }
    if (SITEKEY && window.turnstile && widget) v.token = window.turnstile.getResponse(widget) || "";
    v.page = location.href.slice(0, 200);
    btn.disabled = true; say("Sending…");
    fetch("/api/contact", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(v) })
      .then(function (r) { return r.json().catch(function () { return { ok: false }; }); })
      .then(function (r) {
        btn.disabled = false;
        if (r.ok) { f.reset(); f.message.dispatchEvent(new Event("input")); say("Thanks, your message was sent.", "ok"); if (widget && window.turnstile) window.turnstile.reset(widget); }
        else { say(r.error || "Your message could not be sent. Please try again later.", "err"); if (widget && window.turnstile) window.turnstile.reset(widget); }
      })
      .catch(function () { btn.disabled = false; say("Your message could not be sent. Check your connection and try again.", "err"); });
  }

  function close() { if (dlg.open) dlg.close(); }

  window.HMTL_CONTACT = function (btn) {
    if (!dlg) build();
    lastBtn = btn || null;
    say("");
    if (typeof dlg.showModal === "function") dlg.showModal(); else dlg.setAttribute("open", "");
    turnstile();
    setTimeout(function () { dlg.querySelector("#hc-name").focus(); }, 0);
  };
})();
