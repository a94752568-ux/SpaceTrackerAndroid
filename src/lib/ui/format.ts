/** Formateo para la UI (números, coordenadas, fechas con zona horaria). */

export function fmtNum(x: number | undefined | null, digits = 1, suffix = ""): string {
  if (x === undefined || x === null || !Number.isFinite(x)) return "—";
  return `${x.toLocaleString("es-ES", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}${suffix}`;
}

export function fmtLat(lat: number): string {
  return `${fmtNum(Math.abs(lat), 3)}° ${lat >= 0 ? "N" : "S"}`;
}

export function fmtLon(lon: number): string {
  return `${fmtNum(Math.abs(lon), 3)}° ${lon >= 0 ? "E" : "O"}`;
}

export function fmtTime(ms: number, timezone: string): string {
  try {
    return new Intl.DateTimeFormat("es-ES", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(new Date(ms));
  } catch {
    return new Date(ms).toISOString().slice(11, 19);
  }
}

export function fmtDateTime(ms: number | string | Date, timezone?: string): string {
  const d = typeof ms === "string" ? new Date(ms) : typeof ms === "number" ? new Date(ms) : ms;
  try {
    return new Intl.DateTimeFormat("es-ES", {
      timeZone: timezone ?? "UTC",
      dateStyle: "medium",
      timeStyle: "short",
      hour12: false,
    }).format(d);
  } catch {
    return d.toISOString().slice(0, 16).replace("T", " ");
  }
}

export function fmtDuration(minutes: number): string {
  if (!Number.isFinite(minutes)) return "—";
  if (minutes < 1) return `${Math.round(minutes * 60)} s`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h > 0 ? `${h} h ${m} min` : `${m} min`;
}

/** Edad legible a partir de días (p. ej. "2 h", "3 d"). */
export function fmtAgeDays(days: number | undefined): string {
  if (days === undefined || !Number.isFinite(days)) return "—";
  if (days < 1 / 24) return `${Math.max(1, Math.round(days * 1440))} min`;
  if (days < 1) return `${Math.round(days * 24)} h`;
  return `${days.toFixed(1)} d`;
}

export function fmtAz(az: number): string {
  const dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSO", "SO", "OSO", "O", "ONO", "NO", "NNO"];
  const d = dirs[Math.round(((az % 360) + 360) % 360 / 22.5) % 16];
  return `${fmtNum(az, 0)}° (${d})`;
}

/** Fecha estilo póster: "30 OCT 2026" (mayúsculas; UTC por defecto). */
export function fmtPosterDate(ms: number | string | Date, timezone?: string): string {
  const d = typeof ms === "string" ? new Date(ms) : typeof ms === "number" ? new Date(ms) : ms;
  try {
    return new Intl.DateTimeFormat("es-ES", {
      timeZone: timezone ?? "UTC",
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
      .format(d)
      .replace(/\./g, "")
      .replace(/\s*de\s+/gi, " ")
      .trim()
      .toUpperCase();
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

/** Hora estilo póster: "08:14" (sin segundos; UTC por defecto). */
export function fmtPosterTime(ms: number | string | Date, timezone?: string): string {
  const d = typeof ms === "string" ? new Date(ms) : typeof ms === "number" ? new Date(ms) : ms;
  try {
    return new Intl.DateTimeFormat("es-ES", {
      timeZone: timezone ?? "UTC",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(d);
  } catch {
    return d.toISOString().slice(11, 16);
  }
}
