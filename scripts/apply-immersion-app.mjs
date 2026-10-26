/**
 * Integra inmersión de producto en App.tsx (idempotente).
 * Uso: node scripts/apply-immersion-app.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const path = join(ROOT, "src/App.tsx");
let t = readFileSync(path, "utf8");

if (t.includes("MissionTelemetry")) {
  console.log("App.tsx ya tiene inmersión — nada que hacer");
  process.exit(0);
}

const importAnchor = 'import { useViewport } from "./lib/ui/useViewport";';
if (!t.includes(importAnchor)) throw new Error("no useViewport import");
t = t.replace(
  importAnchor,
  importAnchor +
    `
import { hapticTap } from "./lib/ui/haptics";
import { playCatalogReadyBeep, syncAmbientFromPrefs } from "./lib/ui/ambientAudio";
import Onboarding from "./components/immersion/Onboarding";
import MissionTelemetry from "./components/immersion/MissionTelemetry";
import ImmersionControls from "./components/immersion/ImmersionControls";
`,
);

const kioskAnchor = "  const kiosk = useKioskMode();";
if (!t.includes(kioskAnchor)) throw new Error("no kiosk");
t = t.replace(
  kioskAnchor,
  kioskAnchor +
    `
  const [viewSwitching, setViewSwitching] = useState(false);
  useEffect(() => {
    syncAmbientFromPrefs();
  }, []);
  const switchView = useCallback(() => {
    setViewSwitching(true);
    window.setTimeout(() => {
      setView((v) => (v === "map" ? "globe" : "map"));
      setViewSwitching(false);
    }, 200);
  }, []);
`,
);

const loose = "allSats.find((s) => s.id === selectedId) ?? null";
if (!t.includes(loose)) throw new Error("no selected memo");
if (!t.includes("const selectedFix")) {
  const mEnd = t.indexOf(");", t.indexOf(loose));
  if (mEnd < 0) throw new Error("cannot find selected end");
  t =
    t.slice(0, mEnd + 2) +
    `
  const selectedFix = useMemo(() => {
    if (!selected) return null;
    try {
      return getFix(selected, now);
    } catch {
      return null;
    }
  }, [selected, now]);
` +
    t.slice(mEnd + 2);
}

t = t.replace(
  'const rootCls = `st-app${panels.left ? "" : " left-closed"}${isCompact ? " is-compact" : ""}${isMedium ? " is-medium" : ""}`;',
  'const rootCls = `st-app${panels.left ? "" : " left-closed"}${isCompact ? " is-compact" : ""}${isMedium ? " is-medium" : ""}${kiosk.isFull ? " is-mission" : ""}`;',
);

t = t.replace(
  `onClick={() => setView((v) => (v === "map" ? "globe" : "map"))}
            title={view === "map" ? "Cambiar a Globo 3D" : "Cambiar a Mapa 2D"}`,
  `onClick={() => { hapticTap(); switchView(); }}
            title={view === "map" ? "Cambiar a Globo 3D" : "Cambiar a Mapa 2D"}`,
);

t = t.replace(
  'onViewToggle={() => setView((v) => (v === "map" ? "globe" : "map"))}',
  'onViewToggle={() => { hapticTap(); switchView(); }}',
);

t = t.replace(
  '<div className="st-map-area">',
  '<div className={`st-map-area${viewSwitching ? " is-view-switching" : ""}`}>',
);

t = t.replace(
  "<TelemetryConsole open={consoleOpen} onOpenChange={setConsoleOpen} />",
  `<MissionTelemetry
          visible={kiosk.isFull && !!selected}
          name={selected?.name ?? null}
          fix={selectedFix}
        />
        <Onboarding />
        <TelemetryConsole open={consoleOpen} onOpenChange={setConsoleOpen} />`,
);

writeFileSync(path, t);
console.log("OK immersion App.tsx bytes", t.length);
