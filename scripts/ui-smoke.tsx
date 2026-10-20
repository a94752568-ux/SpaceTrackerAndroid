/**
 * Humo de UI: renderiza los componentes con React SSR (react-dom/server) y
 * datos reales del seed. Detecta crashes de import/inicialización y verifica
 * que las piezas clave aparecen en el HTML. Lo consumen scripts/ui-smoke.test.mjs.
 */
import { renderToString } from "react-dom/server";

import Header from "../src/components/Header";
import Sidebar from "../src/components/Sidebar";
import SatDetail from "../src/components/orbit/SatDetail";
import ObserverPanel from "../src/components/observer/ObserverPanel";
import TimeBar from "../src/components/time/TimeBar";
import Dock from "../src/components/hud/Dock";
import TelemetryConsole from "../src/components/console/TelemetryConsole";
import SkyRadar from "../src/components/orbit/SkyRadar";
import { SEED_SATS, SEED_FETCHED_AT, SEED_STATS } from "../src/lib/space/seed";
import {
  allFavoriteIds,
  emptyState,
  toggleSatInList,
} from "../src/lib/ui/favorites";
import type { CatalogPayload, Observer } from "../src/lib/space/types";

const OBS: Observer = {
  name: "Madrid",
  country: "España",
  latitude: 40.4168,
  longitude: -3.7038,
  timezone: "Europe/Madrid",
  elevationM: 667,
};

const noop = () => {};

/** Estado de favoritos de ejemplo: ISS en la lista por defecto. */
function sampleFav() {
  let s = emptyState();
  s = toggleSatInList(s, s.lists[0].id, 25544);
  return s;
}

export function renderHeader(): string {
  const payload: CatalogPayload = {
    fetchedAt: SEED_FETCHED_AT,
    source: "seed",
    note: "humo",
    sats: SEED_SATS,
    stats: SEED_STATS,
  };
  return renderToString(
    <Header
      payload={payload}
      query=""
      onQueryChange={noop}
      onRemoteSearch={noop}
      searching={false}
      uniqueCount={SEED_SATS.length}
      kioskActive={false}
      onKioskToggle={noop}
      theaterOn={false}
      onTheater={noop}
      observer={null}
      isGlitching={false}
      onToggleGlitch={noop}
      onCenterObserver={noop}
    />,
  );
}

export function renderTimeBar(): string {
  const real = new Date("2026-10-18T12:00:00Z");
  return renderToString(
    <TimeBar
      now={new Date(real.getTime() + 3_600_000)}
      realNow={real}
      mode="frozen"
      timezone="UTC"
      onPlayLive={noop}
      onPause={noop}
      onShiftHours={noop}
      onScrub={noop}
    />,
  );
}

export function renderTimeBarLive(): string {
  const real = new Date("2026-10-18T12:00:00Z");
  return renderToString(
    <TimeBar
      now={real}
      realNow={real}
      mode="live"
      timezone="Europe/Madrid"
      onPlayLive={noop}
      onPause={noop}
      onShiftHours={noop}
      onScrub={noop}
    />,
  );
}

export function renderSidebar(): string {
  const fav = sampleFav();
  return renderToString(
    <Sidebar
      sats={SEED_SATS}
      selectedId={25544}
      fav={fav}
      favIds={allFavoriteIds(fav)}
      query=""
      externals={[]}
      observer={OBS}
      date={new Date()}
      onSelect={noop}
      onToggleRadar={noop}
      onRenameList={noop}
      onDeleteList={noop}
      onRemoveFromList={noop}
      onSaveObserver={noop}
      onClearObserver={noop}
    />,
  );
}

export function renderDock(): string {
  const real = new Date("2026-10-18T12:00:00Z");
  return renderToString(
    <Dock
      now={real}
      realNow={real}
      mode="live"
      timezone="UTC"
      onPlayLive={noop}
      onPause={noop}
      onShiftHours={noop}
      onScrub={noop}
      baseId="esri-dark"
      onBase={noop}
      overlays={{ labels: true, terminator: true }}
      onOverlays={noop}
      activeGroup={null}
      onToggleActiveGroup={noop}
      consoleOpen={false}
      onConsoleToggle={noop}
      view="map"
      onViewToggle={noop}
      source="seed"
      uniqueCount={SEED_SATS.length}
      sgp4={{ worker: true, frameMs: 12.5 }}
      tleHealth={97}
      fps={60}
    />,
  );
}

export function renderSatDetail(): string {
  const iss = SEED_SATS.find((s) => s.id === 25544) ?? SEED_SATS[0];
  return renderToString(
    <SatDetail
      sat={iss}
      observer={OBS}
      now={new Date()}
      fav={sampleFav()}
      tracked={false}
      onToggleSatInList={noop}
      onCreateList={noop}
      onToggleTrack={noop}
      onClose={noop}
    />,
  );
}

export function renderSatDetailSinObservador(): string {
  const sat = SEED_SATS.find((s) => s.group === "starlink") ?? SEED_SATS[0];
  return renderToString(
    <SatDetail
      sat={sat}
      observer={null}
      now={new Date()}
      fav={emptyState()}
      tracked
      onToggleSatInList={noop}
      onCreateList={noop}
      onToggleTrack={noop}
      onClose={noop}
    />,
  );
}

export function renderObserverPanel(): string {
  return renderToString(
    <ObserverPanel observer={OBS} onSave={noop} onClear={noop} date={new Date()} />,
  );
}

export function renderConsole(): string {
  return renderToString(<TelemetryConsole open onOpenChange={noop} />);
}

export function renderSkyRadar(): string {
  const iss = SEED_SATS.find((s) => s.id === 25544) ?? SEED_SATS[0];
  return renderToString(<SkyRadar sat={iss} observer={OBS} now={new Date()} />);
}

export function renderObserverPanelVacio(): string {
  return renderToString(
    <ObserverPanel observer={null} onSave={noop} onClear={noop} date={new Date()} />,
  );
}
