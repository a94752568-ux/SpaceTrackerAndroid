/**
 * Exportación de pases predichos (CSV estructurado, UTF-8 sin BOM).
 * La construcción del texto es pura (testeable); `downloadText` es la única
 * parte que toca el DOM y solo se invoca desde el navegador.
 */
import type { Observer, Pass, Sat } from "../space/types";

function csvField(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

const iso = (ms: number) => new Date(ms).toISOString();

export const PASSES_CSV_HEADER =
  "sat_name,sat_norad,observer,observer_lat,observer_lon,aos_utc,tca_utc,los_utc,max_el_deg,az_rise_deg,az_set_deg,duration_min";

/** CSV de los pases de las próximas 24 h con cabecera de metadatos (#). */
export function buildPassesCsv(
  sat: Sat,
  observer: Observer,
  passes: Pass[],
  generatedAt: Date,
): string {
  const meta = `# SpaceTracker · pases 24 h · generado ${generatedAt.toISOString()} · tz_observador ${observer.timezone}`;
  const rows = passes.map((p) =>
    [
      csvField(sat.name),
      sat.id,
      csvField(observer.name),
      observer.latitude,
      observer.longitude,
      iso(p.aosMs),
      iso(p.tcaMs),
      iso(p.losMs),
      p.maxElDeg.toFixed(1),
      p.azRiseDeg.toFixed(1),
      p.azSetDeg.toFixed(1),
      p.durationMin.toFixed(2),
    ].join(","),
  );
  return `${meta}\n${PASSES_CSV_HEADER}\n${rows.join("\n")}\n`;
}

export function passesFilename(sat: Sat, generatedAt: Date): string {
  return `spacetracker_pases_${sat.id}_${generatedAt.toISOString().slice(0, 10)}.csv`;
}

/** Descarga client-side (Blob + anchor temporal). */
export function downloadText(filename: string, text: string, mime = "text/csv"): void {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}
