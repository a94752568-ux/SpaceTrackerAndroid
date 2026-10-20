/**
 * Fragmentos HTML/SVG y constantes de los marcadores del mapa (sin Leaflet,
 * testeables en Node/SSR).
 *
 * UX (2026-10-18, iteración 2):
 * - Cada satélite se dibuja con un SVG minimalista según su grupo de misión
 *   (`groupIconSvg`), usando el color del grupo como color principal.
 * - Hitbox invisible de HITBOX_PX × HITBOX_PX alrededor del icono (clic fiable
 *   con alta densidad).
 * - Rotación por rumbo orbital: el envoltorio `.st-ico` gira con
 *   `transform: rotate(var(--rot))`; MapView actualiza `--rot` con el bearing
 *   SGP4 entre t y t+1 s (ver `bearingDeg` en lib/space/propagate.ts).
 * - El satélite seleccionado lleva la clase `.selected-satellite-active`
 *   (anillos de pulso vía ::before/::after en styles.css).
 */

import type { GroupId } from "../space/types";

/** Lado del cuadrado de hitbox invisible (≥ 24 px exigido por el requisito UX). */
export const HITBOX_PX = 24;

/**
 * Tope duro del tier DOM (favoritos + categoría activa + seleccionado).
 * Por encima de ~150 nodos divIcon el DOM vuelve a ser el cuello de botella;
 * el exceso permanece en canvas sin perder información (color + tooltip).
 */
export const MAX_DOM_MARKERS = 150;

/** Clase canónica del marcador seleccionado (pulso rítmico en CSS). */
export const SELECTED_SAT_CLASS = "selected-satellite-active";

/** Escapa texto inyectado en tooltips HTML (nombres de catálogo). */
export function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}

/* Trazos minimalistas por grupo (viewBox 16×16). "COLOR" se sustituye por el
   color del grupo: el color sigue siendo el identificador principal. */
const ICON_PATHS: Record<GroupId, string> = {
  // Casco de astronauta + hombros
  crew:
    '<circle cx="8" cy="6.6" r="3.6"/><path d="M6.2 7.1a1.9 1.9 0 0 0 3.6 0"/><path d="M3.2 13.6c.9-2.2 2.7-3.3 4.8-3.3s3.9 1.1 4.8 3.3"/>',
  // Nube con precipitación
  weather:
    '<path d="M4.6 10.2a2.6 2.6 0 0 1 .3-5.2 3.4 3.4 0 0 1 6.6.9 2.3 2.3 0 0 1-.4 4.3z"/><path d="M6.2 12.1l-.7 1.7M9.4 12.1l-.7 1.7"/>',
  // Retícula GNSS (crosshair + núcleo)
  nav:
    '<circle cx="8" cy="8" r="3.2"/><path d="M8 1.6v2.2M8 12.2v2.2M1.6 8h2.2M12.2 8h2.2"/><circle cx="8" cy="8" r="1" fill="COLOR" stroke="none"/>',
  // Átomo (núcleo + dos órbitas)
  science:
    '<circle cx="8" cy="8" r="1.1" fill="COLOR" stroke="none"/><ellipse cx="8" cy="8" rx="6.2" ry="2.5"/><ellipse cx="8" cy="8" rx="6.2" ry="2.5" transform="rotate(64 8 8)"/>',
  // Panel plano característico de Starlink + cuerpo
  starlink:
    '<rect x="2.4" y="7.1" width="11.2" height="1.8" rx=".5"/><rect x="6.7" y="4.2" width="2.6" height="2.9" rx=".5"/><path d="M8 8.9v2.6"/>',
  // Antena parabólica con haz
  comms:
    '<path d="M3.6 9.8a5.2 5.2 0 0 1 6.6-6.6z"/><path d="M7 6.4l4.6 4.6"/><path d="M11.9 2.7a4.6 4.6 0 0 1 1.4 1.4"/><path d="M6.4 11.4l-1.6 2.8"/>',
  // Satélite genérico (rombo + paneles)
  other:
    '<rect x="6.5" y="6.5" width="3" height="3" transform="rotate(45 8 8)"/><path d="M1.6 8h3.2M11.2 8h3.2M8 1.6v3.2"/>',
};

/** SVG minimalista de la categoría; `color` es el color principal del trazo. */
export function groupIconSvg(group: GroupId, color: string): string {
  const body = ICON_PATHS[group].replaceAll("COLOR", color);
  return (
    `<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="${color}" ` +
    `stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`
  );
}

/**
 * Interior del divIcon del tier DOM (favoritos / categoría activa):
 * puntero táctico = anillo radar-ping escalonado + icono SVG orientable +
 * badge ★ de favorito + etiqueta inteligente de nombre.
 */
export function tacticalIconHtml(
  group: GroupId,
  color: string,
  opts: { fav?: boolean; ping?: string; label?: string } = {},
): string {
  const ping = opts.ping ?? "0s";
  return (
    `<span class="st-tac" style="--g:${color};--g-glow:${color}66;--pd:${ping}">` +
    `<span class="st-tac-ring"></span>` +
    `<span class="st-ico">${groupIconSvg(group, color)}</span>` +
    `${opts.fav ? '<span class="st-fav-badge" aria-label="favorito">★</span>' : ""}` +
    `${opts.label ? `<span class="st-tac-label">${escapeHtml(opts.label)}</span>` : ""}` +
    `</span>`
  );
}

/**
 * Interior del divIcon del satélite seleccionado: icono grande orientable +
 * retícula giratoria + crosshair biselado con destellos naranjas.
 */
export function satIconHtml(group: GroupId, color: string): string {
  return (
    `<span class="st-ico st-ico-lg">${groupIconSvg(group, color)}</span>` +
    '<span class="st-halo"></span>' +
    '<span class="st-reticle"></span>' +
    '<span class="st-cross"><i></i><i></i><i></i><i></i></span>'
  );
}
