/* Hockey MTL on Cloudflare Workers.
   Every request is a plain file from the repo (static assets), except /api/*, which runs here.
   POST /api/contact: the footer's contact form. It emails the owner through Cloudflare Email Routing.
   Settings kept in the Worker (Settings > Variables and Secrets), never in this repo:
     CONTACT_TO        the owner's address, verified under Email Routing > Destination addresses
     TURNSTILE_SECRET  Turnstile secret key (spam check); if missing, only the hidden trap field is checked
     CONTACT_FROM      optional sender, default form@hockeymtl.ca (must be on a domain with Email Routing) */
import { EmailMessage } from "cloudflare:email";

const LIMITS = { name: 80, email: 120, subject: 120, message: 250 };

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/contact") return contact(request, env);
    if (url.pathname.startsWith("/api/")) return json({ ok: false, error: "Not found." }, 404);
    return env.ASSETS.fetch(request);
  },
};

async function contact(request, env) {
  if (request.method !== "POST") return json({ ok: false, error: "Use POST." }, 405);
  if (!env.EMAIL || !env.CONTACT_TO) return json({ ok: false, error: "The contact form is not set up yet." }, 503);
  let f;
  try { f = await request.json(); } catch (e) { return json({ ok: false, error: "Bad request." }, 400); }
  const v = {};
  for (const k of Object.keys(LIMITS)) v[k] = String((f && f[k]) || "").replace(/\r/g, "").trim();
  /* hidden field that people never see: bots fill it in */
  if (f && f.website) return json({ ok: true });
  if (!v.name || !v.email || !v.subject || !v.message) return json({ ok: false, error: "Please fill in every field." }, 400);
  for (const k of Object.keys(LIMITS)) if (v[k].length > LIMITS[k]) return json({ ok: false, error: "Your " + k + " is too long." }, 400);
  if (!/^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(v.email)) return json({ ok: false, error: "Please enter a valid email address." }, 400);
  for (const k of ["name", "email", "subject"]) v[k] = v[k].replace(/\n/g, " ");

  if (env.TURNSTILE_SECRET) {
    const body = new FormData();
    body.append("secret", env.TURNSTILE_SECRET);
    body.append("response", String((f && f.token) || ""));
    const ip = request.headers.get("CF-Connecting-IP"); if (ip) body.append("remoteip", ip);
    let ok = false;
    try { const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body }); ok = (await r.json()).success === true; } catch (e) { ok = false; }
    if (!ok) return json({ ok: false, error: "The spam check failed. Please try again." }, 400);
  }

  const from = env.CONTACT_FROM || "form@hockeymtl.ca";
  const page = String((f && f.page) || "").slice(0, 200).replace(/[\r\n]/g, "");
  const raw = mime({
    from: v.name + " via Hockey MTL <" + from + ">",
    to: env.CONTACT_TO,
    replyTo: v.name + " <" + v.email + ">",
    subject: v.subject,
    text: v.message + "\n\n----\nFrom: " + v.name + " <" + v.email + ">\n" + (page ? "Page: " + page + "\n" : "") + "Reply to this email to answer " + v.name + ".\n",
    html: emailHTML(v, page),
    domain: from.split("@")[1],
  });
  try {
    await env.EMAIL.send(new EmailMessage(from, env.CONTACT_TO, raw));
  } catch (e) {
    return json({ ok: false, error: "Your message could not be sent. Please try again later." }, 502);
  }
  return json({ ok: true });
}

/* the email: plain text plus a simple HTML version, UTF-8 so accents work everywhere */
export function mime(m) {
  const b64 = (str) => { const b = new TextEncoder().encode(str); let bin = ""; for (const c of b) bin += String.fromCharCode(c); return btoa(bin); };
  const word = (str) => (/^[\x20-\x7e]*$/.test(str) ? str : "=?UTF-8?B?" + b64(str) + "?=");
  const addr = (str) => { const i = str.lastIndexOf("<"); return i > 0 ? word(str.slice(0, i).trim().replace(/"/g, "")) + " " + str.slice(i) : str; };
  const part = (type, body) => ["Content-Type: " + type + "; charset=UTF-8", "Content-Transfer-Encoding: base64", "", b64(body).replace(/.{1,76}/g, "$&\r\n")].join("\r\n");
  const bound = "hm-" + crypto.randomUUID();
  return [
    "From: " + addr(m.from),
    "To: " + m.to,
    "Reply-To: " + addr(m.replyTo),
    "Subject: " + word(m.subject),
    "Date: " + new Date().toUTCString().replace("GMT", "+0000"),
    "Message-ID: <" + crypto.randomUUID() + "@" + m.domain + ">",
    "MIME-Version: 1.0",
    'Content-Type: multipart/alternative; boundary="' + bound + '"',
    "",
    "--" + bound,
    part("text/plain", m.text),
    "--" + bound,
    part("text/html", m.html),
    "--" + bound + "--",
    "",
  ].join("\r\n");
}

function emailHTML(v, page) {
  const e = (str) => String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const reply = "mailto:" + encodeURIComponent(v.email) + "?subject=" + encodeURIComponent("Re: " + v.subject);
  return '<!doctype html><html><body style="margin:0;padding:24px;background:#F3F5F8;font-family:Arial,Helvetica,sans-serif;color:#0F1B2A">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:8px">' +
    '<tr><td style="padding:22px 26px 6px;font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#5B6675">Hockey MTL contact form</td></tr>' +
    '<tr><td style="padding:0 26px 4px;font-size:20px;font-weight:bold">' + e(v.subject) + "</td></tr>" +
    '<tr><td style="padding:0 26px 16px;font-size:14px;color:#5B6675">From <b style="color:#0F1B2A">' + e(v.name) + '</b> &lt;<a href="mailto:' + e(v.email) + '" style="color:#1D4ED8">' + e(v.email) + "</a>&gt;</td></tr>" +
    '<tr><td style="padding:0 26px"><div style="border-left:4px solid #C8102E;background:#F7F8FA;padding:14px 16px;font-size:15px;line-height:1.5;white-space:pre-wrap">' + e(v.message) + "</div></td></tr>" +
    '<tr><td style="padding:20px 26px 6px"><a href="' + e(reply) + '" style="display:inline-block;background:#C8102E;color:#ffffff;text-decoration:none;font-weight:bold;padding:10px 20px;border-radius:999px">Reply to ' + e(v.name.split(" ")[0] || v.name) + "</a></td></tr>" +
    '<tr><td style="padding:10px 26px 22px;font-size:12px;color:#8A94A3">Or just hit Reply: it goes to ' + e(v.email) + "." + (page ? ' Sent from <a href="' + e(page) + '" style="color:#8A94A3">' + e(page) + "</a>." : "") + "</td></tr>" +
    "</table></body></html>";
}

function json(o, status) {
  return new Response(JSON.stringify(o), { status: status || 200, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
}
