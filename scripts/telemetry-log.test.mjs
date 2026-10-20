/**
 * Tests del bus de telemetría (Flight Log): buffer anular, suscripción y
 * formato UTC. Sin DOM.
 *
 * Ejecutar: node --test scripts/telemetry-log.test.mjs
 */
import { test, after } from "node:test";
import assert from "node:assert/strict";

import { closeVite, loadModule } from "./_load.mjs";

after(closeVite);

const { TelemetryLogStore, fmtUtc, LOG_LEVELS } = await loadModule(
  "/src/lib/ui/telemetry-log.ts",
);

test("niveles definidos y orden estable", () => {
  assert.deepEqual([...LOG_LEVELS], ["SYS", "ORBIT", "TLE", "WARN", "ALRT"]);
});

test("push/snapshot: orden cronológico e ids crecientes", () => {
  const log = new TelemetryLogStore();
  log.push("SYS", "uno", 1000);
  log.push("ORBIT", "dos", 2000);
  const snap = log.snapshot();
  assert.equal(snap.length, 2);
  assert.deepEqual(snap.map((e) => e.msg), ["uno", "dos"]);
  assert.ok(snap[1].id > snap[0].id);
  // snapshot es copia: mutarlo no afecta al store
  snap.push({ id: 999, tMs: 3, level: "SYS", msg: "x" });
  assert.equal(log.snapshot().length, 2);
});

test("buffer anular con tope: descarta los más antiguos", () => {
  const log = new TelemetryLogStore();
  for (let i = 1; i <= 450; i++) log.push("SYS", `e${i}`);
  const snap = log.snapshot();
  assert.equal(snap.length, 400);
  assert.equal(snap[0].msg, "e51");
  assert.equal(snap[399].msg, "e450");
});

test("subscribe/unsubscribe: notificación puntual", () => {
  const log = new TelemetryLogStore();
  const got = [];
  const un = log.subscribe((e) => got.push(e.msg));
  log.push("WARN", "a");
  un();
  log.push("WARN", "b");
  assert.deepEqual(got, ["a"]);
});

test("clear purga y deja constancia", () => {
  const log = new TelemetryLogStore();
  log.push("ALRT", "x");
  log.clear();
  const snap = log.snapshot();
  assert.equal(snap.length, 1);
  assert.equal(snap[0].level, "SYS");
  assert.match(snap[0].msg, /purgada/);
});

test("fmtUtc: hh:mm:ssZ", () => {
  assert.equal(fmtUtc(Date.UTC(2026, 9, 18, 7, 5, 9)), "07:05:09Z");
  assert.match(fmtUtc(Date.now()), /^\d{2}:\d{2}:\d{2}Z$/);
});
