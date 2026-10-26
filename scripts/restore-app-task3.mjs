/**
 * Restaura src/App.tsx desde el commit bueno + parches Tarea 3.
 * Uso: node scripts/restore-app-task3.mjs
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const GOOD =
  "https://raw.githubusercontent.com/a94752568-ux/SpaceTrackerAndroid/2a4758f5391b30a722ac193dade79eef09e1452c/src/App.tsx";

const res = await fetch(GOOD);
if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
let text = await res.text();

const needle = `  const isCompact = viewport.sizeClass === "compact";\n  const [compactTab, setCompactTab] = useState<"catalog" | "radar" | "time" | "layers" | "observer" | null>(null);\n  const [showHint, setShowHint] = useState(() => !localStorage.getItem("spacetracker:dismiss-hint"));\n`;

const insert = `  const isCompact = viewport.sizeClass === "compact";\n  const isMedium = viewport.sizeClass === "medium";\n  const [compactTab, setCompactTab] = useState<"catalog" | "radar" | "time" | "layers" | "observer" | null>(null);\n  const [showHint, setShowHint] = useState(() => !localStorage.getItem("spacetracker:dismiss-hint"));\n\n  /* Tarea 3: al salir de compact (o rotar a clase mayor) cerrar sheets; conservar selección. */\n  useEffect(() => {\n    if (!isCompact && compactTab !== null) setCompactTab(null);\n  }, [isCompact, compactTab]);\n`;

if (!text.includes(needle)) throw new Error("needle isCompact not found");
text = text.replace(needle, insert);

const oldEsc = `          case "Escape":\n            handleCloseDetail();\n            setConsoleOpen(false);\n            break;`;
const newEsc = `          case "Escape":\n            // Compact: primero cierra el sheet activo; luego detalle / consola.\n            if (compactTab !== null) {\n              setCompactTab(null);\n              break;\n            }\n            handleCloseDetail();\n            setConsoleOpen(false);\n            break;`;
if (!text.includes(oldEsc)) throw new Error("Escape block not found");
text = text.replace(oldEsc, newEsc);

const oldDeps =
  "[sim.mode, handlePause, handlePlayLive, handleCloseDetail, favIds, selectedId, satMap, handleSelect]);";
const newDeps =
  "[sim.mode, handlePause, handlePlayLive, handleCloseDetail, favIds, selectedId, satMap, handleSelect, compactTab]);";
if (!text.includes(oldDeps)) throw new Error("deps not found");
text = text.replace(oldDeps, newDeps);

const oldRoot = "  const rootCls = `st-app${panels.left ? \"\" : \" left-closed\"}`;";
const newRoot =
  "  const rootCls = `st-app${panels.left ? \"\" : \" left-closed\"}${isCompact ? \" is-compact\" : \"\"}${isMedium ? \" is-medium\" : \"\"}`;";
if (!text.includes(oldRoot)) throw new Error("rootCls not found");
text = text.replace(oldRoot, newRoot);

const oldSide = `        {/* Sidebar: normal or compact bottom sheet */}\n        {(!isCompact || compactTab === "catalog") && (\n          <div className={isCompact ? "st-bottom-sheet" : ""}>\n            {isCompact && <div className="st-sheet-handle" onClick={() => setCompactTab(null)} />}`;

const newSide = `        {/* Backdrop: un solo sheet a la vez; tap cierra (Tarea 3) */}\n        {isCompact && compactTab !== null && (\n          <button\n            type="button"\n            className="st-sheet-backdrop"\n            aria-label="Cerrar panel"\n            onClick={() => setCompactTab(null)}\n          />\n        )}\n\n        {/* Sidebar: normal or compact bottom sheet */}\n        {(!isCompact || compactTab === "catalog") && (\n          <div className={isCompact ? "st-bottom-sheet" : isMedium ? "st-sidebar medium" : undefined}>\n            {isCompact && <div className="st-sheet-handle" onClick={() => setCompactTab(null)} />}`;

if (!text.includes(oldSide)) throw new Error("sidebar block not found");
text = text.replace(oldSide, newSide);

const out = join(ROOT, "src", "App.tsx");
writeFileSync(out, text);
console.log("OK wrote", out, text.length, "bytes");
