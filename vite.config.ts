import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

/**
 * Plugin de servidor: expone GET /api/catalog cargando `catalog.server.ts`
 * por SSR (`ssrLoadModule`), igual que el proyecto original.
 *
 * Motivación (verificada el 2026-10-18):
 * - La API de Ivan envía `Access-Control-Allow-Origin: *` (accesible desde el navegador).
 * - SatNOGS NO envía cabeceras CORS, así que desde el navegador falla; el
 *   middleware del servidor la consume sin problema de CORS.
 * - Ivan aplica límite de recursos (HTTP 508 con HTML) en peticiones paginadas
 *   (`?page=`); el cliente debe tolerar respuestas no-JSON.
 *
 * Nota de build (fallo conocido del handoff): satellite.js v7 es ESM-only y su
 * entrada re-exporta estáticamente la cadena WASM (`dist/index.js` →
 * `./wasm/index.js` → `await import('#wasm-…')` con salidas Emscripten
 * pthreads/Worker). Por eso la salida del build DEBE ser ES nativo
 * (comportamiento por defecto de Vite) y `target` moderno: cualquier formato
 * IIFE/CJS choca con el top-level/dynamic await y con los Workers. No cambiar
 * `build.target` a formatos antiguos ni forzar `output.format: "iife"`.
 */
function catalogApi(): Plugin {
  return {
    name: "spacetracker:catalog-api",
    configureServer(server) {
      server.middlewares.use("/api/catalog", async (_req, res) => {
        try {
          const mod = await server.ssrLoadModule("/src/lib/space/catalog.server.ts");
          const payload = await mod.getCatalog();
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.setHeader("Cache-Control", "no-store");
          res.end(JSON.stringify(payload));
        } catch (err) {
          res.statusCode = 502;
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.end(
            JSON.stringify({
              error: err instanceof Error ? err.message : String(err),
            }),
          );
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), catalogApi()],
  server: {
    port: 5173,
  },
  // CAUSA RAÍZ DEL FALLO DE BUILD CONOCIDO (diagnosticado y aislado el
  // 2026-10-18; confirmado aguas arriba en shashwatak/satellite-js#165 y
  // vitejs/vite#22362):
  // El plugin `vite:worker-import-meta-url` detecta los patrones
  // `new Worker(… import.meta.url)` del código Emscripten de satellite.js
  // (wasm-build/pthreads-release, arrastrado al grafo por el `export *` de
  // dist/index.js hacia la cadena WASM) y compila esos chunks de worker con
  // `worker.format`, que por defecto es "iife" — formato que NO admite el
  // top-level await del módulo. Error típico:
  //   [UNSUPPORTED_FEATURE] Top-level await is currently not supported with
  //   the 'iife' output format        (Vite 8 / Rolldown)
  //   Module format "iife" does not support top-level await   (Vite ≤7 / Rollup)
  // Solución mínima verificada: worker.format "es" (los workers ES son
  // estándar en navegadores evergreen, los únicos que satellite.js v7 soporta).
  // NO hacen falta commonjsOptions ni treeshake para resolverlo (aislado
  // experimentalmente: el build pasa solo con esta opción).
  worker: {
    format: "es",
  },
  build: {
    // ESM nativo (por defecto en Vite). satellite.js v7 exige target moderno:
    // usa require(ESM)/import dinámico y código Emscripten.
    target: "es2022",
    sourcemap: false,
  },
  optimizeDeps: {
    // satellite.js es ESM con exports dinámicos internos; dejar que Vite lo
    // pre-optimice normalmente. Si el pre-bundling fallara en algún entorno,
    // la alternativa diagnosticada es excluirlo: exclude: ["satellite.js"].
    include: ["satellite.js"],
  },
});
