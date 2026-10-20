/**
 * Helper de tests: carga módulos TypeScript de src/ mediante Vite
 * (`createServer` + `ssrLoadModule`), igual que el proyecto original.
 * Sin configFile para no arrancar plugins innecesarios en los tests.
 */
import { createServer } from "vite";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

let serverPromise = null;

export function viteServer() {
  if (!serverPromise) {
    serverPromise = createServer({
      configFile: false,
      root: ROOT,
      server: { middlewareMode: true, hmr: false },
      appType: "custom",
      logLevel: "error",
      optimizeDeps: { noDiscovery: true },
    });
  }
  return serverPromise;
}

export async function loadModule(path) {
  const server = await viteServer();
  return server.ssrLoadModule(path);
}

export async function closeVite() {
  if (serverPromise) {
    const s = await serverPromise;
    serverPromise = null;
    await s.close();
  }
}

/** Construye un `Sat` a partir de una fixture por nombre. */
export function satFromFixture(FIXTURES, name, group = "other") {
  const f = FIXTURES.find((x) => x.name === name);
  if (!f) throw new Error(`Fixture no encontrada: ${name}`);
  return { id: f.id, name: f.name, line1: f.line1, line2: f.line2, group };
}
