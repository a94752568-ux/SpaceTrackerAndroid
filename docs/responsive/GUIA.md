# Guía del sistema responsive — SpaceTracker

**Rama:** `ui/responsive-movil`  
**Plan maestro:** `android/PROMPT_AGENTE_RESPONSIVE_MOVIL.md`

## 1. Breakpoints (Material Design 3 / sizeClass)

| Clase | Ancho CSS (px) | Layout |
|---|---|---|
| **compact** | ≤ 599 | Mapa a pantalla completa · bottom nav · un bottom sheet a la vez · Dock oculto |
| **medium** | 600–839 | Sidebar más estrecha · sin bottom nav · paneles laterales |
| **expanded** | ≥ 840 | Layout escritorio / kiosco |

Orientación: `portrait` si `height > width`, si no `landscape`.

La clasificación la hace `classifySize` / `classifyOrientation` en `src/lib/ui/useViewport.ts` y se publica en:

- `document.documentElement.dataset.size` → `"compact" | "medium" | "expanded"`
- `document.documentElement.dataset.orientation`
- clases en `.st-app`: `is-compact` / `is-medium`
- variables CSS `--vw`, `--vh` (y altura de `visualViewport` cuando existe)

## 2. Variables CSS útiles

### Tema base (`src/styles.css`)

Tokens de color y tipografía del HUD (p. ej. fondo `#030508`, acento `#FF6700`). Safe areas:

```css
env(safe-area-inset-top)
env(safe-area-inset-right)
env(safe-area-inset-bottom)
env(safe-area-inset-left)
```

Usadas en header, bottom nav y sheets.

### Tarea 3 — `src/styles-responsive-task3.css`

Reglas bajo `[data-size="compact"]` / `.st-app.is-compact`: bottom nav, sheets, backdrop, targets táctiles.

### Tarea 5 — `src/styles-responsive-task5.css`

| Variable | Uso |
|---|---|
| `--st-fs-body` | Texto de lectura (`clamp` ~14–16px) |
| `--st-fs-ui` | UI secundaria |
| `--st-fs-label` | Etiquetas bottom nav |
| `--st-touch-min` | `48px` mínimo táctil en compact |

Inputs: `font-size ≥ 16px` para evitar zoom del WebView Android.

### Viewport meta

`index.html`: `width=device-width, initial-scale=1, viewport-fit=cover`.

## 3. Cómo añadir un componente nuevo

1. **No asumas desktop.** Consume `useViewport()` o selectores `[data-size="…"]`.
2. **Compact:** si el panel es denso, intégralo al flujo de `compactTab` / bottom sheet (un sheet activo). Targets ≥ 48px.
3. **Overflow:** `min-width: 0`, elipsis en textos largos, scroll interno en listas.
4. **Safe areas:** padding inferior/superior con `env(safe-area-inset-*)` si el control es fijo al borde.
5. **Motion:** respeta `prefers-reduced-motion` (ya hay reglas globales en task5).
6. **Mapa/globo:** no dimensionar con `window.innerWidth`; el contenedor + `ResizeObserver` (ver GlobeView / MapView / `globeFit.ts`).
7. **Prueba:** DevTools 360×800 y 600×960; `node --test scripts/responsive-matrix.test.mjs`.

### Patrón mínimo

```tsx
import { useViewport } from "../lib/ui/useViewport";

export function MiPanel() {
  const { sizeClass, isTouch } = useViewport();
  if (sizeClass === "compact") {
    return <div className="st-bottom-sheet">…</div>;
  }
  return <aside className="st-sidebar">…</aside>;
}
```

```css
[data-size="compact"] .mi-panel { /* … */ }
[data-size="medium"] .mi-panel { /* … */ }
```

## 4. Cómo probar con `wm size` / densidad

```bash
# Android emulador / dispositivo
adb shell wm size 360x800
adb shell wm density 320
# ejercitar app…
adb shell wm size 600x960
adb shell wm size 915x412   # landscape móvil grande
adb shell wm size reset
adb shell wm density reset
```

Chrome DevTools → device toolbar: mismos anchos (360, 412, 600, 800, 1280).

Fuente del sistema 130 % / 200 %: ajustes del emulador o del SO; sizeClass **no** debe cambiar (solo tipografía).

## 5. Scripts y tests

| Script | Función |
|---|---|
| `scripts/viewport.test.mjs` | classifySize / orientation |
| `scripts/globe-fit.test.mjs` | fitScale, DPR, buffer, matriz |
| `scripts/responsive-matrix.test.mjs` | expectativas por viewport |
| `scripts/ortho.test.mjs` | drag X/Y globo |
| `scripts/apply-task6-app.mjs` | listener atrás Android en App.tsx |
| `scripts/apply-task4-map.mjs` | idempotente si ya aplicado |

```bash
npm run typecheck
node --test scripts/viewport.test.mjs scripts/globe-fit.test.mjs scripts/responsive-matrix.test.mjs scripts/ortho.test.mjs
npm test
```

## 6. Android (Capacitor, targetSdk 36)

* Edge-to-edge: `MainActivity` + barras transparentes + `StatusBar` overlays WebView.
* Teclado: `windowSoftInputMode=adjustResize` + Keyboard resize body.
* Rotación: `configChanges` amplio; `screenOrientation=unspecified` (ambas).
* Atrás: `popstate` / `st-android-back` (tras `apply-task6-app.mjs`).

Detalle: `docs/responsive/TAREA6_ANDROID.md`.

## 7. Documentación por tarea

| Doc | Contenido |
|---|---|
| `TAREA2_VIEWPORT.md` … `TAREA6_ANDROID.md` | Evidencia por etapa |
| `VERIFICACION.md` | Matriz dispositivos (Tarea 7) |
| `RECOVERY.md` | Restaurar App/styles si corrupción |
| `INFORME_FINAL.md` | Cierre de la rama responsive |
