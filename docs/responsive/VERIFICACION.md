# Tarea 7 — Verificación en matriz de dispositivos

**Rama:** `ui/responsive-movil`  
**Fecha:** 2026-10-26  
**Plan:** `android/PROMPT_AGENTE_RESPONSIVE_MOVIL.md` § TAREA 7

## 1. Pruebas automáticas (lógica)

```bash
npm run typecheck
node --test scripts/viewport.test.mjs scripts/globe-fit.test.mjs scripts/responsive-matrix.test.mjs scripts/ortho.test.mjs
npm test
```

| Suite | Qué valida | Estado código |
|---|---|---|
| `viewport.test.mjs` | classifySize 599/600/839/840, orientation | Automatizado |
| `globe-fit.test.mjs` | fitScale, clampDpr≤2, buffer, zoom relativo, matriz | Automatizado |
| `responsive-matrix.test.mjs` | Expectativas compact/medium por viewport | Automatizado |
| `ortho.test.mjs` | Drag X/Y y proyección (no regresión globo) | Automatizado |

| Comando | Resultado local | Commit |
|---|---|---|
| `npm run typecheck` | _pendiente_ | |
| `node --test scripts/globe-fit.test.mjs scripts/responsive-matrix.test.mjs scripts/viewport.test.mjs` | _pendiente_ | |
| `npm test` | _pendiente_ | |

## 2. Matriz de pantallas (manual / emulador)

```bash
adb shell wm size 360x800
adb shell wm density 320
# probar…
adb shell wm size reset && adb shell wm density reset
```

Criterios: arranque OK · globo completo · panel usable · sin scroll horizontal · nada tapado por barras · bottom nav solo compact.

Leyenda: ✅ Verificado · ❌ Fallo · ⏳ Pendiente captura

### Portrait

| Viewport | sizeClass | Layout esperado | UI | Notas |
|---|---|---|---|---|
| 360×640 | compact | bottom nav + sheets | ⏳ | densidad baja |
| 360×800 | compact | bottom nav + sheets | ⏳ | baseline móvil |
| 412×915 | compact | bottom nav + sheets | ⏳ | |
| 600×960 | medium | sidebar, sin bottom nav | ⏳ | tablet 7" |
| 800×1280 | medium | sidebar (expanded ≥840) | ⏳ | |
| 280×653 fold outer | compact | bottom nav | ⏳ | AVD plegable |
| 673×841 fold inner | medium | sidebar | ⏳ | |

### Landscape

| Viewport | sizeClass | UI |
|---|---|---|
| 640×360 | medium | ⏳ |
| 800×360 | medium | ⏳ |
| 915×412 | expanded | ⏳ |
| 960×600 | expanded | ⏳ |
| 1280×800 | expanded | ⏳ |

### Fuente del sistema

| Escala | Viewport | UI |
|---|---|---|
| 100 % | 360×800 | ⏳ |
| 130 % | 360×800 | ⏳ |
| 200 % | 360×800 | ⏳ |

## 3. Capturas

Ver `docs/responsive/despues/README.md`.

## 4. Rendimiento (protocolo)

Medir en chrome://inspect → Performance: drag del globo ~3 s con catálogo completo, en 360 y 1280 de ancho. Anotar FPS/jank aquí (no inventar cifras).

| Escenario | Resultado |
|---|---|
| Compact 360 + drag | _medir_ |
| Expanded 1280 + drag | _medir_ |

## 5. Release en emulador

```bash
npm run build && npx cap sync android
cd android && ./gradlew assembleRelease
```

| Check | Resultado |
|---|---|
| assembleRelease | ⏳ |
| Arranque AVD release | ⏳ |
| Rotar sin crash | ⏳ |

## 6. Limitaciones conocidas

* Celdas UI requieren capturas humanas; sizeClass/fit cubiertos por tests.
* sizeClass por **ancho CSS**, no diagonal física.
* `@capacitor/app` no instalado: atrás vía popstate + `st-android-back` (tras apply-task6-app).
* Este entorno de agente no ejecuta AVD ni Performance real.

## 7. Completar entrega

1. `apply-task6-app.mjs` + tests §1  
2. Matriz §2 + PNG en `despues/`  
3. Opcional §4–§5  
4. Commit evidencias
