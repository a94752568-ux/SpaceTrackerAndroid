/**
 * Fase 2 inmersión. Uso: node scripts/apply-immersion-phase2.mjs
 * Aplica fase 1 si falta MissionTelemetry.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const appPath = join(ROOT, "src/App.tsx");

function runPhase1() {
  const r = spawnSync(process.execPath, [join(ROOT, "scripts/apply-immersion-app.mjs")], {
    cwd: ROOT,
    stdio: "inherit",
  });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

let app = readFileSync(appPath, "utf8");
if (!app.includes("MissionTelemetry")) {
  console.log("→ fase 1");
  runPhase1();
  app = readFileSync(appPath, "utf8");
}

if (app.includes("detectElevationCross")) {
  console.log("App fase 2 ya aplicada");
} else {
  if (!app.includes("lookAngles")) {
    app = app.replace(
      'import { getFix, orbitParams } from "./lib/space/propagate";',
      'import { getFix, lookAngles, orbitParams } from "./lib/space/propagate";',
    );
  }

  if (app.includes('import { hapticTap } from "./lib/ui/haptics";')) {
    app = app.replace(
      'import { hapticTap } from "./lib/ui/haptics";',
      'import { hapticTap, hapticAos } from "./lib/ui/haptics";',
    );
  }
  if (app.includes("playCatalogReadyBeep, syncAmbientFromPrefs")) {
    app = app.replace(
      'import { playCatalogReadyBeep, syncAmbientFromPrefs } from "./lib/ui/ambientAudio";',
      'import { playAosBeep, playLosBeep, playCatalogReadyBeep, syncAmbientFromPrefs } from "./lib/ui/ambientAudio";',
    );
  } else if (!app.includes("playAosBeep")) {
    app = app.replace(
      'import { hapticTap, hapticAos } from "./lib/ui/haptics";',
      `import { hapticTap, hapticAos } from "./lib/ui/haptics";
import { playAosBeep, playLosBeep, playCatalogReadyBeep, syncAmbientFromPrefs } from "./lib/ui/ambientAudio";`,
    );
  }
  if (!app.includes("aosWatch")) {
    app = app.replace(
      'import { hapticTap, hapticAos } from "./lib/ui/haptics";',
      `import { hapticTap, hapticAos } from "./lib/ui/haptics";
import { detectElevationCross } from "./lib/ui/aosWatch";
import { fetchKpClass, type KpClass } from "./lib/ui/spaceWeather";`,
    );
  }

  if (!app.includes("const [kpClass")) {
    app = app.replace(
      "const [viewSwitching, setViewSwitching] = useState(false);",
      `const [viewSwitching, setViewSwitching] = useState(false);
  const [kpClass, setKpClass] = useState<KpClass>("quiet");
  const prevElRef = useRef<number | null>(null);`,
    );
  }

  app = app.replace(
    `const handleSelect = useCallback((s: Sat) => {
    startTransition(() => {
      setSelectedId(s.id);
      setTracked(true);
    });
  }, [startTransition]);`,
    `const handleSelect = useCallback((s: Sat) => {
    hapticTap();
    startTransition(() => {
      setSelectedId(s.id);
      setTracked(true);
    });
  }, [startTransition]);`,
  );

  if (!app.includes("detectElevationCross(")) {
    const key = "  }, [selected, now]);\n";
    const from = app.indexOf("const selectedFix");
    const idx = from >= 0 ? app.indexOf(key, from) : -1;
    if (idx < 0) throw new Error("no selectedFix end");
    const block = `${key}
  useEffect(() => {
    if (!selected || !observer) {
      prevElRef.current = null;
      return;
    }
    let cancelled = false;
    const sample = () => {
      if (cancelled) return;
      try {
        const la = lookAngles(selected, observer, now);
        if (!la) return;
        const edge = detectElevationCross(prevElRef.current, la.elDeg);
        prevElRef.current = la.elDeg;
        if (edge === "aos") {
          playAosBeep();
          hapticAos();
          teleLog.push("ALRT", \`AOS \${selected.name} el=\${la.elDeg.toFixed(1)}°\`);
        } else if (edge === "los") {
          playLosBeep();
          teleLog.push("SYS", \`LOS \${selected.name}\`);
        }
      } catch { /* ignore */ }
    };
    sample();
    const id = window.setInterval(sample, 2000);
    return () => { cancelled = true; window.clearInterval(id); };
  }, [selected, observer, now]);

  useEffect(() => {
    let alive = true;
    const load = () => void fetchKpClass().then((c) => { if (alive) setKpClass(c); });
    load();
    const id = window.setInterval(load, 15 * 60_000);
    return () => { alive = false; window.clearInterval(id); };
  }, []);

`;
    app = app.slice(0, idx) + block + app.slice(idx + key.length);
  }

  if (!app.includes("data-kp={kpClass}")) {
    app = app.replace("className={rootCls}", 'className={rootCls} data-kp={kpClass}');
  }

  writeFileSync(appPath, app);
  console.log("OK App.tsx", app.length);
}

{
  const p = join(ROOT, "src/components/hud/Dock.tsx");
  let t = readFileSync(p, "utf8");
  if (!t.includes("ImmersionControls")) {
    t = t.replace(
      'import { BASE_LAYERS } from "../../lib/ui/tiles";',
      'import { BASE_LAYERS } from "../../lib/ui/tiles";\nimport ImmersionControls from "../immersion/ImmersionControls";',
    );
    const needle = "aria-pressed={consoleOpen}";
    const i = t.indexOf(needle);
    if (i >= 0) {
      const j = t.indexOf("</button>", i);
      if (j >= 0) {
        t = t.slice(0, j + 9) + "\n      <ImmersionControls />" + t.slice(j + 9);
      }
    }
    writeFileSync(p, t);
    console.log("OK Dock.tsx");
  } else console.log("Dock ya OK");
}

{
  const p = join(ROOT, "src/components/map/MapView.tsx");
  let t = readFileSync(p, "utf8");
  if (!t.includes("elevRef")) {
    t = t.replace(
      "bearingDeg, footprint, getFix, groundTrack, orbitParams, terminatorPolygon",
      "bearingDeg, footprint, getFix, groundTrack, lookAngles, orbitParams, terminatorPolygon",
    );
    if (t.includes("footRingRef") && !t.includes("elevRef")) {
      t = t.replace(
        /const footRingRef = useRef[^;]+;/,
        (m) => m + "\n  const elevRef = useRef<L.Marker | null>(null);",
      );
    }
    t = t.replace(
      "footRingRef.current?.remove();\n      footRingRef.current = null;",
      `footRingRef.current?.remove();
      footRingRef.current = null;
      elevRef.current?.remove();
      elevRef.current = null;`,
    );
    if (t.includes("const fp = footprint(selected, now);") && !t.includes("st-elev-max")) {
      t = t.replace(
        "const fp = footprint(selected, now);",
        `const fp = footprint(selected, now);
    elevRef.current?.remove();
    elevRef.current = null;
    if (observer && map.getZoom() >= 5) {
      const la = lookAngles(selected, observer, now);
      if (la) {
        elevRef.current = L.marker([observer.latitude, observer.longitude], {
          interactive: false,
          keyboard: false,
          zIndexOffset: 800,
          icon: L.divIcon({
            className: "st-elev-max",
            html: \`<span class="st-elev-max-label">el \${la.elDeg.toFixed(1)}° · az \${la.azDeg.toFixed(0)}°</span>\`,
            iconSize: [130, 18],
            iconAnchor: [65, 24],
          }),
        }).addTo(map);
      }
    }`,
      );
    }
    writeFileSync(p, t);
    console.log("OK MapView.tsx", t.length);
  } else console.log("MapView ya OK");
}

console.log("fase 2 completa");
