/**
 * SpaceTracker — composición de la aplicación.
 * Estado global mínimo (sin dependencias externas):
 * - catálogo con procedencia (live/seed),
 * - reloj real (1 s) + reloj de simulación (live/frozen ±24 h) para SGP4,
 * - selección, seguimiento, favoritos v2 (listas + radar), observador,
 * - Modo Teatro: paneles laterales colapsables (persistidos).
 */
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";

import Header from "./components/Header";
import Sidebar from "./components/Sidebar";
import MapView from "./components/map/MapView";
// El globo ortográfico (d3-geo + world-atlas) se carga bajo demanda: el chunk
// pesado solo entra al conmutar la vista, manteniendo ligero el arranque.
const GlobeView = lazy(() => import("./components/map/GlobeView"));
import SatDetail from "./components/orbit/SatDetail";
import SkyRadar from "./components/orbit/SkyRadar";
import TelemetryConsole from "./components/console/TelemetryConsole";
import Dock from "./components/hud/Dock";
import { fetchCatalog } from "./lib/space/catalog.client";
import { searchSatsByName } from "./lib/space/load-catalog";
import { getFix, orbitParams } from "./lib/space/propagate";
import { GROUP_LABELS } from "./lib/space/groups";
import { fetchCityName } from "./lib/ui/geocoding";
import type { CatalogPayload, GroupId, Observer, Sat } from "./lib/space/types";
import {
  allFavoriteIds,
  createList as createListOp,
  deleteList as deleteListOp,
  loadFavoritesState,
  renameList as renameListOp,
  saveFavoritesState,
  setRadarMode as setRadarModeOp,
  toggleSatInList as toggleSatInListOp,
  type FavoritesState,
} from "./lib/ui/favorites";
import {
  loadObserver,
  loadPanels,
  saveObserver,
  savePanels,
  type PanelsState,
} from "./lib/ui/persistence";
import { shiftMs, labelOffset } from "./lib/ui/timecontrol";
import { teleLog } from "./lib/ui/telemetry-log";
import { cycleFavorite, isTypingTarget } from "./lib/ui/hotkeys";
import { MAX_DOM_MARKERS } from "./lib/ui/markers";
import { DEFAULT_BASE_ID } from "./lib/ui/tiles";
import { installNativeGuards } from "./lib/ui/native";
import { useFps } from "./lib/ui/useFps";
import { useKioskMode } from "./lib/ui/useKioskMode";

interface SimState {
  mode: "live" | "frozen";
  tMs: number;
}

export default function App() {
  const [payload, setPayload] = useState<CatalogPayload | null>(null);
  const [externals, setExternals] = useState<Sat[]>([]);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [tracked, setTracked] = useState(false);
  const [fav, setFav] = useState<FavoritesState>(() => loadFavoritesState());
  const [observer, setObserver] = useState<Observer | null>(() => loadObserver());
  const [panels, setPanels] = useState<PanelsState>(() => loadPanels());
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [baseId, setBaseId] = useState<string>(DEFAULT_BASE_ID);
  const [overlays, setOverlays] = useState({ labels: true, terminator: true });
  const [view, setView] = useState<"map" | "globe">("map");
  /** Último satélite del drawer: permite la animación de salida al cerrar. */
  const [drawerSat, setDrawerSat] = useState<Sat | null>(null);
  const [fleetInfo, setFleetInfo] = useState<{ worker: boolean; frameMs: number } | null>(null);
  const fps = useFps();
  const kiosk = useKioskMode();
  const [isGlitching, setIsGlitching] = useState(false);
  const [realNow, setRealNow] = useState<Date>(() => new Date());
  const [sim, setSim] = useState<SimState>({ mode: "live", tMs: Date.now() });
  const autoSelected = useRef(false);
  const scrubRaf = useRef(0);
  const scrubPending = useRef(0);
  const [centerOnObserverTrigger, setCenterOnObserverTrigger] = useState(0);

  /* Reloj real de 1 s (base del modo live y del origen del slider). */
  useEffect(() => {
    const id = window.setInterval(() => setRealNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  /* Geolocalización silenciosa al iniciar si no hay observador explícitamente guardado */
  useEffect(() => {
    if (!localStorage.getItem("spacetracker:observer") && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const lat = pos.coords.latitude;
          const lon = pos.coords.longitude;
          let cityName = "Mi ubicación GPS";
          const resolved = await fetchCityName(lat, lon);
          if (resolved) cityName = resolved;

          const newObs: Observer = {
            name: cityName,
            latitude: lat,
            longitude: lon,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
          };
          setObserver(newObs);
          saveObserver(newObs);
          teleLog.push("SYS", `GPS automático: ${cityName} (${lat.toFixed(2)}°, ${lon.toFixed(2)}°)`);
        },
        () => {
          /* silencioso: usa Madrid */
        },
        { timeout: 6000 },
      );
    }
  }, []);

  /* Guards de WebView nativa (Tauri/Capacitor): contextmenu, gestos y ctrl+wheel. */
  useEffect(() => installNativeGuards(), []);

  /* Tiempo de cálculo SGP4: real en vivo, o instante congelado ajustable. */
  const now = useMemo<Date>(
    () => (sim.mode === "live" ? realNow : new Date(sim.tMs)),
    [sim, realNow],
  );

  const handlePause = useCallback(() => {
    setSim((s) => {
      const tMs = s.mode === "frozen" ? s.tMs : Date.now();
      teleLog.push("SYS", `TIME frozen @ ${new Date(tMs).toISOString().slice(11, 19)}Z`);
      return { mode: "frozen", tMs };
    });
  }, []);
  const handlePlayLive = useCallback(() => {
    teleLog.push("SYS", "TIME live · resincronizado con UTC");
    setSim({ mode: "live", tMs: Date.now() });
  }, []);
  const handleShiftHours = useCallback((h: number) => {
    setSim((s) => {
      const base = s.mode === "live" ? Date.now() : s.tMs;
      const tMs = shiftMs(base, h);
      teleLog.push("SYS", `TIME ${h > 0 ? "+" : ""}${h}h → desfase ${labelOffset(tMs - Date.now())}`);
      return { mode: "frozen", tMs };
    });
  }, []);
  /** Scrub del slider: coalesce con rAF para no recalcular más de 60 fps. */
  const handleScrub = useCallback((tMs: number) => {
    scrubPending.current = tMs;
    if (!scrubRaf.current) {
      scrubRaf.current = requestAnimationFrame(() => {
        scrubRaf.current = 0;
        setSim({ mode: "frozen", tMs: scrubPending.current });
      });
    }
  }, []);
  useEffect(() => () => cancelAnimationFrame(scrubRaf.current), []);

  /* Carga inicial del catálogo (servidor → Ivan directo → seed). */
  useEffect(() => {
    let alive = true;
    fetchCatalog()
      .then((p) => {
        if (alive) setPayload(p);
      })
      .catch(() => {
        /* la cascada de fetchCatalog ya termina en seed; esto es red de seguridad */
      });
    return () => {
      alive = false;
    };
  }, []);

  /* ---------- favoritos v2 ---------- */
  const favIds = useMemo(() => allFavoriteIds(fav), [fav]);

  const updateFav = useCallback((fn: (s: FavoritesState) => FavoritesState) => {
    setFav((prev) => {
      const next = fn(prev);
      saveFavoritesState(next);
      return next;
    });
  }, []);

  const handleToggleSatInList = useCallback(
    (listId: string, satId: number) => updateFav((s) => toggleSatInListOp(s, listId, satId)),
    [updateFav],
  );
  const handleCreateList = useCallback(
    (name: string, satId?: number) =>
      updateFav((s) => {
        const withList = createListOp(s, name);
        const created = withList.lists[withList.lists.length - 1];
        return satId === undefined ? withList : toggleSatInListOp(withList, created.id, satId);
      }),
    [updateFav],
  );
  const handleRenameList = useCallback(
    (id: string, name: string) => updateFav((s) => renameListOp(s, id, name)),
    [updateFav],
  );
  const handleDeleteList = useCallback(
    (id: string) => updateFav((s) => deleteListOp(s, id)),
    [updateFav],
  );
  const handleToggleRadar = useCallback(
    () =>
      updateFav((s) => {
        const next = setRadarModeOp(s, !s.radarMode);
        teleLog.push("SYS", `RADAR personal ${next.radarMode ? "ON" : "OFF"} · ${allFavoriteIds(next).size} sats en mapa`);
        return next;
      }),
    [updateFav],
  );

  /* ---------- Modo Teatro: panel de misión izquierdo ---------- */
  const toggleLeft = useCallback(
    () => setPanels((p) => { const n = { left: !p.left }; savePanels(n); return n; }),
    [],
  );

  /* ---------- catálogo ---------- */
  const allSats = useMemo<Sat[]>(() => {
    if (!payload) return externals;
    const ids = new Set(payload.sats.map((s) => s.id));
    return [...payload.sats, ...externals.filter((s) => !ids.has(s.id))];
  }, [payload, externals]);

  /** Radar Personalizado: el mapa pinta solo favoritos. */
  const mapSats = useMemo<Sat[]>(
    () => (fav.radarMode ? allSats.filter((s) => favIds.has(s.id)) : allSats),
    [allSats, fav.radarMode, favIds],
  );

  useEffect(() => {
    if (autoSelected.current || allSats.length === 0) return;
    autoSelected.current = true;
    const iss = allSats.find((s) => s.id === 25544) ?? allSats[0];
    setSelectedId(iss.id);
  }, [allSats]);

  const selected = useMemo(
    () => allSats.find((s) => s.id === selectedId) ?? null,
    [allSats, selectedId],
  );

  /* El drawer de detalles existe solo con selección; conserva el último
     satélite para poder deslizar hacia fuera con contenido visible. */
  useEffect(() => {
    if (selected) setDrawerSat(selected);
  }, [selected]);

  const handleSelect = useCallback((s: Sat) => {
    setSelectedId(s.id);
    setTracked(true); // flyTo + centrado continuo hasta que el operador arrastre
  }, []);

  /** Salud TLE viva: % de filas recibidas aceptadas como vigentes. */
  const tleHealth = useMemo(() => {
    const st = payload?.stats;
    if (!st || st.seen === 0) return null;
    return Math.round((100 * st.valid) / st.seen);
  }, [payload]);

  const handleSaveObserver = useCallback((o: Observer) => {
    setObserver(o);
    saveObserver(o);
  }, []);

  const handleClearObserver = useCallback(() => {
    setObserver(null);
    saveObserver(null);
  }, []);

  const handleSetObserver = useCallback(async (lat: number, lon: number, elevationM?: number) => {
    let cityName = observer?.name && observer.name !== "Ubicación del mapa" && observer.name !== "Mi ubicación GPS" ? observer.name : "Ubicación";
    const resolved = await fetchCityName(lat, lon);
    if (resolved) cityName = resolved;

    const newObserver: Observer = observer
      ? {
          ...observer,
          name: cityName,
          latitude: lat,
          longitude: lon,
          elevationM: elevationM ?? observer.elevationM,
        }
      : {
          name: cityName,
          latitude: lat,
          longitude: lon,
          timezone: "UTC",
          elevationM: elevationM,
        };
    setObserver(newObserver);
    saveObserver(newObserver);
    teleLog.push("SYS", `Observador: ${cityName} (${lat.toFixed(4)}°, ${lon.toFixed(4)}°)`);
  }, [observer]);

  const handleCenterObserver = useCallback(() => {
    if (!observer) return;
    setCenterOnObserverTrigger((prev) => prev + 1);
    teleLog.push("SYS", `Centrando en ${observer.name}`);
  }, [observer]);

  const handleRemoteSearch = useCallback(async (q: string) => {
    setSearching(true);
    try {
      const res = await searchSatsByName(q);
      setExternals(res);
      if (res.length === 1) setSelectedId(res[0].id);
    } finally {
      setSearching(false);
    }
  }, []);

  const handleCloseDetail = useCallback(() => {
    setSelectedId(null);
    setTracked(false);
  }, []);

  /* ---------- Hotkeys de operador (globales, respetan inputs) ---------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (isTypingTarget(e.target)) {
        if (e.key === "Escape") (e.target as HTMLElement).blur();
        return;
      }
      switch (e.key) {
        case " ":
          e.preventDefault();
          if (sim.mode === "live") handlePause();
          else handlePlayLive();
          break;
        case "/":
          e.preventDefault();
          document.getElementById("st-search-input")?.focus();
          break;
        case "Escape":
          handleCloseDetail();
          setConsoleOpen(false);
          break;
        case "ArrowLeft":
        case "ArrowRight": {
          e.preventDefault();
          const nextId = cycleFavorite([...favIds], selectedId, e.key === "ArrowRight" ? 1 : -1);
          if (nextId !== null) {
            const s = allSats.find((x) => x.id === nextId);
            if (s) handleSelect(s);
          }
          break;
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sim.mode, handlePause, handlePlayLive, handleCloseDetail, favIds, selectedId, allSats, handleSelect]);

  /* ---------- Flight Log: eventos reales del motor y la ingesta ---------- */
  const bootLogged = useRef(false);
  useEffect(() => {
    if (!payload || bootLogged.current) return;
    bootLogged.current = true;
    teleLog.push("SYS", "init SpaceTracker · núcleo SGP4 satellite.js 7.1.0");
    const st = payload.stats;
    teleLog.push(
      "TLE",
      `sync catálogo source=${payload.source} sats=${payload.sats.length}` +
        (st ? ` seen=${st.seen} valid=${st.valid} fresh=${st.fresh} aging=${st.aging} stale=${st.stale} inv=${st.invalid}` : ""),
    );
    if (payload.source === "seed") teleLog.push("ALRT", "fuentes live no disponibles → catálogo SEED local");
    else if (payload.note?.includes("SatNOGS no respondió")) teleLog.push("WARN", "SatNOGS sin respuesta · ingesta completada vía Ivan");
    if (st && st.failedBySource.ivan > 0) teleLog.push("WARN", `Ivan: ${st.failedBySource.ivan} peticiones fallidas (508/timeout)`);
  }, [payload]);

  const selLogged = useRef<number | null>(null);
  useEffect(() => {
    if (!selected || selLogged.current === selected.id) return;
    selLogged.current = selected.id;
    const p = orbitParams(selected);
    const f = getFix(selected, new Date());
    teleLog.push(
      "ORBIT",
      `SEL ${selected.name} [${selected.id}] inc=${p.inclinationDeg.toFixed(1)}° T=${p.periodMin.toFixed(1)}min alt=${f ? f.altKm.toFixed(0) : "—"}km`,
    );
  }, [selected]);

  const obsLogged = useRef<string | null>(null);
  useEffect(() => {
    const key = observer ? `${observer.name}|${observer.latitude}|${observer.longitude}` : null;
    if (key === obsLogged.current) return;
    obsLogged.current = key;
    if (observer) {
      teleLog.push("SYS", `OBS ${observer.name} ${observer.latitude.toFixed(2)},${observer.longitude.toFixed(2)} tz=${observer.timezone}`);
    } else {
      teleLog.push("SYS", "OBS liberado");
    }
  }, [observer]);

  /* Telemetría periódica (60 s) del satélite seleccionado, en tiempo de sim. */
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const nowRef = useRef(now);
  nowRef.current = now;
  useEffect(() => {
    const id = window.setInterval(() => {
      const s = selectedRef.current;
      if (!s) return;
      const f = getFix(s, nowRef.current);
      if (f) {
        teleLog.push(
          "ORBIT",
          `TEL ${s.name} alt=${f.altKm.toFixed(1)}km vel=${f.velKmS.toFixed(3)}km/s lat=${f.latDeg.toFixed(2)}° lon=${f.lonDeg.toFixed(2)}°`,
        );
      }
    }, 60_000);
    return () => window.clearInterval(id);
  }, []);

  /**
   * Tier DOM del mapa: seleccionado + favoritos + categoría activa, con tope
   * duro MAX_DOM_MARKERS para no devolver el cuello de botella al DOM.
   */
  const [activeGroup, setActiveGroup] = useState<GroupId | null>(null);
  const domIds = useMemo<Set<number>>(() => {
    const set = new Set<number>();
    if (selected) set.add(selected.id);
    for (const s of mapSats) {
      if (set.size >= MAX_DOM_MARKERS) break;
      if (favIds.has(s.id)) set.add(s.id);
    }
    if (activeGroup) {
      for (const s of mapSats) {
        if (set.size >= MAX_DOM_MARKERS) break;
        if (s.group === activeGroup) set.add(s.id);
      }
    }
    return set;
  }, [mapSats, favIds, activeGroup, selected]);

  const handleToggleActiveGroup = useCallback((g: GroupId) => {
    setActiveGroup((prev) => {
      const next = prev === g ? null : g;
      teleLog.push(
        "SYS",
        next
          ? `CATEGORÍA ACTIVA ${GROUP_LABELS[next]} → iconos SVG en tier DOM`
          : "categoría activa liberada → flota completa en canvas",
      );
      return next;
    });
  }, []);

  const handleBase = useCallback((id: string) => {
    setBaseId(id);
    teleLog.push("SYS", `BASE ${id}`);
  }, []);

  const handleOverlays = useCallback((o: { labels: boolean; terminator: boolean }) => {
    setOverlays(o);
    teleLog.push("SYS", `OVERLAYS rótulos=${o.labels ? "on" : "off"} terminador=${o.terminator ? "on" : "off"}`);
  }, []);

  useEffect(() => {
    if (!activeGroup) return;
    const candidates =
      mapSats.filter((s) => s.group === activeGroup).length + favIds.size;
    if (candidates > MAX_DOM_MARKERS) {
      teleLog.push(
        "WARN",
        `tier DOM limitado a ${MAX_DOM_MARKERS} marcadores (candidatos: ${candidates})`,
      );
    }
  }, [activeGroup, mapSats, favIds]);

  const rootCls = `st-app${panels.left ? "" : " left-closed"}`;

  return (
    <div className={rootCls}>
      <Header
        payload={payload}
        query={query}
        onQueryChange={setQuery}
        onRemoteSearch={handleRemoteSearch}
        searching={searching}
        uniqueCount={allSats.length}
        kioskActive={kiosk.isFull}
        onKioskToggle={kiosk.toggle}
        theaterOn={!panels.left}
        onTheater={toggleLeft}
        observer={observer}
        isGlitching={isGlitching}
        onToggleGlitch={() => setIsGlitching((v) => !v)}
        onCenterObserver={handleCenterObserver}
      />
      {/* Zona intermedia del flujo (flex:1): mapa al 100 % y HUD flotante
          anclado AQUÍ — nunca colisiona con cabecera ni consola */}
      <div className="st-viewport">
        <div className="st-map-area">
          {view === "map" ? (
            <MapView
              sats={mapSats}
              selected={selected}
              tracked={tracked}
              observer={observer}
              now={now}
              domIds={domIds}
              favIds={favIds}
              baseId={baseId}
              overlays={overlays}
              radarCount={fav.radarMode ? favIds.size : null}
              onFleetInfo={setFleetInfo}
              onUserPan={() => setTracked(false)}
              onSetObserver={handleSetObserver}
              centerOnObserverTrigger={centerOnObserverTrigger}
              onSelect={handleSelect}
              isGlitching={isGlitching}
            />
          ) : (
            <Suspense fallback={<div className="st-globe-wrap" />}>
              <GlobeView
                sats={mapSats}
                selected={selected}
                observer={observer}
                now={now}
                tracked={tracked}
                onSelect={handleSelect}
                onUserPan={() => setTracked(false)}
                centerOnObserverTrigger={centerOnObserverTrigger}
                isGlitching={isGlitching}
              />
            </Suspense>
          )}
        </div>
        <button
          className="st-panel-tab left"
          onClick={toggleLeft}
          title={panels.left ? "Colapsar panel de misión" : "Expandir panel de misión"}
          aria-label="colapsar o expandir panel de misión"
        >
          {panels.left ? "«" : "»"}
        </button>
        <Sidebar
          sats={allSats}
          selectedId={selectedId}
          fav={fav}
          favIds={favIds}
          query={query}
          externals={externals.filter((e) => !payload?.sats.some((s) => s.id === e.id))}
          onSelect={handleSelect}
          onToggleRadar={handleToggleRadar}
          onRenameList={handleRenameList}
          onDeleteList={handleDeleteList}
          onRemoveFromList={handleToggleSatInList}
          observer={observer}
          date={now}
          onSaveObserver={handleSaveObserver}
          onClearObserver={handleClearObserver}
        />
        {/* Drawer de detalles: OCULTO por defecto; slide-in glass al seleccionar */}
        <div className={selected ? "st-right open hud-panel" : "st-right hud-panel"} aria-hidden={!selected}>
          {drawerSat && observer && <SkyRadar sat={drawerSat} observer={observer} now={now} />}
          {drawerSat && (
            <SatDetail
              sat={drawerSat}
              observer={observer}
              now={now}
              fav={fav}
              tracked={tracked}
              onToggleSatInList={handleToggleSatInList}
              onCreateList={handleCreateList}
              onToggleTrack={() => setTracked((v) => !v)}
              onClose={handleCloseDetail}
            />
          )}
        </div>
        <Dock
          now={now}
          realNow={realNow}
          mode={sim.mode}
          timezone={observer?.timezone ?? "UTC"}
          onPlayLive={handlePlayLive}
          onPause={handlePause}
          onShiftHours={handleShiftHours}
          onScrub={handleScrub}
          baseId={baseId}
          onBase={handleBase}
          overlays={overlays}
          onOverlays={handleOverlays}
          activeGroup={activeGroup}
          onToggleActiveGroup={handleToggleActiveGroup}
          consoleOpen={consoleOpen}
          onConsoleToggle={() => setConsoleOpen((v) => !v)}
          view={view}
          onViewToggle={() => setView((v) => (v === "map" ? "globe" : "map"))}
          source={payload?.source ?? "seed"}
          uniqueCount={allSats.length}
          sgp4={fleetInfo}
          tleHealth={tleHealth}
          fps={fps}
        />
        <TelemetryConsole open={consoleOpen} onOpenChange={setConsoleOpen} />
      </div>
    </div>
  );
}
