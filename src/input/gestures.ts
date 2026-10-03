export interface Point {
  x: number;
  y: number;
}

/** One touch becomes one lane change: a horizontal swipe goes its way, anything else is a tap on a screen half. */
export function resolveGesture(down: Point, up: Point | null, centerX: number, swipeMinPx: number): -1 | 1 {
  if (up) {
    const dx = up.x - down.x, dy = up.y - down.y;
    if (Math.abs(dx) >= swipeMinPx && Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 1 : -1;
  }
  return down.x < centerX ? -1 : 1;
}
