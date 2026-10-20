/**
 * Cálculo analítico de la posición de la Luna (efemérides simplificadas de alta precisión).
 *
 * - Coordenadas ecuatoriales geocéntricas (Ascensión Recta y Declinación).
 * - Punto sub-lunar en la Tierra (lat, lon).
 * - Distancia geocéntrica en km.
 * - Ángulos de observación (azimut, elevación) si se provee la posición del observador.
 */

import {
  degreesToRadians,
  ecfToLookAngles,
  eciToEcf,
  eciToGeodetic,
  gstime,
  jday,
  radiansToDegrees,
} from "satellite.js";

export interface MoonPosition {
  lat: number;
  lon: number;
  distanceKm: number;
  azimuth?: number;
  elevation?: number;
  isAboveHorizon: boolean;
}

function norm360(deg: number): number {
  const d = deg % 360;
  return d < 0 ? d + 360 : d;
}

function normLonDeg(lon: number): number {
  let l = lon % 360;
  if (l > 180) l -= 360;
  if (l < -180) l += 360;
  return l;
}

function observerGeodetic(obs: { latitude: number; longitude: number; elevationM?: number }) {
  return {
    latitude: degreesToRadians(obs.latitude),
    longitude: degreesToRadians(obs.longitude),
    height: (obs.elevationM ?? 0) / 1000,
  };
}

export function getMoonPosition(date: Date, obsLat?: number, obsLon?: number): MoonPosition {
  const jd = jday(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate(),
    date.getUTCHours(),
    date.getUTCMinutes(),
    date.getUTCSeconds() + date.getUTCMilliseconds() / 1000,
  );

  const t = jd - 2451545.0; // Días desde J2000.0

  // 1. Elementos orbitales medios de la Luna (Meeus / alg. simplificados)
  const L = 218.316 + 13.176396 * t; // Longitud media (deg)
  const M = 134.963 + 13.064993 * t; // Anomalía media (deg)
  const F = 93.272 + 13.229350 * t; // Argumento de latitud (deg)
  const Ms = 357.529 + 0.9856003 * t; // Anomalía media del Sol (deg)

  const lRad = degreesToRadians(L);
  const mRad = degreesToRadians(M);
  const msRad = degreesToRadians(Ms);
  const fRad = degreesToRadians(F);

  // Perturbaciones principales en longitud eclíptica (deg)
  const dLambda =
    6.289 * Math.sin(mRad) +
    1.274 * Math.sin(2 * lRad - mRad) +
    0.658 * Math.sin(2 * lRad) -
    0.185 * Math.sin(msRad) -
    0.114 * Math.sin(2 * fRad);

  const lambda = norm360(L + dLambda); // Longitud eclíptica
  const beta = 5.128 * Math.sin(fRad) + 0.280 * Math.sin(mRad + fRad) + 0.278 * Math.sin(mRad - fRad); // Latitud eclíptica (deg)

  // Distancia geocéntrica (km)
  const distanceKm =
    385000 -
    20905 * Math.cos(mRad) -
    3699 * Math.cos(2 * lRad - mRad) -
    2956 * Math.cos(2 * lRad) -
    570 * Math.cos(2 * mRad);

  // Oblicuidad de la eclíptica (deg)
  const epsilon = 23.439 - 0.0000004 * t;
  const epsRad = degreesToRadians(epsilon);

  const lamRad = degreesToRadians(lambda);
  const betRad = degreesToRadians(beta);

  // Conversión eclíptica (lambda, beta) -> ecuatorial (alpha, delta)
  const sinDelta =
    Math.sin(betRad) * Math.cos(epsRad) + Math.cos(betRad) * Math.sin(epsRad) * Math.sin(lamRad);
  const deltaRad = Math.asin(Math.max(-1, Math.min(1, sinDelta)));

  const y = Math.sin(lamRad) * Math.cos(epsRad) - Math.tan(betRad) * Math.sin(epsRad);
  const x = Math.cos(lamRad);
  const alphaRad = Math.atan2(y, x);

  // Posición en ECI (km)
  const cosDec = Math.cos(deltaRad);
  const eciPos = {
    x: distanceKm * cosDec * Math.cos(alphaRad),
    y: distanceKm * cosDec * Math.sin(alphaRad),
    z: distanceKm * Math.sin(deltaRad),
  };

  const gmst = gstime(date);
  const gd = eciToGeodetic(eciPos, gmst);
  const lat = radiansToDegrees(gd.latitude);
  const lon = normLonDeg(radiansToDegrees(gd.longitude));

  let azimuth: number | undefined;
  let elevation: number | undefined;
  let isAboveHorizon = false;

  if (obsLat !== undefined && obsLon !== undefined) {
    const ecfPos = eciToEcf(eciPos, gmst);
    const obsGeo = observerGeodetic({
      latitude: obsLat,
      longitude: obsLon,
      elevationM: 0,
    });
    const la = ecfToLookAngles(obsGeo, ecfPos);
    azimuth = norm360(radiansToDegrees(la.azimuth));
    elevation = radiansToDegrees(la.elevation);
    isAboveHorizon = elevation > 0;
  }

  return {
    lat,
    lon,
    distanceKm,
    azimuth,
    elevation,
    isAboveHorizon,
  };
}
