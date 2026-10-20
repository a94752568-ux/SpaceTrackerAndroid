/**
 * Test de regresión de las capas base del mapa (lib/ui/tiles.ts):
 * - solo servidores gratuitos sin API key (nada de CARTO/Stadia/MapTiler/…);
 * - atribución presente (requisito de Esri);
 * - el satelital lleva la clase de atenuado oscuro;
 * - ningún rastro de basemaps.cartocdn.com queda en src/.
 *
 * Ejecutar: node --test scripts/map-tiles.test.mjs
 */
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

import { closeVite, loadModule } from "./_load.mjs";

after(closeVite);

const tiles = await loadModule("/src/lib/ui/tiles.ts");

test("capas base: HTTPS públicos sin API key y con atribución", () => {
  assert.ok(tiles.BASE_LAYERS.length >= 2, "mínimo dos bases: oscuro y satelital");
  for (const base of tiles.BASE_LAYERS) {
    assert.ok(base.name && base.id, "identificadores legibles");
    for (const l of base.layers) {
      const url = l.url
        .replace("{z}", "5")
        .replace("{y}", "12")
        .replace("{x}", "15");
      const u = new URL(url);
      assert.equal(u.protocol, "https:");
      assert.ok(
        u.hostname.endsWith("arcgisonline.com"),
        `dominio inesperado (¿requiere clave?): ${u.hostname}`,
      );
      assert.equal(u.search, "", "sin parámetros de consulta (sin api_key)");
      assert.ok(!/api[-_]?key|token=/i.test(u.href), `posible clave en URL: ${u.href}`);
      assert.ok(l.attribution && l.attribution.length > 10, `atribución vacía en ${base.id}`);
      assert.match(l.attribution, /Esri/, "atribución debe citar a Esri");
      assert.ok(l.maxZoom >= 10, "maxZoom por encima del zoom máximo del mapa (10)");
    }
  }
});

test("capa por defecto oscura y satelital sin filtros por capa (filtro GPU único)", () => {
  assert.equal(tiles.DEFAULT_BASE_ID, "esri-dark");
  const dark = tiles.BASE_LAYERS.find((b) => b.id === "esri-dark");
  assert.ok(dark && dark.layers.length >= 1);
  const sat = tiles.BASE_LAYERS.find((b) => b.id === "esri-sat");
  assert.ok(sat, "falta la base satelital");
  // El filtrado GPU vive en .leaflet-tile-pane (styles.css): sin doble atenuación.
  assert.equal(
    sat.layers[0].className,
    undefined,
    "sin className de filtro: el filtro GPU es único a nivel de tile-pane",
  );
  assert.match(
    sat.layers[0].url,
    /^https:\/\/server\.arcgisonline\.com\/ArcGIS\/rest\/services\/World_Imagery\/MapServer\/tile\/\{z\}\/\{y\}\/\{x\}$/,
    "URL pública de Esri World Imagery tal cual la especificación",
  );
});

test("overlays del control de capas: rótulos por defecto y con atribución", () => {
  assert.ok(Array.isArray(tiles.OVERLAYS) && tiles.OVERLAYS.length >= 1);
  for (const o of tiles.OVERLAYS) {
    assert.ok(o.name && o.id);
    assert.equal(typeof o.defaultOn, "boolean");
    assert.match(o.layer.attribution, /Esri/);
    assert.ok(o.layer.url.includes("arcgisonline.com"));
  }
  assert.ok(
    tiles.OVERLAYS.some((o) => o.defaultOn),
    "al menos un overlay activo por defecto (rótulos)",
  );
});

/** Retira comentarios de bloque y de línea respetando strings (para que los
 *  comentarios que DOCUMENTAN el descarte de CARTO no den falsos positivos,
 *  pero cualquier uso real en código o CSS sí se detecte). */
function stripComments(s) {
  let out = "";
  let i = 0;
  const n = s.length;
  let state = "code";
  while (i < n) {
    const c = s[i];
    const d = i + 1 < n ? s[i + 1] : "";
    if (state === "code") {
      if (c === "/" && d === "*") { state = "block"; i += 2; continue; }
      if (c === "/" && d === "/") { state = "line"; i += 2; continue; }
      if (c === "'" || c === '"' || c === "`") state = c;
      out += c; i++; continue;
    }
    if (state === "'" || state === '"' || state === "`") {
      if (c === "\\") { out += c + d; i += 2; continue; }
      out += c;
      if (c === state) state = "code";
      i++; continue;
    }
    if (state === "line") { if (c === "\n") { state = "code"; out += c; } i++; continue; }
    if (state === "block") { if (c === "*" && d === "/") { state = "code"; i += 2; continue; } i++; continue; }
  }
  return out;
}

test("sin restos de CARTO en src/ (causa de la marca de agua 'API KEY REQUIRED')", () => {
  const walk = (dir) =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? walk(`${dir}/${e.name}`) : [`${dir}/${e.name}`],
    );
  const files = walk("src").filter((f) => /\.(ts|tsx|css)$/.test(f));
  assert.ok(files.length >= 10, "barrido de src/ vacío, algo falla en el test");
  for (const f of files) {
    const code = stripComments(readFileSync(f, "utf8"));
    assert.ok(!/basemaps\.cartocdn/i.test(code), `queda CARTO (tiles) en código de ${f}`);
    assert.ok(!/carto\.com/i.test(code), `queda CARTO (atribución/enlace) en código de ${f}`);
  }
});
