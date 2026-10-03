import type { GameConfig } from '../config';
import { resolveGesture, type Point } from './gestures';

export interface InputHandlers {
  onLane(dir: -1 | 1): void;
  /** Any fresh press on the game surface (starts the game from the attract screen). */
  onPress(): void;
}

/**
 * Pointer + keyboard input. Only the primary pointer counts, so a second hand or a palm does nothing.
 * Cheap IR touch frames sometimes drop the release, so a press resolves on its own after `tapFallbackMs`.
 */
export function attachInput(surface: HTMLElement, cfg: GameConfig['input'], h: InputHandlers): () => void {
  let down: { p: Point; cx: number; id: number; timer: number; done: boolean } | null = null;

  const finish = (up: Point | null) => {
    if (!down || down.done) return;
    down.done = true;
    window.clearTimeout(down.timer);
    h.onLane(resolveGesture(down.p, up, down.cx, cfg.swipeMinPx));
  };
  const onDown = (e: PointerEvent) => {
    if (!e.isPrimary) return;
    const target = e.target as Element | null;
    if (target?.closest?.('button, [data-ui]')) return;
    if (down && !down.done) finish(null);
    h.onPress();
    const r = surface.getBoundingClientRect();
    down = {
      p: { x: e.clientX, y: e.clientY },
      cx: r.left + r.width / 2,
      id: e.pointerId,
      done: false,
      timer: window.setTimeout(() => finish(null), cfg.tapFallbackMs),
    };
  };
  const onUp = (e: PointerEvent) => {
    if (!e.isPrimary || !down || e.pointerId !== down.id) return;
    finish({ x: e.clientX, y: e.clientY });
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.repeat) return;
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
  surface.addEventListener('pointerup', onUp);
  window.addEventListener('keydown', onKey);
  return () => {
    surface.removeEventListener('pointerdown', onDown);
    surface.removeEventListener('pointerup', onUp);
    window.removeEventListener('keydown', onKey);
  };
}
