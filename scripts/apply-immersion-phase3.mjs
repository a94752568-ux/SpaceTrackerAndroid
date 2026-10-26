/**
 * Fase 3: edad TLE visual, lock-on, interpolación, beep catálogo.
 * Uso: node scripts/apply-immersion-phase3.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function ensurePhase2() {
  const app = readFileSync(join(ROOT, "src/App.tsx"), "utf8");
  if (!app.includes("detectElevationCross")) {
    console.log("→ fase 2");
    const r = spawnSync(process.execPath, [join(ROOT, "scripts/apply-immersion-phase2.mjs")], {
      cwd: ROOT,
      stdio: "inherit",
    });
    if (r.status !== 0) process.exit(r.status ?? 1);
  }
}

ensurePhase2();

{
  const p = join(ROOT, "src/components/map/MapView.tsx");
  let t = readFileSync(p, "utf8");
  if (t.includes("tleAgeClassFromLine1")) {
    console.log("MapView fase 3 ya OK");
  } else {
    t = t.replace(
      'import { escapeHtml, groupIconSvg, satIconHtml, SELECTED_SAT_CLASS, tacticalIconHtml } from "../../lib/ui/markers";',
      `import { escapeHtml, groupIconSvg, satIconHtml, SELECTED_SAT_CLASS, tacticalIconHtml } from "../../lib/ui/markers";
import { tleAgeClassFromLine1 } from "../../lib/ui/tleAgeClass";
import { interpolateFix } from "../../lib/space/interpolateFix";`,
    );

    t = t.replace(
      `function satIconFor(sat: Sat): L.DivIcon {
  return L.divIcon({
    className: \`st-sat-icon \${SELECTED_SAT_CLASS}\`,
    html: satIconHtml(sat.group, GROUP_COLORS[sat.group]),
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}`,
      `function satIconFor(sat: Sat, now: Date = new Date()): L.DivIcon {
  const age = tleAgeClassFromLine1(sat.line1, now);
  return L.divIcon({
    className: \`st-sat-icon \${SELECTED_SAT_CLASS} \${age}\`,
    html: satIconHtml(sat.group, GROUP_COLORS[sat.group]),
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}`,
    );

    t = t.replace(
      `function domIconFor(sat: Sat, fav: boolean): L.DivIcon {
  return L.divIcon({
    className: "st-dom-icon",
    html: tacticalIconHtml(sat.group, GROUP_COLORS[sat.group], {
      fav,
      ping: \`\${(sat.id % 7) * 0.4}s\`,
      label: sat.name,
    }),
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}`,
      `function domIconFor(sat: Sat, fav: boolean, now: Date = new Date()): L.DivIcon {
  const age = tleAgeClassFromLine1(sat.line1, now);
  return L.divIcon({
    className: \`st-dom-icon \${age}\`,
    html: tacticalIconHtml(sat.group, GROUP_COLORS[sat.group], {
      fav,
      ping: \`\${(sat.id % 7) * 0.4}s\`,
      label: sat.name,
    }),
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}`,
    );

    if (!t.includes("st-lock-on")) {
      t = t.replace(
        "if (isNewSelection) {\n      map.flyTo([fix.latDeg, fix.lonDeg], Math.max(map.getZoom(), 4), { duration: 1.25 });",
        `if (isNewSelection) {
      const pane = map.getContainer();
      pane.classList.add("st-lock-on");
      window.setTimeout(() => pane.classList.remove("st-lock-on"), 1200);
      map.flyTo([fix.latDeg, fix.lonDeg], Math.max(map.getZoom(), 4), { duration: 1.25 });`,
      );
    }

    t = t.replace("icon: satIconFor(selected),", "icon: satIconFor(selected, now),");
    t = t.replace(
      /domIconFor\(([^,]+), favIdsRef\.current\.has\(([^)]+)\)\)/g,
      "domIconFor($1, favIdsRef.current.has($2), now)",
    );

    writeFileSync(p, t);
    console.log("OK MapView", t.length);
  }
}

{
  const p = join(ROOT, "src/App.tsx");
  let t = readFileSync(p, "utf8");
  if (!t.includes("playCatalogReadyBeep();")) {
    for (const pat of ["setPayload(data);", "setPayload(payload);", "setPayload(next);"]) {
      if (t.includes(pat)) {
        t = t.replace(
          pat,
          `${pat}\n        try { playCatalogReadyBeep(); } catch { /* audio off */ }`,
        );
        break;
      }
    }
    writeFileSync(p, t);
    console.log("OK App catalog beep", t.length);
  } else console.log("App beep ya OK");
}

console.log("fase 3 apply listo");
