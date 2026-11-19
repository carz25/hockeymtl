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
  const page = String((f && f.page) || "").slice(0, 200);
  const text = "Name: " + v.name + "\nEmail: " + v.email + "\nSubject: " + v.subject + (page ? "\nPage: " + page : "") +
    "\n\n" + v.message + "\n\n-- \nSent from the hockeymtl.ca contact form. Reply to this email to answer " + v.name + ".\n";
  const raw = mime({ from: "Hockey MTL contact form <" + from + ">", to: env.CONTACT_TO, replyTo: v.name + " <" + v.email + ">", subject: "[Hockey MTL] " + v.subject, text, domain: from.split("@")[1] });
  try {
    await env.EMAIL.send(new EmailMessage(from, env.CONTACT_TO, raw));
  } catch (e) {
    return json({ ok: false, error: "Your message could not be sent. Please try again later." }, 502);
  }
  return json({ ok: true });
}

/* a plain-text email, UTF-8 so accents work in every field */
export function mime(m) {
  const b64 = (s) => { const b = new TextEncoder().encode(s); let bin = ""; for (const c of b) bin += String.fromCharCode(c); return btoa(bin); };
  const word = (s) => (/^[\x20-\x7e]*$/.test(s) ? s : "=?UTF-8?B?" + b64(s) + "?=");
  const addr = (s) => { const i = s.lastIndexOf("<"); return i > 0 ? word(s.slice(0, i).trim().replace(/"/g, "")) + " " + s.slice(i) : s; };
  const body = b64(m.text).replace(/.{1,76}/g, "$&\r\n");
  return [
    "From: " + addr(m.from),
    "To: " + m.to,
    "Reply-To: " + addr(m.replyTo),
    "Subject: " + word(m.subject),
    "Date: " + new Date().toUTCString().replace("GMT", "+0000"),
    "Message-ID: <" + crypto.randomUUID() + "@" + m.domain + ">",
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    body,
  ].join("\r\n");
}

function json(o, status) {
  return new Response(JSON.stringify(o), { status: status || 200, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
}
