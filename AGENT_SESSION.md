# INFORME DE ESTADO PARA AGENTE DE IA (SESSION CONTEXT)
> **Actualizado manualmente:** 2026-10-26T22:18:00Z (sesión responsive móvil)

## 1. Identificación del Proyecto
* **Nombre:** spacetracker
* **Versión:** 1.0.0
* **Rama Git actual:** `ui/responsive-movil` (default)
* **Repo:** https://github.com/a94752568-ux/SpaceTrackerAndroid
* **Stack:** Vite + React + TypeScript · Capacitor (android/) · Tauri v2 (src-tauri/)
* **Estética:** HUD Mission Control · acento `#FF6700` · glassmorphism

## 2. Ruta de trabajo actual

**Objetivo de la rama:** interfaz adaptable a cualquier pantalla (plan en `android/PROMPT_AGENTE_RESPONSIVE_MOVIL.md`).

| Tarea | Título | Estado remoto |
|---|---|---|
| 0 | Diagnóstico / línea base | No formalizado en docs/responsive/DIAGNOSTICO.md |
| 1 | Fundamentos (viewport, dvh, safe areas) | Parcial (meta viewport-fit, 100dvh, safe-top en header) |
| 2 | Detección de pantalla (`useViewport`) | **Hecha** — `src/lib/ui/useViewport.ts` + `scripts/viewport.test.mjs` + `docs/responsive/TAREA2_VIEWPORT.md` |
| 3 | Layout por sizeClass (sheets, bottom nav) | **Código + scripts listos**; requiere App.tsx restaurado — `docs/responsive/TAREA3_LAYOUT.md`, `scripts/restore-app-task3.mjs` |
| 4 | Globo y mapa al contenedor / DPR | **Script listo** — `scripts/apply-task4-map.mjs` + `docs/responsive/TAREA4_GLOBE_MAP.md` |
| 5 | Tipografía y controles táctiles | Pendiente |
| 6 | Android edge-to-edge / teclado / rotación | Pendiente |
| 7 | Matriz de dispositivos + capturas | Pendiente |
| 8 | Entrega / commits atómicos / GUIA.md | Pendiente |

## 3. BLOQUEANTE — corrupción en remoto (prioridad #1)

En `origin/ui/responsive-movil` estos archivos **siguen corruptos** (verificar con `curl`/`wc`):

| Archivo | Estado en remoto | Debe ser |
|---|---|---|
| `src/App.tsx` | Stub “RESTORE_PENDING…” (~15 líneas) | App completa (~870+ líneas) con compactTab / sheets |
| `src/styles.css` | Texto `SEE_FILE` (8 bytes) | Tema Mission Control (~61 KB) |

**Síntoma en localhost:** fondo blanco, tipografía del sistema, sin HUD/mapa estilizado.

### Recuperación obligatoria (local → push)

```bash
git pull origin ui/responsive-movil
node scripts/restore-styles.mjs          # styles.css desde commit 2a4758f
node scripts/restore-app-task3.mjs       # App.tsx bueno + parches Tarea 3
node scripts/apply-task4-map.mjs         # GlobeView + MapView Tarea 4
npm run typecheck && node --test scripts/ortho.test.mjs scripts/viewport.test.mjs
npm run dev                              # hard refresh Ctrl+Shift+R
git add src/App.tsx src/styles.css src/components/map/
git commit -m "fix(ui): restaurar App.tsx y styles.css + Tareas 3-4"
git push origin ui/responsive-movil
```

Guía: `docs/responsive/RECOVERY.md`

**Commit bueno de referencia (pre-corrupción):** `2a4758f5391b30a722ac193dade79eef09e1452c`

## 4. Scripts de agente en la rama

| Script | Función |
|---|---|
| `scripts/restore-styles.mjs` | Restaura `styles.css` desde commit bueno |
| `scripts/restore-app-task3.mjs` | Restaura `App.tsx` + parches Tarea 3 |
| `scripts/apply-task4-map.mjs` | Parchea GlobeView/MapView (fitScale, pinch, invalidateSize) |
| `scripts/viewport.test.mjs` | Tests clasificación MD3 (599/600, 839/840) |

## 5. Estado de módulos base (pre-responsive)

- [x] Layout 100dvh / anti-solapes (diseño base)
- [x] Filtro estricto de TLEs obsoletos
- [x] Estética HUD (glassmorphism + glow `#FF6700`)
- [x] Globo ortográfico 2D (d3-geo; drag X/Y; `ortho.test.mjs`)
- [x] Modo kiosco / F11 Tauri v2
- [x] Favoritos v2 + radar personal
- [x] Capacitor Android + targetSdk prep (rama origen playstore-prep)

## 6. Decisiones de diseño responsive (acordadas)

* **sizeClass MD3:** compact ≤599 · medium 600–839 · expanded ≥840
* **compact:** mapa full + bottom nav (Catálogo / Radar / Tiempo / Capas) + un bottom sheet a la vez; Dock oculto
* **medium:** sidebar más estrecha; Dock visible; sin bottom nav
* **expanded / kiosco:** layout desktop sin cambios visibles
* **Globo:** `ResizeObserver` del wrap; DPR cap 2; fit `min(w,h)*0.42`; zoom relativo al redimensionar; pellizco
* **Mapa:** `invalidateSize` con rAF + visualViewport + orientationchange; zoom control bottomright si width < 600

## 7. Próximo paso recomendado

1. **Desbloquear:** ejecutar recuperación (§3) y **confirmar push** de `App.tsx` + `styles.css` reales (no stub / no SEE_FILE).
2. Verificar en navegador tema oscuro + mapa/globo.
3. Continuar **Tarea 5** (tipografía fluida, targets 48dp, paneles legibles en 360×800) según `android/PROMPT_AGENTE_RESPONSIVE_MOVIL.md`.

## 8. Archivos clave

```
android/PROMPT_AGENTE_RESPONSIVE_MOVIL.md   # plan maestro tareas 0–8
src/lib/ui/useViewport.ts                  # Tarea 2
src/styles-responsive-task3.css            # extras CSS Tarea 3 (import en main.tsx)
docs/responsive/TAREA2_VIEWPORT.md
docs/responsive/TAREA3_LAYOUT.md
docs/responsive/TAREA4_GLOBE_MAP.md
docs/responsive/RECOVERY.md
UI_MAINTENANCE.md                          # reglas UI a largo plazo
```

## 9. Restricciones del plan responsive

* No tocar `~/SpaceTracker` ni `~/SpaceTracker2`.
* No añadir dependencias/plugins Capacitor sin preguntar.
* No romper lógica orbital, filtro TLE ni matemáticas del globo (drag X/Y).
* Un cambio por etapa; commits atómicos; evidencia antes de dar por verificada una tarea.
