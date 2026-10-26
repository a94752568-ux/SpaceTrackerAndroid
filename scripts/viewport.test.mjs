/**
 * Tests de la lógica pura de detección de viewport (Tarea 2 responsive).
 * Ejecutar: node --test scripts/viewport.test.mjs
 */
import { test, after } from "node:test";
import assert from "node:assert/strict";

import { closeVite, loadModule } from "./_load.mjs";

after(closeVite);

const {
  classifySize,
  classifyOrientation,
  SIZE_COMPACT_MAX,
  SIZE_MEDIUM_MAX,
  readViewport,
} = await loadModule("/src/lib/ui/useViewport.ts");

test("constantes MD3: compact ≤599, medium ≤839", () => {
  assert.equal(SIZE_COMPACT_MAX, 599);
  assert.equal(SIZE_MEDIUM_MAX, 839);
});

test("classifySize: límites 599/600 y 839/840", () => {
  assert.equal(classifySize(0), "compact");
  assert.equal(classifySize(360), "compact");
  assert.equal(classifySize(599), "compact");
  assert.equal(classifySize(600), "medium");
  assert.equal(classifySize(700), "medium");
  assert.equal(classifySize(839), "medium");
  assert.equal(classifySize(840), "expanded");
  assert.equal(classifySize(1280), "expanded");
  assert.equal(classifySize(1920), "expanded");
});

test("classifyOrientation: portrait vs landscape", () => {
  assert.equal(classifyOrientation(360, 800), "portrait");
  assert.equal(classifyOrientation(800, 360), "landscape");
  assert.equal(classifyOrientation(600, 600), "landscape", "cuadrado → landscape (width >= height)");
  assert.equal(classifyOrientation(412, 915), "portrait");
  assert.equal(classifyOrientation(915, 412), "landscape");
});

test("readViewport: SSR / sin window → expanded seguro", () => {
  // En node --test no hay window; debe devolver desktop expandido sin lanzar.
  const v = readViewport();
  assert.equal(v.sizeClass, "expanded");
  assert.equal(v.orientation, "landscape");
  assert.equal(v.width, 1280);
  assert.equal(v.height, 800);
  assert.equal(v.dpr, 1);
  assert.equal(v.isTouch, false);
  assert.equal(v.prefersReducedMotion, false);
  assert.equal(v.visualViewportHeight, 800);
});
