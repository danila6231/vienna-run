export type LandmarkId = 'stephansdom' | 'tram' | 'karlskirche' | 'hofburg' | 'riesenrad';

export interface Landmark {
  id: LandmarkId;
  /** Route distance of the landmark, in metres from the start line. */
  at: number;
  /** -1 = left side of the street, 1 = right side. */
  side: -1 | 1;
  /** Open plaza around the landmark (metres before/after `at`) where facade rows break. */
  plaza: [number, number] | null;
}

/** The authored route, Stephansplatz to the Riesenrad. Reorder or add stops here. */
export const LANDMARKS: readonly Landmark[] = [
  { id: 'stephansdom', at: 65, side: 1, plaza: [-24, 16] },
  { id: 'tram', at: 175, side: -1, plaza: null },
  { id: 'karlskirche', at: 270, side: -1, plaza: [-24, 16] },
  { id: 'hofburg', at: 410, side: 1, plaza: [-26, 16] },
  // Must equal CONFIG.runLength: the finish line sits beside the Riesenrad.
  { id: 'riesenrad', at: 600, side: 1, plaza: [-40, 40] },
];

export function inPlaza(p: number, side: -1 | 1, margin = 0): boolean {
  for (const lm of LANDMARKS) {
    if (!lm.plaza || lm.side !== side) continue;
    const d = p - lm.at;
    if (d > lm.plaza[0] - margin && d < lm.plaza[1] + margin) return true;
  }
  return false;
}
