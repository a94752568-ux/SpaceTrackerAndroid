import { test, after } from "node:test";
import assert from "node:assert/strict";
import { closeVite, loadModule } from "./_load.mjs";

after(closeVite);

const { interpolateFix, lerpLon } = await loadModule("/src/lib/space/interpolateFix.ts");
const { epochStatusToClass } = await loadModule("/src/lib/ui/tleAgeClass.ts");

test("interpolateFix punto medio", () => {
  const m = interpolateFix(
    { latDeg: 0, lonDeg: 0, altKm: 400 },
    { latDeg: 10, lonDeg: 20, altKm: 500 },
    0.5,
  );
  assert.ok(Math.abs(m.latDeg - 5) < 1e-9);
  assert.ok(Math.abs(m.lonDeg - 10) < 1e-9);
  assert.ok(Math.abs(m.altKm - 450) < 1e-9);
});

test("lerpLon cruza antimeridiano", () => {
  const x = lerpLon(170, -170, 0.5);
  assert.ok(Math.abs(x - 180) < 1e-6 || Math.abs(x + 180) < 1e-6);
});

test("epochStatusToClass", () => {
  assert.equal(epochStatusToClass("fresh"), "st-tle-fresh");
  assert.equal(epochStatusToClass("aging"), "st-tle-aging");
  assert.equal(epochStatusToClass("stale"), "st-tle-stale");
  assert.equal(epochStatusToClass("future"), "st-tle-unknown");
});
