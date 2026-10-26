/**
 * SpaceTracker — composición de la aplicación.
 * Estado global mínimo (sin dependencias externas):
 * - catálogo con procedencia (live/seed),
 * - reloj real (1 s) + reloj de simulación (live/frozen ±24 h) para SGP4,
 * - selección, seguimiento, favoritos v2 (listas + radar), observador,
 * - Modo Teatro: paneles laterales colapsables (persistidos).
 */
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";

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
import BottomSheet from "./components/hud/BottomSheet";
import ObserverPanel from "./components/observer/ObserverPanel";
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
import { useViewport } from "./lib/ui/useViewport";

interface SimState {
  mode: "live" | "frozen";
  tMs: number;
}

export default function App() {
  const viewport = useViewport();
  const isCompact = viewport.sizeClass === "compact";
  const isMedium = viewport.sizeClass === "medium";
  const isPortrait = viewport.orientation === "portrait";
  const [compactTab, setCompactTab] = useState<"catalog" | "radar" | "time" | "layers" | "observer" | null>(null);
  const [showHint, setShowHint] = useState(() => !localStorage.getItem("spacetracker:dismiss-hint"));

  /* Tarea 3: al salir de compact (o rotar a clase mayor) cerrar sheets; conservar selección. */
  useEffect(() => {
    if (!isCompact && compactTab !== null) setCompactTab(null);
  }, [isCompact, compactTab]);

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
  const [, startTransition] = useTransition();

  /* Reloj real de 1 s (base del modo live y del origen del slider). */
  useEffect(() => {
    const id = window.setInterval(() => setRealNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  /* Inicializar tema guardado (Neon / Amber) */
  useEffect(() => {
    const saved = localStorage.getItem("spacetracker:theme") || "neon";
    document.documentElement.setAttribute("data-theme", saved);
  }, []);

  /* Evitar que la pantalla se apague (Screen Wake Lock API) */
  useEffect(() => {
    let wakeLock: any = null;
    async function requestWakeLock() {
      if (typeof navigator !== "undefined" && "wakeLock" in navigator) {
        try {
          wakeLock = await (navigator as any).wakeLock.request("screen");
        } catch {
          // Ignorado si el sistema deniega el wake lock
        }
      }
    }
    void requestWakeLock();
    const handleVis = () => {
      if (document.visibilityState === "visible") void requestWakeLock();
    };
    document.addEventListener("visibilitychange", handleVis);
    return () => {
      document.removeEventListener("visibilitychange", handleVis);
      wakeLock?.release?.().catch(() => {});
    };
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

  /* O(1) satellite lookup map for INP optimization */
  const satMap = useMemo(() => new Map(allSats.map((s) => [s.id, s])), [allSats]);

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
    startTransition(() => {
      setSelectedId(s.id);
      setTracked(true);
    });
  }, [startTransition]);

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
    if (!observer) {
      if (navigator.geolocation) {
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
            setCenterOnObserverTrigger((prev) => prev + 1);
            teleLog.push("SYS", `GPS actual: ${cityName} (${lat.toFixed(2)}°, ${lon.toFixed(2)}°)`);
          },
          (err) => {
            teleLog.push("WARN", `Ubicación no disponible (${err.message}). Usando Madrid por defecto.`);
            const madrid: Observer = {
              name: "Madrid",
              latitude: 40.4168,
              longitude: -3.7038,
              timezone: "Europe/Madrid",
            };
            setObserver(madrid);
            saveObserver(madrid);
            setCenterOnObserverTrigger((prev) => prev + 1);
          },
          { timeout: 6000, enableHighAccuracy: true, maximumAge: 60000 },
        );
      } else {
        const madrid: Observer = {
          name: "Madrid",
          latitude: 40.4168,
          longitude: -3.7038,
          timezone: "Europe/Madrid",
        };
        setObserver(madrid);
        saveObserver(madrid);
        setCenterOnObserverTrigger((prev) => prev + 1);
      }
      return;
    }
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
        case "/":
        case "ArrowLeft":
        case "ArrowRight":
          e.preventDefault();
          break;
      }
      setTimeout(() => {
        switch (e.key) {
          case " ":
            if (sim.mode === "live") handlePause();
            else handlePlayLive();
            break;
          case "/":
            document.getElementById("st-search-input")?.focus();
            break;
          case "Escape":
            // Compact: primero cierra el sheet activo; luego detalle / consola.
            if (compactTab !== null) {
              setCompactTab(null);
              break;
            }
            handleCloseDetail();
            setConsoleOpen(false);
            break;
          case "ArrowLeft":
          case "ArrowRight": {
            const nextId = cycleFavorite([...favIds], selectedId, e.key === "ArrowRight" ? 1 : -1);
            if (nextId !== null) {
              const s = satMap.get(nextId);
              if (s) handleSelect(s);
            }
            break;
          }
        }
      }, 0);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sim.mode, handlePause, handlePlayLive, handleCloseDetail, favIds, selectedId, satMap, handleSelect, compactTab]);

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

  /* Contenido compartido entre el layout de escritorio y las hojas compactas
     (Tarea 3): los paneles son los mismos, solo cambia el contenedor. */
  const sidebarContent = (
    <Sidebar
      sats={allSats}
      selectedId={selectedId}
      fav={fav}
      favIds={favIds}
      query={query}
      externals={externals.filter((e) => !payload?.sats.some((s) => s.id === e.id))}
      onSelect={(s) => {
        handleSelect(s);
        if (isCompact) setCompactTab("radar");
      }}
      onToggleRadar={handleToggleRadar}
      onRenameList={handleRenameList}
      onDeleteList={handleDeleteList}
      onRemoveFromList={handleToggleSatInList}
      observer={observer}
      date={now}
      onSaveObserver={handleSaveObserver}
      onClearObserver={handleClearObserver}
    />
  );

  const drawerContent = (
    <>
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
          onClose={() => {
            handleCloseDetail();
            if (isCompact) setCompactTab(null);
          }}
        />
      )}
    </>
  );

  const rootCls = `st-app${panels.left ? "" : " left-closed"}${isCompact ? " is-compact" : ""}${isMedium ? " is-medium" : ""}`;

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
        sizeClass={viewport.sizeClass}
        onOpenCatalog={() => setCompactTab("catalog")}
      />
      {/* Zona intermedia del flujo (flex:1): mapa al 100 % y HUD flotante
          anclado AQUÍ — nunca colisiona con cabecera ni consola */}
      <div className={`st-viewport ${isCompact ? "is-compact" : ""}`}>
        {isCompact && showHint && !selected && (
          <div className="st-onboarding-hint">
            <span>💡 Toca cualquier satélite en el mapa o abre Catálogo para comenzar.</span>
            <button className="st-iconbtn" onClick={() => { setShowHint(false); localStorage.setItem("spacetracker:dismiss-hint", "1"); }}>×</button>
          </div>
        )}

        {isCompact && (
          <button
            className="st-map-fab-toggle"
            onClick={() => setView((v) => (v === "map" ? "globe" : "map"))}
            title={view === "map" ? "Cambiar a Globo 3D" : "Cambiar a Mapa 2D"}
          >
            {view === "map" ? "🌍 Globo" : "🗺️ Mapa"}
          </button>
        )}

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
              onSelect={(s) => {
                handleSelect(s);
                if (isCompact) setCompactTab("radar");
              }}
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
                onSelect={(s) => {
                  handleSelect(s);
                  if (isCompact) setCompactTab("radar");
                }}
                onUserPan={() => setTracked(false)}
                centerOnObserverTrigger={centerOnObserverTrigger}
                isGlitching={isGlitching}
              />
            </Suspense>
          )}
        </div>

        {!isCompact && (
          <button
            className="st-panel-tab left"
            onClick={toggleLeft}
            title={panels.left ? "Colapsar panel de misión" : "Expandir panel de misión"}
            aria-label="colapsar o expandir panel de misión"
          >
            {panels.left ? "«" : "»"}
          </button>
        )}

        {/* Backdrop: un solo sheet a la vez; tap cierra (Tarea 3) */}
        {isCompact && compactTab !== null && (
          <button
            type="button"
            className="st-sheet-backdrop"
            aria-label="Cerrar panel"
            onClick={() => setCompactTab(null)}
          />
        )}

        {/* Sidebar: normal or compact bottom sheet */}
        {isCompact ? (
          compactTab === "catalog" && (
            <BottomSheet onClose={() => setCompactTab(null)} snap={isPortrait} initialSnap="tall">
              {sidebarContent}
            </BottomSheet>
          )
        ) : (
          <div className={isMedium ? "st-sidebar medium" : undefined}>{sidebarContent}</div>
        )}

        {/* Drawer de detalles / Radar: normal o compact bottom sheet */}
        {isCompact ? (
          selected &&
          compactTab === "radar" && (
            <BottomSheet
              onClose={() => {
                handleCloseDetail();
                setCompactTab(null);
              }}
              snap={isPortrait}
              initialSnap="half"
            >
              {drawerContent}
            </BottomSheet>
          )
        ) : (
          selected && <div className="st-right open hud-panel">{drawerContent}</div>
        )}

        {/* Compact bottom sheets for time / layers */}
        {isCompact && compactTab === "time" && (
          <BottomSheet onClose={() => setCompactTab(null)} snap={isPortrait} initialSnap="peek">
            <div className="st-sheet-head">
              <h3>Control de Tiempo</h3>
              <button className="st-iconbtn" onClick={() => setCompactTab(null)}>×</button>
            </div>
            <div style={{ padding: "10px", display: "flex", flexDirection: "column", gap: "10px" }}>
              <p style={{ margin: 0, fontSize: "12px" }}>Modo: {sim.mode}</p>
              <button className="st-primary" onClick={sim.mode === "live" ? handlePause : handlePlayLive}>
                {sim.mode === "live" ? "Pausar / Congelar" : "Volver a LIVE"}
              </button>
              <div style={{ display: "flex", gap: "6px" }}>
                <button className="st-ghost" onClick={() => handleShiftHours(-1)}>-1h</button>
                <button className="st-ghost" onClick={() => handleShiftHours(1)}>+1h</button>
                <button className="st-ghost" onClick={() => handleShiftHours(24)}>+24h</button>
              </div>
            </div>
          </BottomSheet>
        )}

        {isCompact && compactTab === "layers" && (
          <BottomSheet onClose={() => setCompactTab(null)} snap={isPortrait} initialSnap="half">
            <div className="st-sheet-head">
              <h3>Capas, Vistas y Leyenda</h3>
              <button className="st-iconbtn" onClick={() => setCompactTab(null)}>×</button>
            </div>
            <div style={{ padding: "10px", display: "flex", flexDirection: "column", gap: "12px", fontSize: "13px" }}>
              <button className="st-primary" onClick={() => setView((v) => (v === "map" ? "globe" : "map"))}>
                Vista actual: {view === "map" ? "Mapa Leaflet 2D" : "Globo 3D"}
              </button>
              <button className="st-ghost" onClick={() => handleBase(baseId === DEFAULT_BASE_ID ? "dark" : DEFAULT_BASE_ID)}>
                Cambiar Tesela (Actual: {baseId})
              </button>
              <div style={{ borderTop: "1px solid var(--line)", paddingTop: "8px" }}>
                <strong style={{ color: "var(--accent)", display: "block", marginBottom: "6px" }}>Leyenda de colores:</strong>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", fontSize: "12px" }}>
                  <div><i style={{ display: "inline-block", width: "10px", height: "10px", background: "var(--group-crew)", borderRadius: "50%", marginRight: "6px" }} /> Tripulación / Estación</div>
                  <div><i style={{ display: "inline-block", width: "10px", height: "10px", background: "var(--group-starlink)", borderRadius: "50%", marginRight: "6px" }} /> Starlink / Megaconst.</div>
                  <div><i style={{ display: "inline-block", width: "10px", height: "10px", background: "var(--group-weather)", borderRadius: "50%", marginRight: "6px" }} /> Ciencia / Clima</div>
                  <div><i style={{ display: "inline-block", width: "10px", height: "10px", background: "var(--group-science)", borderRadius: "50%", marginRight: "6px" }} /> Navegación / GPS</div>
                  <div><i style={{ display: "inline-block", width: "10px", height: "10px", background: "var(--group-other)", borderRadius: "50%", marginRight: "6px" }} /> Otros / Misiones</div>
                </div>
              </div>
            </div>
          </BottomSheet>
        )}

        {/* TAREA 3 (brecha 3): destino Observador en compact — el mismo
            ObserverPanel del panel de misión, en hoja inferior. */}
        {isCompact && compactTab === "observer" && (
          <BottomSheet onClose={() => setCompactTab(null)} snap={isPortrait} initialSnap="half">
            <div className="st-sheet-head">
              <h3>Observador</h3>
              <button className="st-iconbtn" onClick={() => setCompactTab(null)}>×</button>
            </div>
            <ObserverPanel observer={observer} onSave={handleSaveObserver} onClear={handleClearObserver} date={now} />
          </BottomSheet>
        )}

        {!isCompact && (
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
        )}

        {isCompact && (
          <nav className="st-bottom-nav" aria-label="Navegación principal">
            <button
              className={`st-bottom-nav-btn ${compactTab === "catalog" ? "active" : ""}`}
              onClick={() => setCompactTab((c) => (c === "catalog" ? null : "catalog"))}
              aria-label={compactTab === "catalog" ? "Cerrar catálogo" : "Abrir catálogo"}
              aria-pressed={compactTab === "catalog"}
            >
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <circle cx="12" cy="12" r="9"/>
                <path d="M3 12h18M12 3a15.3 15.3 0 0 1 4 9 15.3 15.3 0 0 1-4 9 15.3 15.3 0 0 1-4-9 15.3 15.3 0 0 1 4-9z"/>
              </svg>
              Catálogo
            </button>
            <button
              className={`st-bottom-nav-btn ${compactTab === "radar" || selected ? "active" : ""}`}
              onClick={() => setCompactTab((c) => (c === "radar" ? null : "radar"))}
              aria-label={compactTab === "radar" ? "Cerrar radar" : "Abrir radar de satélites"}
              aria-pressed={compactTab === "radar" || selected !== null}
            >
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M12 2a10 10 0 0 1 7.07 17.07M12 6a6 6 0 0 1 4.24 10.24M12 10a2 2 0 0 1 1.41 3.41"/>
                <circle cx="12" cy="18" r="1"/>
              </svg>
              Radar
            </button>
            <button
              className={`st-bottom-nav-btn ${compactTab === "time" ? "active" : ""}`}
              onClick={() => setCompactTab((c) => (c === "time" ? null : "time"))}
              aria-label={compactTab === "time" ? "Cerrar control de tiempo" : "Abrir control de tiempo"}
              aria-pressed={compactTab === "time"}
            >
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
              Tiempo
            </button>
            <button
              className={`st-bottom-nav-btn ${compactTab === "layers" ? "active" : ""}`}
              onClick={() => setCompactTab((c) => (c === "layers" ? null : "layers"))}
              aria-label={compactTab === "layers" ? "Cerrar capas" : "Abrir capas y vistas"}
              aria-pressed={compactTab === "layers"}
            >
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <polygon points="12 2 2 7 12 12 22 7 12 2"/>
                <polyline points="2 17 12 22 22 17"/>
                <polyline points="2 12 12 17 22 12"/>
              </svg>
              Capas
            </button>
            <button
              className={`st-bottom-nav-btn ${compactTab === "observer" ? "active" : ""}`}
              onClick={() => setCompactTab((c) => (c === "observer" ? null : "observer"))}
              aria-label={compactTab === "observer" ? "Cerrar observador" : "Configurar observador terrestre"}
              aria-pressed={compactTab === "observer"}
            >
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
              Observador
            </button>
          </nav>
        )}

        <TelemetryConsole open={consoleOpen} onOpenChange={setConsoleOpen} />
      </div>
    </div>
  );
}
