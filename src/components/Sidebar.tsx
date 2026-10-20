/**
 * Panel de catálogo: Radar Personalizado + listas de favoritos gestionables
 * (crear desde el detalle, renombrar/borrar/plegar aquí) + catálogo agrupado
 * por misión con filtro local por nombre/NORAD.
 *
 * Rendimiento: las listas renderizan solo sus miembros; el catálogo mantiene
 * el tope de 300 filas por grupo abierto (como antes) y el filtrado por radar
 * se aplica únicamente al mapa (App), no a esta lista.
 */
import { memo, useMemo, useState } from "react";

import { GROUPS, GROUP_LABELS } from "../lib/space/groups";
import type { GroupId, Observer, Sat } from "../lib/space/types";
import type { FavoritesState } from "../lib/ui/favorites";
import { GROUP_COLORS } from "../lib/ui/colors";
import ObserverPanel from "./observer/ObserverPanel";

interface SidebarProps {
  sats: Sat[];
  selectedId: number | null;
  fav: FavoritesState;
  favIds: Set<number>;
  query: string;
  externals: Sat[];
  observer: Observer | null;
  date: Date;
  onSelect: (sat: Sat) => void;
  onToggleRadar: () => void;
  onRenameList: (id: string, name: string) => void;
  onDeleteList: (id: string) => void;
  onRemoveFromList: (listId: string, satId: number) => void;
  onSaveObserver: (obs: Observer) => void;
  onClearObserver: () => void;
}

function matches(sat: Sat, q: string): boolean {
  if (!q) return true;
  const qq = q.trim().toUpperCase();
  if (/^\d+$/.test(qq)) return String(sat.id).startsWith(qq);
  return sat.name.toUpperCase().includes(qq);
}

const SatRow = memo(function SatRow({
  sat,
  isSelected,
  external,
  onSelect,
}: {
  sat: Sat;
  isSelected: boolean;
  external?: boolean;
  onSelect: (sat: Sat) => void;
}) {
  return (
    <li className={isSelected ? "st-sat selected" : "st-sat"}>
      <button className="st-sat-name" onClick={() => onSelect(sat)} title={`NORAD ${sat.id}`}>
        <i style={{ background: GROUP_COLORS[sat.group] }} />
        {sat.name}
        {external && <span className="st-ext">ext</span>}
      </button>
    </li>
  );
});

export function Sidebar({
  sats,
  selectedId,
  fav,
  favIds,
  query,
  externals,
  observer,
  date,
  onSelect,
  onToggleRadar,
  onRenameList,
  onDeleteList,
  onRemoveFromList,
  onSaveObserver,
  onClearObserver,
}: SidebarProps) {
  const [openGroups, setOpenGroups] = useState<Set<GroupId>>(new Set(["crew"]));
  const [openLists, setOpenLists] = useState<Set<string>>(() => new Set());
  const [editing, setEditing] = useState<{ id: string; draft: string } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const byName = useMemo(() => new Map(sats.map((s) => [s.id, s])), [sats]);

  const filtered = useMemo(() => sats.filter((s) => matches(s, query)), [sats, query]);
  const byGroup = useMemo(() => {
    const m = new Map<GroupId, Sat[]>();
    for (const g of GROUPS) m.set(g, []);
    for (const s of filtered) (m.get(s.group) ?? m.get("other"))!.push(s);
    for (const list of m.values()) list.sort((a, b) => a.name.localeCompare(b.name));
    return m;
  }, [filtered]);

  const toggleGroup = (g: GroupId) =>
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(g)) next.delete(g);
      else next.add(g);
      return next;
    });

  const toggleList = (id: string) =>
    setOpenLists((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });



  return (
    <aside className="st-sidebar hud-panel">
      {/* ---------------- Favoritos v2: radar + listas ---------------- */}
      <section className="st-favs">
        <div className="st-favs-head">
          <h2>
            Favoritos <small>{favIds.size}</small>
          </h2>
          <button
            className={fav.radarMode ? "st-radar-toggle on" : "st-radar-toggle"}
            onClick={onToggleRadar}
            aria-pressed={fav.radarMode}
            title="Radar Personalizado: mostrar en el mapa solo los favoritos"
          >
            📡 Radar {fav.radarMode ? "ON" : "OFF"}
          </button>
        </div>
        {fav.radarMode && (
          <p className="st-hint">
            Radar activo: el mapa pinta solo los {favIds.size} favoritos (menos ruido, más FPS).
          </p>
        )}

        {fav.lists.map((list) => {
          const open = openLists.has(list.id) || list.id === fav.lists[0]?.id;
          const members = list.satIds
            .map((id) => byName.get(id))
            .filter((s): s is Sat => Boolean(s))
            .sort((a, b) => a.name.localeCompare(b.name));
          const missing = list.satIds.length - members.length; // ids fuera del catálogo actual
          return (
            <div className="st-favlist" key={list.id}>
              <div className="st-favlist-head">
                <button className="st-favlist-fold" onClick={() => toggleList(list.id)} aria-label="plegar/desplegar lista">
                  {open ? "▾" : "▸"}
                </button>
                <span className="st-favlist-icon" aria-hidden="true">{list.icon}</span>
                {editing?.id === list.id ? (
                  <form
                    className="st-favlist-rename"
                    onSubmit={(e) => {
                      e.preventDefault();
                      onRenameList(list.id, editing.draft);
                      setEditing(null);
                    }}
                  >
                    <input
                      autoFocus
                      value={editing.draft}
                      onChange={(e) => setEditing({ id: list.id, draft: e.target.value })}
                      aria-label="Nuevo nombre de la lista"
                    />
                    <button type="submit">✓</button>
                  </form>
                ) : (
                  <button className="st-favlist-name" onClick={() => toggleList(list.id)} title="plegar/desplegar">
                    {list.name}
                  </button>
                )}
                <span className="st-count">{members.length}</span>
                <button
                  className="st-iconbtn"
                  title="Renombrar lista"
                  onClick={() => setEditing({ id: list.id, draft: list.name })}
                >
                  ✎
                </button>
                <button
                  className={pendingDelete === list.id ? "st-iconbtn danger armed" : "st-iconbtn danger"}
                  title={pendingDelete === list.id ? "Confirmar borrado" : "Borrar lista"}
                  onClick={() => {
                    if (pendingDelete === list.id) {
                      onDeleteList(list.id);
                      setPendingDelete(null);
                    } else {
                      setPendingDelete(list.id);
                      window.setTimeout(() => setPendingDelete((p) => (p === list.id ? null : p)), 3000);
                    }
                  }}
                >
                  {pendingDelete === list.id ? "¿?" : "🗑"}
                </button>
              </div>
              {open && (
                <ul>
                  {members.length === 0 && <li className="st-hint">Lista vacía: añade satélites desde el panel de detalle.</li>}
                  {members.map((s) => (
                    <li key={s.id} className={s.id === selectedId ? "st-sat selected" : "st-sat"}>
                      <button className="st-sat-name" onClick={() => onSelect(s)} title={`NORAD ${s.id}`}>
                        <i style={{ background: GROUP_COLORS[s.group] }} />
                        {s.name}
                      </button>
                      <button
                        className="st-iconbtn"
                        title={`Quitar de «${list.name}»`}
                        onClick={() => onRemoveFromList(list.id, s.id)}
                      >
                        ×
                      </button>
                    </li>
                  ))}
                  {missing > 0 && <li className="st-hint">{missing} id(s) fuera del catálogo actual.</li>}
                </ul>
              )}
            </div>
          );
        })}
      </section>

      {/* ---------------- Resultados externos de búsqueda ---------------- */}
      {externals.length > 0 && (
        <section>
          <h2>Resultados externos <small>{externals.length}</small></h2>
          <ul>
            {externals.map((s) => (
              <SatRow key={`${s.id}-ext`} sat={s} isSelected={s.id === selectedId} external onSelect={onSelect} />
            ))}
          </ul>
        </section>
      )}

      {/* ---------------- Catálogo por grupo ---------------- */}
      <section className="st-groups">
        <h2>Catálogo <small>{filtered.length}</small></h2>
        {GROUPS.map((g) => {
          const list = byGroup.get(g) ?? [];
          const open = openGroups.has(g);
          return (
            <div className="st-group" key={g}>
              <button className="st-group-head" onClick={() => toggleGroup(g)}>
                <i style={{ background: GROUP_COLORS[g] }} />
                {GROUP_LABELS[g]}
                <span className="st-count">{list.length}</span>
                <span className="st-chevron">{open ? "▾" : "▸"}</span>
              </button>
              {open && list.length > 0 && (
                <ul>
                  {list.slice(0, 300).map((s) => (
                    <SatRow key={s.id} sat={s} isSelected={s.id === selectedId} onSelect={onSelect} />
                  ))}
                </ul>
              )}
              {open && list.length > 300 && (
                <p className="st-hint">… {list.length - 300} más (usa la búsqueda para acotar)</p>
              )}
            </div>
          );
        })}
      </section>

      {/* Configuración del observador: vive en el panel de misión izquierdo */}
      <ObserverPanel observer={observer} onSave={onSaveObserver} onClear={onClearObserver} date={date} />
    </aside>
  );
}

export default memo(Sidebar);
