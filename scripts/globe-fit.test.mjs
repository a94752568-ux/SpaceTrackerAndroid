/**
 * Tarea 7 — tests de dimensionado de canvas / fit del globo.
 * Ejecutar: node --test scripts/globe-fit.test.mjs
 */
import { test, after } from "node:test";
import assert from "node:assert/strict";

import { closeVite, loadModule } from "./_load.mjs";

after(closeVite);

const {
  fitScale,
  clampDpr,
  canvasBufferSize,
  scaleAfterResize,
  MATRIX_VIEWPORTS,
} = await loadModule("/src/lib/ui/globeFit.ts");

const { classifySize, classifyOrientation } = await loadModule("/src/lib/ui/useViewport.ts");

test("fitScale: usa el lado menor y factor 0.4", () => {
  assert.equal(fitScale(360, 800), Math.max(40, 360 * 0.4));
  assert.equal(fitScale(800, 360), Math.max(40, 360 * 0.4));
  assert.ok(fitScale(100, 100) >= 40);
});

test("clampDpr: tope 2", () => {
  assert.equal(clampDpr(1), 1);
  assert.equal(clampDpr(2), 2);
  assert.equal(clampDpr(3), 2);
  assert.equal(clampDpr(0.5), 0.5);
  assert.equal(clampDpr(NaN), 1);
});

test("canvasBufferSize: layout × dpr acotado", () => {
  const a = canvasBufferSize(360, 800, 1);
  assert.deepEqual(a, { width: 360, height: 800, dpr: 1 });
  const b = canvasBufferSize(360, 800, 3);
  assert.equal(b.dpr, 2);
  assert.equal(b.width, 720);
  assert.equal(b.height, 1600);
});

test("scaleAfterResize: conserva zoom relativo", () => {
  const start = scaleAfterResize(0, 0, 360, 800);
  assert.equal(start.userZoom, 1);
  assert.equal(start.scale, start.fit);
  const zoomed = start.scale * 2;
  const after = scaleAfterResize(zoomed, start.fit, 800, 360);
  assert.ok(Math.abs(after.userZoom - 2) < 1e-9);
  assert.ok(Math.abs(after.scale - after.fit * 2) < 1e-6);
});

test("matriz Tarea 7: sizeClass y orientación portrait", () => {
  for (const vp of MATRIX_VIEWPORTS) {
    const sc = classifySize(vp.w);
    const ori = classifyOrientation(vp.w, vp.h);
    assert.equal(ori, "portrait", `${vp.id} portrait`);
    if (vp.w < 600) assert.equal(sc, "compact", vp.id);
    else if (vp.w < 840) assert.equal(sc, "medium", vp.id);
    else assert.equal(sc, "expanded", vp.id);
  }
});

test("matriz Tarea 7: landscape (w↔h) y fit sigue al menor lado", () => {
  for (const vp of MATRIX_VIEWPORTS) {
    const ori = classifyOrientation(vp.h, vp.w);
    assert.equal(ori, "landscape", `${vp.id} landscape`);
    const fitP = fitScale(vp.w, vp.h);
    const fitL = fitScale(vp.h, vp.w);
    assert.equal(fitP, fitL, "fit simétrico al rotar");
  }
});
