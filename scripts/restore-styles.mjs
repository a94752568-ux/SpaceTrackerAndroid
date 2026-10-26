/**
 * Restaura src/styles.css desde el último commit bueno (antes de corrupción SEE_FILE).
 * Uso: node scripts/restore-styles.mjs
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const GOOD =
  "https://raw.githubusercontent.com/a94752568-ux/SpaceTrackerAndroid/2a4758f5391b30a722ac193dade79eef09e1452c/src/styles.css";

const res = await fetch(GOOD);
if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
const text = await res.text();
if (text.length < 1000 || text.includes("SEE_FILE")) {
  throw new Error("contenido inválido del remoto bueno");
}
const out = join(ROOT, "src", "styles.css");
writeFileSync(out, text);
console.log("OK wrote", out, text.length, "bytes");
