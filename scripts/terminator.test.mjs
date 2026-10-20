/**
 * Tests del terminador solar (línea día/noche) calculado con sunPos/gstime.
 * Ejecutar: node --test scripts/terminator.test.mjs
 */
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { sunPos, gstime, jday, radiansToDegrees } from "satellite.js";

import { closeVite, loadModule } from "./_load.mjs";

after(closeVite);

const { terminatorPolygon } = await loadModule("/src/lib/space/propagate.ts");

const normLon = (l) => ((l + 540) % 360) - 180;

test("anillo completo: 91 puntos de terminador + 2 de cierre polar", () => {
  const ring = terminatorPolygon(new Date("2026-10-18T12:00:00Z"));
  assert.equal(ring.length, 91 + 2);
  for (const p of ring) {
    assert.ok(p.latDeg >= -90 && p.latDeg <= 90, `lat ${p.latDeg}`);
    assert.ok(p.lonDeg >= -180 && p.lonDeg <= 180, `lon ${p.lonDeg}`);
  }
  assert.equal(ring[ring.length - 1].latDeg, ring[ring.length - 2].latDeg, "cierre por el mismo polo");
});

test("junio: noche sobre el polo sur; diciembre: sobre el norte", () => {
  const jun = terminatorPolygon(new Date("2026-06-21T12:00:00Z"));
  assert.equal(jun[jun.length - 1].latDeg, -90, "δ>0 → cierre por polo sur");
  const dic = terminatorPolygon(new Date("2026-12-21T12:00:00Z"));
  assert.equal(dic[dic.length - 1].latDeg, 90, "δ<0 → cierre por polo norte");
});

test("en la longitud subsolar el terminador está en ±(90−|δ|) (borde polar)", () => {
  const date = new Date("2026-06-21T12:00:00Z");
  const sun = sunPos(jday(date));
  const declDeg = radiansToDegrees(sun.decl);
  const subLon = normLon(radiansToDegrees(sun.rtasc - gstime(date)));
  const ring = terminatorPolygon(date);
  // punto de rejilla más cercano a la longitud subsolar (paso 4°)
  const at = ring.reduce((best, p) =>
    Math.abs(normLon(p.lonDeg - subLon)) < Math.abs(normLon(best.lonDeg - subLon)) ? p : best,
  );
  const esperado = declDeg - 90; // noche polar: el terminador toca -(90-δ) al mediodía
  assert.ok(
    Math.abs(at.latDeg - esperado) < 3,
    `lat ${at.latDeg.toFixed(1)} vs esperada ${esperado.toFixed(1)} (tolerancia de rejilla 4°)`,
  );
});

test("a ±90° de hora del subsolar el terminador cruza el ecuador", () => {
  const date = new Date("2026-10-18T12:00:00Z");
  const sun = sunPos(jday(date));
  const decl = sun.decl;
  const subLon = normLon(radiansToDegrees(sun.rtasc - gstime(date)));
  const ring = terminatorPolygon(date).slice(0, 91);
  const target = normLon(subLon + 90);
  const at = ring.reduce((best, p) =>
    Math.abs(normLon(p.lonDeg - target)) < Math.abs(normLon(best.lonDeg - target)) ? p : best,
  );
  // Tolerancia = error de rejilla (paso 4° → H±2°) amplificado por 1/|tan δ|:
  const tol =
    (Math.atan(Math.sin((2 * Math.PI) / 180) / Math.max(0.05, Math.abs(Math.tan(decl)))) * 180) /
      Math.PI +
    1;
  assert.ok(Math.abs(at.latDeg) < tol, `cruce ecuatorial: lat=${at.latDeg.toFixed(2)} tol=${tol.toFixed(1)}`);
});
