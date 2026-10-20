/**
 * Test de humo de UI (SSR): los componentes principales renderizan sin crash
 * y muestran la información clave. Sin navegador, offline, determinista.
 *
 * Ejecutar: node --test scripts/ui-smoke.test.mjs
 */
import { test, after } from "node:test";
import assert from "node:assert/strict";

import { closeVite, loadModule } from "./_load.mjs";

after(closeVite);

const ui = await loadModule("/scripts/ui-smoke.tsx");

test("Header renderiza marca, búsqueda, badge SEED, kiosco y Modo Teatro", () => {
  const html = ui.renderHeader().replaceAll("<!-- -->", "");
  assert.match(html, /SpaceTracker/);
  assert.match(html, /SEED/);
  assert.match(html, /Buscar por nombre o NORAD/);
  assert.match(html, /métricas/);
  assert.match(html, /\[ F11 \] FULLSCREEN/, "conmutador de modo kiosco");
  assert.match(html, /Modo Teatro/, "botón de Modo Teatro presente");
});

test("TimeBar renderiza controles de reproducción y reloj (congelado y en vivo)", () => {
  const frozen = ui.renderTimeBar().replaceAll("<!-- -->", "");
  assert.match(frozen, /Pausar el tiempo/);
  assert.match(frozen, /Reanudar tiempo real/);
  assert.match(frozen, /Retroceder 1 hora/);
  assert.match(frozen, /Adelantar 1 hora/);
  assert.match(frozen, /SIM \+1h/, "desfase +1 h visible");
  assert.match(frozen, /type="range"/);

  const live = ui.renderTimeBarLive().replaceAll("<!-- -->", "");
  assert.match(live, /EN VIVO/);
});

test("Sidebar incluye favoritos, radar, grupos y la sección de observador", () => {
  const html = ui.renderSidebar().replaceAll("<!-- -->", "");
  assert.match(html, /Favoritos/);
  assert.match(html, /Radar OFF/, "interruptor de Radar Personalizado visible");
  assert.match(html, /Catálogo/);
  assert.match(html, /Observador/, "configuración de observador dentro del panel de misión");
  for (const label of ["Tripulados", "Meteorología", "Navegación", "Ciencia", "Starlink", "Comunicaciones", "Otros"]) {
    assert.ok(html.includes(label), `falta el grupo ${label}`);
  }
  assert.match(html, /ISS \(ZARYA\)/);
});

test("Dock inferior: timebar + menú CAPAS + consola + estados del sistema", () => {
  const html = ui.renderDock().replaceAll("<!-- -->", "");
  assert.match(html, /CAPAS/);
  assert.match(html, /LOG/);
  assert.match(html, /Pausar el tiempo/);
  assert.match(html, /Reanudar tiempo real/);
  assert.match(html, /type="range"/);
  assert.match(html, /st-dock/, "contenedor dock presente");
  assert.match(html, /SEED/, "badge de procedencia en el dock");
  assert.match(html, /SAT/, "conteo de flota en el dock");
  assert.match(html, /SGP4 WORKER/, "chip de estado del motor");
  assert.match(html, /TLE 97%/, "chip de salud TLE");
  assert.match(html, /FPS 60/, "chip de FPS");
});

test("SatDetail renderiza métricas, época, pasos y TLE con observador", () => {
  // React SSR intercala "<!-- -->" entre nodos de texto adyacentes; se retiran
  // para poder afirmar sobre el texto visible.
  const html = ui.renderSatDetail().replaceAll("<!-- -->", "");
  assert.match(html, /ISS \(ZARYA\)/);
  assert.match(html, /NORAD 25544/);
  assert.match(html, /Altitud/);
  assert.match(html, /Velocidad/);
  assert.match(html, /Elevación/);
  assert.match(html, /Azimut/);
  assert.match(html, /Distancia/);
  assert.match(html, /Parámetros orbitales/);
  assert.match(html, /Inclinación/);
  assert.match(html, /Período/);
  assert.match(html, /Pasos sobre Madrid/);
  assert.match(html, /CSV/, "botón de exportación CSV de pases");
  assert.match(html, /TLE/);
  // Favoritos v2: picker de listas con el chip marcado para la ISS
  assert.match(html, /Listas:/);
  assert.match(html, /Favoritos ✓|Favoritos\s*✓/, "chip de lista marcado en el detalle");
  // Etiqueta de época presente en alguna de sus variantes válidas:
  assert.ok(/TLE fresco|TLE envejeciendo|TLE antiguo/.test(html), "sin etiqueta de época");
  // Hora solar:
  assert.match(html, /Hora solar/);
});

test("SatDetail sin observador pide configurarlo y no calcula pasos", () => {
  const html = ui.renderSatDetailSinObservador();
  assert.match(html, /Configura tu observador/);
  assert.match(html, /siguiendo|seguir/);
});

test("ObserverPanel sin observador renderiza el formulario completo abierto", () => {
  const html = ui.renderObserverPanelVacio();
  assert.match(html, /Observador/);
  assert.match(html, /Latitud/);
  assert.match(html, /Longitud/);
  assert.match(html, /Zona horaria/);
  assert.match(html, /Elevación/);
  assert.match(html, /Europe\/Madrid|UTC/);
  assert.match(html, /Lugares predefinidos/);
  assert.match(html, /Usar mi ubicación/);
});

test("ObserverPanel con observador guardado aparece plegado y muestra su nombre", () => {
  const html = ui.renderObserverPanel().replaceAll("<!-- -->", "");
  assert.match(html, /Observador/);
  assert.match(html, /Madrid/);
});

test("Consola de telemetría renderiza cabecera, filtros y reloj UTC", () => {
  const html = ui.renderConsole().replaceAll("<!-- -->", "");
  assert.match(html, /FLIGHT LOG/);
  for (const lv of ["SYS", "ORBIT", "TLE", "WARN", "ALRT"]) {
    assert.ok(html.includes(lv), `falta el filtro ${lv}`);
  }
  assert.match(html, /CLEAR/);
  assert.match(html, /\d{2}:\d{2}:\d{2}Z/, "reloj UTC en cabecera");
});

test("Radar de cielo local: rejilla polar, cardinales y lectura az/el", () => {
  const html = ui.renderSkyRadar().replaceAll("<!-- -->", "");
  assert.match(html, /Radar de cielo local/);
  assert.match(html, /Madrid/);
  for (const card of [">N<", ">E<", ">S<", ">W<"]) {
    assert.ok(html.includes(card), `falta cardinal ${card}`);
  }
  assert.ok((html.match(/st-radar-ring/g) || []).length >= 3, "anillos de elevación 0/30/60");
  assert.match(html, /0°/);
  assert.match(html, /30°/);
  assert.match(html, /60°/);
  assert.match(html, /90°/);
  assert.match(html, /AZ /, "lectura de azimut/elevación presente");
});
