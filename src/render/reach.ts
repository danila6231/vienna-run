/** The forward speed (m/s, ~173 km/h) up to which the view keeps the booth's fog: Easy, Normal and Hard look as they always did. */
const FULL_SPEED = 48;
/**
 * The furthest the view stretches. The houses and the road end 300 m ahead (see street.ts); at this scale they are
 * still 90% lost in fog there, and at 400 km/h items are drawn a little over 3 s ahead.
 */
const MAX_SCALE = 1.5;

export interface Reach {
  /** Scene fog, in metres ahead. */
  fogNear: number;
  fogFar: number;
  /** Items further ahead than this are not drawn. */
  items: number;
  /** How much further the skyline and the clouds stand, so they keep their size on screen. */
  scale: number;
}

/** How far ahead the player sees at `speed` m/s: further the faster the run, so there is time to plan. */
export function reach(speed: number): Reach {
  const scale = Math.min(MAX_SCALE, Math.max(1, speed / FULL_SPEED));
  return { fogNear: 60 * scale, fogFar: 210 * scale, items: 230 * scale, scale };
}
