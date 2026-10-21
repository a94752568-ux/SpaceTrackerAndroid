/**
 * Script de generación de manifiesto de assets web (SHA-256 hashes, talle, versión)
 * para verificación de integridad y cache busting seguro.
 */
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const DIST_DIR = "./dist";
const MANIFEST_PATH = "./dist/asset-manifest.json";

function getFilesRecursively(dir) {
  let results = [];
  const list = readdirSync(dir);
  for (const file of list) {
    const filePath = join(dir, file);
    const stat = statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getFilesRecursively(filePath));
    } else {
      if (!file.endsWith(".json")) {
        results.push(filePath);
      }
    }
  }
  return results;
}

try {
  const files = getFilesRecursively(DIST_DIR);
  const manifest = {
    generatedAt: new Date().toISOString(),
    version: "1.2.0",
    assets: {},
  };

  for (const file of files) {
    const content = readFileSync(file);
    const hash = createHash("sha256").update(content).digest("hex");
    const relativePath = file.replace(/^dist\//, "");
    manifest.assets[relativePath] = {
      sha256: hash,
      sizeBytes: content.length,
    };
  }

  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), "utf8");
  console.log(`✓ Manifiesto generado con éxito en ${MANIFEST_PATH} (${Object.keys(manifest.assets).length} assets)`);
} catch (e) {
  console.error("× Error generando manifiesto de assets:", e.message);
  process.exit(1);
}
