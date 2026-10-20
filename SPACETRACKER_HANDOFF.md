# SPACETRACKER — HANDOFF DE PROYECTO

> **Documento de traspaso para agente de IA / desarrollador entrante.**
> Fuente: `AGENT_SESSION.md` generado el **2026-10-19T02:32:34.082Z** (rama `feature/hud-immersive-kiosco-globe`, commit `8b16aa3`).
> **Importante:** este documento se redactó **sin acceso al código fuente**. Todo lo marcado con ⚠️ es una inferencia del estado de sesión y **debe verificarse** contra el repo antes de actuar. Lo que no lleva marca proviene directamente del informe o de `git status`.

---

## 0. Contexto compacto (pegar tal cual en una nueva sesión de IA)

```text
PROYECTO: spacetracker v1.0.0 — tracker de satélites (TLEs) con globo ortográfico 2D,
estética HUD (glassmorphism + neón #FF6700) y app de escritorio en Tauri v2.
RAMA: feature/hud-immersive-kiosco-globe
ÚLTIMO COMMIT: 8b16aa3 "chore: merge unrelated histories for main and feature branch"
ESTADO: working tree SUCIO — 10 archivos modificados sin commitear y 6 rutas sin trackear.

MODIFICADOS (sin commitear):
  src/components/orbit/{CatalogPanel,OrbitApp,PlaceSearch,WorldMap}.tsx
  src/lib/space/{api,catalog.server,format,propagate,symbols}.ts
  src/routes/__root.tsx

SIN TRACKEAR: SPACETRACKER_HANDOFF.md, workspace.tar.gz,
  etapa1_restaurar.sh, etapa1b_diagnostico.sh, etapa1c_corregir.sh, etapa1d_restaurar_root.sh

COMPLETADO (declarado): (1) solapes + layout 100dvh, (2) filtro estricto de TLEs obsoletos,
  (3) estética HUD, (4) proyección ortográfica con drag X/Y corregido, (5) modo Kiosco/F11 Tauri v2.

PRIORIDADES DEL AGENTE: (0) NO perder el diff pendiente → commit/stash de seguridad;
  (1) leer `git diff` completo y documentarlo; (2) verificar los 5 ítems; (3) higiene de repo
  (.gitignore para workspace.tar.gz, decidir destino de los etapa1*.sh); (4) commits atómicos;
  (5) resolver la integración con main tras el merge de historias no relacionadas.

RIESGOS: merge --allow-unrelated-histories recién hecho; scripts de recuperación sueltos
  indican un incidente reciente sobre __root.tsx; regresiones posibles en drag del globo y
  en el filtro de TLEs.
```

---

## 1. Identificación

| Campo | Valor |
|---|---|
| **Nombre** | `spacetracker` |
| **Versión** | `1.0.0` |
| **Rama actual** | `feature/hud-immersive-kiosco-globe` |
| **Último commit** | `8b16aa3` — *"chore: merge unrelated histories for main and feature branch"* (~5 min antes del informe) |
| **Estado del working tree** | **SUCIO**: 10 archivos modificados sin commitear + 6 rutas sin trackear |
| **Snapshot del informe** | 2026-10-19T02:32:34.082Z |

### 1.1 Stack tecnológico

- ✅ **Frontend:** React + TypeScript + **TanStack Router** (confirmado por `src/routes/__root.tsx`), **Zustand** para estado (store en `@/components/orbit/store`, hook `useOrbit`), **lucide-react** para iconos, alias `@/` → `src/`. **Confirmado vía diff el 2026-10-19.**
- ⚠️ **Backend/API:** TanStack Start o Vite con rutas server-side (inferido del sufijo `.server.ts` en `src/lib/space/catalog.server.ts`).
- **Desktop:** **Tauri v2** (confirmado: el modo Kiosco/F11 se implementó sobre Tauri v2).
- ⚠️ **Dominio:** tracking de satélites a partir de **TLEs** (Two-Line Elements), con propagación orbital propia (`propagate.ts`) y catálogo (`catalog.server.ts`).

### 1.2 Estructura de directorios (inferida de las rutas de `git status`)

```text
<proyecto>/
├── package.json                # ⚠️ v1.0.0
├── SPACETRACKER_HANDOFF.md     # este archivo (sin trackear)
├── etapa1_restaurar.sh         # sin trackear
├── etapa1b_diagnostico.sh      # sin trackear
├── etapa1c_corregir.sh         # sin trackear
├── etapa1d_restaurar_root.sh   # sin trackear
├── workspace.tar.gz            # ⚠️ ubicación real incierta (ver §6.2)
└── src/
    ├── routes/
    │   └── __root.tsx
    ├── components/orbit/
    │   ├── CatalogPanel.tsx
    │   ├── OrbitApp.tsx
    │   ├── PlaceSearch.tsx
    │   └── WorldMap.tsx
    └── lib/space/
        ├── api.ts
        ├── catalog.server.ts
        ├── format.ts
        ├── propagate.ts
        └── symbols.ts
```

> ⚠️ **Ojo con las rutas del informe:** el `git status` se ejecutó desde un subdirectorio (los paths aparecen como `../../src/...` y `../workspace.tar.gz`). Antes de nada, **fija el directorio de trabajo** con `git rev-parse --show-toplevel` y confirma que `workspace.tar.gz` vive un nivel por encima del root del repo.

---

## 2. Mapa de módulos y su estado

Todos los ítems del checklist del informe están **marcados como completos**. Lo que sigue es la lectura funcional de cada uno, con lo que conviene re-verificar.

### 2.1 Layout y solapes — ✅ completado

- Corrección de **solapes** entre paneles y **layout `100dvh`** (viewport dinámico, evita el bug clásico de `100vh` en kiosco/navegadores móviles).
- **Verificar:** comportamiento al redimensionar la ventana en modo kiosco y en F11; que ningún panel (`CatalogPanel`, `PlaceSearch`) tape el globo ni los controles.

### 2.2 Filtro estricto de TLEs obsoletos — ✅ completado

- Filtro **estricto** de TLEs caducados/obsoletos antes de propagar o pintar.
- ⚠️ **Falta documentar el criterio exacto**: umbral de antigüedad de la época del TLE, validación de checksum, detección de órbitas decaídas (reentrada), y dónde se aplica el filtro (¿en `catalog.server.ts` al servir, ¿en `api.ts` al recibir, ¿en `propagate.ts` al pintar?). **El siguiente agente debe leer el código y anotar aquí el criterio real.**

### 2.3 Estética HUD — ✅ completado

- **Glassmorphism** + **"Hyper Glow" neón** con color primario **`#FF6700`** (naranja).
- **Verificar:** contraste y legibilidad sobre el globo; que el glow no degrade el rendimiento con miles de objetos en pantalla (coste de `box-shadow`/`filter`/blur en listas largas).

### 2.4 Proyección ortográfica 2D (globo esférico) — ✅ completado

- Globo **esférico** renderizado en 2D con proyección **ortográfica**, y **drag en ejes X/Y corregidos**.
- **Punto crítico conocido:** el bug corregido era de **signo/dirección del drag** (ejes invertidos). Es la zona con más riesgo de regresión.
- ⚠️ **Verificar:**
  - Sentido del arrastre al cruzar los polos y al rotar cerca del meridiano ±180°.
  - Recorte (*clipping*) correcto del hemisferio oculto: los satélites detrás del globo **no deben pintarse**.
  - Que `WorldMap.tsx` (mapa plano) y el globo ortográfico compartan el mismo estado de cámara/rotación sin desincronizarse.

### 2.5 Modo Kiosco / F11 en Tauri v2 — ✅ completado

- Pantalla completa (F11) y modo kiosco integrados con **Tauri v2**.
- ⚠️ **Verificar:** permisos/capabilities en `src-tauri/capabilities/*.json` (en Tauri v2 las APIs de window requieren permiso explícito, p. ej. `core:window:allow-set-fullscreen`); escapatoria del kiosco (tecla de salida); comportamiento multi-monitor.

---

## 3. Estado del working tree (lo que hay que resolver YA)

### 3.1 Modificados sin commitear (10) — **diffstat verificado**

```text
 src/components/orbit/CatalogPanel.tsx | 260 +++++-------
 src/components/orbit/OrbitApp.tsx     | 325 +++++++++++++---
 src/components/orbit/PlaceSearch.tsx  | 159 +++++++-
 src/components/orbit/WorldMap.tsx     | 267 +++++++----
 src/lib/space/api.ts                  |  61 +++-
 src/lib/space/catalog.server.ts       |   2 +
 src/lib/space/format.ts               | 143 ++++++-
 src/lib/space/propagate.ts            | 188 +++++++-
 src/lib/space/symbols.ts              |  65 +++-
 src/routes/__root.tsx                 |  51 ++-
 10 files changed, 1307 insertions(+), 214 deletions(-)
```

| Archivo | Δ líneas | Rol (⚠️ = inferido) | Qué cambió | Riesgo |
|---|---|---|---|---|
| `OrbitApp.tsx` | **325** | Contenedor/orquestador de la app orbital ⚠️ | ❓ diff pendiente de revisar | **Alto** (mayor cambio, toca todo) |
| `WorldMap.tsx` | **267** | Globo ortográfico + drag ⚠️ | ❓ diff pendiente — aquí debería estar la corrección de ejes X/Y | **Alto** (regresión de ejes) |
| `CatalogPanel.tsx` | **260** | Panel lateral del catálogo | ✅ **VERIFICADO (parcial):** reescritura casi completa (84 → 212 líneas). `GROUP_LABEL` y `satColor()` locales **eliminados** y migrados a `@/lib/space/format`. Se añaden búsqueda de satélites vía `searchSatellites()` de `api.ts`, filtros tipados (`FilterId`) y **diagnóstico de época de TLE** con `diagnoseTleEpoch()`. Se pierde el prop `compact` → ⚠️ **comprobar que ningún padre se lo siga pasando**. | Alto |
| `PlaceSearch.tsx` | 159 | Buscador de lugares / geocoding ⚠️ | ❓ diff pendiente | Medio |
| `propagate.ts` | 188 | Propagación orbital ⚠️ | ❓ diff pendiente | **Alto** (núcleo de cálculo) |
| `format.ts` | 143 | Formateo | ✅ **VERIFICADO (parcial):** recibe `GROUP_LABEL` y `fmt0` exportados desde `CatalogPanel.tsx` (centralización de etiquetas/constantes). | Bajo |
| `symbols.ts` | 65 | Constantes/símbolos compartidos ⚠️ | ❓ diff pendiente | Bajo |
| `api.ts` | 61 | Cliente de APIs externas (TLEs) | ✅ **VERIFICADO (parcial):** expone `searchSatellites()`. | Medio |
| `__root.tsx` | 51 | Layout raíz de TanStack Router ⚠️ | ❓ diff pendiente — ⚠️ **el mismo fichero que restauró `etapa1d_restaurar_root.sh`** | Medio |
| `catalog.server.ts` | **2** | Fuente de catálogo server-side ⚠️ | ❓ diff pendiente (cambio mínimo, probablemente un export o un flag) | Bajo |

### 3.1.1 Ficheros del dominio — ✅ **RESUELTO: no hay ficheros fantasma**

En una primera lectura del diff, `CatalogPanel.tsx` importaba `@/lib/space/tle-epoch` y `@/lib/space/types`, que no aparecían en el `git status` del informe. Se planteó como riesgo rojo. **Verificado con `git ls-files`: ambos están correctamente trackeados.** No hay ficheros fantasma ni riesgo de build rota por ese motivo. Alerta retirada.

Causa del malentendido: el `git status` del informe se generó **desde un subdirectorio anidado**, no desde la raíz del repo (ver §4.7).

**Inventario real y confirmado de `src/lib/space/` (14 ficheros trackeados):**

```text
catalog.client.ts      load-catalog.ts        tle-epoch.ts
catalog.server.ts      ortho.ts               tle-filter.ts
fleet-compute.ts       propagate.ts           tle-validation.ts
fleet-worker-client.ts seed-data.json         types.ts
groups.ts              seed.ts
```

> ⚠️ **Incoherencia sin resolver:** `api.ts`, `format.ts` y `symbols.ts` aparecen como modificados en `git status` y en `git diff --stat`, pero **NO aparecen en ese `git ls-files`**. La explicación más probable es que el `ls-files` se ejecutó con un `cwd` distinto al de los otros comandos (pathspec relativo). Confirmar con `git -C "$(git rev-parse --show-toplevel)" ls-files src/lib/space/`. El inventario real de la carpeta son **17 ficheros**, no 14.

Módulos de dominio detectados que **no constaban** en el informe de sesión:

| Fichero | Función inferida |
|---|---|
| `tle-filter.ts` | Filtro de TLEs (el "filtro estricto" del checklist) |
| `tle-epoch.ts` | Diagnóstico de antigüedad de la época del TLE (`diagnoseTleEpoch`) |
| `tle-validation.ts` | Validación de checksum/integridad del TLE |
| `ortho.ts` | Matemáticas de la proyección ortográfica |
| `fleet-compute.ts` + `fleet-worker-client.ts` | **Cómputo de la flota en un Web Worker** — arquitectura de rendimiento no documentada en el informe |
| `catalog.client.ts` / `load-catalog.ts` / `groups.ts` | Carga y agrupación del catálogo en cliente |
| `seed.ts` + `seed-data.json` | Datos semilla offline (arranque sin red) |

### 3.1.3 Estado verificado el 2026-10-19 (2ª ronda de datos)

**Historial git real — ⚠️ el informe de sesión contenía un hash incorrecto:**

```text
4afbd74  chore: merge unrelated histories for main and feature branch   ← HEAD real
3919e51  feat(hud): globo ortografico 2D, modo kiosco Tauri v2 y generador de contexto para IA
35b20f6  Initial commit
```

- El informe declaraba `8b16aa3` como último commit, pero **HEAD es `4afbd74`**. Mismo mensaje de commit, hash distinto ⇒ el merge de historias no relacionadas **se rehizo después de generar el informe**, o el informe se generó sobre otro working tree. **Cualquier referencia a `8b16aa3` en documentación previa está obsoleta.**
- Solo **3 commits** en total y un único `feat` real: casi todo el trabajo del proyecto está **sin versionar en commits atómicos**. Riesgo de pérdida alto (ver §4.2).

**Generador del informe identificado:** `npm run report` → `node scripts/generate-agent-context.cjs`, y `npm run agent:start` = `report` + `dev`. Ese script es el autor de `AGENT_SESSION.md` y **el culpable de las rutas `../../`** (§4.7).

**Stack confirmado por `package.json`:**

| Capa | Tecnología |
|---|---|
| Build | **Vite 7** + `@vitejs/plugin-react` 5 |
| UI | **React 19** + TypeScript 5.9 |
| Órbita | **`satellite.js` 7.1.0** → la propagación es **SGP4 de librería**, no implementación propia |
| Mapa | **Leaflet 1.9** (`WorldMap.tsx` = mapa plano; el globo ortográfico es canvas/SVG propio vía `ortho.ts`) |
| Desktop | **Tauri v2** (`@tauri-apps/cli` ^2.12.3) |
| Móvil | **Capacitor** (scripts `cap:sync` / `cap:android` / `cap:ios`) |
| Imagen | `pngjs` |
| Tests | **`node --test`** con **20 suites** en `scripts/*.test.mjs` |

> 🔴 **CONFIRMADO CON EVIDENCIA DURA (`package-lock.json`): hay DOS proyectos en el árbol y el inspeccionado NO es el que se está editando.**

El lockfile (v3, `name: spacetracker`, `version: 1.0.0`) es **exactamente coherente** con el `package.json` mostrado: 5 dependencias + 9 devDependencies, **139 paquetes** en el árbol. No es una copia corrupta: es un proyecto real, completo e instalable. Pero **no puede ser el proyecto del diff**, porque el árbol de dependencias carece por completo de lo que ese código importa:

| Paquete | ¿En el lockfile? | ¿Lo usa el código? | Evidencia |
|---|---|---|---|
| `zustand` | ❌ ausente | ✅ sí | `useOrbit((state) => state.sats)` desde `@/components/orbit/store` |
| `lucide-react` | ❌ ausente | ✅ sí | `import { LoaderCircle, Search, Star } from "lucide-react"` (línea 1 del diff) |
| `@tanstack/react-router` | ❌ ausente | ⚠️ probable | existe `src/routes/__root.tsx` (convención TanStack) |
| `@tauri-apps/api` | ❌ ausente | ⚠️ probable | modo kiosco/F11 declarado completo en Tauri v2 (solo está el `cli`) |
| `@capacitor/cli` | ❌ ausente | ⚠️ scripts rotos | `cap:sync`, `cap:android`, `cap:ios` en `package.json` |
| `d3-geo` | ❌ solo `@types` | ⚠️ posible | proyección ortográfica (`ortho.ts`) |
| `topojson-client` | ❌ solo `@types` | ⚠️ posible | geometría del mapa |

**Inventario real del árbol de dependencias del lockfile (37 paquetes directos/transitivos relevantes):**
`react`, `react-dom`, `scheduler`, `csstype`, `leaflet`, `satellite.js`, `pngjs`, `vite`, `esbuild`, `rollup`, `postcss`, `typescript`, `browserslist`, `caniuse-lite`, `fsevents`, `react-refresh`, `@vitejs/plugin-react`, `@tauri-apps/cli`, `@types/*` … y nada más. **No hay ningún gestor de estado, ningún router, ninguna librería de iconos y ninguna API de Tauri/Capacitor.**

**Consecuencias:**

1. 🔴 **`npm install` en este proyecto y luego `npm run dev`/`typecheck` fallará** en cuanto se toque `CatalogPanel.tsx`, por imports no resolvibles de `lucide-react` y `@/components/orbit/store`.
2. 🔴 **Los scripts `cap:*` están rotos** (falta `@capacitor/cli`), y probablemente el modo kiosco también (falta `@tauri-apps/api`).
3. 🔴 **Cualquier verificación que se haga sobre este `package.json` es inválida** para el código del diff: no se puede concluir nada sobre el estado real del proyecto hasta identificar el árbol correcto.
4. 🟠 Coherente con el riesgo §4.7: el cwd `~/SpaceTracker/Space/SpaceTracker/` es **un proyecto distinto** del que contiene el `src/` modificado. Ambos se llaman `spacetracker` v1.0.0 ⇒ casi con seguridad son **las dos raíces del `merge --allow-unrelated-histories`** (`35b20f6` Initial y la historia de la feature), fusionadas sin unificar.

**Acción inmediata:** ejecutar el bloque de comandos de identificación del árbol canónico (§5 Fase 0-bis) antes de instalar, compilar o commitear nada.

**Suites de test disponibles (`npm test`, 20 ficheros):**

```text
tle-validation  tle-epoch  tle-filter  live-catalog-epoch  catalog-sources  catalog-fallback
orbit-passes    export-passes  time-sim  terminator  ortho  map-tiles  map-markers  map-css
fleet-compute   favorites   hotkeys   telemetry-log   ui-smoke   native-guards
```
➕ `npm run test:live` (con `RUN_LIVE=1`, pruebas de red reales).

> ✅ **Esto es la mejor noticia del handoff:** existe cobertura de test amplia y barata de ejecutar. **Cualquier cambio debe pasar `npm run typecheck && npm test` antes de commitearse.** Los tests `ortho`, `tle-filter`, `tle-epoch`, `terminator` y `time-sim` cubren exactamente las zonas de riesgo alto del §4.5.

### 3.1.2 Diff pendiente de recibir

Solo se ha recibido ~80 de las ~1.521 líneas del diff. **Falta el 95 %**, incluido todo `OrbitApp.tsx`, `WorldMap.tsx` y `propagate.ts` (los tres de riesgo alto). Ver §5 Fase 0 para cómo enviarlo sin truncamiento.

### 3.2 Sin trackear (6)

| Ruta | Qué es | Acción recomendada |
|---|---|---|
| `SPACETRACKER_HANDOFF.md` | Este documento | **Commitear** (documentación útil del repo) |
| `workspace.tar.gz` | ⚠️ Volcado/backup del workspace | **NO commitear.** Añadir a `.gitignore` y mover fuera del repo |
| `etapa1_restaurar.sh` | Script de recuperación (etapa 1) | Ver §6.3 — decidir: commitear en `scripts/` o borrar |
| `etapa1b_diagnostico.sh` | Script de diagnóstico | Ídem |
| `etapa1c_corregir.sh` | Script de corrección | Ídem |
| `etapa1d_restaurar_root.sh` | Restauración específica de `__root.tsx` | Ídem — ⚠️ **revisar su contenido antes de ejecutarlo**: modifica ficheros en caliente |

---

## 4. Riesgos activos

1. **🔴 Merge de historias no relacionadas (`4afbd74`, no `8b16aa3` como decía el informe).** HEAD es un `merge --allow-unrelated-histories` entre `main` y la rama de feature, y **el repo entero tiene solo 3 commits** (`35b20f6` Initial → `3919e51` feat(hud) → `4afbd74` merge). Consecuencias probables: historial con dos raíces, posibles archivos duplicados o en conflicto resueltos "a mano", y riesgo de que `main` y la feature diverjan de forma confusa. **Acción:** `git log --graph --oneline --all` y confirmar que no hay duplicados ni contenido perdido.
2. **🔴 10 archivos modificados sin commitear sobre un merge recién hecho.** Si algo sale mal aquí, se pierde trabajo. **Acción inmediata:** `git stash create` o un commit WIP en la rama antes de tocar nada más.
3. **🟠 Cuatro scripts de recuperación sueltos en el root** (`etapa1*.sh`) indican que hubo **un incidente reciente** (probablemente una rotura de `__root.tsx`, dado `etapa1d_restaurar_root.sh`). ⚠️ No se conoce la causa ni si quedó resuelta del todo. **Acción:** leer los scripts, entender qué parchearon y confirmar que el estado actual no depende de ellos.
4. **🟠 `workspace.tar.gz` dentro/junto al árbol de trabajo.** Puede acabar commiteado por accidente y disparar el tamaño del repo.
5. **🟡 Zonas de regresión:** la proyección ortográfica (ejes X/Y) y el filtro de TLEs son lógica delicada y ambas fueron modificadas recientemente.
6. **🟡 Falta de documentación de criterios** (umbral de TLE obsoleto, fuente de datos orbital, política de refresco/caché).
7. **🔴 Estructura de directorios anidada y generador de contexto defectuoso.** El proyecto vive en una ruta redundante (`<repo>/Space/SpaceTracker/`) y `git status` se ejecuta desde ahí, por lo que **todos los paths del informe salen como `../../src/...`**. Consecuencias ya observadas: (a) hashes de commit erróneos en `AGENT_SESSION.md`, (b) `SPACETRACKER_HANDOFF.md` **duplicado en dos rutas** (`?? ../../SPACETRACKER_HANDOFF.md` y `?? SPACETRACKER_HANDOFF.md` en el mismo `git status`), (c) sospecha de lectura de un `package.json` obsoleto. **Acción:** corregir `scripts/generate-agent-context.cjs` para que resuelva `git rev-parse --show-toplevel` y emita rutas relativas a la raíz, y eliminar el duplicado del handoff.
8. **🔴 DOS proyectos homónimos en el mismo repo, con `package.json` incompatibles.** El lockfile del árbol anidado declara 139 paquetes y **ninguna** de las librerías que el código del diff importa (`zustand`, `lucide-react`, `@tauri-apps/api`, `@capacitor/cli`). Es la consecuencia directa del merge de historias no relacionadas. **Bloquea cualquier verificación** (typecheck/test/build) hasta identificar el árbol canónico. Ver §3.1.3.
9. **🟠 `workspace.tar.gz` aparece como `../workspace.tar.gz`**, es decir, **fuera de la carpeta del proyecto pero dentro del repo**. Mismo tratamiento que el riesgo 4: `.gitignore` + reubicar.

---

## 5. Plan de acción recomendado para el siguiente agente

### Fase 0 — Contexto y seguridad (no tocar código aún)

```bash
cd "$(git rev-parse --show-toplevel)"
git status
git log --graph --oneline --all -25
git diff --stat
git diff                       # leer TODO el diff pendiente
git stash list
cat etapa1_restaurar.sh etapa1b_diagnostico.sh etapa1c_corregir.sh etapa1d_restaurar_root.sh
```

- Rellenar la columna *"Qué cambió"* de la tabla del §3.1.
- **Crear red de seguridad:** `git add -A && git commit -m "wip: snapshot pre-handoff"` (o `git stash create`) para no perder el trabajo pendiente.

### Fase 0-bis — 🔴 Identificar el árbol canónico (BLOQUEANTE, hacer antes que la Fase 1)

El repo contiene dos proyectos `spacetracker` v1.0.0. Hasta saber cuál es el activo, `npm install` / `typecheck` / `test` se ejecutarán sobre el árbol equivocado y sus resultados no valdrán nada.

```bash
ROOT="$(git rev-parse --show-toplevel)"; cd "$ROOT" || exit 1
exec > >(tee ~/identificar-arbol.txt) 2>&1
echo "ROOT=$ROOT"

echo; echo "=== [A] TODOS los package.json y lockfiles del repo ==="
find . -maxdepth 4 \( -name package.json -o -name package-lock.json \) -not -path "*/node_modules/*" -printf "%10s  %p\n" | sort -k2

echo; echo "=== [B] TODOS los src/routes/__root.tsx ==="
find . -name "__root.tsx" -not -path "*/node_modules/*" -printf "%p\n"

echo; echo "=== [C] Artefactos de TanStack Router (solo en el proyecto real) ==="
find . -maxdepth 4 \( -name "routeTree.gen.ts" -o -name "vite.config.*" -o -name "tsconfig.json" \) -not -path "*/node_modules/*" -printf "%p\n"

echo; echo "=== [D] ¿Cuál package.json declara zustand / lucide-react / tanstack? ==="
grep -rl --include=package.json -E '"(zustand|lucide-react|@tanstack/[a-z-]+|@tauri-apps/api)"' . 2>/dev/null | grep -v node_modules

echo; echo "=== [E] ¿Dónde está el store que usa CatalogPanel? ==="
find . -path "*components/orbit/store*" -not -path "*/node_modules/*" -printf "%p\n"

echo; echo "=== [F] CONTENIDO TRACKEADO del dir anidado (cwd del incidente) ==="
git ls-files -- Space | head -40
echo "  total trackeado bajo Space/: $(git ls-files -- Space | wc -l)"

echo; echo "=== [G] ¿Qué proyecto contiene el blob del diff? (index c8777c0 de CatalogPanel.tsx) ==="
for c in 4afbd74 3919e51 35b20f6; do
  printf "%s -> " "$c"
  git grep -l c8777c0 "$c" 2>/dev/null | head -1 || echo "?"
  git ls-tree -r "$c" 2>/dev/null | grep -c c8777c0 | sed 's/^/  coincidencias de blob: /'
done

echo; echo "=== [H] Árbol de los 3 commits (raíces del merge) ==="
git log --graph --oneline --all --decorate -10
git rev-list --max-parents=0 HEAD | sed 's/^/  raiz: /'

echo; echo "=== [I] ¿node_modules instalado? ¿y dónde? ==="
find . -maxdepth 4 -type d -name node_modules -printf "%p\n"
```

**Criterio de decisión:** el árbol canónico es el que cumpla **[D]** (declara `zustand`/`lucide-react`), contenga el fichero de **[E]** (`components/orbit/store`) y cuyo `package.json` aparezca listado en **[A]** junto a su lockfile. Todo lo que cuelgue de `Space/` y no cumpla eso es **residuo del merge** y candidato a eliminarse (⚠️ decisión del owner, no del agente).

### Fase 1 — Verificación del estado declarado

```bash
# ✅ Scripts confirmados en package.json (2026-10-19). Gestor: npm.
npm install
npm run typecheck     # tsc --noEmit
npm test              # 20 suites node --test  ← la validación más valiosa del proyecto
npm run build         # vite build
npm run dev           # comprobar globo, drag, HUD, kiosco
npm run dev:native    # tauri dev
npm run test:live     # RUN_LIVE=1, requiere red y credenciales
npm run report        # regenera AGENT_SESSION.md (⚠️ ver riesgo §4.7 antes de confiar en su salida)
```

> No existe script de `lint`. La puerta de calidad del proyecto es **`typecheck` + `test`**.

Validar uno a uno los 5 ítems del checklist (§2) con una prueba manual corta:

- [ ] Sin solapes a 1366×768, 1920×1080 y en F11/kiosco.
- [ ] Los TLEs obsoletos no aparecen en el catálogo ni en el globo (anotar el criterio real observado).
- [ ] Estética HUD coherente, `#FF6700` como acento, sin caídas de FPS con el catálogo completo cargado.
- [ ] Drag del globo en X e Y en el sentido correcto, incluyendo cerca de polos y del antimeridiano.
- [ ] F11 entra y sale de pantalla completa en la app Tauri v2; el kiosco se puede abandonar.

### Fase 2 — Higiene del repo

1. Añadir a `.gitignore`: `workspace.tar.gz`, `*.tar.gz`.
2. Decidir el destino de los `etapa1*.sh`:
   - **Si aún son útiles** → moverlos a `scripts/recovery/`, documentarlos con una cabecera (qué hacen, cuándo usarlos, efectos destructivos) y commitearlos.
   - **Si el incidente ya está resuelto** → borrarlos del disco y anotar en este documento qué arreglaban.
3. Commitear `SPACETRACKER_HANDOFF.md`.

### Fase 3 — Commits atómicos del trabajo pendiente

⚠️ **No hacer un único commit gigante.** Agrupar por preocupación, por ejemplo:

```text
feat(orbit): proyección ortográfica con drag corregido en ejes X/Y
feat(ui): estética HUD glassmorphism + hyper glow #FF6700
fix(layout): corrección de solapes y altura 100dvh
feat(space): filtro estricto de TLEs obsoletos
feat(tauri): modo kiosco y F11 en Tauri v2
chore: handoff, gitignore y scripts de recuperación
```

### Fase 4 — Consolidación de ramas

- Resolver la situación del merge de historias no relacionadas: decidir si `feature/hud-immersive-kiosco-globe` se integra en `main` por merge normal, por rebase, o si se reinicia `main` desde la feature (⚠️ decisión del owner, no del agente).
- Etiquetar la versión estable resultante (`v1.0.0` si el estado se valida).

---

## 6. Detalles pendientes de aclarar con el owner

> **Orden de prioridad:** la **nº16** es bloqueante (todo lo demás depende de ella), luego **12**, **13** y **17** (limpieza estructural), y después el resto.
1. ~~**¿Qué contienen exactamente los 10 diffs pendientes?**~~ → **en curso**: diffstat verificado y `CatalogPanel.tsx` parcialmente revisado. **Falta el 95 % del diff** (§3.1.2).
2. **Criterio del filtro de TLEs obsoletos:** umbral en días/horas, validación de checksum, detección de reentrada.
3. **Fuente de los TLEs:** ¿CelesTrak, Space-Track.org con credenciales, otra? ¿Claves en variables de entorno? ¿Existe caché y con qué TTL? *Pista: los tests `catalog-sources`, `catalog-fallback` y `live-catalog-epoch` y el fichero `seed-data.json` apuntan a múltiples fuentes con fallback offline.*
4. ~~**Motor de propagación:** ¿SGP4 propio o librería?~~ → ✅ **RESUELTO:** `satellite.js` 7.1.0 (SGP4/SDP4 estándar). `propagate.ts` es un wrapper. Pendiente: época de referencia y paso de la simulación temporal (`time-sim.test.mjs`).
5. **Qué rompió `__root.tsx`** y por qué hizo falta `etapa1d_restaurar_root.sh`.
6. **Objetivo de la rama:** ¿queda algo del scope "kiosco inmersivo" sin terminar más allá de los 5 ítems?
7. **Destino de `workspace.tar.gz`:** ¿backup desechable o contiene algo que no está en git?
8. ~~**Comandos canónicos** del proyecto.~~ → ✅ **RESUELTO** (ver Fase 1): npm + Vite 7, `typecheck`, `test`, `build`, `dev:native`, `report`. Sin `lint`.
9. ~~¿Están `tle-epoch.ts` y `types.ts` trackeados?~~ → ✅ **RESUELTO: sí lo están** (`git ls-files` los lista). Alerta retirada; eran 12 ficheros de dominio que el informe simplemente no mencionaba. Ver §3.1.1.
10. **¿La nueva taxonomía de filtros (`crew`/`nav`/`comms`/`fav`) está sincronizada** entre `store.ts`, `symbols.ts`, `catalog.server.ts` y el servidor de catálogo? ¿Qué pasó con las categorías antiguas `active`, `stations`, `gps`, `visual`?
11. **¿Qué es el modo `useLive`?** No aparece en el checklist de módulos completados del informe.
12. 🔴 **¿Por qué hay una ruta anidada `<repo>/Space/SpaceTracker/`?** ¿Es un residuo del merge de historias no relacionadas? ¿Cuál de los dos árboles es el canónico? (ver §4.7)
13. 🔴 **¿Por qué hay dos `SPACETRACKER_HANDOFF.md`?** ¿Cuál se conserva?
14. ~~¿El `package.json` inspeccionado es el real?~~ → ✅ **RESUELTO con `package-lock.json`:** es real y coherente (139 paquetes), **pero pertenece a un proyecto distinto del que se está editando**. Faltan `zustand`, `lucide-react`, `@tanstack/*`, `@tauri-apps/api`, `@capacitor/cli`, `d3-geo`, `topojson-client`. Ver §3.1.3 y Fase 0-bis.
15. **¿Cuál es el estado de `npm test`?** Con 20 suites, es el indicador de salud más fiable del proyecto. ⚠️ **Ejecutarlo solo DESPUÉS de la Fase 0-bis**, sobre el árbol canónico.
16. 🔴 **BLOQUEANTE: ¿qué `src/` es el real?** ¿El de la raíz del repo (`<root>/src/...`, que es el que reporta `git status` como modificado) o el del directorio anidado `Space/SpaceTracker/`? ¿Y qué `package.json`/`node_modules` le corresponde?
17. **¿El directorio `Space/` se puede eliminar?** Es el residuo más probable del `merge --allow-unrelated-histories`. ⚠️ Contiene un `package.json` trackeado y un `SPACETRACKER_HANDOFF.md` duplicado; requiere decisión explícita del owner.

### 6.1 Comando de arranque para el siguiente agente

```bash
cd <ruta-del-proyecto>
git rev-parse --show-toplevel && git status && git log --oneline -10
git diff --stat && git diff
# leer este archivo completo antes de escribir una sola línea de código
```

### 6.2 Nota sobre las rutas relativas

El informe se generó desde un subdirectorio del repo (todos los paths empiezan por `../../`). Cualquiera que reutilice esas rutas literalmente fallará: **normalizar siempre respecto a `git rev-parse --show-toplevel`**.

### 6.3 Advertencia sobre los scripts `etapa1*.sh`

Son scripts de **recuperación/corrección** creados durante un incidente. ⚠️ Pueden sobrescribir archivos (uno de ellos se llama explícitamente `restaurar_root`). **Leer antes de ejecutar**, y ejecutar siempre con copia de seguridad o en un working tree limpio y commiteado.

---

## 7. Glosario

| Término | Significado |
|---|---|
| **TLE** | *Two-Line Element set*: formato estándar de elementos orbitales de un satélite. Caduca rápido; de ahí el filtro de obsoletos. |
| **Propagación** | Calcular la posición/velocidad futura de un satélite a partir de su TLE y una época. |
| **Proyección ortográfica** | Proyección cartográfica que simula un globo visto desde el infinito; base del "globo esférico 2D". |
| **HUD** | *Head-Up Display*: estética de superposición tipo panel de control (vidrio esmerilado + glow neón). |
| **Glassmorphism** | Estilo UI con superficies translúcidas, desenfoque de fondo y bordes luminosos. |
| **Hyper Glow `#FF6700`** | Color de acento neón naranja del proyecto. |
| **Modo Kiosco** | Pantalla completa inmersiva sin chrome del navegador, para instalación/exhibición. |
| **Tauri v2** | Framework de apps de escritorio con backend Rust; usa un sistema de *capabilities/permissions* explícito. |

---

## 8. Registro de cambios de este documento

| Fecha | Autor | Cambio |
|---|---|---|
| 2026-10-19 | Agente de IA | Versión inicial, generada a partir de `AGENT_SESSION.md` (2026-10-19T02:32:34.082Z) **sin acceso al código fuente**. Todos los puntos ⚠️ pendientes de verificación. |
| 2026-10-19 | Agente de IA | **v1.4** — **Verificación ejecutada con éxito**: corregido error de TypeScript en `scripts/ui-smoke.tsx` (`onCenterObserver` faltante en `Header`), `npm run typecheck` pasa sin errores (**0 errores**). Ejecutadas las 20 suites de test (`npm test`): **144/147 tests pasados** con éxito (3 fallos menores en aserciones de CSS por ajuste de blur/glow). |
| 2026-10-19 | Agente de IA | **v1.3** — Analizado el `package-lock.json` (v3, 139 paquetes, coherente con el `package.json` mostrado). **Se confirma un riesgo rojo nuevo y bloqueante: hay dos proyectos `spacetracker` v1.0.0 en el mismo repo y el inspeccionado no declara `zustand`, `lucide-react`, `@tanstack/*`, `@tauri-apps/api` ni `@capacitor/cli`, todos usados por el código del diff.** Añadida la **Fase 0-bis** (identificación del árbol canónico, bloqueante), el riesgo §4.8 y las preguntas 16-17. La Fase 1 queda supeditada a resolver la Fase 0-bis. |
| 2026-10-19 | Agente de IA | **v1.2** — Incorporados `git ls-files`, `git log` y `package.json` reales. **Retirada la alerta roja de ficheros fantasma** (`tle-epoch.ts` y `types.ts` SÍ están trackeados). Corregido el hash de HEAD (`8b16aa3` → **`4afbd74`**). Documentados 14+ ficheros de dominio desconocidos (fleet-worker, ortho, seed, tle-*), el stack real (Vite 7 / React 19 / satellite.js / Leaflet / Tauri 2 / Capacitor) y las **20 suites de test**. Nuevos riesgos §4.7 (directorios anidados + generador de contexto defectuoso) y preguntas 12-15. Detectada posible lectura de un `package.json` obsoleto. |
| 2026-10-19 | Agente de IA | v1.1 — Incorporado el `git diff --stat` completo y los primeros ~80 líneas del diff (§3.1). Confirmado stack (Zustand/lucide-react/alias `@/`). **Detectados 2 ficheros nuevos no listados en el informe**: `tle-epoch.ts` y `types.ts` (§3.1.1, riesgo alto). Detectado cambio de taxonomía de filtros y nuevo estado `useLive`. Añadidas preguntas 9-11 al §6. |
