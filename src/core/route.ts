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

export interface Route {
  length: number;
  landmarks: readonly Landmark[];
  /** Is route position `p` inside a landmark's open plaza on this side of the street? */
  inPlaza(p: number, side: -1 | 1, margin?: number): boolean;
}

/** The authored route as fractions of its length, so any round length keeps the Riesenrad at the finish. */
const STOPS: ReadonlyArray<Omit<Landmark, 'at'> & { frac: number }> = [
  { id: 'stephansdom', frac: 65 / 600, side: 1, plaza: [-24, 16] },
  { id: 'tram', frac: 175 / 600, side: -1, plaza: null },
  { id: 'karlskirche', frac: 270 / 600, side: -1, plaza: [-24, 16] },
  { id: 'hofburg', frac: 410 / 600, side: 1, plaza: [-26, 16] },
  { id: 'riesenrad', frac: 1, side: 1, plaza: [-40, 40] },
];

export function buildRoute(length: number): Route {
  const landmarks: Landmark[] = STOPS.map(({ frac, ...stop }) => ({ ...stop, at: Math.round(frac * length) }));
  return {
    length,
    landmarks,
    inPlaza(p, side, margin = 0) {
      for (const lm of landmarks) {
        if (!lm.plaza || lm.side !== side) continue;
        const d = p - lm.at;
        if (d > lm.plaza[0] - margin && d < lm.plaza[1] + margin) return true;
      }
      return false;
    },
  };
}
