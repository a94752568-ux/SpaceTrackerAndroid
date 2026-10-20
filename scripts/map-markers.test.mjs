/**
 * Tests de los fragmentos/constantes de marcadores del mapa: SVG por
 * categoría, hitbox, clase canónica del seleccionado y escape HTML.
 * Sin DOM ni Leaflet.
 *
 * Ejecutar: node --test scripts/map-markers.test.mjs
 */
import { test, after } from "node:test";
import assert from "node:assert/strict";

import { closeVite, loadModule } from "./_load.mjs";

after(closeVite);

const M = await loadModule("/src/lib/ui/markers.ts");

const GROUPS = ["crew", "weather", "nav", "science", "starlink", "comms", "other"];

test("hitbox invisible de al menos 24×24 px", () => {
  assert.ok(M.HITBOX_PX >= 24, `HITBOX_PX=${M.HITBOX_PX}`);
});

test("clase canónica del seleccionado: .selected-satellite-active", () => {
  assert.equal(M.SELECTED_SAT_CLASS, "selected-satellite-active");
});

test("groupIconSvg: un SVG distinto por categoría, con el color del grupo", () => {
  const svgs = GROUPS.map((g) => M.groupIconSvg(g, "#ffd166"));
  assert.equal(new Set(svgs).size, GROUPS.length, "cada grupo debe tener un SVG propio");
  for (const svg of svgs) {
    assert.match(svg, /^<svg viewBox="0 0 16 16"/);
    assert.match(svg, /stroke="#ffd166"/, "el color del grupo es el color principal");
    assert.match(svg, /fill="none"/);
  }
  // El color se propaga también a los rellenos internos marcados con COLOR:
  assert.match(M.groupIconSvg("nav", "#4cc9f0"), /fill="#4cc9f0"/);
});

test("tacticalIconHtml: puntero táctico con ping, glow, badge y etiqueta", () => {
  const html = M.tacticalIconHtml("weather", "#4cc9f0", {
    fav: true,
    ping: "1.2s",
    label: "NOAA 19",
  });
  assert.match(html, /class="st-tac"/);
  assert.match(html, /st-tac-ring/, "anillo radar-ping");
  assert.match(html, /--pd:1\.2s/, "ping escalonado");
  assert.match(html, /--g:#4cc9f0/, "color de grupo como glow");
  assert.match(html, /class="st-ico"/);
  assert.match(html, /<svg/);
  assert.match(html, /st-fav-badge/, "badge ★ de favorito");
  assert.match(html, /st-tac-label">NOAA 19/, "etiqueta inteligente");
  const plain = M.tacticalIconHtml("nav", "#b5e48c");
  assert.ok(!/st-fav-badge/.test(plain) && !/st-tac-label/.test(plain), "sin badge/etiqueta por defecto");
});

test("satIconHtml: icono grande + retícula + crosshair biselado", () => {
  const html = M.satIconHtml("crew", "#ffd166");
  assert.match(html, /st-ico st-ico-lg/);
  assert.match(html, /<svg/);
  assert.match(html, /st-reticle/, "retícula de mira tipo HUD presente");
  assert.match(html, /st-halo/, "halo expansivo naranja del seleccionado");
  assert.match(html, /st-cross/, "crosshair biselado del seleccionado");
});

test("escapeHtml blinda nombres inyectados en el tooltip", () => {
  assert.equal(M.escapeHtml("A & B"), "A &amp; B");
  assert.equal(M.escapeHtml('<img src=x onerror="p()">'), "&lt;img src=x onerror=&quot;p()&quot;&gt;");
  assert.equal(M.escapeHtml("ISS (ZARYA)"), "ISS (ZARYA)");
  assert.equal(M.escapeHtml("O'Neill"), "O&#39;Neill");
});
