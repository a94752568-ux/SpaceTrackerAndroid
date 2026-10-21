/**
 * Cabecera: identidad, búsqueda (local + remota en Ivan), procedencia del
 * catálogo (live/seed) y métricas de ingesta (Etapa 2).
 */
import { memo, useState } from "react";

import type { CatalogPayload, Observer } from "../lib/space/types";
import { fmtDateTime } from "../lib/ui/format";
import { isTauri } from "../lib/ui/native";
import WindowControls from "./hud/WindowControls";

interface HeaderProps {
  payload: CatalogPayload | null;
  query: string;
  onQueryChange: (q: string) => void;
  onRemoteSearch: (q: string) => void;
  searching: boolean;
  uniqueCount: number;
  /** Modo kiosco / pantalla completa inmersiva (F11). */
  kioskActive: boolean;
  onKioskToggle: () => void;
  /** Modo Teatro: colapsar/expandir ambos paneles a la vez. */
  theaterOn: boolean;
  onTheater: () => void;
  observer: Observer | null;
  isGlitching: boolean;
  onToggleGlitch: () => void;
  onCenterObserver: () => void;
}

function Header({
  payload,
  query,
  onQueryChange,
  onRemoteSearch,
  searching,
  uniqueCount,
  kioskActive,
  onKioskToggle,
  theaterOn,
  onTheater,
  observer,
  isGlitching,
  onToggleGlitch,
  onCenterObserver,
}: HeaderProps) {
  const [showStats, setShowStats] = useState(false);
  const stats = payload?.stats;
  const native = isTauri();

  return (
    <header
      className="st-header"
      {...(native ? { "data-tauri-drag-region": "" } : {})}
    >
      <div className="st-brand">
        <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
          <circle cx="12" cy="12" r="4" fill="#7ee8fa" />
          <ellipse
            cx="12"
            cy="12"
            rx="10"
            ry="4.4"
            fill="none"
            stroke="#c77dff"
            strokeWidth="1.4"
            transform="rotate(-24 12 12)"
          />
          <circle cx="21" cy="8.4" r="1.5" fill="#ffd166" />
        </svg>
        <div>
          <h1>SpaceTracker</h1>
          <p className="st-tagline">
            Explorador de satélites · TLE: Ivan/SatNOGS · SGP4: satellite.js 7.1.0 · Teselas: Esri
          </p>
        </div>
      </div>

      <form
        className="st-search"
        onSubmit={(e) => {
          e.preventDefault();
          if (query.trim()) onRemoteSearch(query.trim());
        }}
      >
        <input
          id="st-search-input"
          type="search"
          value={query}
          placeholder="Buscar por nombre o NORAD… (Enter busca también en Ivan)"
          onChange={(e) => {
            // Defer state update to avoid blocking INP during typing
            requestAnimationFrame(() => onQueryChange(e.target.value));
          }}
          aria-label="Buscar satélite"
        />
        <button type="submit" disabled={searching || !query.trim()}>
          {searching ? "…" : "Ivan"}
        </button>
      </form>

      {observer && (
        <button
          type="button"
          className="st-observer-badge st-observer-btn"
          onClick={onCenterObserver}
          title={`Centrar mapa en ${observer.name} (${observer.latitude.toFixed(2)}°, ${observer.longitude.toFixed(2)}°)`}
        >
          📍 {observer.name} ({observer.latitude.toFixed(1)}°, {observer.longitude.toFixed(1)}°) 🎯
        </button>
      )}

      <div className="st-prov">
        {native && <WindowControls />}
        <button
          className={kioskActive ? "st-kiosk on" : "st-kiosk"}
          onClick={onKioskToggle}
          aria-pressed={kioskActive}
          title="Pantalla completa inmersiva (F11 o F)"
        >
          [ F11 ] {kioskActive ? "KIOSK ON" : "FULLSCREEN"}
        </button>
        <button
          className={isGlitching ? "st-glitch-btn on" : "st-glitch-btn"}
          onClick={onToggleGlitch}
          aria-pressed={isGlitching}
          title="Efecto Glitch Cyberpunk"
        >
          ⚡ GLITCH
        </button>
        {payload ? (
          <>
            <button
              className={theaterOn ? "st-theater on" : "st-theater"}
              onClick={onTheater}
              aria-pressed={theaterOn}
              title="Modo Teatro: ocultar/mostrar el panel de misión"
            >
              ⛶
            </button>
            <span className={`st-badge ${payload.source === "live" ? "st-badge-live" : "st-badge-seed"}`}>
              {payload.source === "live" ? "LIVE" : "SEED"}
            </span>
            <span className="st-prov-meta" title={payload.note ?? ""}>
              {uniqueCount} sats · {fmtDateTime(payload.fetchedAt)} UTC
            </span>
            {stats && (
              <button className="st-stats-toggle" onClick={() => setShowStats((v) => !v)}>
                métricas {showStats ? "▴" : "▾"}
              </button>
            )}
          </>
        ) : (
          <span className="st-prov-meta">cargando catálogo…</span>
        )}
      </div>

      {stats && showStats && (
        <div className="st-stats" title={payload?.note}>
          <span>vistas <b>{stats.seen}</b></span>
          <span>válidas <b>{stats.valid}</b></span>
          <span className="st-fresh">fresh <b>{stats.fresh}</b></span>
          <span className="st-aging">aging <b>{stats.aging}</b></span>
          <span className="st-stale">stale <b>{stats.stale}</b></span>
          <span>expirados <b>{stats.expired}</b></span>
          <span>decaídos <b>{stats.decayed}</b></span>
          <span>inválidas <b>{stats.invalid}</b></span>
          <span>futuras <b>{stats.future}</b></span>
          <span>Ivan <b>{stats.bySource.ivan}</b> (vistas {stats.seenBySource.ivan}, fallos {stats.failedBySource.ivan})</span>
          <span>SatNOGS <b>{stats.bySource.satnogs}</b> (vistas {stats.seenBySource.satnogs}, fallos {stats.failedBySource.satnogs})</span>
          {payload?.note && <span className="st-note">{payload.note}</span>}
        </div>
      )}
    </header>
  );
}

export default memo(Header);
