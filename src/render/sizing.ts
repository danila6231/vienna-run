/** A zero or invalid aspect (a broken image) is treated as square so nothing becomes Infinity. */
const safe = (aspect: number): number => (Number.isFinite(aspect) && aspect > 0 ? aspect : 1);

/** Width × height of a sprite that fits inside a size × size box while keeping the image's shape. */
export function fitSquare(aspect: number, size: number): { w: number; h: number } {
  const a = safe(aspect);
  return a >= 1 ? { w: size, h: size / a } : { w: size * a, h: size };
}

/** Height of a card with a fixed width (facades tile along the street) that keeps the image's shape. */
export function heightForWidth(width: number, aspect: number): number {
  return width / safe(aspect);
}
