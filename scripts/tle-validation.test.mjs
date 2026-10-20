/**
 * Tests de validación estructural TLE.
 * Ejecutar: node --test scripts/tle-validation.test.mjs
 * Fixtures: TLEs REALES descargados y verificados (scripts/fixtures.mjs).
 */
import { test, after } from "node:test";
import assert from "node:assert/strict";

import { FIXTURES } from "./fixtures.mjs";
import { closeVite, loadModule } from "./_load.mjs";

after(closeVite);

const mod = await loadModule("/src/lib/space/tle-validation.ts");
const { validateTle, tleChecksum } = mod;

test("todas las fixtures reales pasan validateTle", () => {
  assert.ok(FIXTURES.length >= 10, `esperadas >=10 fixtures, hay ${FIXTURES.length}`);
  for (const f of FIXTURES) {
    const r = validateTle(f.id, f.line1, f.line2);
    assert.equal(r.valid, true, `${f.name}: ${r.errors.join("; ")}`);
  }
});

test("tleChecksum coincide con el dígito de control de cada fixture", () => {
  for (const f of FIXTURES) {
    assert.equal(tleChecksum(f.line1), Number(f.line1[68]), `line1 de ${f.name}`);
    assert.equal(tleChecksum(f.line2), Number(f.line2[68]), `line2 de ${f.name}`);
  }
});

test("checksum corrupto => inválido con error específico", () => {
  const f = FIXTURES[0];
  const bad = f.line1.slice(0, 68) + String((Number(f.line1[68]) + 1) % 10);
  const r = validateTle(f.id, bad, f.line2);
  assert.equal(r.valid, false);
  assert.ok(r.errors.some((e) => /checksum/i.test(e)), r.errors.join("; "));
});

test("longitud incorrecta => inválido", () => {
  const f = FIXTURES[0];
  const r = validateTle(f.id, f.line1.slice(0, 68), f.line2);
  assert.equal(r.valid, false);
  assert.ok(r.errors.some((e) => /longitud/i.test(e)), r.errors.join("; "));
});

test("ID NORAD que no coincide con las líneas => inválido", () => {
  const f = FIXTURES[0];
  const r = validateTle(f.id + 1, f.line1, f.line2);
  assert.equal(r.valid, false);
  assert.ok(r.errors.some((e) => /no coincide/i.test(e)), r.errors.join("; "));
});

test("prefijos incorrectos => inválido", () => {
  const f = FIXTURES[0];
  const r1 = validateTle(f.id, "3" + f.line1.slice(1), f.line2);
  assert.equal(r1.valid, false);
  assert.ok(r1.errors.some((e) => /comenzar con '1'/.test(e)), r1.errors.join("; "));
  const r2 = validateTle(f.id, f.line1, "9" + f.line2.slice(1));
  assert.equal(r2.valid, false);
  assert.ok(r2.errors.some((e) => /comenzar con '2'/.test(e)), r2.errors.join("; "));
});

test("basura no-TLE => inválido", () => {
  const r = validateTle(25544, "hola mundo", "esto no es un TLE");
  assert.equal(r.valid, false);
  assert.ok(r.errors.length >= 2);
});

test("ID NORAD fuera de rango => inválido", () => {
  const f = FIXTURES[0];
  assert.equal(validateTle(0, f.line1, f.line2).valid, false);
  assert.equal(validateTle(100000, f.line1, f.line2).valid, false);
  assert.equal(validateTle("abc", f.line1, f.line2).valid, false);
});

test("excentricidad no numérica se detecta", () => {
  const f = FIXTURES[0];
  // El campo de excentricidad son 7 dígitos con decimal implícito ("0." + 7 dígitos),
  // así que "≥ 1" es inalcanzable por construcción; lo detectable es un no-dígito.
  const bad = f.line2.slice(0, 26) + "00000A0" + f.line2.slice(33);
  const r = validateTle(f.id, f.line1, bad);
  assert.equal(r.valid, false);
  assert.ok(r.errors.some((e) => /excentricidad/i.test(e)), r.errors.join("; "));
});

test("inclinación fuera de rango se detecta", () => {
  const f = FIXTURES[0];
  const bad = f.line2.slice(0, 8) + " 999.000" + f.line2.slice(16);
  const r = validateTle(f.id, f.line1, bad);
  assert.equal(r.valid, false);
  assert.ok(r.errors.some((e) => /inclinaci/i.test(e)), r.errors.join("; "));
});
