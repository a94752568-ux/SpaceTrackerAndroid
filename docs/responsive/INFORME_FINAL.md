# Informe final — UI responsive móvil (SpaceTrackerAndroid)

**Rama:** `ui/responsive-movil`  
**Fecha de cierre documental:** 2026-10-26  
**Plan:** `android/PROMPT_AGENTE_RESPONSIVE_MOVIL.md` (tareas 0–8)

## 1. Qué cambió

### Arquitectura UI
* **Detección de viewport** (`useViewport`): sizeClass MD3, orientation, DPR, touch, `prefers-reduced-motion`, `visualViewport`, atributos `data-size` / `data-orientation`.
* **Layout por clase:** compact → bottom nav + sheets; medium → sidebar; expanded → escritorio.
* **Globo/mapa:** dimensionado por contenedor (`ResizeObserver`), DPR acotado a 2, fit 1:1, zoom relativo al rotar, pellizco en globo, `invalidateSize` en Leaflet.
* **Tipografía y táctil:** `clamp`, targets 48px, inputs ≥16px, blur reducido en compact.
* **Android:** edge-to-edge (targetSdk 36), teclado `adjustResize`, rotación sin reinicio, tema HUD, puente StatusBar + atrás por historial.

### Archivos principales

| Área | Rutas |
|---|---|
| Viewport | `src/lib/ui/useViewport.ts`, `src/lib/ui/globeFit.ts` |
| App layout | `src/App.tsx` (compactTab, sheets) |
| Estilos | `styles.css`, `styles-responsive-task3.css`, `styles-responsive-task5.css` |
| Mapa | `GlobeView.tsx`, `MapView.tsx` |
| Android | `MainActivity.java`, `AndroidManifest.xml`, `styles.xml`, `colors.xml` |
| Puente web | `src/lib/ui/androidChrome.ts`, `main.tsx` |
| Tests | `viewport.test.mjs`, `globe-fit.test.mjs`, `responsive-matrix.test.mjs` |

### Commits representativos (rama)

Mensajes alineados con el estilo pedido en Tarea 8 (historial real de la rama):

* `feat(ui):` useViewport / layout sizeClass / tipografía táctil  
* `fix(map):` globo y mapa al contenedor  
* `feat(android):` edge-to-edge, teclado, rotación  
* `test(responsive):` matriz y globeFit  
* `docs(responsive):` evidencias por tarea + esta guía/informe  
* `fix(ts):` limpieza build (SatDetail, CatalogStats, sin `@capacitor/app`)

No se reescribió el historial completo en commits “ideales” uno-por-tarea: el trabajo quedó versionado de forma incremental en `ui/responsive-movil`.

## 2. Evidencia

| Tipo | Dónde |
|---|---|
| Diseño por tarea | `docs/responsive/TAREA2_*.md` … `TAREA6_*.md` |
| Matriz dispositivos | `docs/responsive/VERIFICACION.md` |
| Guía de mantenimiento | `docs/responsive/GUIA.md` |
| Tests automáticos | `npm test` incluye viewport + globe-fit + matrix + ortho |
| Capturas UI | `docs/responsive/despues/` (relleno local) |

**Pendiente en entorno sin AVD:** marcar ✅ en VERIFICACION.md y subir PNG tras prueba manual/emulador.

## 3. Limitaciones conocidas

1. **Capturas y Performance:** no ejecutadas en el entorno del agente; protocolo documentado en VERIFICACION.md.  
2. **`apply-task6-app.mjs`:** puede ser necesario en clones que aún no tengan `st-android-back` en `App.tsx`.  
3. **`@capacitor/app` no instalado:** atrás predictivo nativo opcional; se usa `history` + evento custom (evitar dependencia que rompía el build Vite).  
4. **sizeClass = ancho CSS**, no diagonal física del dispositivo.  
5. **Plegables:** tamaños aproximados en la matriz.  
6. **Histórico de corrupción:** en un momento `App.tsx`/`styles.css` se sobrescribieron con placeholders en remoto; ya restaurados. Scripts `restore-*` quedan por si reaparece.

## 4. Decisiones abiertas

| Tema | Estado |
|---|---|
| Orientación solo portrait | Por defecto **ambas**; bloquear con `android:screenOrientation="portrait"` si se pide |
| Plugin `@capacitor/app` | Opcional si se quiere `backButton` nativo sin depender solo de historial |
| Merge a `main` / Play | Tras rellenar VERIFICACION y smoke release en AVD |
| Intensidad glassmorphism en compact | Reducida (task5); se puede endurecer más si hay jank |

## 5. Impacto en preparación Google Play

| Requisito | Estado en esta rama |
|---|---|
| **targetSdk / compileSdk 36** | Sí (`android/variables.gradle`) |
| **Edge-to-edge** | Sí (`setDecorFitsSystemWindows(false)`, barras transparentes, `viewport-fit=cover`, safe-area CSS) |
| **Teclado / resize** | `adjustResize` + config Capacitor Keyboard |
| **Orientación / multi-ventana** | `resizeableActivity=true`, `configChanges` completo |
| **Privacidad / permisos** | Sin cambios de permisos en Tareas 2–8 (location ya declarado) |
| **Firma / Play Console** | Fuera de alcance de este trabajo UI |

Conclusión: el trabajo responsive **refuerza** el cumplimiento de comportamientos esperados en API 35/36 (insets, no reinicio al rotar, UI usable en móviles), alineado con la prep Play ya iniciada en la línea Capacitor del proyecto.

## 6. Confirmación de alcance de repositorios

* Trabajo realizado **únicamente** sobre el remoto `a94752568-ux/SpaceTrackerAndroid` (rama `ui/responsive-movil`) vía API GitHub y artefactos del agente.
* **No se modificaron** los árboles locales ajenos `~/SpaceTracker` ni `~/SpaceTracker2` (restricción del plan).

## 7. Checklist de cierre para el mantenedor

```bash
git checkout ui/responsive-movil && git pull
node scripts/apply-task6-app.mjs   # si aplica
npm run typecheck && npm test && npm run build
npx cap sync android               # opcional smoke
# Completar docs/responsive/VERIFICACION.md + capturas despues/
# PR → main cuando la matriz manual esté ✅
```

## 8. Referencia rápida de docs

```
docs/responsive/
  GUIA.md              ← este sistema (breakpoints, componentes, wm size)
  INFORME_FINAL.md     ← este informe
  VERIFICACION.md      ← matriz Tarea 7
  TAREA2…TAREA6_*.md   ← evidencia por etapa
  RECOVERY.md          ← restauración de archivos
  despues/             ← capturas post-cambio
```
