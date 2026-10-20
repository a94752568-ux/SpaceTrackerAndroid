/**
 * Mocks compartidos para tests de ingesta. Usan `Response` real de Node para
 * que `readJson`/`fetchWithRetry` se ejerciten tal como en producción.
 */
import { FIXTURES } from "./fixtures.mjs";

export const IVAN_URL_RE = /tle\.ivanstanojevic\.me/;
export const SATNOGS_URL_RE = /db\.satnogs\.org/;

export function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export function htmlResponse(html, status = 508) {
  return new Response(html, { status, headers: { "content-type": "text/html" } });
}

/** Cuerpo estilo Hydra de Ivan a partir de filas {id,name,line1,line2}. */
export function ivanBody(rows) {
  return {
    "@context": "/api/contexts/Tle",
    "@type": "Collection",
    totalItems: rows.length,
    member: rows.map((r) => ({
      "@type": "Tle",
      satelliteId: r.id,
      name: r.name,
      date: "2026-10-18T00:00:00+00:00",
      line1: r.line1,
      line2: r.line2,
    })),
  };
}

/** Cuerpo estilo SatNOGS a partir de filas {id,name,line1,line2}. */
export function satnogsBody(rows) {
  return rows.map((r) => ({
    tle0: `0 ${r.name}`,
    tle1: r.line1,
    tle2: r.line2,
    tle_source: "Space-Track.org",
    sat_id: "MOCK-0000",
    norad_cat_id: r.id,
    updated: "2026-10-18T00:00:00Z",
  }));
}

/** Recalcula el dígito de control (columna 69) de una línea TLE. */
export function fixChecksum(line) {
  let sum = 0;
  for (let i = 0; i < line.length - 1; i++) {
    const c = line[i];
    if (c >= "0" && c <= "9") sum += Number(c);
    else if (c === "-") sum += 1;
  }
  return line.slice(0, 68) + String(sum % 10);
}

/** Sustituye el campo de época (cols 19-32) por el de `date` y arregla el checksum. */
export function patchEpoch(line1, date) {
  const start = Date.UTC(date.getUTCFullYear(), 0, 1);
  const doy = (date.getTime() - start) / 86_400_000 + 1;
  const yy = String(date.getUTCFullYear() % 100).padStart(2, "0");
  const field = yy + doy.toFixed(8).padStart(12, "0");
  return fixChecksum(line1.slice(0, 18) + field + line1.slice(32));
}

/** Rompe el checksum de una línea (garantizado distinto). */
export function breakChecksum(line) {
  const last = Number(line[68]);
  return line.slice(0, 68) + String((last + 1) % 10);
}

/**
 * fetch simulado enrutado por URL:
 *  - ivan(url) / satnogs(url) devuelven Response, promesa o lanzan (fallo de red).
 *  - rutas no previstas → error (para detectar URLs inesperadas).
 */
export function makeMockFetch({ ivan, satnogs, onRequest } = {}) {
  return async (url, init = {}) => {
    if (onRequest) onRequest(url);
    if (init?.signal?.aborted) {
      throw new DOMException("This operation was aborted", "AbortError");
    }
    if (IVAN_URL_RE.test(url)) {
      if (!ivan) throw new Error(`ruta Ivan no prevista en el mock: ${url}`);
      return ivan(url, init);
    }
    if (SATNOGS_URL_RE.test(url)) {
      if (!satnogs) throw new Error(`ruta SatNOGS no prevista en el mock: ${url}`);
      return satnogs(url, init);
    }
    throw new Error(`URL no mockeada: ${url}`);
  };
}

/** Filtra fixtures por prefijo de nombre. */
export function fixturesNamed(...prefixes) {
  return FIXTURES.filter((f) => prefixes.some((p) => f.name.startsWith(p)));
}

export { FIXTURES };
