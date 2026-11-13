// Eco Cup Trivia Night: rules and scoring. Pure functions, no DOM, no database.
// The same file is copied to Shoeyoung25/eco-cup (trivia/js/core.js) for the operator page. Keep both copies identical.

export const TEAMS = [1, 2, 3, 4, 5, 6, 7, 8, 9];
export const ECO = [10, 8, 6, 4]; // Eco points for places 1..4
export const LETTERS = ["A", "B", "C", "D"];
export const LATE_GRACE_MS = 1500; // answers that reach the server this long after close still count (network lag)
export const TAP_WINDOW_MS = 2000; // a phone's tap time is trusted if it is at most this much before the server got it

// scoring: fastest5 = 5 fastest correct get 5/4/3/2/1; speed = Kahoot style 500-1000 for correct;
// count = 1 per correct; wager = weight if correct; closest = summed % error, lower wins.
export const ROUNDS = [
  { n: 1, name: "Showdown", scoring: "fastest5", timed: true, limit: 30,
    rules: ["Multiple choice locks the moment you tap; typed answers lock when you press Submit", "30 seconds per question", "The 5 fastest correct teams score 5, 4, 3, 2 and 1"] },
  { n: 2, name: "Picture", scoring: "count", limit: 60,
    rules: ["Identify what's on the big screen", "Type or pick your answer, then press Submit", "1 point per correct answer"] },
  { n: 3, name: "Music", scoring: "count", limit: 60,
    rules: ["Each clip plays twice", "Type or pick your answer, then press Submit", "1 point per correct answer"] },
  { n: 4, name: "Wager", scoring: "wager", limit: 60,
    rules: ["Before each question, pick a weight from 1 to 10 and confirm it", "Each weight can be used once", "Correct answers score their weight"] },
  { n: 5, name: "Closest Wins", scoring: "closest", limit: 60, lowerBetter: true,
    rules: ["Every answer is a number", "Your error on each question is capped at 100%", "Lowest total % error wins"] },
  { n: 6, name: "Kahoot", scoring: "speed", timed: true, limit: 30,
    rules: ["Multiple choice locks in the moment you tap", "30 seconds per question", "Correct answers score 500 to 1000: the faster, the more"] },
];
export const round = n => ROUNDS.find(r => r.n === Number(n));
export const ROUND_EMOJI = { 1: "⚡", 2: "🖼️", 3: "🎵", 4: "🎲", 5: "🎯", 6: "🏁" };
// each round's own look: an accent colour and a one-line tagline
export const ROUND_COLORS = { 1: "#d99a1e", 2: "#2f7fd8", 3: "#8a5cd6", 4: "#c0392b", 5: "#12a08f", 6: "#d63384" };
export const ROUND_TAG = { 1: "Fastest five score", 2: "Name what you see", 3: "Listen closely", 4: "Bet on what you know", 5: "Get as close as you can", 6: "Speed is everything" };
// one colour per team, readable with white text in light and dark mode
export const TEAM_COLORS = { 1: "#e4572e", 2: "#1b998b", 3: "#7b4fc9", 4: "#c77700", 5: "#1f6fd1", 6: "#d63384", 7: "#2f8f2f", 8: "#8c5a3c", 9: "#0b8fb0" };
export const teamColor = t => TEAM_COLORS[t] || "#5c6b63";

export const TOKENS = {
  1: { name: "1st token", title: "Triple or bust", lines: ["Top 4: points ×3", "Outside top 4: −5"] },
  2: { name: "2nd token", title: "Third or fourth", lines: ["3rd or 4th: points ×6", "1st or 2nd: points halved", "Outside top 4: −5"] },
  3: { name: "3rd token", title: "First or last", lines: ["1st: points ×4", "Bottom 2 teams: 10 points", "Any other finish: 0"] },
};

/* ---------- Prats token order ---------- */
// played: tokens already played in earlier rounds, in round order, e.g. [1, 2]. Returns tokens allowed next.
export function allowedTokens(played) {
  const p = (played || []).filter(k => k >= 1 && k <= 3);
  if (!p.length) return [1, 3];
  const dir = p[0] === 1 ? 1 : -1;
  const next = p[p.length - 1] + dir;
  return next >= 1 && next <= 3 && !p.includes(next) ? [next] : [];
}
// tokens: {round: {team: {k}}}. Tokens this team played before round r, in round order.
export function tokensPlayedBefore(tokens, team, r) {
  const out = [];
  for (const R of ROUNDS) {
    if (R.n >= r) break;
    const k = tokens?.[R.n]?.[team]?.k;
    if (k >= 1 && k <= 3) out.push(k);
  }
  return out;
}

/* ---------- typed answer matching ---------- */
export function normText(s) {
  return String(s ?? "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ").trim()
    .replace(/^(the|a|an) /, "");
}
export function lev(a, b) {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j), cur = new Array(n + 1);
  for (let i = 1; i <= m; i++) {
    cur[0] = i;
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    [prev, cur] = [cur, prev];
  }
  return prev[n];
}
const tolerance = len => (len <= 3 ? 0 : len <= 6 ? 1 : len <= 12 ? 2 : 3);
// 'yes' exact (ignoring case, accents, punctuation, leading "the"), 'close' small typo (counted right, operator can see),
// 'maybe' partial (counted wrong, operator should look), 'no'.
export function matchText(given, keys) {
  const g = normText(given), gs = g.replace(/ /g, "");
  if (!g) return "no";
  let best = "no";
  for (const k of keys) {
    const n = normText(k), ns = n.replace(/ /g, "");
    if (!n) continue;
    if (g === n || gs === ns) return "yes";
    if (/\d/.test(ns) && ns.replace(/\D/g, "") !== gs.replace(/\D/g, "")) continue; // numbers must match exactly: 13 is not a typo of 12, 9 Mile is not 8 Mile
    const d = lev(gs, ns), tol = tolerance(ns.length);
    if (d <= tol) { best = "close"; continue; }
    if (best === "no" && ((ns.length >= 4 && (gs.includes(ns) || ns.includes(gs)) && gs.length >= 3) || d <= tol * 2 + 1)) best = "maybe";
  }
  return best;
}

/* ---------- marking one answer ---------- */
// key: the operator's answer key for a question {type:'mc'|'text'|'number', answer, alts:[]}
// returns {ok:true|false, flag:null|'close'|'maybe'}
export function autoMark(key, value) {
  if (value === undefined || value === null || value === "") return { ok: false, flag: null };
  if (key.type === "mc") return { ok: String(value).toUpperCase() === String(key.answer).toUpperCase(), flag: null };
  if (key.type === "number") return { ok: null, flag: null };
  const m = matchText(value, [key.answer, ...(key.alts || [])]);
  return { ok: m === "yes" || m === "close", flag: m === "close" || m === "maybe" ? m : null };
}
// operator override wins over the automatic mark
export function finalMark(key, ans, override) {
  if (override === true || override === false) return override;
  if (!ans) return false;
  return !!autoMark(key, ans.v).ok;
}

/* ---------- timing ---------- */
// The phone stamps its tap with server-synced time (t); the database stamps arrival (at).
// Trust the tap if it is within TAP_WINDOW_MS before arrival, otherwise use the nearest bound.
export function effTime(ans) {
  if (!ans) return Infinity;
  const at = Number(ans.at), t = Number(ans.t);
  if (!isFinite(at)) return isFinite(t) ? t : Infinity;
  if (!isFinite(t)) return at;
  return Math.min(at, Math.max(t, at - TAP_WINDOW_MS));
}
export function inTime(ans, qpub) {
  if (!ans) return false;
  if (!qpub || !qpub.closeAt) return true;
  return Number(ans.at) <= Number(qpub.closeAt) + LATE_GRACE_MS;
}
export function pctError(given, truth) {
  const g = Number(given), x = Number(truth);
  if (given === undefined || given === null || given === "" || !isFinite(g) || !isFinite(x) || x === 0) return 100;
  return Math.min(Math.abs(g - x) / Math.abs(x), 1) * 100;
}
export function speedPoints(elapsedMs, limitSec) {
  const L = Math.max(1, limitSec) * 1000;
  const e = Math.min(Math.max(elapsedMs, 0), L);
  return Math.round(1000 * (1 - e / L / 2));
}

/* ---------- one question ---------- */
// ctx: {roundN, key, qpub:{startAt, closeAt, limit}, answers:{team:{v,t,at}}, overrides:{team:bool}, wagers:{team:{w}}, teams:[...]}
// returns {team: {pts, ok, err, ms}}
export function scoreQuestion(ctx) {
  const R = round(ctx.roundN), out = {};
  const teams = ctx.teams || TEAMS;
  for (const t of teams) {
    const a = ctx.answers?.[t];
    const valid = a && inTime(a, ctx.qpub) ? a : null;
    const ms = valid ? effTime(valid) - Number(ctx.qpub?.startAt || 0) : null;
    if (R.scoring === "closest") {
      const err = pctError(valid?.v, ctx.key.answer);
      out[t] = { pts: err, err, ok: null, ms };
      continue;
    }
    const ok = valid ? finalMark(ctx.key, valid, ctx.overrides?.[t]) : ctx.overrides?.[t] === true;
    let pts = 0;
    if (ok) {
      if (R.scoring === "count") pts = 1;
      else if (R.scoring === "wager") pts = Number(ctx.wagers?.[t]?.w) || 0;
      else if (R.scoring === "speed") pts = speedPoints(ms ?? Infinity, ctx.qpub?.limit || R.limit);
    }
    out[t] = { pts, ok, ms };
  }
  if (R.scoring === "fastest5") {
    const correct = teams.filter(t => out[t].ok).sort((a, b) => (out[a].ms ?? Infinity) - (out[b].ms ?? Infinity));
    correct.forEach((t, i) => { out[t].pts = i < 5 ? 5 - i : 0; });
  }
  return out;
}

/* ---------- ranking and Eco points ---------- */
// Dense ranking: tied teams share the higher place, the next team takes the next place.
export function denseRank(scores, lowerBetter) {
  const vals = [...new Set(Object.values(scores))].sort((a, b) => (lowerBetter ? a - b : b - a));
  const place = {};
  for (const [t, s] of Object.entries(scores)) place[t] = vals.indexOf(s) + 1;
  return place;
}
// Bottom 2 (for the 3rd token): every team scoring at or below the second-worst team's score.
export function bottomTwo(scores, lowerBetter) {
  const entries = Object.entries(scores);
  if (entries.length < 2) return new Set(entries.map(e => e[0]));
  const worstFirst = entries.map(e => e[1]).sort((a, b) => (lowerBetter ? b - a : a - b));
  const cut = worstFirst[1];
  return new Set(entries.filter(([, s]) => (lowerBetter ? s >= cut : s <= cut)).map(e => e[0]));
}
export function applyToken(k, place, base, isBottom2) {
  if (k === 1) return place <= 4 ? base * 3 : -5;
  if (k === 2) return place === 3 || place === 4 ? base * 6 : place <= 2 ? base / 2 : -5;
  if (k === 3) return place === 1 ? base * 4 : isBottom2 ? 10 : 0;
  return base;
}
// scores: {team: roundScore} for teams playing; tokens: {team:{k}}. Returns {team:{score, place, base, token, final}}
export function roundResult(roundN, scores, tokens) {
  const R = round(roundN);
  const place = denseRank(scores, R.lowerBetter);
  const b2 = bottomTwo(scores, R.lowerBetter);
  const rows = {};
  for (const t of Object.keys(scores)) {
    const base = place[t] <= 4 ? ECO[place[t] - 1] : 0;
    const k = Number(tokens?.[t]?.k) || 0;
    rows[t] = { score: scores[t], place: place[t], base, token: k, final: applyToken(k, place[t], base, b2.has(t)) };
  }
  return rows;
}

/* ---------- small helpers shared by pages ---------- */
export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const fmtScore = (roundN, v) => (round(roundN)?.scoring === "closest" ? `${Math.round(v * 10) / 10}%` : String(Math.round(v * 100) / 100));
export function teamName(config, t) { return config?.teams?.[t]?.name || `Team ${t}`; }
export function playingTeams(config) {
  const p = TEAMS.filter(t => config?.teams?.[t]?.playing !== false);
  return p.length ? p : TEAMS;
}
// Firebase may return arrays as objects; give back a plain array
export const arr = v => (Array.isArray(v) ? v : v && typeof v === "object" ? Object.keys(v).sort((a, b) => a - b).map(k => v[k]) : []);

// small burst of confetti from a point on the page (DOM only; harmless if called on the server)
export function confetti(x, y, n = 28, colors = Object.values(TEAM_COLORS)) {
  if (typeof document === "undefined") return;
  for (let i = 0; i < n; i++) {
    const el = document.createElement("i");
    el.className = "confetti";
    const ang = Math.random() * Math.PI * 2, dist = 80 + Math.random() * 180;
    el.style.cssText = `left:${x}px;top:${y}px;background:${colors[i % colors.length]};--dx:${Math.cos(ang) * dist}px;--dy:${Math.sin(ang) * dist + 120}px;--rot:${Math.random() * 720 - 360}deg;animation-delay:${Math.random() * 0.1}s`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1400);
  }
}
