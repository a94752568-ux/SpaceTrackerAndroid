/**
 * Verificación de clases CSS del sistema de iconos/HUD (req. 3): garantiza que
 * los estilos de los SVG, el pulso y los tiers DOM existen y NO están
 * bloqueados (display:none / visibility:hidden / pointer-events mal puestos),
 * y que MapView sigue usando divIcon + L.canvas (renderizado híbrido).
 *
 * Ejecutar: node --test scripts/map-css.test.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const CSS = readFileSync("src/styles.css", "utf8");
const MAPVIEW = readFileSync("src/components/map/MapView.tsx", "utf8");

/** Extrae el cuerpo de una regla por selector (primera coincidencia). */
function rule(selector) {
  const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = CSS.match(new RegExp(`(?:^|\\n)${esc}\\s*\\{([^}]*)\\}`));
  return m ? m[1] : null;
}

test("selectores clave del HUD de iconos presentes", () => {
  for (const sel of [
    ".st-ico",
    ".st-hit",
    ".st-dom-icon",
    ".st-fav-badge",
    ".st-reticle",
    ".st-sat-icon",
  ]) {
    assert.ok(rule(sel) !== null, `falta la regla ${sel}`);
  }
  // Selectores agrupados (::before, ::after): basta con que existan y tengan cuerpo:
  assert.match(CSS, /\.selected-satellite-active::before,\s*\n?\.selected-satellite-active::after\s*\{/, "anillos del seleccionado");
  assert.match(CSS, /@keyframes st-pulse/, "animación de pulso definida");
  assert.match(CSS, /@keyframes st-spin/, "animación de retícula definida");
});

test("nada oculta ni desactiva los iconos o el pulso", () => {
  for (const sel of [".st-ico", ".st-hit", ".st-dom-icon", ".st-reticle", ".st-sat-icon"]) {
    const body = rule(sel);
    assert.ok(body !== null, sel);
    assert.ok(!/display\s*:\s*none/.test(body), `${sel} tiene display:none`);
    assert.ok(!/visibility\s*:\s*hidden/.test(body), `${sel} tiene visibility:hidden`);
  }
  // La retícula no debe robar clicks, pero el hitbox SÍ debe recibirlos:
  assert.match(rule(".st-reticle"), /pointer-events\s*:\s*none/);
  assert.ok(!/pointer-events\s*:\s*none/.test(rule(".st-hit")), ".st-hit debe ser clicable");
});

test("el pulso y la retícula usan el acento SpaceX y giro lento de 20 s", () => {
  const pulse = CSS.match(/@keyframes st-pulse\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
  assert.match(pulse, /scale\(2\.6\)/);
  const ret = rule(".st-reticle");
  assert.match(ret, /border\s*:\s*1px dashed var\(--accent\)/);
  assert.match(ret, /animation\s*:\s*spin-slow 20s linear infinite/);
});

test("MapView: renderizado híbrido divIcon + canvas vigente", () => {
  assert.match(MAPVIEW, /L\.canvas\(\{ tolerance: 12/, "renderer canvas forzado");
  assert.match(MAPVIEW, /L\.divIcon/, "tier DOM con divIcon");
  assert.match(MAPVIEW, /tacticalIconHtml\(/, "punteros tácticos SVG por categoría en tier DOM");
  assert.match(MAPVIEW, /satIconHtml\(/, "icono del seleccionado");
  assert.match(MAPVIEW, /SELECTED_SAT_CLASS/, "clase de pulso canónica en el seleccionado");
  assert.match(MAPVIEW, /circleMarker/, "fondo en circleMarker (canvas)");
});

test("coberturas sin intercepción: interactive:false + bubblingMouseEvents:false", () => {
  // Órbita en 3 trazos con fade, huella + anillo punteado y terminador:
  const trackOpts = MAPVIEW.match(/const trackOpts = \{[\s\S]*?\} as L\.PolylineOptions;/)?.[0] ?? "";
  assert.match(trackOpts, /interactive: false/, "opciones comunes de órbita no interactivas");
  assert.match(trackOpts, /bubblingMouseEvents: false/, "órbita sin bubbling");
  const polys = [...MAPVIEW.matchAll(/L\.polyline\(seg\w+, \{ \.\.\.trackOpts/g)];
  assert.ok(polys.length >= 3, `3 trazos de órbita con fade, hallados ${polys.length}`);
  const circles = [...MAPVIEW.matchAll(/L\.circle\([\s\S]*?\}\)/g)].map((m) => m[0]);
  assert.ok(circles.length >= 2, "huella con gradiente + anillo punteado");
  for (const c of circles) {
    assert.match(c, /interactive: false/);
    assert.match(c, /bubblingMouseEvents: false/);
  }
  const term = MAPVIEW.match(/L\.polygon\(\[\], \{[\s\S]*?\}\)/)?.[0] ?? "";
  assert.match(term, /interactive: false/, "terminador no interactivo");
  assert.match(term, /bubblingMouseEvents: false/, "terminador sin bubbling");
});

test("CSS estricto: pointer-events none !important en contenedores de cobertura", () => {
  assert.match(CSS, /\.leaflet-overlay-pane > svg \{\s*pointer-events: none !important;/);
  assert.match(
    CSS,
    /\.selected-satellite-active::before,\s*\.selected-satellite-active::after,\s*\.st-reticle \{\s*pointer-events: none !important;/,
    "anillos y retícula transparentes a clics",
  );
  assert.match(CSS, /\.st-tip \{\s*pointer-events: none !important;/);
  // El canvas debe CONSERVAR sus eventos (hit-testing de la flota):
  assert.ok(
    !/\.leaflet-overlay-pane > canvas \{[^}]*pointer-events: none/.test(CSS),
    "el canvas de Leaflet no puede quedar ciego (rompería los clics de la flota)",
  );
});

test("layout de zonas en flujo: header fijo, viewport flex:1, consola retráctil", () => {
  const app = rule(".st-app");
  assert.match(app, /display: flex/);
  assert.match(app, /flex-direction: column/);
  assert.match(app, /height: 100dvh/);
  assert.match(app, /width: 100dvw/);
  assert.match(app, /overflow: hidden/);
  assert.match(app, /--dock-zone: 64px/, "zona inferior reservada al dock");
  assert.match(rule(".st-header"), /flex-shrink: 0/, "cabecera nunca se comprime ni tapa");
  assert.match(rule(".st-header"), /position: relative/, "cabecera en flujo");
  const vp = rule(".st-viewport");
  assert.match(vp, /flex: 1/, "zona de mapa prioritaria");
  assert.match(vp, /position: relative/, "ancla de los flotantes");
  assert.match(vp, /min-height: 0/);
  const area = rule(".st-map-area");
  assert.match(area, /position: absolute/);
  assert.match(area, /inset: 0/);
  assert.match(area, /z-index: 1/);
  // Consola: cajón flotante OCULTO por defecto, sobre el dock, sin empalmes
  const cons = rule(".st-console");
  assert.match(cons, /position: absolute/);
  assert.match(cons, /bottom: calc\(1rem \+ var\(--dock-zone\)/, "flota sobre el dock");
  assert.match(cons, /transform: translateY\(calc\(100% \+ 2rem\)\)/, "oculta por defecto");
  assert.match(cons, /pointer-events: none/);
  assert.match(rule(".st-console.open"), /transform: translateY\(0\)/);
  for (const sel of [".st-sidebar", ".st-right"]) {
    const body = rule(sel);
    assert.match(body, /position: absolute/, `${sel} flotante`);
    assert.match(body, /z-index: 10/, `${sel} z-10`);
    assert.match(
      body,
      /max-height: calc\(100% - 2rem - var\(--dock-zone\)\)/,
      `${sel} acotado por encima del dock`,
    );
    assert.match(body, /overflow-y: auto/, `${sel} con scroll interno`);
  }
  assert.match(rule(".st-header"), /z-index: 20/);
  assert.match(rule(".st-console"), /z-index: 20/);
  assert.match(
    CSS,
    /\.st-panel-tab \{\s*position: absolute;[\s\S]{0,220}?z-index: 15/,
    "pestañas de paneles en z-15",
  );
});

test("Glow FX: neón en flota, seleccionado y paneles HUD", () => {
  assert.match(
    rule(".leaflet-overlay-pane canvas"),
    /drop-shadow\(0 0 6px rgba\(0, 242, 255, 0\.55\)\)[\s\S]*drop-shadow\(0 0 14px rgba\(0, 242, 255, 0\.25\)\)/,
    "hyper glow multicapa de la flota en canvas",
  );
  assert.match(
    rule(".st-ico svg"),
    /drop-shadow\(0 0 8px rgba\(0, 242, 255, 0\.9\)\)[\s\S]*drop-shadow\(0 0 20px rgba\(0, 242, 255, 0\.4\)\)/,
    "hyper glow neón multicapa en iconos DOM",
  );
  assert.match(
    rule(".st-sat-icon .st-ico svg"),
    /drop-shadow\(0 0 6px rgba\(255, 103, 0, 0\.9\)\)/,
    "destello naranja intenso del seleccionado",
  );
  assert.match(rule(".st-sat-icon .st-ico svg"), /animation: st-glow-pulse/, "brillo pulsante");
  assert.match(rule(".st-reticle"), /drop-shadow\(0 0 6px rgba\(255, 103, 0, 0\.55\)\)/);
  assert.match(rule(".st-reticle"), /animation: spin-slow 20s linear infinite/, "retícula 20 s");
  assert.match(rule(".st-radar-sweep"), /animation: spin-slow 20s linear infinite/, "barrido del radar 20 s");
  assert.match(CSS, /@keyframes pulse-ring/, "halo expansivo del seleccionado");
  assert.match(rule(".st-halo"), /radial-gradient/, "halo con gradiente radial naranja");
  assert.match(rule(".st-tval"), /animation: st-flicker/, "glitch de 1 frame en telemetría");
  assert.match(CSS, /@keyframes st-flicker/);
  assert.match(rule(".st-trackpulse"), /animation: st-energy/, "pulso de energía en la órbita");
  assert.match(CSS, /prefers-reduced-transparency/, "fallback de transparencia accesible");
  assert.match(
    CSS,
    /\.selected-satellite-active::before,[\s\S]{0,220}?box-shadow: 0 0 10px rgba\(255, 103, 0, 0\.45\)/,
    "anillos de pulso con glow",
  );
  assert.match(
    rule(".hud-panel"),
    /box-shadow:[\s\S]*rgba\(255, 103, 0, 0\.4\)/,
    "resplandor de acento en bordes de paneles",
  );
  const kiosk = rule(".st-kiosk.on");
  assert.match(kiosk, /box-shadow:[\s\S]*var\(--accent-glow\)/, "kiosco activo con brillo naranja");
  assert.match(kiosk, /color: var\(--accent\)/);
});

test("drawer de detalles OCULTO por defecto y slide-in con .open", () => {
  const closed = rule(".st-right");
  assert.match(closed, /transform: translateX\(calc\(100% \+ 2rem\)\)/, "fuera de pantalla por defecto");
  assert.match(closed, /top: 1rem/);
  assert.match(closed, /right: 1rem/);
  assert.match(closed, /pointer-events: none/);
  // El glassmorphism lo aporta la clase compartida .hud-panel, que App aplica
  // junto a .st-right (verificado en el source):
  const app = readFileSync("src/App.tsx", "utf8");
  assert.match(app, /st-right open hud-panel/, "drawer con glassmorphism .hud-panel");
  assert.match(rule(".hud-panel"), /backdrop-filter: blur\(16px\)/);
  assert.match(rule(".hud-panel"), /rgba\(2, 6, 15, 0\.85\)/, "cristal acrílico profundo");
  const open = rule(".st-right.open");
  assert.match(open, /transform: translateX\(0\)/);
  assert.match(open, /pointer-events: auto/);
});

test("dock adaptativo: centrado abajo, 90vw y wrap", () => {
  const dock = rule(".st-dock");
  assert.match(dock, /position: absolute/);
  assert.match(dock, /z-index: 20/);
  assert.match(dock, /left: 50%/);
  assert.match(dock, /bottom: 1rem/);
  assert.match(dock, /max-width: 90vw/);
  assert.match(dock, /flex-wrap: wrap/);
  assert.ok(rule(".st-layers-pop") !== null, "popover del menú CAPAS");
  const corners = rule(".st-corners");
  assert.match(corners, /background-image:/);
  assert.ok((corners.match(/linear-gradient/g) || []).length >= 8, "8 trazos de esquina");
});

test("HUD vivo: ping táctico, crosshair, huella dinámica, pulso y chips", () => {
  assert.match(CSS, /@keyframes st-ping/, "radar-ping del puntero táctico");
  assert.match(rule(".st-tac-ring"), /animation: st-ping/, "anillo ping animado");
  assert.match(rule(".st-tac-ring"), /animation-delay: var\(--pd/, "ping escalonado por NORAD");
  assert.match(rule(".st-cross i"), /border: 0 solid var\(--accent\)/, "esquinas biseladas");
  assert.match(CSS, /@keyframes st-flash/, "destello escalonado del crosshair");
  assert.match(rule(".st-footprint"), /fill: url\(#stFootGrad\)/, "gradiente radial de la huella");
  assert.match(rule(".st-foot-ring"), /stroke-dasharray/, "anillo punteado");
  assert.match(rule(".st-foot-ring"), /animation: st-dashspin/, "anillo rotatorio");
  assert.match(rule(".st-trackpulse"), /box-shadow:[\s\S]*0 0 10px 2px rgba\(255, 103, 0/, "pulso lumínico naranja");
  assert.match(rule(".st-stat.ok"), /color: var\(--ok\)/);
  assert.match(rule(".st-stat.warn"), /color: var\(--warn\)/);
  assert.match(rule(".st-tac-label"), /font-family: var\(--font-mono\)/, "etiqueta mono");
  assert.match(CSS, /\.st-zoom-hi \.st-tac-label/, "etiqueta visible con zoom alto");
});

test("multiplataforma: filtro GPU de teselas, glassmorphism .hud-panel y safe-areas", () => {
  assert.match(
    rule(".leaflet-tile-pane"),
    /filter: brightness\(0\.65\) contrast\(1\.25\) saturate\(0\.4\)/,
    "filtro GPU exacto sobre el contenedor de teselas",
  );
  assert.match(rule(".leaflet-container"), /background-color: #030508 !important/);
  const hud = rule(".hud-panel");
  assert.match(hud, /rgba\(2, 6, 15, 0\.85\)/, "cristal acrílico profundo");
  assert.match(hud, /backdrop-filter: blur\(16px\)/);
  assert.match(hud, /-webkit-backdrop-filter: blur\(16px\)/);
  assert.match(hud, /border: 1px solid transparent/, "borde por gradiente en border-box");
  assert.match(rule(".hud-panel::before"), /rgba\(255, 103, 0, 0\.9\)/, "esquinas naranjas");
  assert.match(CSS, /\.hud-panel::after \{[\s\S]*?rgba\(34, 211, 238, 0\.8\)/, "esquinas cian");
  assert.match(rule(".st-sidebar"), /will-change: transform/, "repliegue acelerado por hardware");
  assert.match(rule(".st-right"), /will-change: transform/, "slide-in acelerado por hardware");
  assert.match(CSS, /env\(safe-area-inset-top/, "safe-area superior");
  assert.match(CSS, /env\(safe-area-inset-bottom/, "safe-area inferior");
  assert.match(CSS, /@media \(pointer: coarse\)/, "ajustes táctiles");
  assert.match(CSS, /@media \(min-width: 1800px\)/, "ultra-wide");
  const html = readFileSync("index.html", "utf8");
  assert.match(html, /viewport-fit=cover/, "viewport con cover para safe-areas nativas");
});

test("MapView sin L.control.layers ni leyenda flotante (todo vive en el dock)", () => {
  assert.ok(!MAPVIEW.includes("L.control.layers("), "control de capas legado eliminado");
  assert.ok(!MAPVIEW.includes("st-map-legend"), "leyenda flotante eliminada");
});

test("globo SIN rotación perpetua: estático por defecto, tracking solo con lock", () => {
  const GLOBE = readFileSync("src/components/map/GlobeView.tsx", "utf8");
  assert.match(GLOBE, /SIN rotación perpetua/, "comentario de garantía presente");
  assert.ok(!/0\.00045/.test(GLOBE), "sin incremento de longitud por frame en reposo");
  assert.match(GLOBE, /trackedRef\.current && sel/, "interpolación de centro solo con lock activo");
  assert.match(GLOBE, /Math\.exp\(-dt \/ 250\)/, "suavizado exponencial independiente de FPS");
  assert.match(GLOBE, /onUserPanRef\.current\?\.\(\)/, "clic vacío / arrastre liberan el seguimiento");
});

test("globo autocontenido: sin imports externos sin vendorizar", () => {
  // Regresión del fallo de dev-server en máquinas con node_modules antiguos:
  // el globo solo puede importar de src/vendor (d3-geo/topojson/land embebidos).
  const GLOBE = readFileSync("src/components/map/GlobeView.tsx", "utf8");
  assert.ok(!/from "d3-geo"/.test(GLOBE), "d3-geo debe venir de src/vendor");
  assert.ok(!/from "topojson-client"/.test(GLOBE), "topojson-client debe venir de src/vendor");
  assert.ok(!/world-atlas\//.test(GLOBE), "land-110m debe venir de src/vendor");
  assert.match(GLOBE, /vendor\/d3-geo\/index\.js/);
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  for (const d of ["d3-geo", "topojson-client", "world-atlas"]) {
    assert.ok(!(pkg.dependencies || {})[d], `${d} no debe estar en dependencies`);
  }
});
