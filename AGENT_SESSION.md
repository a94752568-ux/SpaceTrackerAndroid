# INFORME DE ESTADO PARA AGENTE DE IA (SESSION CONTEXT)
> **Actualizado:** 2026-10-26T23:18:00Z — responsive 0–8 cerrado · backlog **inmersión de producto**

## 1. Proyecto
* **Nombre:** spacetracker 1.0.0
* **Rama:** `ui/responsive-movil`
* **Repo:** https://github.com/a94752568-ux/SpaceTrackerAndroid
* **Stack:** Vite + React + TS · Capacitor 8 · targetSdk 36 · Tauri v2
* **Estética:** HUD `#030508` · acento `#FF6700` · glassmorphism / mission control

## 2. Estado del plan responsive (0–8)

| Tarea | Estado |
|---|---|
| 2 useViewport | Hecha |
| 3 Layout compact/sheets | Hecha |
| 4 Globo/mapa contenedor | Hecha |
| 5 Tipografía / 48dp | Hecha |
| 6 Android edge-to-edge | Nativo hecho; `apply-task6-app.mjs` si falta `st-android-back` |
| 7 Matriz + tests | Infra + VERIFICACION.md; capturas UI locales pendientes |
| 8 Entrega | **Hecha a nivel docs** — `GUIA.md` + `INFORME_FINAL.md` |

## 3. Documentación de cierre
* `docs/responsive/GUIA.md` — breakpoints, CSS, nuevo componente, `wm size`
* `docs/responsive/INFORME_FINAL.md` — cambios, evidencia, límites, Play/targetSdk 36
* `docs/responsive/VERIFICACION.md` — matriz Tarea 7
* `docs/responsive/TAREA2…6_*.md` — evidencia por etapa

## 4. Acción residual (humana)
```bash
git pull origin ui/responsive-movil
node scripts/apply-task6-app.mjs
npm run typecheck && npm test && npm run build
# Rellenar VERIFICACION.md + PNG en docs/responsive/despues/
# Abrir PR a main cuando la matriz manual esté completa
```

## 5. Backlog — Inmersión de producto (pendiente de implementación)

Ideas priorizadas para mayor inmersión sin romper el HUD táctico. **No implementadas aún**; siguiente fase de UX cuando el usuario lo pida.

### 5.1 Modo “misión” / teatro ampliado
* Ocultar chrome (header/dock secundario).
* Maximizar mapa/globo.
* Telemetría mínima en esquinas; tipografía mono más presente.
* Atajo **F** o **F11** (encaja con kiosk existente).

### 5.2 Audio ambiental opcional y muy bajo
* Ruido de “sala de control” + beep en AOS/LOS y al completar catálogo.
* **Mute por defecto.**
* Respetar `prefers-reduced-motion` y preferencia explícita del usuario.

### 5.3 Consola de telemetría viva
* Líneas con scramble (ya hay scramble en métricas): epoch, alt, vel, az/el.
* Ritmo ~1 línea cada pocos segundos cuando hay satélite seleccionado.

### 5.4 Transiciones mapa ↔ globo
* Morph o crossfade ~400 ms (no corte seco).
* El satélite seleccionado permanece anclado visualmente.

### 5.5 Huella y elevación
* Anillo de footprint que “respira” con el período orbital.
* Al acercar zoom: proyección de elevación máxima sobre el observador.

### 5.6 Clima espacial como atmósfera (futuro)
* Si hay índice Kp / flare: tinte sutil del cielo del globo o del HUD (sin alarmismo).
* Contexto “fuera de la Tierra”.

### 5.7 Onboarding en ~20 s
* Primera visita: tres tooltips — “arrastra el globo”, “elige un satélite”, “configura observador”.
* Destacar ISS con animación de lock-on.

### 5.8 Haptics en Android
* Vibración mínima al seleccionar satélite o en AOS.
* Capacitor Haptics (plugin nuevo → **pedir permiso** antes de añadir).

### Notas de implementación (cuando se aborde)
* Animar `transform`/`opacity`; no `filter`/`box-shadow` masivo en flota.
* En compact: menos efectos, una sola estela (seleccionado).
* `prefers-reduced-motion`: saltar a estado final.
* Relacionado (animaciones satélite, no listadas arriba pero prioritarias): estela orbital, lock-on al seleccionar, tintado por edad TLE (fresh/aging/stale), interpolación de posición entre ticks SGP4.

## 6. Alcance
* Solo `SpaceTrackerAndroid` / `ui/responsive-movil`.
* **No** se tocó `~/SpaceTracker` ni `~/SpaceTracker2`.

## 7. Restricciones vigentes
* Sin plugins Capacitor nuevos sin permiso explícito (p. ej. Haptics).
* No romper ortho/TLE ni filtro estricto.
* Commits atómicos en trabajo futuro.
