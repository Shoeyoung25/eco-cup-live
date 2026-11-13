// Run: node --test trivia/tests/
import test from "node:test";
import assert from "node:assert/strict";
import * as C from "../js/core.js";

test("token order", () => {
  assert.deepEqual(C.allowedTokens([]), [1, 3]);
  assert.deepEqual(C.allowedTokens([1]), [2]);
  assert.deepEqual(C.allowedTokens([1, 2]), [3]);
  assert.deepEqual(C.allowedTokens([1, 2, 3]), []);
  assert.deepEqual(C.allowedTokens([3]), [2]);
  assert.deepEqual(C.allowedTokens([3, 2]), [1]);
  assert.deepEqual(C.allowedTokens([3, 2, 1]), []);
  const tok = { 1: { 4: { k: 3 } }, 2: { 4: { k: 0 } }, 3: { 4: { k: 2 } } };
  assert.deepEqual(C.tokensPlayedBefore(tok, 4, 4), [3, 2]);
  assert.deepEqual(C.tokensPlayedBefore(tok, 4, 3), [3]);
});

test("text matching", () => {
  assert.equal(C.matchText("the beatles", ["Beatles"]), "yes");
  assert.equal(C.matchText("Beyonce", ["Beyoncé"]), "yes");
  assert.equal(C.matchText("Mr. Brightside", ["Mr Brightside"]), "yes");
  assert.equal(C.matchText("Mr Brightsde", ["Mr Brightside"]), "close");
  assert.equal(C.matchText("Brightside", ["Mr Brightside"]), "close"); assert.equal(C.matchText("Killers", ["Mr Brightside", "The Killers Mr Brightside"]), "maybe");
  assert.equal(C.matchText("Queen", ["Beatles"]), "no");
  assert.equal(C.matchText("cat", ["car"]), "maybe"); // short words need exact; 1 off is only 'maybe'
  assert.equal(C.matchText("", ["x"]), "no");
  assert.deepEqual(C.autoMark({ type: "mc", answer: "B" }, "b"), { ok: true, flag: null });
  assert.deepEqual(C.autoMark({ type: "text", answer: "Paris", alts: ["Paree"] }, "parris"), { ok: true, flag: "close" });
});

test("pct error and speed", () => {
  assert.equal(C.pctError(110, 100), 10);
  assert.equal(C.pctError(500, 100), 100);
  assert.equal(C.pctError("", 100), 100);
  assert.equal(C.pctError(undefined, 100), 100);
  assert.equal(C.speedPoints(0, 30), 1000);
  assert.equal(C.speedPoints(30000, 30), 500);
  assert.equal(C.speedPoints(15000, 30), 750);
  assert.equal(C.speedPoints(99999, 30), 500);
});

test("effective time", () => {
  assert.equal(C.effTime({ t: 1000, at: 1500 }), 1000);
  assert.equal(C.effTime({ t: 0, at: 5000 }), 3000); // tap claimed too early, clamp to 2 s before arrival
  assert.equal(C.effTime({ t: 9000, at: 5000 }), 5000); // tap after arrival is impossible, use arrival
  assert.equal(C.effTime({ at: 5000 }), 5000);
});

const teams = [1, 2, 3, 4, 5, 6, 7];
test("fastest5 question", () => {
  const ans = {}; teams.forEach((t, i) => ans[t] = { v: "A", t: 1000 + t * 100, at: 1000 + t * 100 + 50 });
  ans[2].v = "B";
  const s = C.scoreQuestion({ roundN: 1, key: { type: "mc", answer: "A" }, qpub: { startAt: 1000, closeAt: 40000, limit: 30 }, answers: ans, teams });
  assert.deepEqual(teams.map(t => s[t].pts), [5, 0, 4, 3, 2, 1, 0]);
});
test("late answers ignored, overrides win", () => {
  const ans = { 1: { v: "A", t: 1000, at: 50000 }, 2: { v: "B", t: 2000, at: 2100 } };
  const s = C.scoreQuestion({ roundN: 2, key: { type: "mc", answer: "A" }, qpub: { startAt: 0, closeAt: 30000 }, answers: ans, overrides: { 2: true }, teams: [1, 2] });
  assert.equal(s[1].pts, 0); assert.equal(s[2].pts, 1);
});
test("wager and speed and closest", () => {
  const ans = { 1: { v: "paris", at: 10 }, 2: { v: "rome", at: 10 } };
  const w = C.scoreQuestion({ roundN: 4, key: { type: "text", answer: "Paris" }, qpub: {}, answers: ans, wagers: { 1: { w: 7 }, 2: { w: 9 } }, teams: [1, 2] });
  assert.equal(w[1].pts, 7); assert.equal(w[2].pts, 0);
  const sp = C.scoreQuestion({ roundN: 6, key: { type: "mc", answer: "C" }, qpub: { startAt: 0, closeAt: 30000, limit: 30 }, answers: { 1: { v: "C", t: 15000, at: 15100 } }, teams: [1, 2] });
  assert.equal(sp[1].pts, 750); assert.equal(sp[2].pts, 0);
  const cl = C.scoreQuestion({ roundN: 5, key: { type: "number", answer: 200 }, qpub: {}, answers: { 1: { v: 150, at: 1 } }, teams: [1, 2] });
  assert.equal(cl[1].pts, 25); assert.equal(cl[2].pts, 100);
});

test("dense ranking and eco points", () => {
  const r = C.roundResult(2, { 1: 9, 2: 9, 3: 7, 4: 5, 5: 5, 6: 3, 7: 1 }, {});
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7].map(t => r[t].place), [1, 1, 2, 3, 3, 4, 5]);
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7].map(t => r[t].final), [10, 10, 8, 6, 6, 4, 0]);
  const low = C.roundResult(5, { 1: 50, 2: 20, 3: 300 }, {});
  assert.deepEqual([low[1].place, low[2].place, low[3].place], [2, 1, 3]);
});

test("tokens", () => {
  const scores = { 1: 10, 2: 9, 3: 8, 4: 7, 5: 6, 6: 5, 7: 4, 8: 3, 9: 2 };
  const tok = t => k => C.roundResult(2, scores, { [t]: { k } })[t].final;
  assert.deepEqual([1, 2, 3].map(tok(1)), [30, 5, 40]);
  assert.deepEqual([1, 2, 3].map(tok(2)), [24, 4, 0]);
  assert.deepEqual([1, 2, 3].map(tok(3)), [18, 36, 0]);
  assert.deepEqual([1, 2, 3].map(tok(4)), [12, 24, 0]);
  assert.deepEqual([1, 2, 3].map(tok(5)), [-5, -5, 0]);
  assert.deepEqual([1, 2, 3].map(tok(8)), [-5, -5, 10]);
  assert.deepEqual([1, 2, 3].map(tok(9)), [-5, -5, 10]);
  // ties at the bottom: three teams tied last are all bottom 2
  const b = C.bottomTwo({ 1: 5, 2: 1, 3: 1, 4: 1 }, false);
  assert.deepEqual([...b].sort(), ["2", "3", "4"]);
  const b5 = C.bottomTwo({ 1: 10, 2: 80, 3: 90 }, true);
  assert.deepEqual([...b5].sort(), ["2", "3"]);
  
  assert.equal(3 * 10 + 30 + 36 + 40, 136);
});

test("typed numbers must match exactly", () => {
  const k = { type: "text", answer: "12", alts: ["twelve"] };
  assert.equal(C.autoMark(k, "12").ok, true);
  assert.equal(C.autoMark(k, "Twelve").ok, true);
  assert.deepEqual(C.autoMark(k, "13"), { ok: false, flag: null });
});

test("digits inside typed answers must match exactly", () => {
  const k = { type: "text", answer: "8 Mile", alts: ["Eight Mile"] };
  assert.equal(C.autoMark(k, "8mile").ok, true);
  assert.equal(C.autoMark(k, "eight mile").ok, true);
  assert.equal(C.autoMark(k, "9 Mile").ok, false);
});
