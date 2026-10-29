import { readdirSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BAD_TYPES, GOOD_TYPES } from '../../src/core/types';

const ART = 'src/assets/art';

describe('road item art', () => {
  // System emoji fonts differ (Windows draws 🎹 nothing like a Mac), so every item ships as an image.
  it.each([...GOOD_TYPES, ...BAD_TYPES, 'question'])('item-%s is a bundled image, small enough for the kiosk', (type) => {
    const file = readdirSync(ART).find((f) => f.startsWith(`item-${type}.`));
    expect(file).toMatch(/\.(png|webp)$/);
    expect(statSync(`${ART}/${file}`).size).toBeLessThan(64_000);
  });
});
