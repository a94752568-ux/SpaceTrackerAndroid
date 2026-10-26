# INFORME DE ESTADO PARA AGENTE DE IA (SESSION CONTEXT)
> **Actualizado:** 2026-10-26T22:41:00Z (sesión responsive móvil)

## 1. Identificación del Proyecto
* **Nombre:** spacetracker · **Versión:** 1.0.0
* **Rama Git actual:** `ui/responsive-movil` (default)
* **Último trabajo:** Tareas responsive 2–6 + fixes TypeScript/build (`@capacitor/app`, SatDetail unused, CatalogStats)
* **Repo:** https://github.com/a94752568-ux/SpaceTrackerAndroid
* **Stack:** Vite + React + TypeScript · Capacitor 8 · targetSdk/compileSdk **36** · Tauri v2
* **Estética:** HUD Mission Control · acento `#FF6700` · fondo `#030508` · glassmorphism

## 2. Ruta responsive (`android/PROMPT_AGENTE_RESPONSIVE_MOVIL.md`)

| Tarea | Título | Estado en remoto |
|---|---|---|
| 0–1 | Diagnóstico / fundamentos | Parcial (viewport-fit, 100dvh, safe-area CSS) |
| 2 | `useViewport` + sizeClass MD3 | **Hecha** — `src/lib/ui/useViewport.ts`, `scripts/viewport.test.mjs` |
| 3 | Layout compact/medium/expanded | **Hecha** — `App.tsx` (`compactTab`, bottom nav, sheets, Escape) |
| 4 | Globo y mapa al contenedor/DPR | **Hecha** — `GlobeView.tsx` (`fitScale`), `MapView.tsx` (`invRaf`/`visualViewport`) |
| 5 | Tipografía y targets 48dp | **Hecha** — `styles-responsive-task5.css` + import en `main.tsx` |
| 6 | Android edge-to-edge / teclado / rotación / atrás | **Nativo hecho**; **App.tsx aún sin** `st-android-back` → falta `node scripts/apply-task6-app.mjs` |
| 7 | Matriz de dispositivos + capturas | Pendiente |
| 8 | Entrega / GUIA.md | Pendiente |

## 3. Verificación reciente de archivos clave

| Archivo | Tamaño remoto | Notas |
|---|---|---|
| `src/App.tsx` | ~35 KB | useViewport + compactTab OK; **sin** listener `st-android-back` aún |
| `src/styles.css` | ~61 KB | Tema Mission Control restaurado |
| `src/components/map/GlobeView.tsx` | ~22 KB | `fitScale` + pinch + DPR cap 2 |
| `src/components/map/MapView.tsx` | ~32 KB | `invalidateSize` + visualViewport |
| `src/lib/ui/androidChrome.ts` | ~1.3 KB | StatusBar + popstate; **sin** `@capacitor/app` (rompe Vite) |
| `src/components/orbit/SatDetail.tsx` | ~7.5 KB | Imports limpios (solo `getFix` + métricas) |
| `src/lib/space/types.ts` | CatalogStats con `live`/`seed` |
| `MainActivity.java` | edge-to-edge `setDecorFitsSystemWindows(false)` |

## 4. Acción inmediata (local)

```bash
git pull origin ui/responsive-movil

# Único parche web pendiente de Tarea 6:
node scripts/apply-task6-app.mjs

npm run typecheck
npm run build
npx cap sync android   # si se prueba en emulador
npm run dev            # hard refresh Ctrl+Shift+R
```

**Comprobar:** tema oscuro, bottom nav <600px, globo al redimensionar, typecheck limpio, build Vite OK.

**Emulador Android:** barras no tapan UI; teclado no oculta buscador; rotar no reinicia; atrás cierra sheet (tras apply-task6-app).

## 5. Fixes TypeScript/build (2026-10-26)

* Eliminado `import("@capacitor/app")` de `androidChrome.ts` (no está en dependencies; Rollup fallaba).
* `SatDetail.tsx`: quitados imports/vars no usados (`footprint`, `passes`, export-passes, etc.).
* `CatalogStats.bySource|seenBySource|failedBySource`: añadidos `live` y `seed`.
* `seedPayload(_now)`: parámetro no leído marcado.

## 6. Scripts de agente

| Script | Uso |
|---|---|
| `scripts/apply-task6-app.mjs` | Añade `st-android-back` + `data-sheet-open` en App.tsx |
| `scripts/apply-task4-map.mjs` | Idempotente si Globe/Map ya tienen Tarea 4 |
| `scripts/viewport.test.mjs` | Clasificación MD3 |
| `scripts/restore-styles.mjs` / `restore-app-task3.mjs` | Solo si vuelve corrupción SEE_FILE/stub |

## 7. Docs responsive

```
docs/responsive/TAREA2_VIEWPORT.md
docs/responsive/TAREA3_LAYOUT.md
docs/responsive/TAREA4_GLOBE_MAP.md
docs/responsive/TAREA5_TIPOGRAFIA.md
docs/responsive/TAREA6_ANDROID.md
docs/responsive/RECOVERY.md
```

## 8. Decisiones de diseño

* sizeClass MD3: compact ≤599 · medium 600–839 · expanded ≥840
* compact: bottom nav + un sheet; Dock oculto
* Orientación Android: **ambas** (`screenOrientation=unspecified`)
* Soft input: `adjustResize`; StatusBar overlays WebView; CSS `env(safe-area-inset-*)`
* No plugins Capacitor nuevos sin confirmación del usuario

## 9. Próximo paso recomendado

1. Ejecutar `apply-task6-app.mjs` + `typecheck` + `build`.
2. Validar UI web 360×800 y emulador Android (criterios Tarea 6).
3. **Tarea 7** — matriz de dispositivos + capturas de evidencia.
4. **Tarea 8** — entrega, commits atómicos, GUIA.md.

## 10. Restricciones

* No tocar `~/SpaceTracker` ni `~/SpaceTracker2`.
* No romper lógica orbital, filtro TLE estricto ni matemáticas del globo (drag X/Y / `ortho.test.mjs`).
* Commits atómicos; no dejar archivos vacíos en push (histórico de corrupción SEE_FILE/stub).
