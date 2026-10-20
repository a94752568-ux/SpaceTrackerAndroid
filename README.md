# SpaceTracker

Aplicación web para explorar satélites artificiales con datos orbitales TLE:
catálogo agrupado por misión, propagación SGP4 en vivo, mapa con trayectoria y
huella, detalle orbital completo, pasos sobre un observador terrestre,
favoritos y búsqueda por nombre o número NORAD.

Reconstruido desde cero el 2026-10-18 a partir de `SPACETRACKER_HANDOFF.md`
(nombre visible confirmado: **SpaceTracker**).

## Pila tecnológica (versiones reales instaladas)

| Elemento | Versión |
|---|---|
| Node.js (entorno de desarrollo) | v20.20.2 (satellite.js v7 exige ≥20.19 / ≥22.13 / ≥24) |
| React | 19.3.1 |
| Vite | 7.3.7 (Rollup 4, salida ES nativa) |
| TypeScript | 5.9.3 |
| satellite.js | 7.1.0 (fijada; ESM-only, API v7 verificada contra sus `.d.ts`) |
| Leaflet | 1.9.4 (tiles Esri Dark Gray / World Imagery, sin API key) |
| Tests | `node --test` sobre `.mjs` que cargan el TS real vía Vite `createServer`+`ssrLoadModule` |

## Favoritos v2 y Radar Personalizado (bloque UX 1)

- **Listas personalizadas** (`src/lib/ui/favorites.ts`, ops puras e inmutables +
  migración automática v1→v2 y saneado de localStorage corrupto): crear,
  renombrar (nombres únicos con sufijo), borrar (doble clic armado 3 s),
  plegar y pertenencia múltiple de un satélite a varias listas.
- **Radar Personalizado**: interruptor en la cabecera de Favoritos; cuando está
  ON, el mapa renderiza SOLO los favoritos (`mapSats` en App) — menos marcadores,
  menos coste de redibujo; chip flotante 📡 sobre el mapa con el conteo.
- **FavoritePicker** en el panel de detalle: chips por lista + creación inline
  ("+ Lista") que crea y añade en un paso.
- Persistencia: `spacetracker:favorites:v2`; si solo existe v1 (array de NORAD)
  se migra a la lista por defecto «Favoritos».
- Tests: `scripts/favorites.test.mjs` (10 casos: migración, inmutabilidad,
  unión de ids, saneado…) + humo UI actualizado.

## Interacción de mapa: hitbox, hover y pulso (bloque UX 1bis)

- **Hitbox 24×24 px invisible** en cada punto del catálogo (`L.divIcon` +
  `.st-hit`), con punto visual de ~6 px que escala al hover: clic fiable con
  alta densidad (antes: circleMarker canvas de radio 1.6 px, inclicable).
- **Tooltip compartido instantáneo** al pasar el cursor: nombre + NORAD, con
  escape HTML y un único objeto `L.Tooltip` reutilizado (no uno por marcador).
- **Pulso**: dos anillos concéntricos CSS (`@keyframes st-pulse`) SOLO en el
  marcador del satélite seleccionado.
- **Trayectoria al seleccionar**: línea translúcida (órbita pasada + proyección
  futura, partida en el antimeridiano), `interactive: false` para no robar clics.
- **Marcadores persistentes con diffing**: cada 15 s solo `setLatLng` y
  altas/bajas; sin `clearLayers()` (menos churn de DOM).
- Fragmentos puros en `src/lib/ui/markers.ts` + tests `map-markers.test.mjs`.
- Pendiente (siguientes incrementos): interpolación `requestAnimationFrame`
  entre cálculos SGP4 y terminador día/noche.

## Iconos SVG por categoría, pulso canónico y rumbo orbital (bloque UX 1ter)

- **SVG minimalista por grupo** (`groupIconSvg` en `lib/ui/markers.ts`): casco
  (tripulados), nube (meteorología), retícula GNSS (nav), átomo (ciencia),
  panel plano (Starlink), parabólica (comms), satélite genérico (otros); el
  color del grupo es el color principal del trazo.
- Marcadores del catálogo y del seleccionado como `L.divIcon` con esos SVG;
  el seleccionado lleva la clase canónica **`.selected-satellite-active`**
  (anillos expansivos translúcidos vía `::before/::after`).
- **Rotación por rumbo orbital**: `bearingDeg()` en `lib/space/propagate.ts`
  (círculo máximo, Δλ normalizada en el antimeridano) entre t y t+1 s; se aplica
  como `transform: rotate(var(--rot))` sobre `.st-ico` sin recrear el icono
  (actualización de variable CSS, coste ~nulo).
- Tests: `map-markers.test.mjs` (SVG único por grupo, color, hitbox, clase) y
  caso de `bearingDeg` (cardinales + antimeridiano) en `orbit-passes.test.mjs`.

## Filtro estricto de TLEs obsoletos (puerta `tle-filter`)

- `src/lib/space/tle-filter.ts`: única fuente de verdad del criterio, aplicada
  en el PARSEO de Ivan/SatNOGS, en el seed y en el fallback → el worker SGP4 y
  el canvas solo ven `activeSatellites`:
  1. Integridad: 69 caracteres + checksum CelesTrak + campos (`validateTle`).
  2. Época: ilegal→`invalid`, futura→`future`, **edad > 30 d → `expired`**
     (`MAX_TLE_AGE_DAYS`, configurable).
  3. Basura orbital → `junk` (bypass por lista de interés `interest`).
  4. Viabilidad: mm ∈ [0.05, 17.6] rev/d (cubre HEO científicas tipo TESS) y
     ecc ≤ 0.9 → `implausible`.
  5. Reingreso: `propagate(…, {communityDecayCheckEnabled:true})` +
     `checkForDecay` → `decayed`.
- `filterActiveSatellites(rows, opts)` devuelve `{ sats, stats }` con
  invariante de auditoría `seen = valid + Σ rechazos`; `gateRow` es pura e
  inyectable (`isDecayed` stub para tests).
- Nuevos contadores en `CatalogStats` y en el chip de métricas de cabecera:
  `expired`, `junk`, `implausible`, `decayed`.
- Seed: `generate-seed.mjs` aplica las mismas puertas al generar (incluida
  caducidad 30 d y propagación); `seedPayload(now)` re-filtra en cada carga
  (si el seed envejece >30 d, el fallback lo dice: «regenera con
  `npm run seed:generate`»).
- Medición real (2026-10-18): de 1949 filas vistas → 234 expiradas y 3
  decaídas descartadas; 1246 satélites únicos vigentes en mapa/worker.

## Empaquetado nativo (Tauri v2 + Capacitor)

- **`src-tauri/tauri.conf.json`** (listo para producción):
  - Ventana HUD: `decorations: false`, `maximized: true`, `minWidth: 1024`,
    `minHeight: 768`, `theme: Dark`, `backgroundThrottling: "disabled"` (el
    rAF/timers del mapa no se congelan al minimizar).
  - Aceleración GPU: WebView2/WKWebView/WebKitGTK componen por hardware por
    defecto (filtros `drop-shadow`/`backdrop-filter` del HUD incluidos); en
    Linux con parpadeo de composición: `WEBKIT_DISABLE_DMABUF_RENDERER=1`.
  - CSP de producción: `connect-src` hacia `tle.ivanstanojevic.me`,
    `db.satnogs.org`, `celestrak.org`, `server.arcgisonline.com` + IPC de
    Tauri (`ipc: http://ipc.localhost`) y HMR de Vite en dev; `img-src` para
    teselas Esri; `worker-src 'self' blob:` para el worker SGP4.
  - `capabilities/default.json`: permisos de ventana para la titlebar propia
    (start-dragging, toggle-maximize, minimize, close, fullscreen).
  - Rust mínimo: `src/main.rs` + `src/lib.rs` (`mobile_entry_point` incluido),
    `Cargo.toml` con perfil release optimizado a tamaño/RAM (`lto`, `opt-level
    = "s"`, `strip`), `build.rs`, iconos generados (32/128/512 png + ico).
- **Scripts**: `npm run dev:native` (`tauri dev`) y `npm run build:native`
  (`tauri build`); `beforeDevCommand`/`beforeBuildCommand` encadenan Vite.
- **Capacitor**: `capacitor.config.json` con StatusBar DARK `#030508`
  `overlaysWebView: true` (inmersivo con safe-areas vía `env()`), SplashScreen
  negro y `androidScheme: https`. Instalación: `npm i @capacitor/core
  @capacitor/cli @capacitor/statusbar && npx cap add android && npm run cap:sync`.
- **Adaptaciones JS/CSS nativas** (`lib/ui/native.ts`): detección
  Tauri/Capacitor, guards de WebView (contextmenu, gesturestart/change,
  ctrl+wheel) activos SOLO en nativo, clase `st-native` en `<html>`, titlebar
  propia con `data-tauri-drag-region` y botones ─  ✕ (`WindowControls`,
  import dinámico de `@tauri-apps/api` → el bundle web no lo carga).

## Bandeja retráctil de telemetría + Glow FX (layout v4)

- **Flight Log como cajón flotante retráctil**: oculto por defecto
  (`translateY(calc(100% + 2rem))`), se abre con ▮ LOG del dock o su cabecera;
  flota SOBRE el dock (`bottom: calc(1rem + var(--dock-zone))`) con altura
  `clamp(160px, 32vh, 260px)` y scroll interno → imposible que se empalme con
  el reproductor de tiempo (ya no ocupa flujo).
- **Zona reservada al dock** (`--dock-zone: 64px`, 104 px en pantallas
  cortas/táctiles): los paneles acotan `max-height: calc(100% - 2rem -
  var(--dock-zone))` con `overflow-y: auto` → latitud/longitud/estado nunca
  quedan bajo el dock ni cortados.
- **Glow FX**: flota en canvas con `drop-shadow` cian (GPU, solo vectores);
  iconos DOM con brillo del color de su grupo (`--g` por marcador); seleccionado
  con destello `#FF6700` en icono, retícula y anillos de pulso
  (`box-shadow` en los anillos); `.hud-panel` con resplandor de acento
  `0 0 14px -6px rgba(255,103,0,.35)` sobre el cristal blur(12px).
- Unidades dinámicas vigentes: `100dvh/100dvw`, `env(safe-area-inset-*)`,
  `clamp()` y breakpoints 1800/1024/900/700 px + `pointer: coarse`.

## Globe: dependencias venderizadas (zip autocontenido)

- `d3-geo@3.1.1` (src ESM), `topojson-client@3.1.0` (src ESM) y
  `world-atlas/land-110m.json` (54 KB) viven en `src/vendor/` con licencias y
  procedencia en `src/vendor/VENDORED.md`; los `import "d3-array"` de d3-geo se
  reescribieron a `d3-array-shim.js` (range/merge/Adder, 40 líneas).
- `package.json` ya NO declara esas dependencias runtime: el zip funciona sobre
  un `node_modules` externo antiguo sin reinstalar nada (regresión cubierta
  por `map-css.test.mjs`: "globo autocontenido").
- Tipado vía `src/vendor/shims.d.ts` (wildcard modules → @types oficiales en
  devDependencies) y `land-110m.json?raw` + `JSON.parse` (sin inferencia TS
  pesada del JSON).

## Globo ortográfico 2D (vista pseudo-3D sin WebGL)

- `components/map/GlobeView.tsx`: globo en proyección ortográfica
  (`d3-geo` + continentes `world-atlas` 110 m embebidos, 54 KB) sobre un único
  canvas: halo atmosférico cian (gradiente radial), océano con sombreado de
  limbo, graticula técnica y continentes con borde cian.
- **Backface culling** matemático (`cos c > 0` en `lib/space/ortho.ts`): flota,
  trayectoria, huella y observador se ocultan en el hemisferio trasero.
- Interacción: arrastre = rotación (pointer events, `touch-action: none`),
  rueda = zoom, click/tap = selección por hit-test de puntos proyectados,
  hover = tooltip; auto-rotación suave en reposo y centrado con lerp si
  `tracked`. Conmutador `◍ GLOBO / ▦ MAPA` en el dock.
- Rendimiento: esfera estática en canvas offscreen cacheada por rotación/zoom
  cuantizadas; frames de flota del mismo Web Worker SGP4 (cubos 2 s); chunk
  perezoso `GlobeView-*.js` (34 kB gzip) que solo se carga al conmutar.
- Seleccionado sobre la esfera: halo pulsante + retícula punteada móvil +
  esquinas de mira en `#FF6700`, coherentes con el HUD.

## Hyper Glow HUD v6 (atmósfera de misión)

- **Hyper glow multicapa**: flota en canvas con doble `drop-shadow` cian
  `(0 0 6px .55)+(0 0 14px .25)`; iconos DOM con los valores pedidos
  `(0 0 8px rgba(0,242,255,.9))+(0 0 20px rgba(0,242,255,.4))`; seleccionado con
  brillo naranja pulsante (`st-glow-pulse`) + **halo expansivo** `.st-halo`
  (`@keyframes pulse-ring`, gradiente radial `#FF6700`).
- **Glassmorphism avanzado** en `.hud-panel`: cristal `rgba(2,6,15,.85)` +
  `backdrop-filter: blur(16px)` + borde 1 px por gradiente (padding-box/
  border-box naranja→cian) + resplandor superior + esquinas biseladas
  naranjas/cian vía `::before/::after`; fallback `prefers-reduced-transparency`.
- **Retículas y órbitas**: retícula y barrido del radar con `spin-slow 20s
  linear infinite`; huella con gradiente radial SVG y anillo punteado
  rotatorio; pulso de energía `st-energy` en el punto que recorre la órbita.
- **Micro-animaciones**: glitch de 1 frame (`st-flicker`, 140 ms) en alt/vel/
  lat/lon al actualizarse (vía `key=` en el `<b>`); hover global con expansión
  de brillo y viraje a naranja en botones/chips/tarjetas.
- Rendimiento: solo `transform/opacity/filter` animados; blur en 5 paneles
  estáticos; glow de flota en una única pasada del canvas.

## Modo Kiosco / Pantalla completa (F11)

- Hook `lib/ui/useKioskMode.ts`: captura `F11` y el alias táctico `F`/`f`
  (preventDefault; `F` se ignora dentro de inputs/textarea/select/
  contentEditable mediante `isTypingTarget`, y nunca actúa con Ctrl/Meta/Alt),
  detecta Tauri v2 por el global `__TAURI__` (`setFullscreen/isFullscreen`,
  sin `@tauri-apps/api` en el bundle web) y en web usa la Fullscreen API con
  sincronía vía `fullscreenchange`. El estado `isFull` es único: el botón del
  Header refleja el cambio use la vía que use.
- `tauri.conf.json`: ventana con `decorations: false` + `fullscreen: true`
  (arranque inmersivo); ACL con `core:window:allow-set-fullscreen` y
  `allow-is-fullscreen` ya presentes en `capabilities/default.json`.
- Header: conmutador `[ F11 ] FULLSCREEN / KIOSK ON` con brillo naranja
  `#FF6700` cuando está activo (`.st-kiosk.on`).
- Tests: `kioskSupported()` false en SSR, humo del Header con el conmutador y
  regresión CSS del glow activo.

## HUD vivo v5: punteros tácticos, crosshair, huella dinámica y telemetría viva

- **Puntero táctico** (tier DOM): anillo *radar-ping* intermitente escalonado
  por NORAD (`--pd`), icono SVG con glow del color de grupo (`--g`), badge ★ y
  **etiqueta inteligente** del nombre (visible con zoom ≥ 5 o en hover).
- **Crosshair del seleccionado**: 4 esquinas biseladas naranjas con destello
  escalonado (`st-flash`) sobre la retícula giratoria y los anillos de pulso.
- **Huella dinámica**: renderer SVG propio con `<radialGradient>` inyectado
  (`.st-footprint { fill: url(#stFootGrad) }`) + anillo punteado rotatorio
  (`stroke-dashoffset` animado); sigue `interactive: false`.
- **Órbita estilizada**: 3 trazos con fade de opacidad hacia el pasado
  (0.12/0.28/0.55) + **pulso lumínico naranja** que recorre el tramo futuro en
  rAF (un solo nodo, 6 s por órbita).
- **Telemetría viva**: valores de alt/vel/lat/lon con efecto *scramble*
  (`useScramble`, 420 ms, SSR-safe) y chips industriales en el dock:
  `SGP4 WORKER|SYNC` (info real del FleetClient), `TLE nn%` (valid/seen de la
  ingesta) y `FPS nn` medido con rAF (`useFps`), con parpadeo verde/ámbar.
- Multiplataforma sin cambios regresivos: 100dvh, safe-areas, HW accel nativa
  (Tauri) y filtros GPU ya vigentes.

## Layout adaptativo de 3 zonas (anti-colisiones, 100dvh)

- Flujo vertical: `Header (flex-shrink:0)` → `.st-viewport (flex:1, min-height:0,
  position:relative)` → `Consola (flex-shrink:0)`. Todo flotante se ancla a la
  zona intermedia: **imposible** que la cabecera tapie el drawer o que la
  consola corte los paneles (causa raíz de los solapes anteriores: offsets
  manuales contra alturas estimadas).
- Paneles acotados: `top/left/right: 1rem` + `max-height: calc(100% - 2rem)` +
  `overflow-y: auto` (scroll interno con scrollbar estilizado); el Observador
  ya no se corta: vive dentro del scroll del panel de misión.
- Command Dock: `bottom: 1rem; left: 50%; translateX(-50%); z-20; max-width: 90vw;
  flex-wrap: wrap`; en <700 px la atribución de Leaflet pasa a la izquierda y
  el status del dock se oculta para evitar empalmes.
- Breakpoints compactos `@media (max-width:1024px), (max-height:768px)`:
  métricas 12.5 px, paddings de tarjeta reducidos, radar 200 px, órbita a una
  columna; paneles colapsables con « / ⛶ (cerrados por defecto).

## Command Dock v3 + filtro GPU de teselas (rediseño final)

- **Filtro GPU único** en el contenedor de teselas (no por capa, para evitar
  doble atenuación y mantener una sola pasada de composición):
  `.leaflet-tile-pane { filter: brightness(0.65) contrast(1.25) saturate(0.4) }`
  + `.leaflet-container { background-color: #030508 !important }`. Satélites,
  órbitas y retículas quedan FUERA del filtro → destacan al máximo.
- **`.hud-panel` compartido** (glassmorphism eficiente): `rgba(3,5,8,.75)` +
  `backdrop-filter: blur(12px)` + borde `1px rgba(255,255,255,.08)`, aplicado a
  panel de misión, drawer de detalles, Command Dock, popover CAPAS y consola.
  Paneles con `will-change: transform` y animación solo de `transform`
  (translateX/Y, 0.3 s ease) → 60 fps sin reflow.
- **Command Dock** unificado: timebar + ◧ CAPAS + ▮ LOG + **estados del
  sistema** (badge LIVE/SEED y conteo de flota) en una única barra central;
  bordes inferiores del mapa liberados (consola y dock son tarjetas flotantes
  con margen de 8 px).
- Panel de misión **cerrado por defecto** en todo viewport: el mapa respira a
  pantalla completa desde el primer arranque (pestaña « o ⛶ para abrirlo).
- Coberturas (huella/órbita/terminador) siguen `interactive: false` +
  `bubblingMouseEvents: false` y el blindaje `pointer-events: none !important`
  (regresión cubierta por tests).

## HUD flotante full-viewport v2 (diseño de misión)

- **Sin paneles rígidos**: mapa 100 vw×100 vh en `z-1`; el panel de misión
  izquierdo es un drawer flotante (cerrado por defecto en <1024 px) y el de
  detalles está **completamente oculto** hasta seleccionar satélite: entonces
  entra con slide-in y glassmorphism (`blur(14px)`, borde 1 px, esquinas con
  retícula `.st-corners`). Al cerrar, desliza fuera conservando el último
  satélite para la animación.
- **Dock inferior central** (`components/hud/Dock.tsx`): una sola barra con la
  línea de tiempo, el menú desplegable **◧ CAPAS** (base Esri, overlays
  rótulos/terminador y categoría con iconos SVG — sustituye a la leyenda
  flotante y a `L.control.layers`) y el acceso **▮ LOG** a la consola.
- **Tiles desaturados** para que órbitas/satélites/brillo dominen:
  `.st-base-desat` (saturate .55), `.st-labels-dim` (grayscale .7) y
  `.satellite-dark-mode` reforzado (brightness .62 / saturate .5).
- **Multiplataforma**: `viewport-fit=cover` + `env(safe-area-inset-*)` en
  cabecera, paneles, dock y consola; `overscroll-behavior: none`; breakpoints
  1800 px (ultra-wide), 900/700 px (drawer→bottom-sheet táctil) y
  `@media (pointer: coarse)` con objetivos ≥38 px; Leaflet conserva pinch-zoom
  y tap nativos (tolerancia canvas 12 px) sin conflictos con el HUD flotante.
- Observador migrado al panel de misión izquierdo; el botón ⛶ ahora conmuta
  ese panel (Modo Teatro).

## Corrección de intercepción de eventos + layout full-viewport

- **Coberturas no interactivas**: huella (`L.circle`), órbita (`L.polyline`) y
  terminador (`L.polygon`) se crean con `interactive: false` y
  `bubblingMouseEvents: false` (el bug crítico era la huella sin `interactive`).
  Doble seguridad CSS: `.leaflet-overlay-pane > svg { pointer-events: none
  !important }` (con restitución `visiblePainted !important` solo para paths
  `.leaflet-interactive`), anillos/retícula/tooltip con `pointer-events: none
  !important`. El canvas de Leaflet **conserva** sus eventos: el hit-testing
  por software de la flota los necesita (ver test que lo prohíbe cegar).
- **Layout full-viewport**: `.st-app { position: fixed; inset: 0 }`; el mapa
  ocupa el 100 % (`st-map-area` absolute inset 0, **z-index 1**); catálogo y
  detalle flotan como paneles HUD **z-10** (translateX animado .3s para el
  Modo Teatro); cabecera y consola **z-20**; pestañas **z-15**. Los controles
  de Leaflet (zoom, capas) y leyenda/timebar se desplazan con variables
  `--left-w/--right-w/--console-h/--header-h` para no quedar tapados.
  Créditos movidos a la tagline de cabecera (desaparece la franja de pie).
- Regresión cubierta en `map-css.test.mjs` (7 casos): opciones de capas,
  pointer-events estrictos, canvas no cegado y jerarquía de z-index.

## Renderizado híbrido por tiers (corrección visual post-optimización)

- **Tier 1 — seleccionado** (1 nodo DOM): divIcon con SVG de categoría,
  retícula HUD giratoria, anillos de pulso y rotación por rumbo.
- **Tier 2 — favoritos + categoría activa** (≤ `MAX_DOM_MARKERS = 150`):
  divIcon interactivos con SVG detallado y badge ★ de favorito; la categoría
  activa se fija **clicando en la leyenda** del mapa (evento SYS en consola y
  WARN si se supera el tope → el excedente sigue en canvas).
- **Tier 3 — fondo** (el resto de la flota): circleMarker en `L.canvas()`.
- Transiciones entre tiers sin fugas: el sync crea/degrada/promueve marcadores
  por diferencia; los frames del worker alimentan ambos tiers.
- Regresión CSS cubierta por `scripts/map-css.test.mjs`: existencia de
  selectores HUD, ausencia de `display:none/visibility:hidden` sobre iconos,
  `pointer-events` correctos (retícula no, hitbox sí) y vigencia del híbrido
  divIcon+canvas en MapView.

## Arquitectura de rendimiento (flota masiva)

- **SGP4 en Web Worker** (`src/workers/sgp4.worker.ts` + cliente
  `lib/space/fleet-worker-client.ts`): protocolo `postMessage`
  (`init` catálogo → `compute {seq,tMs}` → `positions {seq,tMs,data,ids}`) con
  **Float64Array/Int32Array transferibles (zero-copy)**. El cómputo puro vive en
  `lib/space/fleet-compute.ts` (STRIDE=6: lat, lon, alt, vel, bearing, ok) y lo
  comparten worker y fallback síncrono (SSR/tests/sin Worker). Semántica
  *latest-wins*: un pedido nuevo descarta el pendiente → nunca hay backlog.
  Caché de SatRecs dentro del worker (clave `id:line1:line2`).
- **Canvas forzado** (`renderer: L.canvas({ tolerance: 12 })`): la flota son
  `circleMarker` (cero nodos DOM/SVG, un solo canvas); `tolerance: 12` da
  hitbox cómoda de click/hover. Marcadores DOM solo para seleccionado (icono
  SVG + retícula HUD) y observador. Trade-off aceptado: el icono SVG por
  categoría y la rotación por rumbo quedan para hover (tooltip con SVG) y para
  el seleccionado; la flota se distingue por color + leyenda.
- **Throttling**: flota en cubos de `FLEET_UPDATE_MS = 2000` ms (+ post-limit
  250 ms con cola final durante el scrub); detalle/seleccionado 1 s;
  terminador 1 min; curva del Sky Radar en cubos de 60 s; consola fuera del
  ciclo de render del mapa.
- `ok=0` (TLE que SGP4 rechaza, p. ej. Starlink muy degradados) → el marcador
  se oculta en canvas en vez de pintar basura.

## Modo Teatro y Línea de Tiempo (bloque UX 2)

- **Modo Teatro**: pestañas flotantes en los bordes del mapa («/») colapsan los
  paneles izquierdo/derecho de forma independiente; botón ⛶ en la cabecera los
  conmuta simétricos. Estado persistido (`spacetracker:panels:v1`).
  La rejilla anima `grid-template-columns/rows` con `transition: .3s ease` y un
  `ResizeObserver` sobre el contenedor del mapa llama `map.invalidateSize()`
  en cada frame de la transición (sin marcadores rotos ni saltos).
- **Línea de tiempo** (`components/time/TimeBar.tsx` + helpers puros en
  `lib/ui/timecontrol.ts`): ⏸ Pausa · ▶ Tiempo real · −1h · +1h · slider ±24 h.
  El tiempo de cálculo SGP4 (`now`) pasa a ser `realNow` (live) o un instante
  congelado; el arrastre del slider hace *scrub* de toda la flota al instante
  (coalescido con `requestAnimationFrame`; repintado de puntos con throttle
  250 ms + cola final). Lectura con badge `EN VIVO` / `SIM ±Xh` y reloj en la
  zona horaria del observador.
- Tests: `time-sim.test.mjs` (ventana, redondeo, acotado, etiquetas) y humo UI
  de la TimeBar (congelada y en vivo) + botón de teatro.

## Consola de Telemetría y Radar de Cielo Local (bloque HUD 2)

- **Flight Log** (`components/console/TelemetryConsole.tsx` + bus
  `lib/ui/telemetry-log.ts`): cajón inferior colapsable (34 px → 220 px,
  `transition: height .3s ease`) con flujo de eventos `hh:mm:ssZ [NIVEL] msg`:
  `SYS` gris técnico, `ORBIT` cian, `TLE` verde, `WARN`/`ALRT` naranja SpaceX
  (ALRT parpadea). Filtros por nivel, CLEAR, auto-scroll anclable y reloj UTC.
  El buffer vive fuera de React (singleton, tope 400/200): **solo la consola se
  re-renderiza** con cada evento. Fuentes de eventos reales: sync TLE al
  arrancar (con warns de SatNOGS/Ivan y ALRT de fallback seed), selección
  (`orbitParams`+`getFix`), observador, cambios de tiempo (live/frozen/±1h),
  radar personal, telemetría periódica 60 s del seleccionado y anuncios de
  pase (AOS/próximo) deduplicados.
- **Sky Radar** (`components/orbit/SkyRadar.tsx`): diagrama polar SVG
  azimut/elevación (borde 0°, anillos 30/60, cenit 90°; cardinales N/E/S/W con
  N en naranja), curva del pase en curso (sólida cian) y futuro (discontinua),
  punto vivo naranja con glow, barrido decorativo (spin 6 s) y lectura
  interactiva az/el al mover el cursor. Curva memoizada en cubos de 60 s; el
  tick de 1 s solo recalcula un `lookAngles`. Se renderiza en el panel derecho
  únicamente con satélite seleccionado + observador configurado.

## Pulido pro: flyTo, hotkeys, terminador y exportación (bloque HUD 3)

- **flyTo**: al seleccionar (lista o mapa) la cámara vuela al satélite
  (`map.flyTo`, zoom suave ≥ 4, 1.25 s) y queda **centrado mientras orbita**
  (`panTo` animado sincronizado al tick); el seguimiento se activa al
  seleccionar y se libera automáticamente si el operador arrastra el mapa
  (`dragstart` → `onUserPan`).
- **Hotkeys de operador** (`lib/ui/hotkeys.ts` + listener global en App,
  ignorados dentro de inputs/textareas/selects/contentEditable y con
  modificadores): `Espacio` pausa/reanuda tiempo real · `/` foco a la
  búsqueda · `ESC` deselecciona y cierra la consola (o blur si se teclea) ·
  `←`/`→` ciclan favoritos con envoltura.
- **Terminador solar** (`terminatorPolygon` en propagate.ts): anillo día/noche
  por círculo mayor (tan φ = −cos H / tan δ, cierre por el polo en noche),
  overlay conmutable «Terminador día/noche» activo por defecto, recalculado
  1 vez/min (93 puntos); relleno negro translúcido + borde cian punteado.
- **Exportación CSV** (`lib/ui/export-passes.ts`): botón «⭳ CSV» en «Pasos
  sobre [ubicación]» descarga las 24 h (AOS/TCA/LOS UTC, maxEl, azimuts,
  duración, metadatos `#` y entrecomillado RFC 4180); evento SYS en el Flight Log.

## Hoja de ruta UX (bloques siguientes)

- **Bloque 2 — Catálogo enriquecido**: insignias por grupo (cohete/clima/comms…),
  filtros combinados rápidos (altitud, inclinación, activo/inactivo) calculados
  desde `orbitParams`/`checkForDecay` sin degradar el render.
- **Bloque 3 — Panel contextual**: sin selección → «Resumen Global en Vivo»
  (stats de pases del observador, satélites visibles ahora); con selección →
  tarjetas de telemetría inmediatas (velocidad, altitud, próxima ventana visible).
- **Bloque 4 — Búsqueda y limpieza**: autocompletado con sugerencias populares
  (ISS, Starlink…) y leyenda del mapa colapsable.
- **Bloque 5 — Movimiento fluido**: interpolación `requestAnimationFrame` de
  posiciones entre recalculos SGP4 (solo seleccionado/seguimiento por coste).
- **Bloque 6 — Terminador día/noche**: capa translúcida de sombra terrestre en
  tiempo real (polígono calculado desde `sunPos`).

## Tema visual "Mission Control"

- Tokens en `:root`: fondo negro absoluto `#030508`, acento SpaceX `#FF6700`
  (`--accent`) y `#FF8C00` (`--accent-soft`), texto crítico `#FFFFFF`, gris
  técnico `#94A3B8` (`--muted`), borde HUD `#1E293B` (`--line`).
- Telemetría monoespaciada (JetBrains Mono con fallback local): altitud,
  velocidad, coordenadas, relojes, tablas de pases, TLE y contadores
  (regla global sobre `.st-metrics b`, `.st-orbit-params dd`, `.st-passes td`,
  `.st-timebar-clock`, `.st-tle code`, `.st-prov-meta`…).
- Paneles HUD de cristal oscuro: `backdrop-filter: blur`, borde 1 px
  `#1E293B`, esquinas biseladas con `clip-path: var(--bevel)` y barra de
  acento naranja degradada en el borde superior (`::before`).
- Mapa: fondo `#030508`, órbita y huella en cian translúcido `#22d3ee`,
  cursor `crosshair`, y el satélite seleccionado lleva **retícula de mira HUD**
  (`.st-reticle`: `border: 1px dashed #FF6700; border-radius: 50%;
  animation: st-spin 10s linear infinite`) más los anillos de pulso.

## Puesta en marcha

```bash
npm install
npm run dev        # http://localhost:5173 (incluye /api/catalog server-side)
npm run typecheck  # tsc --noEmit
npm test           # suite offline (59 tests)
npm run test:live  # suite contra las APIs reales (RUN_LIVE=1)
npm run build      # dist/ (ver "Fallo de build conocido" más abajo)
npm run preview    # sirve dist/ (sin /api/catalog: el cliente cae a Ivan directo o seed)
npm run seed:generate  # regenera el catálogo seed con TLEs frescos
```

## Arquitectura

```
src/lib/space/           dominio puro (sin DOM)
  types.ts               Sat, GroupId, CatalogStats, Observer, CatalogPayload, Fix, Pass…
  tle-validation.ts      validateTle(id, line1, line2): estructura + checksum
  tle-epoch.ts           diagnoseTleEpoch: fresh/aging/stale/future/invalid
  groups.ts              groupOf/junk/accept + consultas curadas de Ivan
  propagate.ts           SGP4: caché SatRec (clave id:line1:line2), Fix, órbita,
                         trayectoria, huella, ángulos, pasos, info solar
  load-catalog.ts        ingesta Ivan + SatNOGS con métricas por fuente
  seed.ts + seed-data.json  catálogo de respaldo (29 TLEs reales, 7 grupos)
  catalog.server.ts      caché SSR, fallback seed, mezcla live+seed (procedencia)
  catalog.client.ts      cascada navegador: /api/catalog → Ivan directo → seed
src/components/          Header, Sidebar, map/MapView, orbit/SatDetail,
                         observer/ObserverPanel
src/lib/ui/              format, persistence, places, colors, tiles (capas base
                         Esri sin API key + selector oscuro/satelital)
scripts/                 tests node --test + generador de seed + fixtures reales
vite.config.ts           plugin /api/catalog (ssrLoadModule) + arreglo del build
```

### Semántica de métricas (Etapa 2, obligatoria)

- `seen` / `seenBySource`: **filas recibidas** por fuente.
- `valid` / `bySource`: **candidatos aceptados** (estructura OK + época no futura
  ni inválida + no junk + pasa filtro de consulta). No deduplicados.
- `fresh + aging + stale === valid`: invariante garantizada porque las
  etiquetas de época se cuentan **solo sobre candidatos aceptados**.
- `invalid`: filas con estructura/época ilegibles. `future`: rechazadas por época futura.
- `failedBySource`: **peticiones HTTP fallidas** (red, timeout/abort, no-2xx,
  cuerpo no-JSON). Regla única anti-duplicado: cada petición se cuenta una sola
  vez, en el `catch` de la función dueña de la petición; workers y agregadores
  no recountan. Un timeout global cuenta como fallo de cada petición en vuelo.
- Satélites únicos: `payload.sats.length` (deduplicación por NORAD, Ivan gana).

### Particularidades de las fuentes (verificadas el 2026-10-18)

- **Ivan** (`tle.ivanstanojevic.me`): envía `Access-Control-Allow-Origin: *`
  (usable desde navegador). La paginación `?page=` responde **508 "Resource
  Limit" con HTML** → no se pagina; se usan búsquedas paralelas curadas
  (`IVAN_QUERIES`) con reintento/backoff y tolerancia a respuestas no-JSON.
- **SatNOGS** (`db.satnogs.org`): **sin cabeceras CORS** → solo utilizable vía
  servidor (middleware `/api/catalog` en dev). Su campo `norad_cat_id` es el ID
  NORAD (no categorías); la agrupación se hace por patrones de nombre.
  Hoy devuelve ~1733 filas y ~13 % con TLE estructuralmente inválido (datos
  reales sucios: se contabilizan en `invalid`, nunca en `failedBySource`).

### Fallo de build conocido de satellite.js — DIAGNOSTICADO Y RESUELTO

Síntoma original (handoff §5): `npm run build:dev` fallaba por "el worker
WASM/pthreads de satellite.js y top-level await en la salida IIFE".

Diagnóstico real reproducido aquí con Vite 7.3.7 + satellite.js 7.1.0:

1. `satellite.js` v7 es ESM-only y `dist/index.js` re-exporta estáticamente
   `./wasm/index.js`, cuyos runtimes hacen `await import('#wasm-single-thread'
   | '#wasm-multi-thread')` → salidas Emscripten (`wasm-build/…`) con
   top-level await y creación de Workers pthread.
2. El plugin **`vite:worker-import-meta-url`** detecta los patrones
   `new Worker(… import.meta.url)` del código Emscripten y compila esos chunks
   de worker con `worker.format`, que **por defecto es `"iife"`** — formato que
   no admite top-level await. Error exacto:
   `Module format "iife" does not support top-level await`.

Solución aplicada (en `vite.config.ts`, comentada in situ) — **mínima, aislada
experimentalmente y confirmada aguas arriba** en
[shashwatak/satellite-js#165](https://github.com/shashwatak/satellite-js/issues/165)
(mismo error en Vite 8/Rolldown; fix confirmado por el autor del issue) y
relacionado con [vitejs/vite#22362](https://github.com/vitejs/vite/issues/22362):

```ts
worker: { format: "es" },
```

Ni `commonjsOptions` ni `treeshake` especiales son necesarios (se probaron: no
resuelven el fallo por sí solos y el build pasa sin ellos una vez fijado
`worker.format`). El chunk WASM queda emitido como import dinámico perezoso
(~308 kB) que la app **nunca carga** (no usa `BulkPropagator` ni los runtimes
WASM). Para portar el arreglo al repositorio original: kit listo en
`auditoria/parche-build/` (script con dry-run + respaldo + documentación).

## Tests

Suite offline por defecto (`npm test`): 59 tests.

| Archivo | Cubre |
|---|---|
| `tle-validation.test.mjs` | 19 fixtures reales + corruptos (checksum, longitud, IDs, prefijos, campos) |
| `tle-epoch.test.mjs` | ventana de siglo, bisiestos, fronteras fresh/aging/stale con épsilon, future/invalid |
| `orbit-passes.test.mjs` | órbita/posición coherentes, **regresión Etapa 1** (caché invalidada al cambiar TLE), trayectoria, huella, pasos (AOS<TCA<LOS), solar |
| `live-catalog-epoch.test.mjs` | ingesta rechaza épocas futuras, conserva stale, distribución fresh/aging/stale |
| `catalog-sources.test.mjs` | caída de SatNOGS (nota real, sin `|| true`), ambas caídas, vacío, 508 HTML, invariantes, junk, duplicados, búsqueda |
| `catalog-fallback.test.mjs` | procedencia live/seed, merge (live gana), compleción de grupos, caché+invalidación, sanidad del seed |
| `ui-smoke.test.mjs` | render SSR de Header/Sidebar/SatDetail/ObserverPanel con datos reales |

Suite live (`npm run test:live`): ingesta real de extremo a extremo. Resultado
del 2026-10-18: 1473 únicos (Ivan 222 + SatNOGS 1286), vistos 1969, válidos
1508 = fresh 1207 + aging 37 + stale 264, inválidos 231, futuros 0, fallos 0.

Las fixtures (`scripts/fixtures.mjs`) son TLEs reales descargados de SatNOGS e
Ivan el 2026-10-18, verificados (69 columnas + checksum). Si envejecen, los
tests siguen pasando (las etiquetas fresh/aging/stale se filtran en tiempo de
ejecución); regenerar con `npm run seed:generate` si se quiere datos del día.

## Limitaciones conocidas

- Los tiles del mapa requieren conexión (servidores Esri); sin red, el mapa
  muestra el fondo oscuro y las capas vectoriales (satélites, trayectoria,
  huella) siguen funcionando. CARTO quedó descartado el 2026-10-18: sus tiles
  públicas sirven hoy marca de agua "API KEY REQUIRED" (verificado visualmente).
- `/api/catalog` solo existe en `npm run dev` (middleware de Vite). En hosting
  estático el cliente usa la cascada: Ivan directo (CORS *) + seed.
- El seed envejece: regenerar periódicamente con `npm run seed:generate`.
- La predicción de pasos usa muestreo + bisección (precisión ~0.1 s); pasos
  rasantes pueden omitirse con umbrales de elevación altos.
- satellite.js v7 trae API WASM de propagación masiva (`BulkPropagator`, 3–12×
  más rápida) y `checkForDecay` para satélites decaídos: mejoras futuras
  opcionales, fuera del alcance actual.
