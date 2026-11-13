// Eco Cup Trivia Night: live database (Firebase Realtime Database over REST + server-sent events) and a shared clock.
// Same file in Shoeyoung25/eco-cup (trivia/js/db.js). Keep both copies identical.
// ?db=<url> on any page points it at another database (used for testing).

const DEFAULT_DB = "https://eco-cup-862f9-default-rtdb.firebaseio.com";
export const DB_URL = (new URLSearchParams(location.search).get("db") || DEFAULT_DB).replace(/\/+$/, "");
export const ROOT = "/trivia/live";
export const MEDIA = "/trivia/media";
export const SERVER_TS = { ".sv": "timestamp" };

async function req(path, method = "GET", body) {
  const r = await fetch(DB_URL + path + ".json", { method, body: body === undefined ? undefined : JSON.stringify(body), cache: "no-store" });
  if (!r.ok) throw new Error("database said " + r.status);
  return r.json();
}
export const get = path => req(path, "GET");
export const put = (path, v) => req(path, "PUT", v);
export const patch = (path, v) => req(path, "PATCH", v);
export const del = path => req(path, "DELETE");

function setIn(obj, parts, val) {
  if (!parts.length) return val ?? {};
  let o = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!o[parts[i]] || typeof o[parts[i]] !== "object") o[parts[i]] = {};
    o = o[parts[i]];
  }
  const last = parts[parts.length - 1];
  if (val === null || val === undefined) delete o[last]; else o[last] = val;
  return obj;
}

// Keeps a live copy of everything under ROOT. onChange(data, status) runs after every change.
export function live(onChange) {
  let data = {}, ok = false, es = null, timer = null;
  const emit = () => onChange(data, ok);
  async function poll() {
    try { data = (await get(ROOT)) || {}; ok = true; } catch (e) { ok = false; }
    emit();
  }
  function stream() {
    try { es = new EventSource(DB_URL + ROOT + ".json"); } catch (e) { return; }
    const apply = (ev, merge) => {
      let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
      if (!m) return;
      const parts = String(m.path || "/").split("/").filter(Boolean);
      if (merge && m.data && typeof m.data === "object") {
        for (const [k, v] of Object.entries(m.data)) data = setIn(data, [...parts, ...k.split("/").filter(Boolean)], v);
      } else data = setIn(data, parts, m.data);
      if (!data || typeof data !== "object") data = {};
      ok = true; emit();
    };
    es.addEventListener("put", ev => apply(ev, false));
    es.addEventListener("patch", ev => apply(ev, true));
    es.addEventListener("cancel", () => { ok = false; emit(); });
    es.addEventListener("auth_revoked", () => { ok = false; emit(); });
    es.onerror = () => { ok = false; emit(); };
    es.onopen = () => { ok = true; emit(); };
  }
  poll(); stream();
  timer = setInterval(() => { if (!document.hidden) poll(); }, 15000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) poll(); });
  return { get data() { return data; }, poll, local(path, v) { data = setIn(data, path.split("/").filter(Boolean), v); emit(); } };
}

/* ---------- shared clock ---------- */
// Every page estimates how far its own clock is from the database server's clock,
// so countdowns end together everywhere and answer times are comparable.
let offset = 0, bestRtt = Infinity;
export const now = () => Date.now() + offset;
export const clockInfo = () => ({ offset, rtt: bestRtt });
async function sample() {
  const id = Math.random().toString(36).slice(2, 10);
  const path = `/trivia/clock/${id}`;
  const t0 = Date.now();
  let ts = await put(path, SERVER_TS);
  const t1 = Date.now();
  if (typeof ts !== "number") ts = await get(path);
  del(path).catch(() => {});
  const rtt = t1 - t0;
  if (typeof ts === "number" && rtt <= bestRtt + 30) {
    if (rtt < bestRtt) bestRtt = rtt;
    offset = ts - (t0 + t1) / 2;
  }
}
export async function syncClock() {
  for (let i = 0; i < 4; i++) { try { await sample(); } catch (e) { } }
  setInterval(() => { bestRtt += 20; sample().catch(() => {}); }, 60000);
}

/* ---------- small UI helpers ---------- */
export const $ = id => document.getElementById(id);
export function toast(msg, ms = 2600) {
  let el = document.querySelector(".toast");
  if (!el) { el = document.createElement("div"); el.className = "toast"; el.setAttribute("role", "status"); document.body.appendChild(el); }
  el.textContent = msg; el.hidden = false;
  clearTimeout(el._t); el._t = setTimeout(() => (el.hidden = true), ms);
}
