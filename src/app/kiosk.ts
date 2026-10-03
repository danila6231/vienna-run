const isField = (t: EventTarget | null): boolean => t instanceof Element && t.closest('input, textarea') !== null;

/** Stops the browser from doing browser things on a public touchscreen (zoom, menus, selection, drag). */
export function installKiosk(doc: Document, opts: { hideCursor: boolean }): void {
  const block = (e: Event) => e.preventDefault();
  // Text fields (name entry, staff settings) still need selection and the paste menu.
  const blockOutsideFields = (e: Event) => {
    if (!isField(e.target)) e.preventDefault();
  };
  for (const type of ['contextmenu', 'selectstart']) doc.addEventListener(type, blockOutsideFields);
  for (const type of ['dragstart', 'gesturestart']) doc.addEventListener(type, block);
  doc.addEventListener('wheel', (e) => { if (e.ctrlKey) e.preventDefault(); }, { passive: false });
  doc.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && ['+', '-', '=', '0'].includes(e.key)) e.preventDefault();
  });
  doc.addEventListener('touchmove', (e) => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
  if (opts.hideCursor) doc.body.classList.add('hide-cursor');
}
