/**
 * Detalle del satélite seleccionado: posición, altitud, velocidad, distancia,
 * azimut/elevación, inclinación, período, tiempos solares, época del TLE,
 * favoritos, seguimiento y predicción de pasos sobre el observador.
 */
import { memo, useEffect, useMemo, useRef, useState } from "react";

import { GROUP_LABELS } from "../../lib/space/groups";
import {
  footprint,
  forecastNow,
  getFix,
  orbitParams,
  predictPasses,
  solarInfo,
} from "../../lib/space/propagate";
import { diagnoseTleEpoch } from "../../lib/space/tle-epoch";
import type { Observer, Sat } from "../../lib/space/types";
import type { FavoritesState } from "../../lib/ui/favorites";
import { buildPassesCsv, downloadText, passesFilename } from "../../lib/ui/export-passes";
import { fmtAgeDays, fmtAz, fmtDuration, fmtLat, fmtLon, fmtNum, fmtTime } from "../../lib/ui/format";
import { useScramble } from "../../lib/ui/useScramble";
import { fmtUtc, teleLog } from "../../lib/ui/telemetry-log";
import FavoritePicker from "./FavoritePicker";

interface SatDetailProps {
  sat: Sat | null;
  observer: Observer | null;
  now: Date;
  fav: FavoritesState;
  tracked: boolean;
  onToggleSatInList: (listId: string, satId: number) => void;
  onCreateList: (name: string, satId: number) => void;
  onToggleTrack: () => void;
  onClose: () => void;
}

const EPOCH_LABEL: Record<string, string> = {
  fresh: "TLE fresco",
  aging: "TLE envejeciendo",
  stale: "TLE antiguo",
  future: "Época futura",
  invalid: "Época inválida",
};

export function SatDetail({
  sat,
  observer,
  now,
  fav,
  tracked,
  onToggleSatInList,
  onCreateList,
  onToggleTrack,
  onClose,
}: SatDetailProps) {
  const tz = observer?.timezone ?? "UTC";

  /* Throttling de telemetría: máximo 1 actualización por segundo (1000 ms)
     para desacoplar la telemetría del panel lateral del bucle de animación de 60 FPS. */
  const [telemetryTime, setTelemetryTime] = useState<Date>(now);
  const lastUpdateRef = useRef<number>(now.getTime());

  useEffect(() => {
    const tMs = now.getTime();
    if (Math.abs(tMs - lastUpdateRef.current) >= 1000) {
      lastUpdateRef.current = tMs;
      setTelemetryTime(now);
    }
  }, [now]);

  // Clave gruesa (10 min) para recalcular pasos sin bloquear cada segundo.
  const coarseNow = Math.floor(telemetryTime.getTime() / 600000) * 600000;

  const params = useMemo(() => (sat ? orbitParams(sat) : null), [sat?.id, sat?.line1, sat?.line2]);
  const epoch = useMemo(
    () => (sat ? diagnoseTleEpoch(sat.line1, telemetryTime) : null),
    [sat?.line1, coarseNow],
  );
  const passes = useMemo(() => {
    if (!sat || !observer) return [];
    return predictPasses(sat, observer, new Date(coarseNow), {
      durationHours: 24,
      coarseStepSec: 30,
      maxPasses: 12,
    });
  }, [
    sat?.id,
    sat?.line1,
    sat?.line2,
    observer?.latitude,
    observer?.longitude,
    observer?.elevationM,
    coarseNow,
  ]);

  /* Flight Log: anuncia el pase en curso (AOS) y el próximo, sin duplicados. */
  const loggedPasses = useRef<Set<number>>(new Set());
  useEffect(() => {
    if (!sat || passes.length === 0) return;
    const ongoing = passes.find((p) => p.aosMs <= coarseNow && coarseNow <= p.losMs);
    const next = passes.find((p) => p.aosMs > coarseNow);
    if (ongoing && !loggedPasses.current.has(ongoing.aosMs)) {
      loggedPasses.current.add(ongoing.aosMs);
      teleLog.push("ALRT", `AOS ${sat.name}: visible ahora · maxEl ${ongoing.maxElDeg.toFixed(0)}°`);
    } else if (next && !loggedPasses.current.has(next.aosMs)) {
      loggedPasses.current.add(next.aosMs);
      teleLog.push(
        "ORBIT",
        `próximo pase ${sat.name} AOS ${fmtUtc(next.aosMs)} maxEl ${next.maxElDeg.toFixed(0)}° dur ${next.durationMin.toFixed(0)}min`,
      );
    }
    if (loggedPasses.current.size > 500) loggedPasses.current.clear();
  }, [passes, sat, coarseNow]);

  /* Posición y métricas de telemetría memoizadas sobre telemetryTime. */
  const fix = useMemo(
    () => (sat ? getFix(sat, telemetryTime) : null),
    [sat?.id, sat?.line1, sat?.line2, telemetryTime],
  );
  const altS = useScramble(fix ? fmtNum(fix.altKm, 1, " km") : "—");
  const velS = useScramble(fix ? fmtNum(fix.velKmS, 3, " km/s") : "—");
  const latS = useScramble(fix ? fmtLat(fix.latDeg) : "—");
  const lonS = useScramble(fix ? fmtLon(fix.lonDeg) : "—");

  const look = useMemo(
    () => (observer && sat && fix ? forecastNow(sat, telemetryTime, observer) : null),
    [
      sat?.id,
      sat?.line1,
      sat?.line2,
      telemetryTime,
      observer?.latitude,
      observer?.longitude,
      observer?.elevationM,
      fix,
    ],
  );
  const sol = useMemo(
    () => (sat && fix ? solarInfo(sat, telemetryTime, observer ?? undefined) : null),
    [sat?.id, sat?.line1, sat?.line2, telemetryTime, observer?.latitude, observer?.longitude, fix],
  );
  const fp = useMemo(
    () => (sat && fix ? footprint(sat, telemetryTime) : null),
    [sat?.id, sat?.line1, sat?.line2, telemetryTime, fix],
  );

  if (!sat) {
    return (
      <section className="st-detail st-detail-empty">
        <h2>Detalle</h2>
        <p className="st-hint">
          Selecciona un satélite del catálogo o del mapa para ver su posición, órbita y
          pasos sobre tu observador.
        </p>
      </section>
    );
  }

  return (
    <section className="st-detail">
      <div className="st-detail-head">
        <div>
          <h2>{sat.name}</h2>
          <p className="st-sub">
            NORAD {sat.id} · {GROUP_LABELS[sat.group]}
            {epoch && (
              <span className={`st-epoch st-epoch-${epoch.status}`} title={epoch.reason ?? ""}>
                {EPOCH_LABEL[epoch.status]}
                {epoch.ageDays !== undefined && epoch.ageDays >= 0 && (
                  <> · {fmtAgeDays(epoch.ageDays)}</>
                )}
              </span>
            )}
          </p>
        </div>
        <div className="st-detail-actions">
          <button
            className={tracked ? "st-track on" : "st-track"}
            onClick={onToggleTrack}
            title="Seguir en el mapa"
          >
            {tracked ? "⦿ siguiendo" : "○ seguir"}
          </button>
          <button className="st-close" onClick={onClose} title="Cerrar detalle">
            ✕
          </button>
        </div>
      </div>

      <FavoritePicker
        fav={fav}
        satId={sat.id}
        onToggle={onToggleSatInList}
        onCreateList={(name) => onCreateList(name, sat.id)}
      />

      {!fix ? (
        <p className="st-warn">
          Sin posición: el TLE no propaga (satélite decaído o elementos degradados).
        </p>
      ) : (
        <>
          <div className="st-metrics">
            <div>
              <span>Latitud</span>
              <b key={latS} className="st-tval">{latS}</b>
            </div>
            <div>
              <span>Longitud</span>
              <b key={lonS} className="st-tval">{lonS}</b>
            </div>
            <div>
              <span>Altitud</span>
              <b key={altS} className="st-tval">{altS}</b>
            </div>
            <div>
              <span>Velocidad</span>
              <b key={velS} className="st-tval">{velS}</b>
            </div>
            {fp && (
              <div>
                <span>Huella</span>
                <b>Ø {fmtNum(fp.radiusKm * 2, 0, " km")}</b>
              </div>
            )}
            {look && look.elDeg !== undefined && (
              <>
                <div className={look.elDeg > 0 ? "st-visible" : undefined}>
                  <span>Elevación</span>
                  <b>{fmtNum(look.elDeg, 1, "°")}</b>
                </div>
                <div>
                  <span>Azimut</span>
                  <b>{fmtAz(look.azDeg ?? 0)}</b>
                </div>
                <div>
                  <span>Distancia</span>
                  <b>{fmtNum(look.rangeKm, 0, " km")}</b>
                </div>
              </>
            )}
            {sol && (
              <>
                <div>
                  <span>Sol</span>
                  <b>{sol.sunlit ? "☀ iluminado" : `🌑 sombra (${fmtNum(sol.shadowFraction * 100, 0, "%")})`}</b>
                </div>
                <div>
                  <span>Hora solar (sub-sat.)</span>
                  <b>{fmtNum(sol.localSolarTimeH, 2, " h")}</b>
                </div>
                {sol.observerSolarTimeH !== undefined && (
                  <div>
                    <span>Hora solar ({observer?.name ?? "obs."})</span>
                    <b>{fmtNum(sol.observerSolarTimeH, 2, " h")}</b>
                  </div>
                )}
              </>
            )}
          </div>

          {params && (
            <details className="st-orbit-params">
              <summary>Parámetros orbitales</summary>
              <dl>
                <div><dt>Inclinación</dt><dd>{fmtNum(params.inclinationDeg, 2, "°")}</dd></div>
                <div><dt>Período</dt><dd>{fmtDuration(params.periodMin)}</dd></div>
                <div><dt>Mov. medio</dt><dd>{fmtNum(params.meanMotionRevDay, 4, " rev/d")}</dd></div>
                <div><dt>Excentricidad</dt><dd>{fmtNum(params.eccentricity, 6, "")}</dd></div>
                <div><dt>Semieje mayor</dt><dd>{fmtNum(params.semiMajorAxisKm, 1, " km")}</dd></div>
                <div><dt>Apogeo</dt><dd>{fmtNum(params.apogeeKm, 1, " km")}</dd></div>
                <div><dt>Perigeo</dt><dd>{fmtNum(params.perigeeKm, 1, " km")}</dd></div>
                <div><dt>B*</dt><dd>{params.bstar.toExponential(2)}</dd></div>
                <div><dt>Época TLE</dt><dd>{params.epoch.toISOString().slice(0, 16).replace("T", " ")} UTC</dd></div>
              </dl>
            </details>
          )}
        </>
      )}

      <div className="st-passes">
        <div className="st-passes-head">
          <h3>Pasos sobre {observer ? observer.name : "el observador"} · próximas 24 h</h3>
          {observer && (
            <button
              className="st-chip"
              title="Descargar los pases de 24 h en CSV"
              onClick={() => {
                const csv = buildPassesCsv(sat, observer, passes, new Date());
                downloadText(passesFilename(sat, new Date()), csv);
                teleLog.push("SYS", `export CSV ${passes.length} pases → ${passesFilename(sat, new Date())}`);
              }}
            >
              ⭳ CSV
            </button>
          )}
        </div>
        {!observer ? (
          <p className="st-hint">Configura tu observador (panel inferior) para predecir pasos.</p>
        ) : passes.length === 0 ? (
          <p className="st-hint">Ningún paso con elevación &gt; 0° en las próximas 24 h.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Inicio (AOS)</th>
                <th>Máx.</th>
                <th>Fin (LOS)</th>
                <th>El. máx</th>
                <th>Az salida</th>
                <th>Az puesta</th>
                <th>Dur.</th>
              </tr>
            </thead>
            <tbody>
              {passes.map((p) => (
                <tr key={p.aosMs}>
                  <td>{fmtTime(p.aosMs, tz)}</td>
                  <td>{fmtTime(p.tcaMs, tz)}</td>
                  <td>{fmtTime(p.losMs, tz)}</td>
                  <td>{fmtNum(p.maxElDeg, 1, "°")}</td>
                  <td>{fmtNum(p.azRiseDeg, 0, "°")}</td>
                  <td>{fmtNum(p.azSetDeg, 0, "°")}</td>
                  <td>{fmtDuration(p.durationMin)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {observer && <p className="st-hint">Horas en {tz}.</p>}
      </div>

      <details className="st-tle">
        <summary>TLE</summary>
        <code>{sat.line1}</code>
        <code>{sat.line2}</code>
      </details>
    </section>
  );
}

export default memo(SatDetail);
