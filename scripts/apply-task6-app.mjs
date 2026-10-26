/**
 * Tarea 6 — App.tsx: gesto atrás cierra sheets; data-sheet-open / data-detail-open.
 * Uso: node scripts/apply-task6-app.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const APP = join(ROOT, "src/App.tsx");
let t = readFileSync(APP, "utf8");

if (t.includes("st-android-back")) {
  console.log("App.tsx ya tiene Tarea 6 (back), se omite");
  process.exit(0);
}

const oldHotkeys = `    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sim.mode, handlePause, handlePlayLive, handleCloseDetail, favIds, selectedId, satMap, handleSelect, compactTab]);`;

const newHotkeys = `    const onAndroidBack = () => {
      if (compactTab !== null) {
        setCompactTab(null);
        return;
      }
      handleCloseDetail();
      setConsoleOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("st-android-back", onAndroidBack);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("st-android-back", onAndroidBack);
    };
  }, [sim.mode, handlePause, handlePlayLive, handleCloseDetail, favIds, selectedId, satMap, handleSelect, compactTab]);`;

if (!t.includes(oldHotkeys)) {
  console.error("No se encontró bloque hotkeys exacto");
  process.exit(1);
}
t = t.replace(oldHotkeys, newHotkeys);

const idx = t.indexOf("const selected = useMemo");
if (idx < 0) {
  console.error("No se encontró const selected = useMemo");
  process.exit(1);
}
const end = t.indexOf(");", idx) + 2;
const block = t.slice(idx, end);
const inject = `${block}

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.sheetOpen = compactTab !== null ? "1" : "0";
    root.dataset.detailOpen = selected ? "1" : "0";
    try {
      const st = (history.state as { stOverlay?: boolean } | null) ?? {};
      if ((compactTab !== null || selected) && !st.stOverlay) {
        history.pushState({ stOverlay: true }, "");
      }
    } catch {
      /* ignore */
    }
  }, [compactTab, selected]);`;
t = t.slice(0, idx) + inject + t.slice(end);

writeFileSync(APP, t);
console.log("OK App.tsx Tarea 6");
