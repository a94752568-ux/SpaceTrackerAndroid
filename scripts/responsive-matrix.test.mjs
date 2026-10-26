/**
 * Tarea 7 — tabla de expectativas por viewport de la matriz.
 */
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { closeVite, loadModule } from "./_load.mjs";

after(closeVite);

const { classifySize, classifyOrientation } = await loadModule("/src/lib/ui/useViewport.ts");
const { fitScale, canvasBufferSize, MATRIX_VIEWPORTS } = await loadModule("/src/lib/ui/globeFit.ts");

const EXPECT = {
  "phone-small": { size: "compact", nav: "bottom", sheets: true },
  "phone-std": { size: "compact", nav: "bottom", sheets: true },
  "phone-large": { size: "compact", nav: "bottom", sheets: true },
  "tablet-7": { size: "medium", nav: "side", sheets: false },
  "tablet-10": { size: "medium", nav: "side", sheets: false },
  "fold-outer": { size: "compact", nav: "bottom", sheets: true },
  "fold-inner": { size: "medium", nav: "side", sheets: false },
};

test("expectativas de layout por id de matriz", () => {
  for (const vp of MATRIX_VIEWPORTS) {
    const exp = EXPECT[vp.id];
    assert.ok(exp, vp.id);
    assert.equal(classifySize(vp.w), exp.size, vp.id);
    const fit = fitScale(vp.w, vp.h);
    assert.ok(fit >= 40 && fit <= Math.min(vp.w, vp.h), `fit ${vp.id}`);
    const buf = canvasBufferSize(vp.w, vp.h, 2.5);
    assert.equal(buf.dpr, 2);
    assert.equal(buf.width, vp.w * 2);
  }
});

test("font-scale no cambia sizeClass (solo tipografía CSS)", () => {
  assert.equal(classifySize(360), "compact");
  assert.equal(classifySize(600), "medium");
  assert.equal(classifyOrientation(360, 800), "portrait");
});
