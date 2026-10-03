export interface RowSpec {
  count: number;
  spacing: number;
  offset: number;
}

/** Route positions for a pooled row; the first slot starts `behind` metres behind the camera. */
export function initialPositions(spec: RowSpec, behind = 16): number[] {
  return Array.from({ length: spec.count }, (_, i) => spec.offset - behind + i * spec.spacing);
}

/** A slot whose position fell more than `behind` metres behind the runner jumps to the front of its row. */
export function recycle(p: number, dist: number, span: number, behind = 16): number {
  while (dist - p > behind) p += span;
  return p;
}
