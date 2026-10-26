# Tarea 6 — Android edge-to-edge, teclado, rotación, atrás

**Estado:** Implementada en nativo + puente web  
**Rama:** `ui/responsive-movil`  
**Fecha:** 2026-10-26

## Objetivo

Comportamiento correcto solo dentro de la app Android (Capacitor, targetSdk 36).

## Cambios

### Nativo
| Archivo | Cambio |
|---|---|
| `MainActivity.java` | `setDecorFitsSystemWindows(false)`; barras transparentes; iconos claros |
| `styles.xml` / `colors.xml` | Tema HUD `#030508`; status/nav transparentes |
| `AndroidManifest.xml` | `resizeableActivity=true`; `windowSoftInputMode=adjustResize`; `screenOrientation=unspecified` (ambas orientaciones); `configChanges` completo (sin reinicio al rotar) |

### Web
| Archivo | Cambio |
|---|---|
| `src/lib/ui/androidChrome.ts` | StatusBar overlay + popstate → `st-android-back`; App.backButton opcional |
| `src/main.tsx` | `installAndroidChrome()` |
| `src/App.tsx` (script) | Escucha `st-android-back`; `data-sheet-open` / pushState al abrir panels |

### Ya existente
- `capacitor.config.json`: StatusBar overlaysWebView, Keyboard resize body
- CSS: `env(safe-area-inset-*)` en header, bottom nav, sheets

## Orientación

Por defecto **ambas** (`unspecified`). Si se desea solo vertical: `android:screenOrientation="portrait"`.

## Plugins

No se añadieron plugins nuevos. `@capacitor/status-bar` ya estaba. `@capacitor/app` es **opcional**.

## Cómo aplicar

```bash
git pull origin ui/responsive-movil
node scripts/apply-task6-app.mjs
node scripts/apply-task4-map.mjs   # si aún falta Tarea 4
npm run build && npx cap sync android
```

## Criterio de aceptación

- Nada tapado por barras (gestos y botones)
- Teclado no oculta el campo de búsqueda
- Rotar no reinicia ni pierde estado
- Atrás cierra sheet/detalle antes de salir
- Logcat sin errores nuevos
