# Inmersión de producto — implementación por fases

**Rama:** `ui/responsive-movil`  
**Fecha:** 2026-10-26

## Fase 1 (implementada — este commit)

| # | Ítem | Implementación |
|---|---|---|
| 1 | Modo misión / teatro | `is-mission` con kiosk F/F11; CSS oculta sidebars |
| 2 | Audio ambiental | `ambientAudio.ts` mute por defecto |
| 3 | Telemetría viva | `MissionTelemetry` + scramble |
| 4 | Transición mapa↔globo | `switchView` + opacity 400 ms |
| 5 | Huella respira | `@keyframes st-foot-breathe` |
| 6 | Clima espacial | Scaffold CSS `data-kp` |
| 7 | Onboarding | 3 pasos, `localStorage` |
| 8 | Haptics | `navigator.vibrate` (sin plugin nuevo) |

## Activación

```bash
git pull origin ui/responsive-movil
node scripts/apply-immersion-app.mjs
npm run typecheck && npm run build
```

## Fase 2 (siguiente)

* Beep + haptic en AOS/LOS real (elevación cruza 0°)
* Feed Kp → `data-kp`
* `ImmersionControls` en Dock
* Haptic en `handleSelect`
* Proyección elevación máx. en footprint

## Prefs `st.immersion.v1`

* `audioEnabled` default `false`
* `onboardingDone`
* `hapticsEnabled` default `true`
