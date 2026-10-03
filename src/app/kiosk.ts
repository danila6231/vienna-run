const isField = (t: EventTarget | null): boolean => t instanceof Element && t.closest('input, textarea') !== null;
/** Only staff fields get the browser's menu (to paste share codes); on a visitor's name field it could lead out of the kiosk. */
const isStaffField = (t: EventTarget | null): boolean => isField(t) && (t as Element).closest('.staff-screen') !== null;

/** Stops the browser from doing browser things on a public touchscreen (zoom, menus, selection, drag). */
export function installKiosk(doc: Document, opts: { hideCursor: boolean }): void {
  const block = (e: Event) => e.preventDefault();
  // Text fields (name entry, staff settings) still need selection; only staff fields also get the paste menu.
  doc.addEventListener('selectstart', (e) => {
    if (!isField(e.target)) e.preventDefault();
  });
  doc.addEventListener('contextmenu', (e) => {
    if (!isStaffField(e.target)) e.preventDefault();
  });
  for (const type of ['dragstart', 'gesturestart']) doc.addEventListener(type, block);
  doc.addEventListener('wheel', (e) => { if (e.ctrlKey) e.preventDefault(); }, { passive: false });
  doc.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && ['+', '-', '=', '0'].includes(e.key)) e.preventDefault();
  });
  doc.addEventListener('touchmove', (e) => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
  if (opts.hideCursor) doc.body.classList.add('hide-cursor');
}
