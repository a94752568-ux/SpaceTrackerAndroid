/**
 * Cabecera: identidad, búsqueda (local + remota en Ivan), procedencia del
 * catálogo (live/seed) y métricas de ingesta (Etapa 2/3).
 */
import { memo, useState } from "react";

import type { CatalogPayload, Observer } from "../lib/space/types";
import { AGING_MAX_DAYS } from "../lib/space/tle-epoch";
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
  sizeClass?: string;
  onOpenCatalog?: () => void;
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
  sizeClass,
  onOpenCatalog,
}: HeaderProps) {
  const [showStats, setShowStats] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const stats = payload?.stats;
  const native = isTauri();
  const isCompact = sizeClass === "compact";

  // Calcular si hay TLEs caducados (más de 7 días = aging + stale)
  const staleCount = stats ? stats.aging + stats.stale : 0;
  const hasStaleTle = staleCount > 0 && stats && stats.valid > 0;
  const stalePercentage = stats && stats.valid > 0 ? (staleCount / stats.valid) * 100 : 0;

  return (
    <header
      className={`st-header ${isCompact ? "compact" : ""}`}
      {...(native ? { "data-tauri-drag-region": "" } : {})}
    >
      <div className="st-brand">
        <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
          <circle cx="12" cy="12" r="4" fill="var(--group-starlink)" />
          <ellipse
            cx="12"
            cy="12"
            rx="10"
            ry="4.4"
            fill="none"
            stroke="var(--group-science)"
            strokeWidth="1.4"
            transform="rotate(-24 12 12)"
          />
          <circle cx="21" cy="8.4" r="1.5" fill="var(--group-crew)" />
        </svg>
        <div>
          <h1>SpaceTracker</h1>
          {!isCompact && (
            <p className="st-tagline">
              Explorador de satélites · TLE: Ivan/SatNOGS · SGP4: satellite.js 7.1.0 · Teselas: Esri
            </p>
          )}
        </div>
      </div>

      {isCompact ? (
        <div className="st-compact-toolbar">
          <button
            type="button"
            className="st-iconbtn"
            onClick={() => setShowMobileSearch((v) => !v)}
            aria-label="Buscar satélites"
            title="Buscar satélite"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </button>
          <button
            type="button"
            className="st-iconbtn"
            onClick={onCenterObserver}
            aria-label="Centrar en mi ubicación o GPS"
            title={observer ? `Centrar en ${observer.name}` : "Obtener mi ubicación GPS actual"}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
          </button>
          <button
            type="button"
            className="st-iconbtn"
            onClick={() => setShowMobileMenu((v) => !v)}
            aria-label="Menú principal de opciones"
            title="Menú"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="12" cy="12" r="1"/>
              <circle cx="19" cy="12" r="1"/>
              <circle cx="5" cy="12" r="1"/>
            </svg>
          </button>
        </div>
      ) : (
        <>
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
                requestAnimationFrame(() => onQueryChange(e.target.value));
              }}
              aria-label="Buscar satélite"
            />
            <button type="submit" disabled={searching || !query.trim()}>
              {searching ? "…" : "Ivan"}
            </button>
          </form>

          <button
            type="button"
            className="st-observer-badge st-observer-btn"
            onClick={onCenterObserver}
            title={observer ? `Centrar mapa en ${observer.name} (${observer.latitude.toFixed(2)}°, ${observer.longitude.toFixed(2)}°)` : "Obtener mi ubicación GPS actual"}
          >
            📍 {observer ? `${observer.name} (${observer.latitude.toFixed(1)}°, ${observer.longitude.toFixed(1)}°)` : "Mi ubicación GPS"} 🎯
          </button>

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
                {hasStaleTle && (
                  <span className="st-prov-meta st-stale-warning" title={`${staleCount} TLEs con más de ${AGING_MAX_DAYS} días (${stalePercentage.toFixed(0)}%)`}>
                    ⚠ {staleCount} caducados
                  </span>
                )}
                {stats && (
                  <button className="st-stats-toggle" onClick={() => setShowStats((v) => !v)} aria-expanded={showStats}>
                    métricas {showStats ? "▴" : "▾"}
                  </button>
                )}
              </>
            ) : (
              <span className="st-prov-meta">cargando catálogo…</span>
            )}
          </div>
        </>
      )}

      {isCompact && payload && (
        <div className="st-compact-meta" onClick={onOpenCatalog} role="button" tabIndex={0} title="Toca para ver el catálogo y filtros">
          <span className={`st-badge ${payload.source === "live" ? "st-badge-live" : "st-badge-seed"}`}>
            {payload.source === "live" ? "LIVE" : "SEED"}
          </span>
          <span className="st-prov-meta ellipsis">
            {uniqueCount} visibles · {fmtDateTime(payload.fetchedAt)} UTC ▾
          </span>
        </div>
      )}

      {isCompact && showMobileSearch && (
        <div className="st-mobile-search-overlay">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (query.trim()) {
                onRemoteSearch(query.trim());
                setShowMobileSearch(false);
              }
            }}
          >
            <input
              autoFocus
              id="st-search-input"
              type="search"
              value={query}
              placeholder="Buscar satélite o NORAD..."
              onChange={(e) => onQueryChange(e.target.value)}
              aria-label="Buscar satélite"
            />
            <button type="submit" disabled={searching || !query.trim()}>
              {searching ? "…" : "Ivan"}
            </button>
            <button type="button" onClick={() => setShowMobileSearch(false)}>
              ×
            </button>
          </form>
        </div>
      )}

      {isCompact && showMobileMenu && (
        <div className="st-mobile-menu-dropdown">
          <button
            className={isGlitching ? "st-glitch-btn on" : "st-glitch-btn"}
            onClick={() => {
              onToggleGlitch();
              setShowMobileMenu(false);
            }}
          >
            ⚡ GLITCH: {isGlitching ? "ON" : "OFF"}
          </button>
          <button
            onClick={() => {
              const current = document.documentElement.getAttribute("data-theme") || "neon";
              const next = current === "neon" ? "amber" : "neon";
              document.documentElement.setAttribute("data-theme", next);
              localStorage.setItem("spacetracker:theme", next);
              setShowMobileMenu(false);
            }}
          >
            🎨 Cambiar Tema (Neon / Amber)
          </button>
          {stats && (
            <button onClick={() => setShowStats((v) => !v)}>
              Métricas {showStats ? "▴" : "▾"}
            </button>
          )}
          <button onClick={() => setShowMobileMenu(false)}>Cerrar menú</button>
        </div>
      )}

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
