/**
 * Selector de listas de favoritos para el panel de detalle.
 * Chips conmutables por lista + creación inline de listas nuevas.
 * Sustituye al antiguo botón ★ único (favoritos v1).
 */
import { useState } from "react";

import { listsContaining, type FavoritesState } from "../../lib/ui/favorites";

interface FavoritePickerProps {
  fav: FavoritesState;
  satId: number;
  onToggle: (listId: string, satId: number) => void;
  onCreateList: (name: string, satId: number) => void;
}

export default function FavoritePicker({ fav, satId, onToggle, onCreateList }: FavoritePickerProps) {
  const [showNew, setShowNew] = useState(false);
  const [draft, setDraft] = useState("");
  const containing = new Set(listsContaining(fav, satId));

  return (
    <div className="st-favpicker" role="group" aria-label="Listas de favoritos">
      <span className="st-favpicker-label">Listas:</span>
      {fav.lists.map((l) => (
        <button
          key={l.id}
          className={containing.has(l.id) ? "st-chip on" : "st-chip"}
          onClick={() => onToggle(l.id, satId)}
          title={containing.has(l.id) ? `Quitar de «${l.name}»` : `Añadir a «${l.name}»`}
        >
          <span aria-hidden="true">{l.icon}</span> {l.name}
          {containing.has(l.id) ? " ✓" : ""}
        </button>
      ))}
      {showNew ? (
        <form
          className="st-chip-new"
          onSubmit={(e) => {
            e.preventDefault();
            const name = draft.trim();
            if (!name) return;
            onCreateList(name, satId);
            setDraft("");
            setShowNew(false);
          }}
        >
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Nombre de la lista…"
            aria-label="Nombre de la nueva lista"
          />
          <button type="submit" disabled={!draft.trim()}>
            Crear
          </button>
          <button type="button" className="st-ghost" onClick={() => setShowNew(false)}>
            ✕
          </button>
        </form>
      ) : (
        <button className="st-chip add" onClick={() => setShowNew(true)} title="Nueva lista y añadir este satélite">
          + Lista
        </button>
      )}
    </div>
  );
}
