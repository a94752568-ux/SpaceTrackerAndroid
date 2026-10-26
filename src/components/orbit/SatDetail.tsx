/**
 * Detalle del satélite o la Luna seleccionados: posición, altitud, velocidad, distancia,
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
import { getMoonPosition } from "../../lib/space/moon-position";
import { getMoonPhase } from "../../lib/space/moon-phase";
import { diagnoseTleEpoch } from "../../lib/space/tle-epoch";
import { fetchLocationDetails } from "../../lib/ui/geocoding";
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
  const isMoon = sat?.id === 999999;
  const [telemetryTime, setTelemetryTime] = useState<Date>(now);
  const lastUpdateRef = useRef<number>(now.getTime());

  useEffect(() => {
    const tMs = now.getTime();
    if (Math.abs(tMs - lastUpdateRef.current) >= 1000) {
      lastUpdateRef.current = tMs;
      setTelemetryTime(now);
    }
  }, [now]);

  const coarseNow = Math.floor(telemetryTime.getTime() / 600000) * 600000;

  const moonData = useMemo(() => (isMoon ? getMoonPosition(telemetryTime) : null), [isMoon, coarseNow]);
  const moonPhase = useMemo(() => (isMoon ? getMoonPhase(telemetryTime) : null), [isMoon, coarseNow]);

  const fix = useMemo(
    () => (sat && !isMoon ? getFix(sat, telemetryTime) : null),
    [sat?.id, sat?.line1, sat?.line2, telemetryTime, isMoon],
  );

  const [locationDetails, setLocationDetails] = useState<{ place: string; country: string; continent: string } | null>(null);
  useEffect(() => {
    if (!fix || isMoon) {
      setLocationDetails(null);
      return;
    }
    let alive = true;
    fetchLocationDetails(fix.latDeg, fix.lonDeg).then((res) => {
      if (alive) setLocationDetails(res);
    });
    return () => { alive = false; };
  }, [fix?.latDeg.toFixed(1), fix?.lonDeg.toFixed(1), isMoon]);

  const params = useMemo(() => (sat && !isMoon ? orbitParams(sat) : null), [sat?.id, sat?.line1, sat?.line2, isMoon]);
  const epoch = useMemo(
    () => (sat && !isMoon ? diagnoseTleEpoch(sat.line1, telemetryTime) : null),
    [sat?.line1, coarseNow, isMoon],
  );
  const passes = useMemo(() => {
    if (!sat || !observer || isMoon) return [];
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
    isMoon,
  ]);

  if (!sat) {
    return (
      <section className="st-detail st-detail-empty">
        <h2>Detalle</h2>
        <p className="st-hint">
          Selecciona un satélite, la Luna o un punto del catálogo para ver su posición y órbita.
        </p>
      </section>
    );
  }

  if (isMoon && moonData && moonPhase) {
    return (
      <section className="st-detail">
        <div className="st-detail-head">
          <div>
            <h2>🌙 {sat.name}</h2>
            <p className="st-sub">Objeto Celeste Natural · Sistema Tierra-Luna</p>
          </div>
          <div className="st-detail-actions">
            <button className="st-close" onClick={onClose} title="Cerrar detalle">
              ✕
            </button>
          </div>
        </div>

        <div className="st-metrics">
          <div>
            <span>Fase Lunar</span>
            <b className="st-tval">{moonPhase.phaseName}</b>
          </div>
          <div>
            <span>Iluminación</span>
            <b className="st-tval">{Math.round(moonPhase.illumination)}%</b>
          </div>
          <div>
            <span>Distancia</span>
            <b className="st-tval">{moonData.distanceKm.toFixed(0)} km</b>
          </div>
          <div>
            <span>Sub-lunar Lat</span>
            <b className="st-tval">{moonData.lat.toFixed(2)}°</b>
          </div>
          <div>
            <span>Sub-lunar Lon</span>
            <b className="st-tval">{moonData.lon.toFixed(2)}°</b>
          </div>
        </div>
      </section>
    );
  }

  const altS = useScramble(fix ? fmtNum(fix.altKm, 1, " km") : "—");
  const velS = useScramble(fix ? fmtNum(fix.velKmS, 3, " km/s") : "—");
  const latS = useScramble(fix ? fmtLat(fix.latDeg) : "—");
  const lonS = useScramble(fix ? fmtLon(fix.lonDeg) : "—");

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

      {locationDetails && (
        <div className="st-location-info" style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--accent)", margin: "8px 0", background: "rgba(0,229,255,0.06)", padding: "6px 10px", borderRadius: "4px", border: "1px solid rgba(0,229,255,0.2)" }}>
          🌍 Sobre: <b>{locationDetails.place}</b>, {locationDetails.country} ({locationDetails.continent})
        </div>
      )}

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
          </div>
        </>
      )}
    </section>
  );
}

export default memo(SatDetail);
