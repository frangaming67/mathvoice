/** Elemento enfocado y su selección, guardados antes de abrir un diálogo que mueve el foco. */
export interface FocusSnapshot {
  element: HTMLElement;
  start: number | null;
  end: number | null;
}

type Selectable = HTMLElement & {
  selectionStart?: number | null;
  selectionEnd?: number | null;
  setSelectionRange?: (start: number, end: number) => void;
};

export function captureFocus(
  active: Element | null = typeof document === 'undefined' ? null : document.activeElement,
): FocusSnapshot | null {
  if (
    !active ||
    typeof (active as HTMLElement).focus !== 'function' ||
    (typeof document !== 'undefined' &&
      (active === document.body || active === document.documentElement))
  )
    return null;
  const element = active as Selectable;
  try {
    return {
      element,
      start: typeof element.selectionStart === 'number' ? element.selectionStart : null,
      end: typeof element.selectionEnd === 'number' ? element.selectionEnd : null,
    };
  } catch {
    // Algunos tipos de input no exponen la selección.
    return { element, start: null, end: null };
  }
}

/**
 * Devuelve el foco y la selección. Al cerrar un <dialog>, Chrome deja el cursor del campo en 0:
 * restaurarlo antes de insertar evita que el texto termine al principio de la expresión.
 */
export function restoreFocus(snapshot: FocusSnapshot | null | undefined): boolean {
  const element = snapshot?.element as Selectable | undefined;
  if (!snapshot || !element?.isConnected || !element.getClientRects().length) return false;
  element.focus({ preventScroll: true });
  if (snapshot.start !== null && typeof element.setSelectionRange === 'function')
    try {
      element.setSelectionRange(snapshot.start, snapshot.end ?? snapshot.start);
    } catch {
      // El tipo de campo no admite selección.
    }
  return true;
}
