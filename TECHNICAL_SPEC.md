# SpaceTracker - Especificación Técnica

> Documento técnico para agentes de IA y desarrolladores que necesitan implementar mejoras en el proyecto.

---

## 1. Visión General

**SpaceTracker** es una aplicación web para explorar satélites artificiales utilizando datos orbitales TLE (Two-Line Element sets). Proporciona:

- Catálogo de satélites agrupado por misión
- Propagación SGP4 en tiempo real (vía `satellite.js`)
- Mapa interactivo con trayectorias y huellas orbitales
- Vista de globo ortográfico 2D (pseudo-3D sin WebGL)
- Detalle orbital completo de cada satélite
- Cálculo de pasos sobre un observador terrestre
- Sistema de favoritos con listas personalizadas
- Búsqueda por nombre o número NORAD
- Modo kiosco/pantalla completa
- Empaquetado nativo (Tauri v2 para desktop, Capacitor para móvil)

**Versión:** 1.0.0  
**Fecha de reconstrucción:** 2026-10-18

---

## 2. Stack Tecnológico

### 2.1 Core

| Tecnología | Versión | Propósito |
|------------|---------|-----------|
| **Node.js** | ≥20.19 | Entorno de ejecución (satellite.js v7 requiere ≥20.19) |
| **React** | 19.0.0 | Framework UI |
| **TypeScript** | 5.9.0 | Tipado estático |
| **Vite** | 7.0.0 | Build tool y dev server |

### 2.2 Dominio Espacial

| Tecnología | Versión | Propósito |
|------------|---------|-----------|
| **satellite.js** | 7.1.0 | Propagación orbital SGP4/SDP4 (ESM-only) |
| **Leaflet** | 1.9.4 | Mapa interactivo (tiles Esri) |

### 2.3 Desktop/Móvil

| Tecnología | Versión | Propósito |
|------------|---------|-----------|
| **Tauri** | 2.12.3 | Empaquetado desktop (Rust + WebView) |
| **Capacitor** | 8.5.3 | Empaquetado móvil (Android/iOS) |

### 2.4 Utilidades

| Tecnología | Versión | Propósito |
|------------|---------|-----------|
| **pngjs** | 7.0.0 | Procesamiento de imágenes |
| **d3-geo** | 3.1.1 | Proyecciones geográficas (vendedorizado) |
| **topojson-client** | 3.1.0 | Geometría de mapas (vendedorizado) |

---

## 3. Arquitectura del Código

### 3.1 Estructura de Directorios

```
src/
├── App.tsx                    # Componente raíz de la aplicación
├── main.tsx                   # Punto de entrada
├── styles.css                 # Estilos globales (tema HUD)
├── components/                # Componentes React
│   ├── Header.tsx            # Cabecera con controles globales
│   ├── Sidebar.tsx           # Panel lateral de catálogo
│   ├── console/              # Consola de telemetría
│   ├── hud/                  # Componentes HUD (dock, paneles)
│   ├── map/                  # Mapa Leaflet y globo ortográfico
│   ├── observer/             # Panel de observador
│   ├── orbit/                # Panel de detalle orbital
│   └── time/                 # Control de tiempo (simulación)
├── lib/                      # Lógica de negocio (sin React)
│   ├── space/                # Dominio espacial (puro)
│   │   ├── types.ts          # Tipos del dominio
│   │   ├── tle-validation.ts # Validación de TLEs
│   │   ├── tle-epoch.ts      # Diagnóstico de época TLE
│   │   ├── tle-filter.ts     # Filtro de TLEs obsoletos
│   │   ├── groups.ts         # Agrupación de satélites
│   │   ├── propagate.ts      # Propagación SGP4
│   │   ├── ortho.ts          # Matemáticas globo ortográfico
│   │   ├── load-catalog.ts   # Ingesta de catálogo (Ivan + SatNOGS)
│   │   ├── catalog.server.ts # Caché SSR del catálogo
│   │   ├── catalog.client.ts # Cliente navegador del catálogo
│   │   ├── seed.ts           # Datos semilla offline
│   │   ├── seed-data.json    # TLEs semilla (29 satélites)
│   │   ├── fleet-compute.ts  # Cómputo de flota (worker)
│   │   └── fleet-worker-client.ts # Cliente del worker SGP4
│   └── ui/                   # Utilidades UI
│       ├── favorites.ts      # Gestión de listas de favoritos
│       ├── markers.ts        # Generación de marcadores de mapa
│       ├── timecontrol.ts    # Control de tiempo
│       ├── telemetry-log.ts  # Bus de eventos de consola
│       ├── hotkeys.ts        # Atajos de teclado
│       ├── export-passes.ts  # Exportación CSV de pases
│       ├── native.ts         # Adaptaciones Tauri/Capacitor
│       └── useKioskMode.ts   # Hook de modo kiosco
├── workers/                   # Web Workers
│   └── sgp4.worker.ts        # Worker de propagación SGP4
├── vendor/                    # Dependencias venderizadas
│   ├── d3-geo/               # d3-geo ESM
│   ├── topojson-client/      # topojson-client ESM
│   ├── world-atlas/          # GeoJSON continentes (110m)
│   └── VENDORED.md           # Licencias y procedencia
└── vite-env.d.ts            # Tipos Vite

scripts/                       # Tests y utilidades
├── *.test.mjs                # Suites de test (node --test)
├── generate-seed.mjs         # Generador de catálogo semilla
├── generate-agent-context.cjs # Generador de contexto para IA
├── fixtures.mjs              # Fixtures de TLEs reales
└── _load.mjs, _mocks.mjs     # Utilidades de test

android/                       # Proyecto Android (Capacitor)
src-tauri/                     # Proyecto Desktop (Tauri)
```

### 3.2 Principios de Arquitectura

1. **Separación de dominio:** `src/lib/space/` contiene lógica pura sin dependencias de React o DOM
2. **Web Worker para cómputo intensivo:** La propagación SGP4 de la flota completa se ejecuta en un worker separado
3. **Cascada de fuentes de datos:** API del servidor → Ivan directo → seed offline
4. **Renderizado híbrido por tiers:** Canvas para fondo (rendimiento), DOM para seleccionado/favoritos (interactividad)
5. **Estado en React:** Sin gestor externo (useState/useContext en componentes)

---

## 4. Módulos Principales

### 4.1 Dominio Espacial (`src/lib/space/`)

#### `types.ts`
Define los tipos principales:
- `Sat`: Satélite con id, nombre, grupo, líneas TLE
- `GroupId`: Identificador de grupo (crew, weather, nav, science, starlink, comms, other)
- `CatalogStats`: Métricas de ingesta (seen, valid, fresh, aging, stale, expired, junk, implausible, decayed)
- `Observer`: Observador terrestre (lat, lon, alt)
- `Fix`: Posición orbital (lat, lon, alt, vel, bearing)
- `Pass`: Paso sobre observador (AOS, TCA, LOS, maxEl)

#### `tle-validation.ts`
Valida integridad de TLEs:
- Longitud exacta de 69 caracteres
- Checksum CelesTrak
- Campos requeridos (line1, line2)
- Coherencia de IDs

```typescript
validateTle(id: string, line1: string, line2: string): boolean
```

#### `tle-epoch.ts`
Diagnostica antigüedad de la época del TLE:
- `fresh`: < 7 días
- `aging`: 7-30 días
- `stale`: > 30 días
- `future`: época en el futuro
- `invalid`: época ilegible

```typescript
diagnoseTleEpoch(line1: string): EpochStatus
```

#### `tle-filter.ts`
**Puerta única de filtrado de TLEs obsoletos** (aplicada en parseo, seed y fallback):

Criterios (en orden):
1. **Integridad:** `validateTle` → `invalid`
2. **Época:** `diagnoseTleEpoch` → `future`/`expired` (> 30 días)
3. **Basura orbital:** Patrones de nombre → `junk` (bypass via lista `interest`)
4. **Viabilidad:** Mean motion ∈ [0.05, 17.6] rev/d y excentricidad ≤ 0.9 → `implausible`
5. **Reingreso:** `propagate` con `communityDecayCheckEnabled` → `decayed`

```typescript
filterActiveSatellites(rows: TleRow[], opts?: FilterOptions): { sats: Sat[], stats: CatalogStats }
gateRow(row: TleRow, opts?: FilterOptions): SatStatus
```

#### `propagate.ts`
Wrapper sobre `satellite.js`:
- Caché de SatRecs (clave `id:line1:line2`)
- Cálculo de posición (`Fix`)
- Trayectoria orbital (pasado + futuro)
- Huella orbital (círculo de visibilidad)
- Ángulos de elevación/azimut
- Pasos sobre observador
- Posición solar (terminador día/noche)

```typescript
propagate(sat: Sat, date: Date): Fix
getTrajectory(sat: Sat, startDate: Date, duration: number): Fix[]
getFootprint(sat: Sat, date: Date): LatLng[]
getPasses(sat: Sat, observer: Observer, startDate: Date, duration: number): Pass[]
```

#### `ortho.ts`
Matemáticas de la proyección ortográfica (globo 2D):
- Proyección de lat/lon a x/y canvas
- Backface culling (`cos c > 0`)
- Rotación de la esfera (drag X/Y)
- Hit-testing de puntos proyectados

```typescript
project(lat: number, lon: number, rotation: Rotation): Point
inverseProject(x: number, y: number, rotation: Rotation): LatLng
isVisible(lat: number, lon: number, rotation: Rotation): boolean
```

#### `load-catalog.ts`
Ingesta de catálogo desde fuentes externas:
- **Ivan** (`tle.ivanstanojevic.me`): API con CORS, búsquedas curadas por grupo
- **SatNOGS** (`db.satnogs.org`): API sin CORS (requiere servidor), ~1733 filas
- Manejo de paginación, timeouts, respuestas no-JSON (508 HTML)

```typescript
loadCatalogFromIvan(queries: string[]): Promise<CatalogPayload>
loadCatalogFromSatNOGS(): Promise<CatalogPayload>
```

#### `catalog.server.ts`
Caché SSR del catálogo (ejecutado en dev server via `ssrLoadModule`):
- Mezcla live + seed
- Fallback si fuentes fallan
- Métricas por fuente

```typescript
getCatalog(): Promise<CatalogPayload>
```

#### `catalog.client.ts`
Cascada en el navegador:
1. `/api/catalog` (dev server)
2. Ivan directo (si CORS disponible)
3. Seed offline

```typescript
loadCatalog(): Promise<CatalogPayload>
```

#### `seed.ts` + `seed-data.json`
Catálogo de respaldo offline (29 TLEs reales, 7 grupos):
- Se regenera con `npm run seed:generate`
- Se re-filtra al cargar (si envejece >30 días)

#### `fleet-compute.ts`
Cómputo de flota para el worker:
- STRIDE=6: lat, lon, alt, vel, bearing, ok
- Float64Array/Int32Array transferibles (zero-copy)
- Caché de SatRecs dentro del worker

```typescript
computeFleet(sats: Sat[], tMs: number[]): Float64Array
```

#### `fleet-worker-client.ts`
Cliente del worker SGP4:
- Protocolo `postMessage` (`init` → `compute` → `positions`)
- Semántica *latest-wins*: pedido nuevo descarta pendiente
- Fallback síncrono para SSR/tests/sin Worker

```typescript
class FleetClient {
  init(sats: Sat[]): Promise<void>
  compute(tMs: number[]): Promise<Positions>
}
```

### 4.2 UI (`src/lib/ui/`)

#### `favorites.ts`
Gestión de listas personalizadas (v2):
- Ops puras e inmutables
- Migración automática v1→v2
- Saneado de localStorage corrupto
- Pertenencia múltiple de satélite a varias listas

```typescript
type Favorites = Record<string, List>  // name → { id, sats: Set<NORAD> }
addList(fav: Favorites, name: string): Favorites
addSatellite(fav: Favorites, listName: string, norad: number): Favorites
```

#### `markers.ts`
Generación de marcadores de mapa:
- SVG minimalista por categoría
- Hitbox 24×24 px invisible
- Rotación por rumbo orbital
- Clases para pulso y selección

```typescript
groupIconSvg(groupId: GroupId, color: string): string
createSatMarker(sat: Sat, isSelected: boolean): L.DivIcon
```

#### `timecontrol.ts`
Control de tiempo:
- Simulación ±24h
- Scrub con slider
- Congelado vs tiempo real

```typescript
type TimeControl = { mode: 'live' | 'frozen', offset: number }
applyOffset(date: Date, offset: number): Date
```

#### `telemetry-log.ts`
Bus de eventos para la consola:
- Buffer fuera de React (tope 400/200)
- Niveles: SYS, ORBIT, TLE, WARN, ALRT
- Filtros por nivel

```typescript
type LogLevel = 'SYS' | 'ORBIT' | 'TLE' | 'WARN' | 'ALRT'
log(level: LogLevel, message: string): void
```

#### `hotkeys.ts`
Atajos de teclado:
- `Espacio`: pausa/reanuda tiempo real
- `/`: foco a búsqueda
- `ESC`: deselecciona y cierra consola
- `←`/`→`: ciclan favoritos

```typescript
handleHotkey(e: KeyboardEvent, state: AppState): void
```

#### `export-passes.ts`
Exportación CSV de pases:
- Formato RFC 4180
- AOS/TCA/LOS UTC, maxEl, azimuts, duración

```typescript
exportPassesToCsv(passes: Pass[], sat: Sat, observer: Observer): string
```

#### `native.ts`
Adaptaciones Tauri/Capacitor:
- Detección de entorno nativo
- Guards de WebView (contextmenu, gestures)
- Clase `st-native` en `<html>`

#### `useKioskMode.ts`
Hook de modo kiosco:
- Captura F11 (y alias táctil F/f)
- Integración con Tauri v2 (`__TAURI__`)
- Fullscreen API para web

```typescript
function useKioskMode(): { isFull: boolean, toggle: () => void }
```

### 4.3 Componentes React (`src/components/`)

#### `App.tsx`
Orquestador principal:
- Estado global (satélites, seleccionado, tiempo, observador)
- Inicialización de catálogo
- Ciclo de render del mapa
- Integración con worker SGP4

#### `Header.tsx`
Cabecera con:
- Búsqueda de satélites
- Botón de modo kiosco (F11)
- Métricas del sistema (TLE%, FPS, worker status)

#### `Sidebar.tsx`
Panel lateral de catálogo:
- Lista agrupada por misión
- Filtros por categoría
- Indicador de radar personalizado

#### `map/MapView.tsx`
Mapa Leaflet:
- Renderizado híbrido (canvas + DOM)
- Capas base Esri (Dark Gray, World Imagery)
- Terminador día/noche
- Trayectorias y huellas

#### `map/GlobeView.tsx`
Globo ortográfico 2D:
- Canvas único con proyección ortográfica
- Continentes `world-atlas` 110m embebidos
- Backface culling matemático
- Arrastre = rotación, rueda = zoom

#### `orbit/SatDetail.tsx`
Panel de detalle orbital:
- Telemetría en vivo (alt, vel, lat, lon)
- Parámetros orbitales
- Sky Radar (azimut/elevación)
- Lista de pases sobre observador

#### `observer/ObserverPanel.tsx`
Configuración de observador:
- Búsqueda de lugares
- Coordenadas manuales
- Persistencia en localStorage

#### `time/TimeBar.tsx`
Control de tiempo:
- Pausa / tiempo real
- Slider ±24h
- Reloj del observador

#### `console/TelemetryConsole.tsx`
Consola de telemetría:
- Flujo de eventos con timestamp
- Filtros por nivel
- Auto-scroll anclable

#### `hud/Dock.tsx`
Barra de comandos inferior:
- TimeBar
- Menú de capas
- Botón de consola
- Estados del sistema

---

## 5. Flujo de Datos

### 5.1 Inicialización

```
1. App.tsx monta
2. loadCatalog() (catalog.client.ts)
   → /api/catalog (catalog.server.ts)
   → Ivan directo
   → seed offline
3. filterActiveSatellites() (tle-filter.ts)
4. FleetClient.init() con satélites filtrados
5. MapView renderiza marcadores iniciales
```

### 5.2 Ciclo de Render

```
1. requestAnimationFrame (cada frame)
2. Calcular now (real o simulado)
3. FleetClient.compute([now]) para seleccionado (1s throttle)
4. FleetClient.compute([...]) para flota (2s throttle)
5. Recibir posiciones (Float64Array transferible)
6. Actualizar marcadores (diffing, no clearLayers)
7. Actualizar telemetría de panel
8. log() eventos a consola
```

### 5.3 Selección de Satélite

```
1. Usuario clic en marcador o lista
2. setSelectedSatellite(sat)
3. map.flyTo(sat.position, zoom ≥ 4)
4. Activar seguimiento (panTo sincronizado)
5. Renderizar SatDetail con Sky Radar
6. Calcular pases sobre observador
```

---

## 6. Configuraciones Importantes

### 6.1 Vite (`vite.config.ts`)

**Configuración crítica para satellite.js v7:**

```typescript
worker: {
  format: "es",  // ← CRÍTICO: satellite.js v7 usa top-level await en workers
},
build: {
  target: "es2022",  // ESM nativo requerido
  sourcemap: false,
},
```

**Motivo:** `satellite.js` v7 es ESM-only con código Emscripten (WASM/pthreads) que usa `new Worker(... import.meta.url)` y top-level await. El plugin `vite:worker-import-meta-url` compila workers con `format: "iife"` por defecto, que no soporta top-level await. La solución es `worker.format: "es"`.

**Plugin `/api/catalog`:**
```typescript
function catalogApi(): Plugin {
  // Expone GET /api/catalog via ssrLoadModule
  // Bypass CORS para SatNOGS (no envía cabeceras CORS)
}
```

### 6.2 Capacitor (`capacitor.config.json`)

```json
{
  "appId": "dev.spacetracker.app",
  "webDir": "dist",
  "server": {
    "androidScheme": "https"
  },
  "plugins": {
    "StatusBar": {
      "style": "DARK",
      "backgroundColor": "#030508",
      "overlaysWebView": true
    },
    "SplashScreen": {
      "launchShowDuration": 400,
      "backgroundColor": "#030508"
    }
  }
}
```

### 6.3 TypeScript (`tsconfig.json`)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

### 6.4 Tauri (`src-tauri/tauri.conf.json`)

```json
{
  "window": {
    "decorations": false,
    "maximized": true,
    "theme": "Dark",
    "backgroundThrottling": "disabled"
  }
}
```

**Permisos** (`src-tauri/capabilities/default.json`):
- `core:window:allow-set-fullscreen`
- `core:window:allow-is-fullscreen`
- Controles de titlebar propia

---

## 7. Scripts Disponibles

```bash
# Desarrollo
npm run dev              # Servidor Vite en http://localhost:5173
npm run dev:native       # Tauri dev (desktop)
npm run preview          # Sirve dist/ (sin /api/catalog)

# Build
npm run build            # Vite build → dist/
npm run build:native     # Tauri build (desktop)
npm run cap:sync         # Capacitor sync
npm run cap:android      # Abrir proyecto Android
npm run cap:ios          # Abrir proyecto iOS

# Calidad
npm run typecheck        # tsc --noEmit
npm test                 # Suite offline (20 tests)
npm run test:live        # Suite contra APIs reales (RUN_LIVE=1)

# Utilidades
npm run seed:generate    # Regenerar catálogo seed
npm run report           # Generar AGENT_SESSION.md
npm run agent:start      # report + dev
```

---

## 8. Tests

### 8.1 Suites de Test (20 archivos)

| Archivo | Cobertura |
|---------|-----------|
| `tle-validation.test.mjs` | Validación de TLEs (19 fixtures) |
| `tle-epoch.test.mjs` | Diagnóstico de época (ventana de siglo, fresh/aging/stale) |
| `tle-filter.test.mjs` | Filtro de TLEs obsoletos |
| `live-catalog-epoch.test.mjs` | Ingesta rechaza épocas futuras |
| `catalog-sources.test.mjs` | Fuentes Ivan/SatNOGS, fallback |
| `catalog-fallback.test.mjs` | Mezcla live/seed, caché |
| `orbit-passes.test.mjs` | Órbita, trayectoria, huella, pasos |
| `fleet-compute.test.mjs` | Cómputo de flota en worker |
| `favorites.test.mjs` | Gestión de listas v2 |
| `map-markers.test.mjs` | Marcadores, SVG, hitbox |
| `map-css.test.mjs` | Selectores HUD, z-index |
| `map-tiles.test.mjs` | Capas base Esri |
| `ortho.test.mjs` | Proyección ortográfica |
| `terminator.test.mjs` | Terminador día/noche |
| `time-sim.test.mjs` | Simulación de tiempo |
| `hotkeys.test.mjs` | Atajos de teclado |
| `telemetry-log.test.mjs` | Bus de eventos |
| `export-passes.test.mjs` | Exportación CSV |
| `native-guards.test.mjs` | Adaptaciones nativas |
| `ui-smoke.test.mjs` | Render SSR de componentes |

### 8.2 Ejecución

```bash
npm test              # Suite offline (sin red)
npm run test:live     # Suite contra APIs reales (requiere RUN_LIVE=1)
```

**Nota:** Los tests cargan el código TypeScript real vía Vite `createServer` + `ssrLoadModule`.

---

## 9. Limitaciones Conocidas

1. **Tiles del mapa requieren conexión** (servidores Esri). Sin red, el mapa muestra fondo oscuro pero las capas vectoriales (satélites, trayectorias) siguen funcionando.
2. **satellite.js v7 es ESM-only**: No se puede cambiar el target de build a formatos antiguos (IIFE/CJS) sin romper el build.
3. **SatNOGS sin CORS**: Solo utilizable vía servidor (`/api/catalog` en dev). En producción, se necesita un backend proxy.
4. **Ivan con límite de recursos**: La paginación `?page=` responde 508 HTML → no se pagina, se usan búsquedas paralelas curadas.
5. **Globo ortográfico 2D**: No es WebGL real, es canvas 2D con matemáticas de proyección. Menos performante que WebGL para miles de puntos.

---

## 10. Consideraciones para Implementar Mejoras

### 10.1 Antes de Empezar

1. **Ejecutar el test suite:** `npm run typecheck && npm test`
2. **Leer el código existente:** Entender la arquitectura de separación de dominio
3. **Verificar dependencias:** No añadir dependencias innecesarias
4. **Considerar rendimiento:** El mapa renderiza miles de puntos; cualquier cambio en el ciclo de render debe ser profileado

### 10.2 Patrones a Seguir

1. **Lógica pura en `src/lib/space/`**: Sin dependencias de React o DOM
2. **Web Worker para cómputo intensivo**: Si el cálculo afecta a muchos satélites
3. **Cascada de fuentes**: Siempre proporcionar fallback offline
4. **Tests primero**: Escribir tests antes de implementar lógica de dominio
5. **Diffing en lugar de clearLayers**: Para actualizaciones de mapa

### 10.3 Zonas de Riesgo Alto

1. **Propagación orbital (`propagate.ts`)**: Cambios aquí afectan a todos los cálculos de posición
2. **Filtro de TLEs (`tle-filter.ts`)**: Cambios en el criterio afectan a qué satélites se muestran
3. **Proyección ortográfica (`ortho.ts`)**: Matemáticas delicadas; errores causan distorsiones visuales
4. **Worker SGP4 (`sgp4.worker.ts`)**: Cambios aquí requieren actualizar el protocolo del cliente
5. **Layout CSS (`styles.css`)**: El diseño usa 100dvh y glassmorphism; cambios pueden romper la responsividad

### 10.4 Métricas de Calidad

- **TypeScript strict:** Sin errores `tsc --noEmit`
- **Tests:** Todos los tests deben pasar
- **Rendimiento:** 60 FPS en el mapa con catálogo completo
- **Accesibilidad:** Contraste suficiente, targets táctiles ≥38px

---

## 11. Glosario

| Término | Significado |
|---------|-------------|
| **TLE** | Two-Line Element set: formato estándar de elementos orbitales |
| **SGP4** | Simplified General Perturbations 4: algoritmo de propagación orbital |
| **NORAD** | North American Aerospace Defense Command: ID de satélite |
| **Epoch** | Época del TLE: fecha de referencia de los elementos orbitales |
| **Fix** | Posición orbital: lat, lon, alt, vel, bearing en un instante |
| **Pass** | Paso sobre observador: AOS (acquisition of signal), TCA (time of closest approach), LOS (loss of signal) |
| **Footprint** | Huella orbital: círculo de visibilidad del satélite |
| **Backface culling** | Ocultación del hemisferio trasero en proyección ortográfica |
| **Tier rendering** | Renderizado híbrido: canvas para fondo, DOM para seleccionado |
| **Glassmorphism** | Estilo UI con superficies translúcidas y desenfoque |
| **HUD** | Head-Up Display: estética de superposición tipo panel de control |

---

## 12. Recursos Externos

- **satellite.js:** https://github.com/shashwatak/satellite-js
- **Leaflet:** https://leafletjs.com/
- **Tauri:** https://tauri.app/
- **Capacitor:** https://capacitorjs.com/
- **Ivan TLE API:** https://tle.ivanstanojevic.me/
- **SatNOGS DB:** https://db.satnogs.org/
- **CelesTrak:** https://celestrak.org/

---

**Documento generado:** 2026-10-19  
**Basado en:** README.md, SPACETRACKER_HANDOFF.md, package.json, vite.config.ts
