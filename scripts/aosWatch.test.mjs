import { test, after } from "node:test";
import assert from "node:assert/strict";
import { closeVite, loadModule } from "./_load.mjs";

after(closeVite);

const { detectElevationCross } = await loadModule("/src/lib/ui/aosWatch.ts");
const { kpToClass } = await loadModule("/src/lib/ui/spaceWeather.ts");

test("detectElevationCross: AOS y LOS", () => {
  assert.equal(detectElevationCross(null, 5), null);
  assert.equal(detectElevationCross(-2, 1), "aos");
  assert.equal(detectElevationCross(1, -1), "los");
  assert.equal(detectElevationCross(5, 10), null);
  assert.equal(detectElevationCross(-5, -1), null);
});

test("kpToClass umbrales", () => {
  assert.equal(kpToClass(0), "quiet");
  assert.equal(kpToClass(2.9), "quiet");
  assert.equal(kpToClass(3), "active");
  assert.equal(kpToClass(4.9), "active");
  assert.equal(kpToClass(5), "storm");
  assert.equal(kpToClass(9), "storm");
});
