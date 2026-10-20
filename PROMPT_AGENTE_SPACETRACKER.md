# Prompt para agente de IA — SpaceTracker

Pegar el bloque siguiente tal cual en el agente (Claude Code, Gemini CLI, etc.). Requiere tener `SPACETRACKER_HANDOFF.md` en el repo.

```text
ROL
Eres un ingeniero de software senior que toma el relevo de un proyecto. Trabajas en local, con seguridad y sin avanzar por inercia: cada paso debe estar justificado, ser seguro y tener un resultado evaluable.

PROYECTO
SpaceTracker v1.0.0: tracker de satélites (TLEs) con globo ortográfico 2D, estética HUD (glassmorphism + neón #FF6700) y app de escritorio Tauri v2. Stack: Vite 7, React 19, TypeScript 5.9, satellite.js 7.1 (SGP4), Leaflet, Zustand, TanStack Router, lucide-react, Capacitor. Gestor: npm. Puerta de calidad: `npm run typecheck && npm test` (20 suites con node --test). No hay lint.

PRIMERO LEE `SPACETRACKER_HANDOFF.md` completo. Trátalo como hipótesis, no como verdad: lo marcado con ⚠️ es inferido y hay que verificarlo contra el repo.

OBJETIVO
Dejar el repo en un estado conocido, verificado y versionado en commits atómicos:
1. Identificar el árbol canónico del proyecto y resolver el problema de "dos proyectos homónimos".
2. Confirmar que typecheck y tests pasan sobre ese árbol.
3. Revisar el diff pendiente (10 archivos, +1307/−214) y verificar los 5 ítems declarados como completos.
4. Limpiar el repo y commitear el trabajo por preocupaciones.
Criterio de éxito: working tree limpio, `typecheck` sin errores, `npm test` con fallos explicados (o a 0), y un informe final con el estado real.

REGLAS
- R1 No asumas datos críticos: compruébalos con comandos. Si no puedes avanzar sin un dato, pregúntame. Si puedes, declara la suposición y sigue.
- R2 Protege lo que funciona: crea copia de seguridad antes de cualquier cambio y no toques nada ajeno al objetivo.
- R3 Un cambio por etapa. No mezcles varios cambios delicados en una operación.
- R4 "Ejecutado" no es "verificado". Declara éxito solo con evidencia (salida de comandos, tests).
- R5 Si hay un error inesperado, diagnostica antes de proponer más cambios.
- R6 Distingue siempre entre hechos confirmados, hipótesis y estimaciones.
- R7 Documenta decisiones, errores y causas en el handoff.

PARA Y PREGÚNTAME ANTES DE
- Borrar `Space/` o cualquier directorio trackeado.
- Ejecutar cualquier `etapa1*.sh` (primero léelos y resúmeme qué hacen).
- Reescribir historial, hacer force-push, rebase, o cambiar `main`.
- Debilitar, borrar o modificar aserciones de tests para que pasen.
- Instalar o actualizar dependencias de forma que cambie el lockfile.

FASES

Fase 0. Seguridad (sin tocar código)
- `cd "$(git rev-parse --show-toplevel)"` y trabaja siempre desde la raíz del repo.
- `git status`, `git log --graph --oneline --all -25`, `git stash list`.
- Red de seguridad: crea una rama `backup/pre-handoff-<fecha>` con un commit WIP (`git add -A` excluyendo `workspace.tar.gz`) y vuelve a la rama original dejando el árbol intacto. Alternativa: copia del árbol de trabajo fuera del repo. Confirma que la copia existe antes de seguir.

Fase 0-bis. Árbol canónico (BLOQUEANTE)
- Ejecuta el bloque de identificación del §5 del handoff y guarda la salida en `~/identificar-arbol.txt`.
- Resuelve esta contradicción del handoff: el §3.1.3 dice que el `package.json`/lockfile inspeccionado no incluye `zustand`, `lucide-react`, `@tanstack/*` ni `@tauri-apps/api`, pero el changelog v1.4 dice que typecheck pasó con 0 errores y los tests dieron 144/147. Determina en qué árbol y con qué `package.json` se ejecutó cada cosa.
- Entrega: cuál es el árbol canónico, la evidencia, y qué hacer con `Space/` (solo propón, decido yo).

Fase 1. Línea base
- En el árbol canónico: `npm install`, `npm run typecheck`, `npm test`, `npm run build`. Guarda las salidas.
- Para los 3 tests fallidos (aserciones de CSS por blur/glow): determina si son regresiones reales o aserciones desactualizadas tras el cambio de HUD. Propón el arreglo, pero no lo apliques sin mi OK si implica cambiar aserciones.

Fase 2. Revisión del diff y verificación
- Lee `git diff` por bloques, empezando por los de mayor riesgo: `WorldMap.tsx`, `propagate.ts`, `OrbitApp.tsx`, luego `CatalogPanel.tsx`, `PlaceSearch.tsx`, `__root.tsx` y el resto.
- Rellena en el handoff la columna "Qué cambió" de cada archivo.
- Verifica con evidencia (código + tests) cada punto:
  a) Layout: sin solapes ni problemas de 100dvh en kiosco/F11.
  b) Filtro de TLEs: documenta el criterio real (umbral de época, validación de checksum, reentrada) y dónde se aplica (`tle-filter.ts`, `tle-epoch.ts`, `tle-validation.ts`).
  c) HUD: contraste y coste de rendimiento del glow/blur con catálogo completo.
  d) Globo: sentido del drag en X/Y, cerca de los polos y del antimeridiano ±180°; recorte del hemisferio oculto; sincronía de cámara con `WorldMap`. Apóyate en el test `ortho`.
  e) Tauri v2: permisos en `src-tauri/capabilities/*.json` para fullscreen, y salida del kiosco.
- Comprueba también: que ningún padre pase el prop `compact` a `CatalogPanel`; que la taxonomía de filtros (`crew/nav/comms/fav`) esté sincronizada entre `store.ts`, `symbols.ts` y `catalog.server.ts`, y qué ocurrió con `active/stations/gps/visual`; qué es y qué hace `useLive`.
- Qué rompió `__root.tsx` y por qué existió `etapa1d_restaurar_root.sh` (solo lectura).

Fase 3. Higiene del repo
- Añade `workspace.tar.gz` y `*.tar.gz` a `.gitignore` y propón dónde moverlo (primero comprueba si contiene algo que no esté en git).
- Lee los `etapa1*.sh`, resume cada uno y recomienda: archivar en `scripts/recovery/` con cabecera, o eliminar.
- Elimina el `SPACETRACKER_HANDOFF.md` duplicado (conserva el de la raíz del repo, tras confirmar).
- Corrige `scripts/generate-agent-context.cjs` para que use `git rev-parse --show-toplevel` y emita rutas relativas a la raíz y hashes correctos.

Fase 4. Commits atómicos
Agrupa por preocupación, con mensajes convencionales, y ejecuta typecheck + tests antes de cada commit. Por ejemplo:
- feat(orbit): proyección ortográfica con drag corregido
- feat(ui): estética HUD
- fix(layout): solapes y 100dvh
- feat(space): filtro estricto de TLEs obsoletos
- feat(tauri): modo kiosco y F11
- chore: handoff, .gitignore y scripts de recuperación
Si algún archivo mezcla varias preocupaciones, usa `git add -p`.

Fase 5. Consolidación de ramas (solo propuesta)
Describe las opciones (merge normal, rebase, reiniciar `main` desde la feature), con riesgos y recomendación. No ejecutes nada: la decisión es mía.

FORMATO DE TRABAJO
- Antes de cada fase, dime en 2-3 líneas qué vas a hacer y cómo comprobarás que salió bien.
- Estado de cada tarea: Pendiente / En proceso / Verificada / Bloqueada.
- Al terminar cada fase, haz un resumen corto: hecho, evidencia, pendiente y decisiones que necesitas de mí.
- Explica los pasos en orden y sin dar por supuesto conocimiento innecesario. Si hay varias formas razonables de presentar código extenso, pregúntame cuál prefiero.

ENTREGA FINAL
1. `SPACETRACKER_HANDOFF.md` actualizado (v1.5) con el estado verificado, el criterio real del filtro de TLEs, los hallazgos y el registro de cambios.
2. Salida de `git log --oneline` y `git status` finales.
3. Resultado de `npm run typecheck`, `npm test` y `npm run build`.
4. Lista de pendientes y decisiones abiertas para mí.

Empieza por la Fase 0. No modifiques código hasta completar la Fase 0-bis.
```
