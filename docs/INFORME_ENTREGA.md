# SpaceTracker — Informe de entrega (flujo Nova-Aegis)

**Fecha:** 18 de octubre de 2026
**Modalidad elegida por el usuario:** reconstrucción desde cero en este espacio de trabajo (`/home/user/SpaceTracker`), con nombre visible confirmado **SpaceTracker**. El repositorio original (`~/SpaceTracker` del usuario) no estuvo disponible aquí; nada de lo afirmado sobre él se ha dado por cierto sin verificar.

## 1. Análisis (resumen)

- Contexto: `SPACETRACKER_HANDOFF.md` (adjunto en `uploads/`).
- Pre-auditoría externa (informe completo en `../auditoria/INFORME_PREAUDITORIA.md`):
  fuentes TLE operativas, `satellite.js@7.1.0` confirmado como `latest`,
  breaking changes v7 identificados (`sunPos().rsun` objeto, unidades de
  `ndot/nddot`, `propagate` nullable, `checkForDecay` nuevo).
- Riesgos asumidos: al reconstruir, no hay equivalencia visual/funcional
  garantizada con el original (el propio handoff lo advierte en §8).

## 2. Planificación ejecutada

Etapa 1 (validación/época/caché) → Etapa 2 (métricas por fuente) → Etapa 3
(fallback/procedencia/merge) → Etapa 4 (robustez de tests) → UI → build →
documentación. Cada etapa con validación real antes de avanzar.

## 3. Ejecución — archivos creados

Dominio (`src/lib/space/`): `types.ts`, `tle-validation.ts`, `tle-epoch.ts`,
`groups.ts`, `propagate.ts`, `load-catalog.ts`, `seed.ts`, `seed-data.json`,
`catalog.server.ts`, `catalog.client.ts`.
UI (`src/`): `App.tsx`, `main.tsx`, `styles.css`, `components/Header.tsx`,
`components/Sidebar.tsx`, `components/map/MapView.tsx`,
`components/orbit/SatDetail.tsx`, `components/observer/ObserverPanel.tsx`,
`lib/ui/{format,persistence,places,colors}.ts`.
Infra: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`,
`.gitignore`, `README.md`.
Tests (`scripts/`): `_load.mjs`, `_mocks.mjs`, `fixtures.mjs` (19 TLEs reales
verificados), `generate-seed.mjs`, `tle-validation.test.mjs`,
`tle-epoch.test.mjs`, `orbit-passes.test.mjs`, `live-catalog-epoch.test.mjs`,
`catalog-sources.test.mjs`, `catalog-fallback.test.mjs`, `ui-smoke.test.mjs`
(+ `ui-smoke.tsx`), `network-live.test.mjs` (fuera de suite por defecto).

## 4. Validación — comandos ejecutados y resultados REALES

| Comando | Resultado |
|---|---|
| `npm install` | 72 paquetes; react 19.3.1, vite 7.3.7, ts 5.9.3, satellite.js 7.1.0, leaflet 1.9.4 |
| `npm run typecheck` | **pass** (0 errores), reejecutado tras cada etapa |
| `npm test` (59 tests offline) | **59/59 pass**, estable en 3 corridas consecutivas (y 8 corridas previas de las suites de dominio durante el desarrollo) |
| `npm run test:live` (3 tests, red real) | **3/3 pass** — 1473 únicos, seen 1969, valid 1508 = fresh 1207 + aging 37 + stale 264, invalid 231, future 0, failedBySource {0,0} |
| `npm run build` | **pass** en ~5.1 s (tras diagnóstico del fallo conocido, ver §6) |
| `npm run dev` + smoke HTTP | `/` 200 (HTML con `#root` y título), `/src/main.tsx` 200 (JS transformado), `/api/catalog` 200 JSON **source live, 1474 sats** en 3.1 s |
| `npm run preview` + smoke HTTP | `/` 200, asset JS 200; `/api/catalog` cae al SPA-fallback (esperado: la cascada del cliente lo detecta y usa Ivan directo/seed) |

Fallos encontrados y corregidos durante el desarrollo (todos con prueba de
regresión en la suite): frontera exacta 3/14 días inestable por redondeo de día
fraccional (épsilon documentado); época "ahora" clasificada `future` por ±0.4 ms
(tolerancia 60 s); campo de revolución con espacios (GOES 18 real); regla
"excentricidad ≥ 1" inalcanzable en formato TLE (eliminada y test sustituido);
pasos degenerados AOS≈TCA≈LOS (refinado corregido); `patchEpoch` de tests
aplicado a línea ajena (corregido); "RANGE A" no es junk por nombre (test usa
`R/B` real); `GROUP_COLORS` en módulo leaflet rompía SSR (movido a `lib/ui/colors.ts`).

## 5. Criterios de aceptación del handoff — estado

- [x] Etapa 1: validación estructural + checksum; época fresh(≤3d)/aging(≤14d)/stale; rechazo de futuras en ingesta; conservación de antiguas con diagnóstico; ventana 57–99→19xx / 00–56→20xx; caché de propagación con clave `${id}:${line1}:${line2}` y test de regresión explícito.
- [x] Etapa 2: `CatalogStats` con `seenBySource` y `failedBySource`; semántica fijada por escrito en `types.ts`; invariante `fresh+aging+stale === valid` sobre el mismo conjunto de aceptados; fallos de Ivan visibles (antes `catch` vacío); stats del seed coherentes; aserción de nota REAL (`assert.deepEqual(notes, ["SatNOGS no respondió"])`) sin `|| true`.
- [x] Etapa 3: procedencia live/seed en payload y nota; fallback completo; merge con live ganando por NORAD; compleción de grupos vacíos con seed; tests específicos.
- [x] Etapa 4: caída parcial, ambas caídas, respuesta vacía, TLE inválidos, 508 HTML, junk, duplicados, caché; funciones reales probadas con fetch inyectado (nunca lógica re-escrita en el test).
- [x] Reglas operativas: español; cambios pequeños y verificados; no se afirmó ninguna prueba no ejecutada; no se modificaron tests para "hacer pasar" la suite (los ajustes de tests fueron correcciones de bugs del propio test, documentadas arriba).

## 6. Fallo de build conocido — resolución verificada

Reproducido aquí con el mensaje exacto del handoff:
`Module format "iife" does not support top-level await` sobre
`wasm-build/pthreads-release/index.js`.

Causa raíz (no documentada hasta ahora): el plugin `vite:worker-import-meta-url`
compila los Workers Emscripten de satellite.js con `worker.format` (por defecto
`"iife"`). Arreglo mínimo: `worker: { format: "es" }`.

**Confirmación posterior a la entrega inicial (misma fecha):**
- Aislamiento experimental: se retiraron `commonjsOptions.exclude` y
  `treeshake.moduleSideEffects` de la config → el build **sigue pasando** solo
  con `worker.format: "es"` (5.28 s). Fix mínimo, necesario y suficiente.
- Evidencia aguas arriba: [shashwatak/satellite-js#165](https://github.com/shashwatak/satellite-js/issues/165)
  (Vite 8/Rolldown + satellite.js 7.x: exactamente el mismo plugin y error
  `[UNSUPPORTED_FEATURE] Top-level await … 'iife'`; el fix `worker: { format: "es" }`
  está confirmado en el issue) y [vitejs/vite#22362](https://github.com/vitejs/vite/issues/22362).
  Esto refuerza la hipótesis de que el repo original usa Vite 8/Rolldown.
- Kit de parche para el repo original generado y probado: `auditoria/parche-build/` —
  `aplicar-parche-build.mjs` (dry-run por defecto, `--aplicar` escribe con
  respaldo en `backups/buildfix-<ts>/`, coincidencia única del anclaje,
  idempotente, se abstiene ante formas no reconocidas; 6 casos sintéticos
  verificados), `verificar-build.sh` (verificación post-parche con log en
  `backups/verify-<ts>/`: presencia del parche sin falsos positivos por
  comentarios, versiones, typecheck, build con escaneo de firmas del error,
  tests del handoff o RUN_ALL, códigos de salida 0/1/2/3; probado en 3
  escenarios reales) y `PARCHE_BUILD.md` (diagnóstico, aplicación,
  verificación, reversión y refuerzos condicionales R1–R3).

Detalles y snippet en `README.md`.

## 7. Checklist de transferencia (§10 del handoff)

- [x] Inspeccionar entorno real y `package.json` (de la reconstrucción; el repo original sigue pendiente de auditar en la máquina del usuario — script listo en `../auditoria/inspeccion-readonly.sh`).
- [x] Confirmar versiones actuales (tabla en README).
- [x] Verificar validación/época TLE (tests reales).
- [x] `seenBySource`/`failedBySource` existen e implementados (en la reconstrucción; en el repo original: pendiente de inspección).
- [x] No confundir `py_compile` con parche funcional: se descartó la vía del script Python; todos los cambios fueron ediciones directas verificadas con typecheck+tests.
- [x] Métricas de filas/candidatos/únicos separadas (semántica en `types.ts`).
- [x] Merge/fallback probado (Etapa 3).
- [x] Resultados y riesgos documentados (este informe + README).

## 8. Incertidumbres del handoff (§11) — estado tras la reconstrucción

1. Nombre visible: **SpaceTracker** (decisión del usuario).
2. Rutas/servidor/mapa: en la reconstrucción — SPA sin router (una sola vista), servidor = middleware Vite `/api/catalog`, mapa = Leaflet 1.9.4. El original sigue sin verificarse.
3. Vite/Rolldown y scripts de build: Vite 7.3.7 (Rollup 4, no rolldown-vite); scripts explícitos en `package.json`.
4. 8 fallos históricos de `grok-pwa-plugin.test.mjs`: **no aplicables** — ese plugin/tests no forman parte de la reconstrucción (no hay PWA). Queda pendiente en el repo original.
5. Cambios desde el respaldo de Etapa 2 del original: no verificable sin su máquina.
6. `SEED_SATS`: 29 TLEs reales (SatNOGS+Ivan) descargados el 2026-10-18, procedencia registrada en `seed-data.json` y regenerable con `npm run seed:generate`.
7. Persistencia de favoritos/observador: `localStorage` (`spacetracker:favorites:v1`, `spacetracker:observer:v1`), tolerante a fallos.
8. Equivalencia visual/funcional con el original: **no garantizada** (el handoff ya lo advertía; no hubo acceso al código original).

## 9. Cambios posteriores a la entrega

### 2026-10-18 — Capas base del mapa: CARTO → Esri (sin API key)

- **Causa:** el usuario reportó marcas de agua "API KEY REQUIRED" en el mapa.
  Verificación propia: las tiles `basemaps.cartocdn.com/dark_all` y
  `dark_nolabels` se sirven hoy con esa marca de agua (tile descargada e
  inspeccionada visualmente).
- **Solución:** nuevo módulo puro `src/lib/ui/tiles.ts` con dos bases
  verificadas tile a tile (HTTP 200 + inspección visual, sin marca de agua):
  1. *Oscuro (por defecto)*: Esri `Canvas/World_Dark_Gray_Base` +
     `Canvas/World_Dark_Gray_Reference` (rótulos).
  2. *Satelital oscuro*: Esri `World_Imagery` atenuado con CSS
     (`.st-tiles-dim`: brightness .72 / contrast 1.08 / saturate .85) para
     conservar el tono del dashboard.
  Selector de capas Leaflet (abajo-derecha), controles y atribución en tema
  oscuro, créditos Esri en el pie y en el control de atribución.
- **Regresión:** `scripts/map-tiles.test.mjs` (3 tests) bloquea cualquier
  vuelta a dominios con clave o a `basemaps.cartocdn.com` en `src/`.
- **Validación:** typecheck OK, suite completa 62/62, build OK.

### 2026-10-18 (bis) — Bloque UX 1: Favoritos v2 + Radar Personalizado

- Análisis del sistema v1 (Set plano en `persistence.ts`) → nuevo módulo
  `src/lib/ui/favorites.ts` con `FavoritesState { lists, radarMode }`, ops puras
  (`createList`, `renameList`, `deleteList`, `toggleSatInList`, `setRadarMode`,
  `allFavoriteIds`, `listsContaining`), migración v1→v2 y `sanitizeState`
  defensivo. Persistencia en `spacetracker:favorites:v2`.
- UI: `FavoritePicker` (chips por lista + crear-y-añadir), Sidebar con listas
  gestionables y botón «📡 Radar» (mapa = solo favoritos, chip de conteo en el
  mapa), App deriva `mapSats` filtrado. Rendimiento: el radar REDUCE marcadores.
- Validación: typecheck OK · 72/72 tests (10 nuevos de favoritos + humo
  actualizado) estables en 3 corridas · build OK.
- Siguientes bloques planificados en README («Hoja de ruta UX»).

### 2026-10-18 (ter) — Interacción de mapa: hitbox 24 px, hover y pulso

- Causa: reporte de usuario — puntos imposibles de clicar por tamaño/densidad.
- Cambios: puntos del catálogo migrados de `circleMarker` (canvas, r=1.6 px) a
  marcadores `divIcon` persistentes con hitbox invisible 24×24 px y hover
  escalado; tooltip compartido instantáneo (nombre + NORAD, escape HTML);
  anillos de pulso CSS solo en el seleccionado; trayectoria translúcida
  `interactive:false`; diffing de marcadores sin `clearLayers()`.
- Nuevo módulo puro `src/lib/ui/markers.ts` (HITBOX_PX, dotIconHtml,
  satIconHtml, escapeHtml) + `scripts/map-markers.test.mjs` (4 tests).
- Validación: typecheck OK · 76/76 tests · build OK · transform de MapView y
  markers verificado en dev-server (200, sin circleMarker residual).

### 2026-10-18 (cuater) — Iconos SVG por categoría + pulso canónico + rumbo

- SVG minimalista por grupo con el color del grupo como trazo principal
  (`groupIconSvg`); marcadores divIcon del catálogo y del seleccionado.
- Clase canónica `.selected-satellite-active` con anillos expansivos
  (::before/::after + @keyframes st-pulse) solo en el seleccionado.
- `bearingDeg()` (propagate.ts) + rotación CSS `--rot` en `.st-ico`
  (t → t+1 s), sin recrear iconos: solo se actualiza la variable CSS.
- Validación: typecheck OK · 79/79 tests · build OK.

### 2026-10-18 (cinco) — Modo Teatro + Línea de tiempo de simulación

- Paneles colapsables (independientes y simétricos) con animación de rejilla
  `.3s ease` y `ResizeObserver → map.invalidateSize()`; estado persistido.
- TimeBar flotante: Pausa / Play tiempo real / ±1 h / slider ±24 h; `now` de
  todo el pipeline SGP4 conmuta live↔frozen; scrub coalescido con rAF y
  repintado de flota con throttle 250 ms + cola final.
- Validación: typecheck OK · 85/85 tests · build OK · transform dev OK.

### 2026-10-18 (seis) — Rediseño visual "Mission Control / SpaceX"

- Paleta negra absoluta (#030508) con acento #FF6700/#FF8C00, texto #FFF y
  gris técnico #94A3B8; bordes HUD #1E293B.
- JetBrains Mono (Google Fonts + fallback ui-monospace) para toda telemetría.
- Paneles/tarjetas estilo HUD: cristal translúcido, bisel `clip-path`, barra
  de acento naranja superior vía `::before`.
- Mapa: órbita/huella cian #22d3ee translúcido; seleccionado con retícula HUD
  giratoria (spin 10 s) + anillos de pulso; cursor crosshair.
- Validación: typecheck OK · 85/85 tests (retícula cubierta en
  map-markers.test.mjs) · build OK.

### 2026-10-18 (siete) — Consola de Telemetría + Radar de Cielo Local

- Flight Log: bus de eventos fuera de React (singleton con tope), consola
  colapsable con niveles SYS/ORBIT/TLE/WARN/ALRT, filtros, CLEAR, auto-scroll
  anclable y reloj UTC; eventos reales de ingesta TLE, selección, observador,
  tiempo simulado, radar y telemetría 60 s + anuncios de pase (AOS dedup).
- Sky Radar: polar SVG az/el con cardinales, anillos 0/30/60/90, curva de pase
  (pasado sólido/futuro discontinuo), punto vivo, barrido y lectura interactiva;
  memoizado por cubos de 60 s para no costar rendimiento al mapa.
- Validación: typecheck OK · 93/93 tests (6 de bus + 2 de humo nuevos) · build OK.

### 2026-10-18 (ocho) — flyTo, hotkeys, terminador solar y export CSV

- Cámara: flyTo al seleccionar + panTo animado en seguimiento; dragstart
  libera el follow (control del operador).
- Hotkeys globales con guardia de inputs: Espacio, /, ESC, ←/→ (favoritos).
- Terminador día/noche real (sunPos/gstime) como overlay conmutable, 1 recálculo/min.
- Export CSV de pases 24 h (RFC 4180, metadatos, evento en consola).
- Validación: typecheck OK · 103/103 tests (4 de terminador, 4 de CSV, 2 de
  hotkeys + humos) · build OK.

### 2026-10-18 (nueve) — Refactor de rendimiento: worker SGP4 + canvas + throttle

- Worker dedicado con buffers transferibles y latest-wins; chunk de build
  separado (21.99 kB, SGP4 puro sin cadena WASM).
- Flota migrada de divIcon DOM a circleMarker sobre `L.canvas({tolerance:12})`;
  DOM reservado a seleccionado/observador.
- Actualización de flota en cubos de 2 s (rango pedido 1-2 s) con post-limit
  250 ms durante scrub.
- Hallazgo de datos: TLE de STARLINK-2342 (~70 d) falla en SGP4 (error 1) →
  cubierto por test como ok=0 (oculto en canvas).
- Validación: typecheck OK · 109/109 tests (6 de fleet-compute) · build OK con
  chunk de worker emitido.

### 2026-10-18 (diez) — Renderizado híbrido: SVG HUD restaurado sin perder RAM

- Tiers: seleccionado (DOM+retícula+pulso), favoritos+categoría activa (DOM
  con SVG y badge ★, tope 150), fondo en canvas. Leyenda clicable para fijar
  la categoría activa; transiciones de tier por diffing sin fugas.
- Req. 3 verificado con test propio (map-css.test.mjs): selectores HUD
  presentes, sin reglas que los oculten, pointer-events correctos.
- Validación: typecheck OK · 113/113 tests · build OK (chunk worker 22 kB).

### 2026-10-18 (once) — Intercepción de eventos y layout full-viewport

- Bug crítico: la huella de cobertura se creaba sin `interactive:false` y
  capturaba todos los clics dentro de su radio. Corregido en huella, órbita y
  terminador (+ `bubblingMouseEvents:false`), más blindaje CSS
  `pointer-events:none !important` en contenedor SVG, anillos, retícula y
  tooltip — sin cegar el canvas (hit-testing de la flota).
- Layout consolidado a pantalla completa: mapa z-1 al 100 % de vw/vh; paneles
  HUD flotantes z-10; cabecera/consola z-20; pestañas z-15; controles Leaflet
  y leyenda/timebar reposicionados con variables CSS; pie eliminado (créditos
  en tagline).
- Validación: typecheck OK · 116/116 tests · build OK.

### 2026-10-18 (doce) — HUD flotante v2: drawer contextual, dock y safe-areas

- Drawer de detalles oculto por defecto (slide-in glass al seleccionar, con
  animación de salida); leyenda y L.control.layers sustituidos por el menú
  CAPAS del nuevo dock inferior (timebar + capas + LOG en una barra).
- Tiles desaturados (base/rótulos/satelital), esquinas con retícula técnica
  (.st-corners), safe-area-inset en todo el HUD, breakpoints ultra-wide y
  táctiles (bottom-sheet ≤700 px, objetivos ≥38 px en pointer:coarse).
- Observador reubicado en el panel de misión; ⛶ conmuta dicho panel.
- Validación: typecheck OK · 121/121 tests (dock/drawer/corners/safe-area en
  map-css y humos) estables ×2 · build OK.

### 2026-10-18 (trece) — Command Dock v3, filtro GPU y paneles .hud-panel

- Filtro de teselas unificado en .leaflet-tile-pane (valores exactos pedidos);
  eliminados los filtros por capa (doble atenuación).
- Clase .hud-panel con el glassmorphism especificado, aplicada a los cinco
  flotantes; will-change: transform en paneles retráctiles.
- Dock con estados del sistema (LIVE/SEED + conteo); consola y dock como
  tarjetas flotantes (margen 8 px); panel de misión cerrado por defecto.
- Validación: typecheck OK · 121/121 tests (regresiones de filtro GPU,
  hud-panel y drawer actualizadas) · build OK.

### 2026-10-18 (catorce) — Layout de 3 zonas anti-colisiones (100dvh)

- Causa raíz de los solapes reportados: cabecera/consola absolutas con alturas
  estimadas (--header-h/--console-h) desincronizadas de su altura real.
- Solución: header y consola vuelven al FLUJO (flex-shrink:0); nueva zona
  .st-viewport (flex:1) ancla todos los flotantes; paneles con top/right/left
  1rem + max-height calc(100% - 2rem) + scroll interno; dock 90vw con wrap;
  breakpoint compacto 1024px/768px de alto; atribución reposicionada en <700px.
- Limpieza: CSS muerto de leyenda y variables --left-w/--right-w/--header-h.
- Validación: typecheck OK · 121/121 tests (layout re-verificado por test) ·
  build OK.

### 2026-10-18 (quince) — Bandeja retráctil + Glow FX + zona dock

- Consola fuera del flujo: cajón flotante oculto por defecto sobre el dock
  (toggle ▮ LOG); elimina el empalme con el reproductor de tiempo.
- --dock-zone reserva aire inferior: paneles con max-height
  calc(100% - 2rem - var(--dock-zone)) + scroll interno (nada se corta).
- Glow FX: canvas drop-shadow cian, --g por grupo en iconos DOM, destello
  #FF6700 en seleccionado/retícula/anillos y resplandor de acento en .hud-panel.
- Validación: typecheck OK · 122/122 tests (layout y glow verificados por
  test) · build OK.

### 2026-10-18 (dieciséis) — Empaquetado nativo Tauri v2 + Capacitor

- src-tauri/ completo: tauri.conf.json (HUD sin decoraciones, maximizada,
  mín. 1024×768, backgroundThrottling disabled, CSP con fuentes TLE/Esri/IPC),
  capabilities de ventana, bootstrap Rust desktop+móvil, perfil release
  optimizado, iconos generados (png 32/128/512 + ico).
- capacitor.config.json: StatusBar DARK #030508 overlaysWebView (inmersivo),
  SplashScreen negro, androidScheme https.
- native.ts: detección + guards de WebView solo en nativo; WindowControls con
  import dinámico de @tauri-apps/api; header como región de arrastre.
- Scripts dev:native/build:native/cap:*; CLI Tauri 2.12.3 verificado aquí
  (sin toolchain Rust en el sandbox: el build nativo se ejecuta en destino).
- Validación: typecheck OK · 124/124 tests (native-guards) · build OK ·
  JSON de configuración parseados.

### 2026-10-18 (diecisiete) — Filtro estricto de TLEs obsoletos

- Nueva puerta `tle-filter.ts` (checksum → época → caducidad 30 d → junk →
  viabilidad orbital → decaimiento SGP4) aplicada en parseo de fuentes, seed y
  fallback; contadores auditables expired/junk/implausible/decayed en stats y
  cabecera; seed regenerado con las mismas puertas y re-filtrado en carga.
- Rango mm ajustado a [0.05, 17.6] rev/d tras detectarse que excluía HEO
  científicas legítimas (TESS ≈ 0.07 rev/d).
- Live real: 234 expirados + 3 decaídos descartados de 1949 filas.
- Validación: typecheck OK · 134/134 tests (10 nuevos de tle-filter) · build OK
  · suite live 3/3.

### 2026-10-18 (dieciocho) — Fix dev-server: sin @tauri-apps/api en el bundle web

- Bug reportado por el usuario: Vite fallaba al resolver
  `@tauri-apps/api/window` desde WindowControls (import dinámico, pero Vite lo
  resuelve en transform) en máquinas sin el paquete instalado.
- Fix: WindowControls usa el global inyectado `window.__TAURI__`
  (`withGlobalTauri: true` en tauri.conf.json); dependencia
  `@tauri-apps/api` ELIMINADA de package.json (el CLI sigue como devDep).
- Regresión: native-guards.test.mjs prohíbe la cadena de texto del paquete en
  WindowControls y exige el uso del global.
- Validación: dev-server transforma WindowControls con 200 sin el paquete
  instalado (reproducción exacta del escenario del usuario) · 135/135 tests ·
  build OK.

### 2026-10-18 (diecinueve) — HUD vivo v5

- Punteros tácticos (ping escalonado + glow por grupo + etiquetas por zoom),
  crosshair biselado con destellos, huella con gradiente radial SVG y anillo
  punteado rotatorio, órbita en 3 trazos con fade + pulso lumínico rAF,
  scramble en telemetría y chips SGP4/TLE/FPS reales en el dock.
- Validación: typecheck OK · 136/136 tests (tácticos/crosshair/huella/pulso/
  chips cubiertos por map-markers, map-css y humos) · build OK.

### 2026-10-18 (veinte) — Modo Kiosco F11

- useKioskMode (Tauri global __TAURI__ / Fullscreen API web), tauri.conf con
  fullscreen:true + decorations:false, botón HUD [ F11 ] con glow naranja.
- Validación: typecheck OK · 137/137 tests · build OK · JSON Tauri parseado.

### 2026-10-18 (veintiuno) — Alias táctico F para el modo kiosco

- isKioskKey() pura y testeable: F11 siempre (sin modificadores), F/f solo
  fuera de campos de texto (isTypingTarget); estado isFull único sincroniza el
  botón del Header con cualquier vía (F11, F, botón, ESC nativo).
- Validación: typecheck OK · 138/138 tests (11 casos de isKioskKey) · build OK.

### 2026-10-18 (veintidós) — Hyper Glow HUD v6

- Glow multicapa en canvas y tier DOM, halo pulse-ring del seleccionado,
  glassmorphism blur(16px) con borde-gradiente y esquinas biseladas,
  spin-slow 20 s en retícula/barrido, st-energy en el pulso de órbita,
  st-flicker en telemetría y hover naranja global.
- Validación: typecheck OK · 138/138 tests (aserciones de glow actualizadas a
  los nuevos valores) · build OK.

### 2026-10-18 (veintitrés) — Globo ortográfico 2D

- GlobeView (canvas + d3-geo + world-atlas 110m embebido): halo atmosférico,
  graticula, continentes, backface culling, drag-rotate, wheel-zoom, hit-test
  de selección, auto-rotación y follow con lerp; chunk lazy propio.
- ortho.ts pura con 5 tests (centro, antípoda, limbo ecuatorial, norte arriba,
  arrastre con clamp/wrap); conmutador en el dock.
- Validación: typecheck OK · 143/143 tests · build OK con code-split del globo.

### 2026-10-18 (veinticuatro) — Vendorizado del globo (fix dev-server)

- Bug reportado: Vite no resolvía "d3-geo" en máquinas con node_modules
  externo anterior al zip. Solución: d3-geo/topojson-client/land-110m.json
  venderizados en src/vendor (+ shim d3-array de 40 líneas), dependencias
  runtime eliminadas de package.json y test de regresión "globo autocontenido".
- Validación: typecheck OK · 144/144 tests · build OK (chunk GlobeView 34 kB
  gzip) · cadena vendor ejecutada en Node como smoke.

## 10. Pendientes y riesgos

- Validación visual en navegador real del usuario (este entorno no tiene navegador; se verificó render SSR + build + servidor).
- Si se desea PWA (el original tenía tests de un plugin PWA), añadir y portar esos tests por separado.
- El seed envejece (~3 semanas para pasar todo a `aging`+): regenerar con `npm run seed:generate`.
- Ivan puede rate-limit (508) bajo uso intensivo: los reintentos/backoff lo absorben, pero una sesión muy larga podría degradar a SatNOGS+seed.
- Mejora futura opcional: `BulkPropagator` WASM (3–12× para pintar 1473 puntos) y `checkForDecay` (7.1.0) para limpiar decaídos del catálogo.
