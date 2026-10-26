/**
 * Telemetría viva en esquina (modo misión): scramble de métricas.
 */
import { useEffect, useState } from "react";
import { useScramble } from "../../lib/ui/useScramble";
import { fmtNum, fmtLat, fmtLon } from "../../lib/ui/format";
import type { Fix } from "../../lib/space/types";

interface Props {
  name: string | null;
  fix: Fix | null;
  visible: boolean;
}

export default function MissionTelemetry({ name, fix, visible }: Props) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!visible || !fix) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 2800);
    return () => window.clearInterval(id);
  }, [visible, fix?.tMs]);

  const lines = [
    name ? `TGT ${name}` : "TGT —",
    fix ? `ALT ${fmtNum(fix.altKm, 1, " km")}` : "ALT —",
    fix ? `VEL ${fmtNum(fix.velKmS, 3, " km/s")}` : "VEL —",
    fix ? `LAT ${fmtLat(fix.latDeg)}` : "LAT —",
    fix ? `LON ${fmtLon(fix.lonDeg)}` : "LON —",
  ];
  const line = lines[tick % lines.length] ?? lines[0];
  const scrambled = useScramble(line, 380);

  if (!visible) return null;

  return (
    <div className="st-mission-telemetry" aria-live="polite">
      <div className="st-mission-telemetry-label">MISSION TX</div>
      <div className="st-mission-telemetry-line">{scrambled}</div>
    </div>
  );
}
