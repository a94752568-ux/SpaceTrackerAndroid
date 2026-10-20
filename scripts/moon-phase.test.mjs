/**
 * Tests de fases lunares: cálculo del ciclo sinódico.
 * 
 * Ejecutar: node --test scripts/moon-phase.test.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { closeVite, loadModule } from "./_load.mjs";

test.after(closeVite);

const M = await loadModule("/src/lib/space/moon-phase.ts");

test("Luna Nueva de referencia (6 enero 2000, 18:14 UTC) tiene fase ~0", () => {
  const date = new Date(Date.UTC(2000, 0, 6, 18, 14, 0));
  const moon = M.getMoonPhase(date);
  assert.ok(moon.phase >= 0 && moon.phase < 0.02, `fase debe ser ~0, obtenido ${moon.phase}`);
  assert.equal(moon.phaseName, "Luna Nueva");
  assert.ok(moon.illumination < 5, `iluminación debe ser <5%, obtenido ${moon.illumination}%`);
});

test("Luna Llena ~7.4 días después de Luna Nueva", () => {
  const newMoon = new Date(Date.UTC(2000, 0, 6, 18, 14, 0));
  const fullMoon = new Date(newMoon.getTime() + 7.4 * 24 * 60 * 60 * 1000);
  const moon = M.getMoonPhase(fullMoon);
  assert.ok(moon.phase >= 0.48 && moon.phase <= 0.52, `fase debe ser ~0.5, obtenido ${moon.phase}`);
  assert.equal(moon.phaseName, "Luna Llena");
  assert.ok(moon.illumination > 95, `iluminación debe ser >95%, obtenido ${moon.illumination}%`);
});

test("Cuarto Creciente ~3.7 días después de Luna Nueva", () => {
  const newMoon = new Date(Date.UTC(2000, 0, 6, 18, 14, 0));
  const firstQuarter = new Date(newMoon.getTime() + 3.7 * 24 * 60 * 60 * 1000);
  const moon = M.getMoonPhase(firstQuarter);
  assert.ok(moon.phase >= 0.22 && moon.phase <= 0.28, `fase debe ser ~0.25, obtenido ${moon.phase}`);
  assert.equal(moon.phaseName, "Cuarto Creciente");
  assert.ok(moon.illumination > 40 && moon.illumination < 60, `iluminación debe ser ~50%, obtenido ${moon.illumination}%`);
});

test("Cuarto Menguante ~11.1 días después de Luna Nueva", () => {
  const newMoon = new Date(Date.UTC(2000, 0, 6, 18, 14, 0));
  const lastQuarter = new Date(newMoon.getTime() + 11.1 * 24 * 60 * 60 * 1000);
  const moon = M.getMoonPhase(lastQuarter);
  assert.ok(moon.phase >= 0.72 && moon.phase <= 0.78, `fase debe ser ~0.75, obtenido ${moon.phase}`);
  assert.equal(moon.phaseName, "Cuarto Menguante");
  assert.ok(moon.illumination > 40 && moon.illumination < 60, `iluminación debe ser ~50%, obtenido ${moon.illumination}%`);
});

test("La iluminación oscila entre 0% y 100%", () => {
  const newMoon = new Date(Date.UTC(2000, 0, 6, 18, 14, 0));
  const fullMoon = new Date(newMoon.getTime() + 7.4 * 24 * 60 * 60 * 1000);
  
  const newMoonPhase = M.getMoonPhase(newMoon);
  const fullMoonPhase = M.getMoonPhase(fullMoon);
  
  assert.ok(newMoonPhase.illumination >= 0 && newMoonPhase.illumination < 10);
  assert.ok(fullMoonPhase.illumination > 90 && fullMoonPhase.illumination <= 100);
});

test("La fase está siempre normalizada entre 0 y 1", () => {
  const base = new Date(Date.UTC(2000, 0, 6, 18, 14, 0));
  
  for (let i = 0; i < 100; i++) {
    const date = new Date(base.getTime() + i * 24 * 60 * 60 * 1000);
    const moon = M.getMoonPhase(date);
    assert.ok(moon.phase >= 0 && moon.phase < 1, `fase fuera de rango: ${moon.phase} en día ${i}`);
  }
});

test("Los nombres de fase cubren todo el ciclo", () => {
  const base = new Date(Date.UTC(2000, 0, 6, 18, 14, 0));
  const phaseNames = new Set();
  
  for (let i = 0; i < 30; i++) {
    const date = new Date(base.getTime() + i * 24 * 60 * 60 * 1000);
    const moon = M.getMoonPhase(date);
    phaseNames.add(moon.phaseName);
  }
  
  // Deberíamos ver al menos los 8 nombres principales
  assert.ok(phaseNames.size >= 6, `solo ${phaseNames.size} nombres de fase distintos: ${[...phaseNames].join(", ")}`);
});

test("getPhaseAngle retorna grados entre 0 y 360", () => {
  const base = new Date(Date.UTC(2000, 0, 6, 18, 14, 0));
  
  const newMoon = M.getMoonPhase(base);
  const angle = M.getPhaseAngle(base);
  
  assert.ok(angle >= 0 && angle < 360, `ángulo fuera de rango: ${angle}`);
  
  // Luna Nueva ~0°
  assert.ok(angle < 20 || angle > 340, `Luna Nueva debe tener ángulo ~0°, obtenido ${angle}`);
});

test("Un ciclo completo dura ~29.53 días", () => {
  const base = new Date(Date.UTC(2000, 0, 6, 18, 14, 0));
  const phase1 = M.getMoonPhase(base);
  
  const oneCycleLater = new Date(base.getTime() + 29.53058867 * 24 * 60 * 60 * 1000);
  const phase2 = M.getMoonPhase(oneCycleLater);
  
  // Las fases deberían ser muy similares después de un ciclo completo
  const diff = Math.abs(phase2.phase - phase1.phase);
  assert.ok(diff < 0.05, `fase después de un ciclo debería ser similar, diff=${diff}`);
});
