/**
 * Dock inferior central (HUD flotante): agrupa en UNA sola barra
 * - la línea de tiempo / control de simulación (TimeBar),
 * - el menú desplegable CAPAS (base, overlays y categorías activas —
 *   sustituye a la leyenda flotante y al antiguo L.control.layers),
 * - el acceso a la consola Flight Log.
 *
 * Todo con glassmorphism, bordes 1 px y retícula de esquinas (.st-corners).
 */
import { useState } from "react";

import TimeBar, { type TimeBarProps } from "../time/TimeBar";
import { GROUPS, GROUP_LABELS } from "../../lib/space/groups";
import type { GroupId } from "../../lib/space/types";
import { GROUP_COLORS } from "../../lib/ui/colors";
import { BASE_LAYERS } from "../../lib/ui/tiles";

export interface DockProps extends TimeBarProps {
  baseId: string;
  onBase: (id: string) => void;
  overlays: { labels: boolean; terminator: boolean };
  onOverlays: (o: { labels: boolean; terminator: boolean }) => void;
  activeGroup: GroupId | null;
  onToggleActiveGroup: (g: GroupId) => void;
  consoleOpen: boolean;
  onConsoleToggle: () => void;
  /** Vista activa: mapa plano Leaflet o globo ortográfico. */
  view: "map" | "globe";
  onViewToggle: () => void;
  /** Estados del sistema agrupados en el dock (procedencia + flota visible). */
  source: "live" | "seed";
  uniqueCount: number;
  /** Telemetría viva del HUD: motor SGP4, salud TLE y FPS reales. */
  sgp4: { worker: boolean; frameMs: number } | null;
  tleHealth: number | null;
  fps: number;
}

export default function Dock(props: DockProps) {
  const [popOpen, setPopOpen] = useState(false);
  const {
    baseId,
    onBase,
    overlays,
    onOverlays,
    activeGroup,
    onToggleActiveGroup,
    consoleOpen,
    onConsoleToggle,
    view,
    onViewToggle,
    source,
    uniqueCount,
    sgp4,
    tleHealth,
    fps,
  } = props;

  return (
    <div className="st-dock hud-panel" role="toolbar" aria-label="Barra de herramientas de misión">
      <TimeBar {...props} />
      <span className="st-dock-sep" aria-hidden="true" />
      <button
        className="st-dock-btn"
        onClick={onViewToggle}
        title="Alternar mapa plano / globo ortográfico"
      >
        {view === "map" ? "◍ GLOBO" : "▦ MAPA"}
      </button>
      <div className="st-dock-menu">
        <button
          className={popOpen ? "st-dock-btn on" : "st-dock-btn"}
          onClick={() => setPopOpen((v) => !v)}
          aria-expanded={popOpen}
          title="Capas base, overlays y categorías"
        >
          ◧ CAPAS
        </button>
        {popOpen && (
          <div className="st-layers-pop hud-panel" role="menu">
            <div className="st-pop-sec">
              <h4>Base</h4>
              {BASE_LAYERS.map((b) => (
                <label key={b.id} className="st-pop-row">
                  <input
                    type="radio"
                    name="st-base"
                    checked={baseId === b.id}
                    onChange={() => onBase(b.id)}
                  />
                  <span>{b.name}</span>
                </label>
              ))}
            </div>
            <div className="st-pop-sec">
              <h4>Overlays</h4>
              <label className="st-pop-row">
                <input
                  type="checkbox"
                  checked={overlays.labels}
                  onChange={() => onOverlays({ ...overlays, labels: !overlays.labels })}
                />
                <span>Rótulos geográficos</span>
              </label>
              <label className="st-pop-row">
                <input
                  type="checkbox"
                  checked={overlays.terminator}
                  onChange={() =>
                    onOverlays({ ...overlays, terminator: !overlays.terminator })
                  }
                />
                <span>Terminador día/noche</span>
              </label>
            </div>
            <div className="st-pop-sec">
              <h4>Categoría con iconos SVG</h4>
              {GROUPS.map((g) => (
                <button
                  key={g}
                  className={activeGroup === g ? "st-pop-cat on" : "st-pop-cat"}
                  onClick={() => onToggleActiveGroup(g)}
                  title={`Iconos DOM para ${GROUP_LABELS[g]}`}
                >
                  <i style={{ background: GROUP_COLORS[g] }} />
                  {GROUP_LABELS[g]}
                </button>
              ))}
            </div>
            <button className="st-pop-close" onClick={() => setPopOpen(false)}>
              ✕ cerrar
            </button>
          </div>
        )}
      </div>
      <button
        className={consoleOpen ? "st-dock-btn on" : "st-dock-btn"}
        onClick={onConsoleToggle}
        aria-pressed={consoleOpen}
        title="Consola de telemetría (Flight Log)"
      >
        ▮ LOG
      </button>
      <span className="st-dock-status" title="Procedencia del catálogo y satélites en pantalla">
        <span className={source === "live" ? "st-badge st-badge-live" : "st-badge st-badge-seed"}>
          {source === "live" ? "LIVE" : "SEED"}
        </span>
        {uniqueCount} SAT
        <span
          className={sgp4?.worker ? "st-stat ok" : "st-stat warn"}
          title="Motor SGP4: worker dedicado o cálculo síncrono"
        >
          SGP4 {sgp4 ? (sgp4.worker ? "WORKER" : "SYNC") : "…"}
        </span>
        <span
          className={tleHealth !== null && tleHealth >= 80 ? "st-stat ok" : "st-stat warn"}
          title="Salud TLE: % de filas recibidas aceptadas como vigentes"
        >
          TLE {tleHealth !== null ? `${tleHealth}%` : "—"}
        </span>
        <span className={fps >= 50 ? "st-stat ok" : "st-stat warn"} title="Fotogramas por segundo del hilo principal">
          FPS {fps}
        </span>
      </span>
    </div>
  );
}
