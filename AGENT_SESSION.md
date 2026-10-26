# INFORME DE ESTADO PARA AGENTE DE IA (SESSION CONTEXT)
> **Actualizado:** 2026-10-26T22:25:00Z (sesión responsive móvil)

## 1. Identificación del Proyecto
* **Nombre:** spacetracker
* **Versión:** 1.0.0
* **Rama Git actual:** `ui/responsive-movil` (default)
* **Repo:** https://github.com/a94752568-ux/SpaceTrackerAndroid
* **Stack:** Vite + React + TypeScript · Capacitor (android/) · Tauri v2 (src-tauri/)
* **Estética:** HUD Mission Control · acento `#FF6700` · glassmorphism

## 2. Ruta de trabajo actual

**Objetivo de la rama:** interfaz adaptable a cualquier pantalla (`android/PROMPT_AGENTE_RESPONSIVE_MOVIL.md`).

| Tarea | Título | Estado remoto |
|---|---|---|
| 0 | Diagnóstico / línea base | Parcial |
| 1 | Fundamentos (viewport, dvh, safe areas) | Parcial |
| 2 | Detección de pantalla (`useViewport`) | **Hecha** |
| 3 | Layout por sizeClass (sheets, bottom nav) | **Hecha** en `App.tsx` (compactTab, bottom nav, Escape) |
| 4 | Globo y mapa al contenedor / DPR | **Script listo** — falta `node scripts/apply-task4-map.mjs` + commit |
| 5 | Tipografía y controles táctiles | **Hecha** — `styles-responsive-task5.css` + import en `main.tsx` |
| 6 | Android edge-to-edge / teclado / rotación | Pendiente |
| 7 | Matriz de dispositivos + capturas | Pendiente |
| 8 | Entrega / commits atómicos / GUIA.md | Pendiente |

## 3. Recuperación App/styles — RESUELTA en remoto

API GitHub confirma contenido completo:

| Archivo | Estado |
|---|---|
| `src/App.tsx` | Completo (~35 KB) con `useViewport`, `compactTab`, sheets |
| `src/styles.css` | Tema Mission Control (~61 KB) |

Si localhost sigue en blanco: `git pull` + hard refresh (`Ctrl+Shift+R`). No usar caché vieja de raw CDN.

## 4. Acción inmediata del desarrollador

```bash
git pull origin ui/responsive-movil

# Tarea 4 (globo/mapa) — aún no aplicada en los .tsx del remoto
node scripts/apply-task4-map.mjs

npm run typecheck
node --test scripts/ortho.test.mjs scripts/viewport.test.mjs
npm run dev   # DevTools 360×800; verificar tema oscuro + targets 48px

git add src/components/map/GlobeView.tsx src/components/map/MapView.tsx
git commit -m "fix(map): globo y mapa adaptativos (Tarea 4)"
git push origin ui/responsive-movil
```

## 5. Scripts de agente

| Script | Función |
|---|---|
| `scripts/apply-task4-map.mjs` | Parchea GlobeView/MapView (fitScale 0.40, pinch, invalidateSize+rAF) |
| `scripts/viewport.test.mjs` | Tests MD3 sizeClass |
| `scripts/restore-styles.mjs` / `restore-app-task3.mjs` | Solo si vuelve a corromperse |

## 6. Tarea 5 (aplicada)

* `src/styles-responsive-task5.css` — tipografía `clamp`, inputs ≥16px, targets 48px, blur reducido en compact, `prefers-reduced-motion`
* Import en `src/main.tsx` (después de task3)
* Doc: `docs/responsive/TAREA5_TIPOGRAFIA.md`

## 7. Próximo paso

1. Aplicar Tarea 4 localmente y pushear GlobeView/MapView.
2. Verificar UI 360×800 (tema oscuro, sheets, 48dp, sin zoom en inputs).
3. **Tarea 6** — Android edge-to-edge, teclado, rotación (`android/PROMPT_AGENTE_RESPONSIVE_MOVIL.md`).

## 8. Decisiones de diseño

* sizeClass MD3: compact ≤599 · medium 600–839 · expanded ≥840
* compact: bottom nav + un sheet; Dock oculto
* Globo: ResizeObserver wrap; DPR cap 2; fit `min(w,h)*0.40`; zoom relativo; pellizco
* Mapa: invalidateSize rAF + visualViewport + orientationchange; zoom bottomright si width < 600

## 9. Restricciones

* No tocar `~/SpaceTracker` ni `~/SpaceTracker2`.
* No añadir dependencias Capacitor sin preguntar.
* No romper lógica orbital / drag X/Y del globo.
* Commits atómicos; evidencia antes de marcar tarea verificada.
