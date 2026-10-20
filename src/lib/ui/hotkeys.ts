/**
 * Atajos de teclado de operador (puros y testeables; el listener vive en App).
 *
 *  Espacio      pausa / reanuda tiempo real
 *  /            foco a la búsqueda
 *  ESC          deselecciona y cierra paneles flotantes (o blur si se teclea)
 *  ← / →        cicla por los favoritos
 */

/** true si el evento nació en un campo de texto (no se pisan las entradas). */
export function isTypingTarget(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  if (!el || typeof el.tagName !== "string") return false;
  return (
    el.tagName === "INPUT" ||
    el.tagName === "TEXTAREA" ||
    el.tagName === "SELECT" ||
    el.isContentEditable === true
  );
}

/**
 * Siguiente/anterior favorito con envoltura. Con selección ausente o ajena a
 * favoritos: → entra por el primero, ← por el último.
 */
export function cycleFavorite(
  ids: number[],
  currentId: number | null,
  dir: 1 | -1,
): number | null {
  if (ids.length === 0) return null;
  const idx = currentId === null ? -1 : ids.indexOf(currentId);
  if (idx === -1) return dir === 1 ? ids[0] : ids[ids.length - 1];
  return ids[(idx + dir + ids.length) % ids.length];
}
