# Prompt por tareas — SpaceTracker Android: interfaz adaptable a cualquier pantalla

**Cómo usarlo:** pega siempre primero el bloque **CONTEXTO COMÚN** y después **una sola tarea**. Cuando el agente la termine y la verifiques, pasa a la siguiente. Las tareas van en orden porque cada una depende de la anterior.

| # | Tarea | Resultado |
|---|---|---|
| 0 | Diagnóstico y línea base | Capturas "antes" y lista de causas del amontonamiento |
| 1 | Fundamentos responsive | Viewport, unidades, safe areas y variables de escala |
| 2 | Detección de pantalla | Un único módulo que clasifica el dispositivo (tamaño, orientación, densidad) |
| 3 | Estructura de la interfaz | Header, Sidebar y paneles que se reorganizan según el tamaño |
| 4 | Globo y mapa | Canvas y Leaflet que se ajustan solos al contenedor y a la densidad |
| 5 | Componentes y tipografía | Textos, botones y paneles legibles y tocables en móvil |
| 6 | Android específico | Insets, teclado, rotación sin reinicio, edge-to-edge |
| 7 | Verificación en matriz de dispositivos | Pruebas en varios tamaños con capturas "después" |
| 8 | Entrega | Documentación y commits atómicos |

---

## CONTEXTO COMÚN (pegar siempre primero)

```text
ROL
Eres un ingeniero frontend/Android senior. Trabajas en local, con seguridad y sin avanzar por inercia: cada paso debe estar justificado, ser seguro y tener un resultado evaluable.

PROYECTO
Carpeta: ~/SpaceTrackerAndroid (usa `git rev-parse --show-toplevel`). SpaceTracker: tracker de satélites con globo ortográfico (canvas), mapa Leaflet y estética HUD (glassmorphism, acento #FF6700). Stack: Vite + React + TypeScript, Capacitor (carpeta android/), Tauri v2 (src-tauri/, escritorio y modo kiosco). La app corre en un WebView de Android; en el WebView, 1 px CSS equivale a 1 dp.
NO toques ~/SpaceTracker ni ~/SpaceTracker2: son otros proyectos.
Estructura conocida (verifícala): src/App.tsx, src/components/{Header.tsx, Sidebar.tsx, hud/, console/, map/, observer/, time/, orbit/}, src/styles.css, scripts/*.test.mjs (incluye map-css, ui-smoke, ortho).

PROBLEMA
En un móvil la interfaz se ve amontonada: los elementos no se redistribuyen según la pantalla. Se necesita un diseño que se adapte automáticamente detectando la resolución, tamaño y orientación del dispositivo, sin romper la versión de escritorio ni el modo kiosco de Tauri.

REGLAS
- R1 No asumas: compruébalo en el código y en el dispositivo/emulador. Si falta un dato que cambia la solución, pregúntame; si no, declara la suposición y sigue.
- R2 Protege lo que funciona: rama `ui/responsive-movil` y copia de seguridad antes de empezar. No toques nada ajeno al objetivo.
- R3 Un cambio por etapa; no mezcles varias reorganizaciones en un mismo commit.
- R4 "Ejecutado" no es "verificado": solo das algo por bueno con evidencia (capturas, medidas, salida de tests).
- R5 Ante un error inesperado, diagnostica antes de seguir cambiando.
- R6 Distingue hechos, hipótesis y estimaciones.
- R7 No rompas la lógica orbital, el filtro de TLEs ni el comportamiento del globo (drag X/Y, hemisferio oculto). Esta tarea es de presentación y layout.
- R8 Documenta decisiones y su motivo.

PARA Y PREGÚNTAME ANTES DE
- Añadir dependencias nuevas o plugins de Capacitor.
- Quitar funcionalidades o paneles (reorganizar sí; eliminar no).
- Modificar o debilitar aserciones de tests para que pasen.
- Cambiar applicationId, versiones o configuración de firma.
- Borrar directorios o reescribir historial.

HERRAMIENTAS DE PRUEBA (resolución simulada)
- En el emulador: `adb shell wm size 1080x2400` y `adb shell wm density 420` para cambiar de resolución; `adb shell wm size reset` y `adb shell wm density reset` para volver. Capturas: `adb exec-out screencap -p > captura.png`.
- Depurar el WebView: chrome://inspect/#devices.
- Navegador de escritorio: modo dispositivo de las DevTools (útil para iterar rápido, pero no sustituye al emulador).
- Tras cambiar código web: `npm run build && npx cap sync android` antes de relanzar la app.

FORMATO
Antes de cada tarea, 2-3 líneas con lo que harás y cómo comprobarás que salió bien. Al terminar: hecho, evidencia, pendiente y decisiones que necesitas de mí. Estados: Pendiente / En proceso / Verificada / Bloqueada.
```
ESTADO PREVIO: estás en la rama ui/responsive-movil, creada desde android/playstore-prep. Esa rama ya aplicó targetSdk 36, minificación R8 y documentación de Google Play. No repitas ese trabajo; solo adapta la interfaz a sus consecuencias (edge-to-edge, atrás predictiva). El último commit es el de Gradle 8.14.5 + JDK 21 (generado por Android Studio).
---

## TAREA 0 — Diagnóstico y línea base

```text
OBJETIVO
Entender por qué se ve amontonada en móvil y dejar una referencia "antes" medible. No cambies código en esta tarea.

PASOS
1. git status, rama `ui/responsive-movil`, y baseline: npm run typecheck y npm test (anota qué falla de antes).
2. Capturas "antes" (guárdalas en docs/responsive/antes/) en estas resoluciones, vertical y horizontal: 360x800 (teléfono pequeño), 412x915 (teléfono grande), 600x960 (tablet pequeña) y 1280x800 (tablet grande/escritorio). Anota el dp real de cada una (dp = px / (dpi/160)).
3. Audita el código y haz un inventario con archivo y línea de:
   - la etiqueta <meta name="viewport"> en index.html (¿existe?, ¿con viewport-fit=cover?);
   - anchos y altos fijos en px, `100vw`/`100vh` en vez de `100%`/`dvh`, `position: absolute/fixed` con coordenadas fijas, `min-width` grandes, `overflow: hidden` que recorta contenido;
   - media queries existentes (¿alguna?) y su breakpoint;
   - tamaños de fuente en px fijos;
   - paneles que se solapan en pantallas estrechas (Header, Sidebar, CatalogPanel/PlaceSearch, hud/, console/, observer/, time/);
   - cómo se dimensionan el canvas del globo y el mapa Leaflet (¿en px fijos, ResizeObserver, window.innerWidth?).
4. Clasifica cada hallazgo por impacto (alto/medio/bajo) y propón una causa raíz principal, marcada como hipótesis hasta verificarla.

CRITERIO DE ACEPTACIÓN
Existen las capturas "antes" y un documento docs/responsive/DIAGNOSTICO.md con el inventario, el impacto y las causas probables.
```

---

## TAREA 1 — Fundamentos responsive

```text
OBJETIVO
Dejar la base técnica correcta para que el layout pueda adaptarse. Sin reorganizar aún componentes.

PASOS
1. index.html: <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">. No bloquees el zoom del usuario salvo que lo justifique el globo (pregúntame si crees que hace falta).
2. Altura de la app: sustituye 100vh por 100dvh (con fallback) en el contenedor raíz, de modo que no se corte con la barra del navegador o del sistema.
3. Safe areas: define variables CSS en :root (--safe-top, --safe-right, --safe-bottom, --safe-left) con env(safe-area-inset-*, 0px) y úsalas en los contenedores que quedan junto a los bordes (Header, barras inferiores, paneles flotantes).
4. Escala: crea variables en :root para espaciado y tipografía fluida (clamp()) y para los tamaños mínimos táctiles (48 dp). Úsalas en vez de valores sueltos.
5. Evita el desbordamiento horizontal global: box-sizing: border-box, max-width: 100%, y que ningún contenedor supere el ancho del viewport. Los elementos anchos (tablas, listas) deben desplazarse dentro de su propio contenedor.
6. Deshabilita solo donde corresponda el comportamiento táctil molesto (por ejemplo, touch-action en el canvas del globo para que el arrastre no desplace la página), sin romper el scroll de los paneles.

CRITERIO DE ACEPTACIÓN
En 360x800 no hay scroll horizontal de página, la altura ocupa toda la pantalla sin cortes, y nada queda bajo la barra de estado o de navegación. npm run typecheck y npm test no empeoran respecto a la Tarea 0.
```

---

## TAREA 2 — Detección automática de pantalla

```text
OBJETIVO
Un único módulo que detecte el tipo de pantalla y se lo comunique al resto de la UI, para que no haya lógica de tamaños repartida por los componentes.

DISEÑO (revísalo y propón cambios si ves algo mejor)
- Crea src/lib/ui/viewport.ts (o similar, siguiendo las convenciones del proyecto) con un hook `useViewport()` que devuelva:
  - width y height en dp (CSS px) y orientation ('portrait' | 'landscape');
  - sizeClass: 'compact' (< 600), 'medium' (600-839) y 'expanded' (≥ 840), siguiendo las clases de tamaño de ventana de Material; verifica los límites vigentes en la documentación oficial;
  - dpr (window.devicePixelRatio, y un valor limitado para el canvas si hace falta);
  - isTouch (matchMedia('(pointer: coarse)')) y prefersReducedMotion;
  - visualViewport (alto real con teclado abierto).
- Implementación con matchMedia y ResizeObserver/visualViewport; sin polling. Throttle con requestAnimationFrame. Limpia los listeners al desmontar. Debe funcionar sin errores en SSR/tests (sin window).
- Publica el resultado también como atributos en <html> (data-size="compact|medium|expanded", data-orientation) y variables CSS (--vw, --vh), para poder maquetar solo con CSS donde baste.
- Si ya existe algo equivalente (p. ej. detección de hardware o de plataforma), reutilízalo en vez de duplicarlo, y dime qué encontraste.

CRITERIO DE ACEPTACIÓN
- Cambiando la resolución con `adb shell wm size` o rotando el emulador, el atributo data-size de <html> y el valor del hook cambian sin recargar.
- Test unitario nuevo (scripts/viewport.test.mjs, con node --test) que cubra la clasificación por ancho en los límites (599/600, 839/840) y la orientación.
- npm run typecheck y npm test sin regresiones.
```

---

## TAREA 3 — Estructura de la interfaz según tamaño

```text
OBJETIVO
Que Header, Sidebar y paneles se reorganicen automáticamente según sizeClass. Esta es la tarea que resuelve el "amontonamiento".

COMPORTAMIENTO OBJETIVO (ajústalo tras ver el código real y propónmelo antes de implementarlo)
- compact (teléfono vertical): el globo/mapa ocupa toda la pantalla como capa base; la navegación pasa a una barra inferior o a un menú; Sidebar y paneles (catálogo, buscador, observador, hora/simulación, consola) se convierten en hojas inferiores (bottom sheets) o cajones que se abren a demanda y se cierran fácilmente. Un solo panel abierto a la vez. Header reducido (iconos, sin textos largos).
- compact en horizontal: paneles en lateral estrecho o cajón; globo a pantalla completa.
- medium: Sidebar colapsable (iconos) y un panel lateral visible a la vez.
- expanded: layout actual de escritorio, sin cambios visibles.
- Modo kiosco de Tauri: debe seguir igual que ahora en pantallas grandes.

PASOS
1. Antes de tocar nada, entrégame un plano (texto o tabla) de cómo quedará cada panel en cada sizeClass, y espera mi OK.
2. Implementa el layout con CSS Grid/Flexbox y los atributos data-size de la Tarea 2; usa el hook solo donde el cambio sea de estructura (qué se renderiza), no de estilo.
3. Evita solapes: ningún panel tapa los controles principales ni el globo de forma permanente. Los paneles flotantes respetan las safe areas.
4. Estado de paneles (cuál está abierto) en el store existente, no en estado local disperso. Al cambiar de sizeClass o rotar, el estado se conserva de forma coherente.
5. Accesibilidad básica: botones con aria-label, foco visible, objetivos táctiles de al menos 48 dp.

CRITERIO DE ACEPTACIÓN
En 360x800 vertical se ve el globo completo, con la navegación accesible y sin elementos apilados unos sobre otros. Capturas en los 4 tamaños y en vertical/horizontal. ui-smoke y map-css siguen pasando, o los ajustes a esos tests me los consultas antes de aplicarlos.
```

---

## TAREA 4 — Globo y mapa

```text
OBJETIVO
Que el globo ortográfico (canvas) y el mapa Leaflet se adapten solos al tamaño de su contenedor y a la densidad de píxeles.

PASOS
1. Globo/canvas: dimensiona por el tamaño real del contenedor con ResizeObserver, no por window.innerWidth. Ajusta el buffer del canvas a ancho/alto × dpr (con un tope razonable, p. ej. 2 en móviles, para cuidar rendimiento y batería) y mantén el tamaño CSS. Recalcula la proyección (radio y centro) al cambiar de tamaño sin perder la orientación del globo.
2. El globo debe verse completo y centrado en pantallas estrechas (radio = min(ancho, alto) / 2 menos margen), sin deformarse (relación 1:1).
3. Interacción táctil: arrastre con un dedo para rotar, pellizco para zoom si ya existe zoom; touch-action adecuado; sin conflicto con el scroll de la página. Verifica que el sentido del drag en X e Y sigue siendo el correcto (hay un test de ortho que protege la matemática).
4. Mapa Leaflet: llama a invalidateSize() cuando cambie el tamaño del contenedor (rotación, abrir/cerrar paneles). Controles de zoom accesibles al pulgar.
5. Rendimiento: usa el dirty-flag/recálculo existente para no redibujar sin motivo al redimensionar; limita la frecuencia durante un redimensionado continuo. Con el catálogo completo, sin tirones perceptibles en el emulador.
6. Si el proyecto ya tiene detección de hardware para ajustar efectos (glow, glitch), conéctala con sizeClass/dpr en lugar de duplicar lógica.

CRITERIO DE ACEPTACIÓN
Rotando el emulador, el globo se reajusta sin recargar, sin recortes y nítido (sin borroso por dpr). ortho.test.mjs y map-markers/map-tiles siguen en verde. Capturas antes/después.
```

---

## TAREA 5 — Componentes, tipografía y paneles

```text
OBJETIVO
Que el contenido de cada componente sea legible y usable en pantallas pequeñas.

PASOS
1. Tipografía fluida con las variables de la Tarea 1; mínimo legible de 14-16 dp para texto de lectura. Respeta el tamaño de fuente del sistema (no uses unidades que lo ignoren).
2. Revisa uno por uno: Header, Sidebar, CatalogPanel, PlaceSearch, observer/, hud/ (incluido el widget lunar), time/ y console/. Para cada uno: sin textos cortados, sin desbordes, con elipsis donde corresponda, y con scroll interno cuando la lista sea larga.
3. Controles táctiles: botones y filas de lista de al menos 48 dp de alto; separación suficiente; sin depender de hover.
4. Efectos HUD (glassmorphism, glow, blur): reduce su intensidad o desactívalos en sizeClass compact si cuestan rendimiento, manteniendo la estética #FF6700. Respeta prefers-reduced-motion.
5. Campos de texto: tamaño de fuente ≥ 16 px para evitar el zoom automático del WebView al enfocar, y que el teclado no tape el campo (ver Tarea 6).
6. Modo oscuro y contraste: comprueba legibilidad sobre el globo en pantallas pequeñas.

CRITERIO DE ACEPTACIÓN
Recorrido manual de cada panel en 360x800 vertical y horizontal sin cortes ni solapes, con capturas. map-css y ui-smoke siguen pasando, o me consultas los cambios a sus aserciones.
```

---

## TAREA 6 — Android específico

```text
OBJETIVO
Resolver lo que solo ocurre dentro de la app Android.

PASOS
1. Edge-to-edge (obligatorio con targetSdk 36): comprueba que el contenido se dibuja bajo las barras del sistema y que las safe areas (Tarea 1) reservan el espacio correcto. Verifica que env(safe-area-inset-*) devuelve valores reales en el WebView de Capacitor; si no, propón la alternativa (p. ej. aplicar insets en la capa nativa) y pídeme confirmación antes de añadir plugins.
2. Teclado: al abrir el teclado, el campo enfocado y su panel quedan visibles (usa visualViewport o el modo de ajuste de la actividad). Verifica con los buscadores.
3. Rotación sin reinicio: revisa android:configChanges en AndroidManifest.xml (orientation|screenSize|smallestScreenSize|screenLayout|keyboardHidden) para que girar el dispositivo no recargue la app ni pierda el estado. Comprueba plegables/multi-ventana: android:resizeableActivity y que el layout reacciona al cambio de tamaño de ventana.
4. Orientación: pregúntame si quiero bloquearla en vertical o permitir ambas. Por defecto, permite ambas.
5. Botón/gesto atrás: con paneles abiertos, atrás los cierra antes de salir de la app (API de atrás predictiva).
6. Barra de estado y de navegación: color/tema coherente con el HUD y con el icono claro u oscuro según el fondo.

CRITERIO DE ACEPTACIÓN
En el emulador con navegación por gestos y por botones, nada queda tapado por las barras; el teclado no oculta los campos; rotar no reinicia la app; atrás cierra paneles. Evidencia con capturas y logcat sin errores nuevos.
```

---

## TAREA 7 — Verificación en matriz de dispositivos

```text
OBJETIVO
Demostrar con evidencia que funciona en distintas pantallas.

PASOS
1. Matriz mínima (AVD o `wm size`/`wm density`), en vertical y horizontal: 360x640 (pequeño, densidad baja), 360x800, 412x915, 600x960 (tablet 7"), 800x1280 (tablet 10"), y un plegable si hay AVD disponible. Incluye también el tamaño de fuente del sistema al 130 % y al 200 %.
2. Para cada combinación: arranque, globo visible completo, panel principal usable, sin scroll horizontal, sin elementos tapados. Registra cada resultado como Verificado o con el fallo y su causa.
3. Capturas "después" en docs/responsive/despues/ con los mismos nombres que las "antes".
4. Pruebas automáticas: añade tests node --test para la lógica nueva (clasificación de tamaño, dimensionado del canvas por contenedor y dpr). Ejecuta npm run typecheck && npm test y compáralo con la línea base de la Tarea 0.
5. Rendimiento: mide con chrome://inspect (pestaña Rendimiento) una interacción típica (rotar el globo con el catálogo completo) en una resolución alta y otra baja. Reporta los números; si hay un cuello de botella, descríbelo sin optimizar a ciegas.
6. Prueba también el build de release en el emulador, no solo el debug.

CRITERIO DE ACEPTACIÓN
Tabla de resultados completa en docs/responsive/VERIFICACION.md, con evidencia por fila y las limitaciones conocidas.
```

---

## TAREA 8 — Entrega

```text
OBJETIVO
Dejar todo documentado y versionado.

PASOS
1. Commits atómicos con mensajes convencionales, por ejemplo:
   fix(ui): viewport, dvh y safe areas
   feat(ui): detección de tamaño de pantalla (useViewport)
   feat(ui): layout adaptable por clase de tamaño
   fix(map): globo y mapa ajustados al contenedor y a la densidad
   fix(ui): tipografía y controles táctiles en móvil
   fix(android): insets, teclado y rotación sin reinicio
   test(ui): pruebas de clasificación y dimensionado
   docs(responsive): diagnóstico, verificación y guía
2. docs/responsive/GUIA.md: breakpoints usados, cómo añadir un componente nuevo respetando el sistema, variables CSS disponibles y cómo probar con wm size.
3. Informe final: qué cambió, evidencia, limitaciones conocidas y decisiones abiertas. Indica también si algo de lo hecho afecta a la preparación para Google Play (targetSdk 36, edge-to-edge).
4. Confirma que ~/SpaceTracker y ~/SpaceTracker2 no se modificaron.
```
