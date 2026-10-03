export function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

/** Drops keyboard focus from inside `root` (a closing screen), so the touch keyboard goes away and keys reach the game again. */
export function releaseFocus(root: HTMLElement): void {
  const active = document.activeElement;
  if (active instanceof HTMLElement && root.contains(active)) active.blur();
}
