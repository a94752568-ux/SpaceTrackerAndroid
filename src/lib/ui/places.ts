/**
 * Lugares predefinidos para el observador (sin dependencias externas ni
 * geocodificación en línea). Coordenadas y elevaciones aproximadas.
 */

import type { PlaceHit } from "../space/types";

export const PLACES: PlaceHit[] = [
  { name: "Madrid", country: "España", latitude: 40.4168, longitude: -3.7038, timezone: "Europe/Madrid", elevationM: 667 },
  { name: "Barcelona", country: "España", latitude: 41.3874, longitude: 2.1686, timezone: "Europe/Madrid", elevationM: 12 },
  { name: "Lisboa", country: "Portugal", latitude: 38.7223, longitude: -9.1393, timezone: "Europe/Lisbon", elevationM: 2 },
  { name: "Londres", country: "Reino Unido", latitude: 51.5072, longitude: -0.1276, timezone: "Europe/London", elevationM: 11 },
  { name: "París", country: "Francia", latitude: 48.8566, longitude: 2.3522, timezone: "Europe/Paris", elevationM: 35 },
  { name: "Berlín", country: "Alemania", latitude: 52.52, longitude: 13.405, timezone: "Europe/Berlin", elevationM: 34 },
  { name: "Roma", country: "Italia", latitude: 41.9028, longitude: 12.4964, timezone: "Europe/Rome", elevationM: 21 },
  { name: "Moscú", country: "Rusia", latitude: 55.7558, longitude: 37.6173, timezone: "Europe/Moscow", elevationM: 156 },
  { name: "Nueva York", country: "EE. UU.", latitude: 40.7128, longitude: -74.006, timezone: "America/New_York", elevationM: 10 },
  { name: "Los Ángeles", country: "EE. UU.", latitude: 34.0522, longitude: -118.2437, timezone: "America/Los_Angeles", elevationM: 71 },
  { name: "Ciudad de México", country: "México", latitude: 19.4326, longitude: -99.1332, timezone: "America/Mexico_City", elevationM: 2240 },
  { name: "Bogotá", country: "Colombia", latitude: 4.711, longitude: -74.0721, timezone: "America/Bogota", elevationM: 2640 },
  { name: "Lima", country: "Perú", latitude: -12.0464, longitude: -77.0428, timezone: "America/Lima", elevationM: 155 },
  { name: "Santiago", country: "Chile", latitude: -33.4489, longitude: -70.6693, timezone: "America/Santiago", elevationM: 570 },
  { name: "Buenos Aires", country: "Argentina", latitude: -34.6037, longitude: -58.3816, timezone: "America/Argentina/Buenos_Aires", elevationM: 25 },
  { name: "São Paulo", country: "Brasil", latitude: -23.5505, longitude: -46.6333, timezone: "America/Sao_Paulo", elevationM: 760 },
  { name: "Montevideo", country: "Uruguay", latitude: -34.9011, longitude: -56.1645, timezone: "America/Montevideo", elevationM: 35 },
  { name: "Caracas", country: "Venezuela", latitude: 10.4806, longitude: -66.9036, timezone: "America/Caracas", elevationM: 900 },
  { name: "Quito", country: "Ecuador", latitude: -0.1807, longitude: -78.4678, timezone: "America/Guayaquil", elevationM: 2850 },
  { name: "Tokio", country: "Japón", latitude: 35.6762, longitude: 139.6503, timezone: "Asia/Tokyo", elevationM: 40 },
  { name: "Pekín", country: "China", latitude: 39.9042, longitude: 116.4074, timezone: "Asia/Shanghai", elevationM: 44 },
  { name: "Sídney", country: "Australia", latitude: -33.8688, longitude: 151.2093, timezone: "Australia/Sydney", elevationM: 58 },
  { name: "El Cairo", country: "Egipto", latitude: 30.0444, longitude: 31.2357, timezone: "Africa/Cairo", elevationM: 75 },
  { name: "Kiruna", country: "Suecia", latitude: 67.8558, longitude: 20.2253, timezone: "Europe/Stockholm", elevationM: 500 },
  { name: "Base Marambio", country: "Antártida", latitude: -64.2333, longitude: -56.6167, timezone: "Antarctica/Palmer", elevationM: 200 },
];
