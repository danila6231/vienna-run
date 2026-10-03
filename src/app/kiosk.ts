/** Stops the browser from doing browser things on a public touchscreen (zoom, menus, selection, drag). */
export function installKiosk(doc: Document, opts: { hideCursor: boolean }): void {
  const block = (e: Event) => e.preventDefault();
  for (const type of ['contextmenu', 'dragstart', 'selectstart', 'gesturestart']) doc.addEventListener(type, block);
  doc.addEventListener('wheel', (e) => { if (e.ctrlKey) e.preventDefault(); }, { passive: false });
  doc.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && ['+', '-', '=', '0'].includes(e.key)) e.preventDefault();
  });
  doc.addEventListener('touchmove', (e) => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
  if (opts.hideCursor) doc.body.classList.add('hide-cursor');
}
