/**
 * Barra de reproducción / línea de tiempo flotante bajo el mapa.
 * Controles: Pausa · Play (tiempo real) · −1 h · +1 h · slider ±24 h.
 * El slider dispara onScrub con el instante absoluto objetivo; App conmuta a
 * modo "frozen" y todo el pipeline SGP4 (flota, trayectoria, pasos, detalle)
 * se recalcula al instante porque consume el mismo prop `now`.
 */
import { labelOffset, offsetMinutes, RANGE_MIN, shiftMs } from "../../lib/ui/timecontrol";
import { fmtDateTime } from "../../lib/ui/format";

export interface TimeBarProps {
  now: Date;
  realNow: Date;
  mode: "live" | "frozen";
  timezone: string;
  onPlayLive: () => void;
  onPause: () => void;
  onShiftHours: (h: number) => void;
  onScrub: (tMs: number) => void;
}

export default function TimeBar({
  now,
  realNow,
  mode,
  timezone,
  onPlayLive,
  onPause,
  onShiftHours,
  onScrub,
}: TimeBarProps) {
  const offMin = offsetMinutes(now.getTime(), realNow.getTime());
  const deltaMs = now.getTime() - realNow.getTime();

  return (
    <div className="st-timebar" role="group" aria-label="Control de tiempo de simulación">
      <div className="st-timebar-btns">
        <button onClick={onPause} disabled={mode === "frozen"} title="Pausar el tiempo">
          ⏸
        </button>
        <button onClick={onPlayLive} disabled={mode === "live"} title="Reanudar tiempo real">
          ▶
        </button>
        <button onClick={() => onShiftHours(-1)} title="Retroceder 1 hora">
          −1h
        </button>
        <button onClick={() => onShiftHours(1)} title="Adelantar 1 hora">
          +1h
        </button>
      </div>
      <input
        type="range"
        min={-RANGE_MIN}
        max={RANGE_MIN}
        step={1}
        value={offMin}
        onChange={(e) => onScrub(shiftMs(realNow.getTime(), Number(e.target.value) / 60))}
        aria-label="Línea de tiempo (minutos respecto al tiempo real)"
      />
      <div className="st-timebar-read">
        <span className={mode === "live" ? "st-live-dot" : "st-sim-dot"}>
          {mode === "live" ? "EN VIVO" : `SIM ${labelOffset(deltaMs)}`}
        </span>
        <span className="st-timebar-clock">{fmtDateTime(now, timezone)}</span>
      </div>
    </div>
  );
}
