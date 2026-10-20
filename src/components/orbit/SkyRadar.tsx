/**
 * Radar de cielo local: diagrama polar azimut/elevación (cenital) del
 * satélite seleccionado visto desde el observador.
 *
 * - Borde exterior = 0° (horizonte); centro = 90° (cenit); anillos 30/60.
 * - Cardinales N/E/S/W (azimut creciente en sentido horario, N arriba).
 * - Trayectoria del pase en curso (sólida) y del próximo pase (discontinua),
 *   muestreada con lookAngles reales (SGP4).
 * - Punto vivo naranja con la posición az/el del instante `now`.
 * - Lectura interactiva az/el al mover el cursor sobre el disco.
 *
 * Rendimiento: la curva del pase se memoiza en cubos de 60 s (y por pase);
 * cada tick de 1 s solo recalcula UN lookAngles (el punto vivo). El componente
 * vive fuera del árbol de Leaflet: sus re-renders no tocan el mapa.
 */
import { memo, useEffect, useMemo, useRef, useState } from "react";

import { lookAngles, predictPasses } from "../../lib/space/propagate";
import { getMoonPosition } from "../../lib/space/moon-position";
import type { Observer, Pass, Sat } from "../../lib/space/types";
import { fmtTime, fmtNum } from "../../lib/ui/format";

const SIZE = 240;
const CX = SIZE / 2;
const CY = SIZE / 2;
const R = 100;

interface SkyRadarProps {
  sat: Sat;
  observer: Observer;
  now: Date;
}

/** az/el → coordenadas SVG (N arriba, azimut horario). */
function polar(azDeg: number, elDeg: number): [number, number] {
  const r = ((90 - Math.max(0, elDeg)) / 90) * R;
  const a = (azDeg * Math.PI) / 180;
  return [CX + r * Math.sin(a), CY - r * Math.cos(a)];
}

function samplePass(sat: Sat, obs: Observer, pass: Pass, nowMs: number) {
  const durS = (pass.losMs - pass.aosMs) / 1000;
  const stepS = Math.max(15, Math.min(60, Math.round(durS / 80)));
  const past: [number, number][] = [];
  const future: [number, number][] = [];
  for (let t = pass.aosMs; t <= pass.losMs; t += stepS * 1000) {
    const la = lookAngles(sat, obs, new Date(t));
    if (!la || la.elDeg < 0) continue;
    const pt = polar(la.azDeg, la.elDeg);
    (t <= nowMs ? past : future).push(pt);
  }
  return { past, future };
}

const toPoints = (pts: [number, number][]) => pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");

export function SkyRadar({ sat, observer, now }: SkyRadarProps) {
  const [readout, setReadout] = useState<{ az: number; el: number } | null>(null);

  /* Throttling de telemetría: actualizar el punto vivo a lo sumo 1 vez por segundo (1000 ms). */
  const [telemetryTime, setTelemetryTime] = useState<Date>(now);
  const lastUpdateRef = useRef<number>(now.getTime());

  useEffect(() => {
    const tMs = now.getTime();
    if (Math.abs(tMs - lastUpdateRef.current) >= 1000) {
      lastUpdateRef.current = tMs;
      setTelemetryTime(now);
    }
  }, [now]);

  const nowMs = telemetryTime.getTime();
  const bucket60 = Math.floor(nowMs / 60000);
  const bucketMs = bucket60 * 60000;

  /* Pases y curvas memoizados en cubos de 60 s (y por pase): el arrastre del
     slider o el tick de 1 s NO recalculan la curva completa. */
  const { passes, ongoing, next } = useMemo(() => {
    const all = predictPasses(sat, observer, new Date(bucketMs), {
      durationHours: 24,
      coarseStepSec: 30,
      maxPasses: 12,
    });
    const cur = all.find((p) => p.aosMs <= bucketMs && bucketMs <= p.losMs) ?? null;
    const nxt = all.find((p) => p.aosMs > bucketMs) ?? null;
    return { passes: all, ongoing: cur, next: nxt };
  }, [sat?.id, sat?.line1, sat?.line2, observer?.latitude, observer?.longitude, observer?.elevationM, bucketMs]);

  const track = useMemo(() => {
    const target = ongoing ?? next;
    if (!target) return null;
    return { pass: target, ...samplePass(sat, observer, target, bucketMs) };
  }, [sat?.id, sat?.line1, sat?.line2, observer?.latitude, observer?.longitude, ongoing, next, bucketMs]);

  /* Punto vivo: UN solo lookAngles por tick de telemetría (1 s). */
  const live = useMemo(
    () => (sat && observer ? lookAngles(sat, observer, telemetryTime) : null),
    [sat?.id, sat?.line1, sat?.line2, observer?.latitude, observer?.longitude, observer?.elevationM, telemetryTime],
  );
  const livePt = useMemo(
    () => (live && live.elDeg > 0 ? polar(live.azDeg, live.elDeg) : null),
    [live],
  );

  const moon = useMemo(
    () => (observer ? getMoonPosition(telemetryTime, observer.latitude, observer.longitude) : null),
    [observer?.latitude, observer?.longitude, telemetryTime],
  );
  const moonPt = useMemo(
    () => (moon && moon.isAboveHorizon && moon.azimuth !== undefined && moon.elevation !== undefined ? polar(moon.azimuth, moon.elevation) : null),
    [moon],
  );

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * SIZE - CX;
    const y = ((e.clientY - rect.top) / rect.height) * SIZE - CY;
    const r = Math.hypot(x, y);
    if (r > R + 6) {
      setReadout(null);
      return;
    }
    const az = (Math.atan2(x, -y) * 180) / Math.PI;
    const el = 90 * (1 - Math.min(r, R) / R);
    setReadout({ az: (az + 360) % 360, el });
  };

  const tz = observer.timezone;
  const target = ongoing ?? next;

  return (
    <section className="st-skyradar" aria-label="Radar de cielo local">
      <h3>Radar de cielo local · {observer.name}</h3>
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        width={SIZE}
        height={SIZE}
        onMouseMove={onMove}
        onMouseLeave={() => setReadout(null)}
        role="img"
      >
        {/* rejilla polar */}
        <circle cx={CX} cy={CY} r={R} className="st-radar-ring st-radar-ring-0" />
        <circle cx={CX} cy={CY} r={(R * 2) / 3} className="st-radar-ring" />
        <circle cx={CX} cy={CY} r={R / 3} className="st-radar-ring" />
        <line x1={CX - R} y1={CY} x2={CX + R} y2={CY} className="st-radar-axis" />
        <line x1={CX} y1={CY - R} x2={CX} y2={CY + R} className="st-radar-axis" />
        <text x={CX} y={CY - R - 4} textAnchor="middle" className="st-radar-card st-radar-n">N</text>
        <text x={CX + R + 8} y={CY + 3} textAnchor="middle" className="st-radar-card">E</text>
        <text x={CX} y={CY + R + 11} textAnchor="middle" className="st-radar-card">S</text>
        <text x={CX - R - 8} y={CY + 3} textAnchor="middle" className="st-radar-card">W</text>
        <text x={CX + 4} y={CY - R + 10} className="st-radar-el">0°</text>
        <text x={CX + 4} y={CY - (R * 2) / 3 + 10} className="st-radar-el">30°</text>
        <text x={CX + 4} y={CY - R / 3 + 10} className="st-radar-el">60°</text>
        <text x={CX + 4} y={CY - 2} className="st-radar-el">90°</text>
        {/* barrido decorativo */}
        <g className="st-radar-sweep">
          <line x1={CX} y1={CY} x2={CX} y2={CY - R} />
        </g>
        {/* trayectoria del pase: pasado sólido, futuro discontinuo */}
        {track && track.past.length > 1 && (
          <polyline points={toPoints(track.past)} className="st-radar-track" />
        )}
        {track && track.future.length > 1 && (
          <polyline points={toPoints(track.future)} className="st-radar-track st-radar-track-fut" />
        )}
        {/* punto vivo */}
        {livePt && (
          <>
            <circle cx={livePt[0]} cy={livePt[1]} r={6} className="st-radar-live-glow" />
            <circle cx={livePt[0]} cy={livePt[1]} r={2.6} className="st-radar-live" />
          </>
        )}
        {/* Luna */}
        {moonPt && (
          <>
            <circle cx={moonPt[0]} cy={moonPt[1]} r={7} fill="rgba(226,232,240,0.3)" />
            <circle cx={moonPt[0]} cy={moonPt[1]} r={3.5} fill="#e2e8f0" stroke="#030508" strokeWidth={1} />
          </>
        )}
        <circle cx={CX} cy={CY} r={1.2} className="st-radar-zenith" />
      </svg>
      <div className="st-skyradar-read">
        <span>
          {live
            ? `AZ ${fmtNum(live.azDeg, 1)}° · EL ${fmtNum(live.elDeg, 1)}°${live.elDeg <= 0 ? " · BAJO HORIZONTE" : ""}`
            : "SIN POSICIÓN (TLE no propaga)"}
        </span>
        <span>
          {moon && moon.elevation !== undefined
            ? `🌙 LUNA: AZ ${fmtNum(moon.azimuth ?? 0, 0)}° EL ${fmtNum(moon.elevation, 0)}° (${moon.isAboveHorizon ? "VISIBLE" : "OCULTA"})`
            : readout
              ? `mira: AZ ${fmtNum(readout.az, 0)}° EL ${fmtNum(readout.el, 0)}°`
              : target
                ? `${ongoing ? "EN CURSO" : "PRÓX."} AOS ${fmtTime(target.aosMs, tz)} · máx ${fmtNum(target.maxElDeg, 0)}°`
                : "SIN PASES EN 24 H"}
        </span>
      </div>
      {passes.length === 0 && <p className="st-hint">Sin pases visibles en 24 h desde {observer.name}.</p>}
    </section>
  );
}

export default memo(SkyRadar);
