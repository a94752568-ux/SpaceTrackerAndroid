/**
 * Tests de la proyección ortográfica (globo 2D): culling, centro, limbo y
 * rotación por arrastre. Matemática pura, sin canvas ni d3.
 *
 * Ejecutar: node --test scripts/ortho.test.mjs
 */
import { test, after } from "node:test";
import assert from "node:assert/strict";

import { closeVite, loadModule } from "./_load.mjs";

after(closeVite);

const O = await loadModule("/src/lib/space/ortho.ts");

const VIEW = { latDeg: 20, lonDeg: -40, scale: 200 };
const CX = 500;
const CY = 400;

test("el centro del globo proyecta al píxel central y es visible", () => {
  const p = O.orthoProject(VIEW.latDeg, VIEW.lonDeg, VIEW, CX, CY);
  assert.ok(Math.abs(p.x - CX) < 1e-9);
  assert.ok(Math.abs(p.y - CY) < 1e-9);
  assert.equal(p.visible, true);
  assert.ok(p.cosc > 0.999);
});

test("backface culling: el antípoda queda oculto", () => {
  const p = O.orthoProject(-VIEW.latDeg, VIEW.lonDeg + 180, VIEW, CX, CY);
  assert.equal(p.visible, false);
  assert.ok(p.cosc < -0.999);
});

test("punto a 89° del centro (vista ecuatorial) cae en el limbo y sigue visible", () => {
  const EQ = { latDeg: 0, lonDeg: 0, scale: 200 };
  const p = O.orthoProject(0, 89, EQ, CX, CY);
  assert.equal(p.visible, true);
  assert.ok(p.x > CX + 0.95 * EQ.scale, `x=${p.x} debe rozar el limbo este`);
  const limb = O.orthoProject(0, 91, EQ, CX, CY);
  assert.equal(limb.visible, false, "pasado el limbo => oculto");
});

test("norte hacia arriba: latitudes mayores proyectan por encima del centro", () => {
  const n = O.orthoProject(VIEW.latDeg + 25, VIEW.lonDeg, VIEW, CX, CY);
  assert.ok(n.y < CY, `y=${n.y} < ${CY}`);
  const s = O.orthoProject(VIEW.latDeg - 25, VIEW.lonDeg, VIEW, CX, CY);
  assert.ok(s.y > CY);
});

test("arrastre: dx/dy rotan el globo y la latitud se clamp a ±90", () => {
  const r = O.dragToRotation(VIEW, 100, 0);
  assert.ok(r.lonDeg > VIEW.lonDeg, "arrastrar a la derecha gira el globo");
  assert.equal(r.latDeg, VIEW.latDeg);
  const clamp = O.dragToRotation({ latDeg: 89, lonDeg: 0, scale: 200 }, 0, 1000);
  assert.equal(clamp.latDeg, 90);
  const wrap = O.dragToRotation({ latDeg: 0, lonDeg: 170, scale: 200 }, 1000, 0);
  assert.ok(wrap.lonDeg >= -180 && wrap.lonDeg <= 180, `longitud envuelta: ${wrap.lonDeg}`);
});

test("arrastre 1:1 con la esfera: π·scale/180 px ≈ 1°", () => {
  const pxPerDeg = (Math.PI * 200) / 180;
  const r = O.dragToRotation({ latDeg: 0, lonDeg: 0, scale: 200 }, pxPerDeg, 0);
  assert.ok(Math.abs(r.lonDeg - 1) < 0.02, `1° esperado, obtenido ${r.lonDeg}`);
});

test("wrapLonDeg envuelve al intervalo [-180, 180)", () => {
  assert.equal(O.wrapLonDeg(190), -170);
  assert.equal(O.wrapLonDeg(-190), 170);
  assert.equal(O.wrapLonDeg(360), 0);
  assert.equal(O.wrapLonDeg(-180), -180);
});
