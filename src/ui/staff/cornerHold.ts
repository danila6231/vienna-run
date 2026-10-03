import { el } from '../dom';

/**
 * An invisible square in the top-left corner. Holding it for `ms` calls `onTrigger` (the staff PIN pad).
 * It is marked as interface, so pressing it never starts a game, and visitors see nothing.
 */
export function attachCornerHold(parent: HTMLElement, ms: number, onTrigger: () => void): HTMLElement {
  const zone = el('div', 'corner-hold');
  zone.dataset.ui = '';
  let timer = 0;
  const cancel = () => {
    window.clearTimeout(timer);
    timer = 0;
  };
  zone.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    cancel();
    timer = window.setTimeout(() => {
      timer = 0;
      onTrigger();
    }, ms);
  });
  for (const type of ['pointerup', 'pointerleave', 'pointercancel']) zone.addEventListener(type, cancel);
  parent.append(zone);
  return zone;
}
