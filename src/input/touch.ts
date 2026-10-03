import type { GameConfig } from '../config';
import { resolveGesture, type Point } from './gestures';

export interface InputHandlers {
  onLane(dir: -1 | 1): void;
  /** Any fresh press on the game surface (starts the game from the attract screen). */
  onPress(): void;
}

/**
 * Pointer + keyboard input. Every touch counts, but each touch moves exactly one lane: a new touch
 * first settles any touch still pending, so two-handed play works and a resting palm moves at most once.
 * Cheap IR touch frames sometimes drop the release, so a press resolves on its own after `tapFallbackMs`.
 */
/** Keys typed into a field or aimed at an on-screen control (name entry, settings, PIN) are not game input. */
const isControl = (t: EventTarget | null): boolean =>
  t instanceof Element && t.closest('input, textarea, select, button, [contenteditable="true"], [data-ui]') !== null;

export function attachInput(surface: HTMLElement, cfg: GameConfig['input'], h: InputHandlers): () => void {
  let down: { p: Point; last: Point; cx: number; id: number; timer: number; done: boolean } | null = null;

  const finish = (up: Point | null) => {
    if (!down || down.done) return;
    down.done = true;
    window.clearTimeout(down.timer);
    h.onLane(resolveGesture(down.p, up, down.cx, cfg.swipeMinPx));
  };
  const onDown = (e: PointerEvent) => {
    const target = e.target as Element | null;
    if (target?.closest?.('button, [data-ui]')) return;
    if (down && !down.done) finish(down.last);
    h.onPress();
    const r = surface.getBoundingClientRect();
    const p = { x: e.clientX, y: e.clientY };
    const gesture = { p, last: p, cx: r.left + r.width / 2, id: e.pointerId, done: false, timer: 0 };
    // If the release never arrives, resolve from wherever the finger got to (a slow swipe still counts).
    gesture.timer = window.setTimeout(() => {
      if (down === gesture) finish(gesture.last);
    }, cfg.tapFallbackMs);
    down = gesture;
  };
  const onMove = (e: PointerEvent) => {
    if (down && !down.done && e.pointerId === down.id) down.last = { x: e.clientX, y: e.clientY };
  };
  const onUp = (e: PointerEvent) => {
    if (!down || e.pointerId !== down.id) return;
    finish({ x: e.clientX, y: e.clientY });
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.repeat || isControl(e.target)) return;
    if (e.key === 'ArrowLeft' || e.key === 'a') {
      h.onPress();
      h.onLane(-1);
      e.preventDefault();
    } else if (e.key === 'ArrowRight' || e.key === 'd') {
      h.onPress();
      h.onLane(1);
      e.preventDefault();
    } else if (e.key === ' ' || e.key === 'Enter') {
      h.onPress();
    }
  };

  surface.addEventListener('pointerdown', onDown);
  surface.addEventListener('pointermove', onMove);
  surface.addEventListener('pointerup', onUp);
  window.addEventListener('keydown', onKey);
  return () => {
    surface.removeEventListener('pointerdown', onDown);
    surface.removeEventListener('pointermove', onMove);
    surface.removeEventListener('pointerup', onUp);
    window.removeEventListener('keydown', onKey);
  };
}
