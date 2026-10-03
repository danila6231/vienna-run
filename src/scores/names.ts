export const NAME_RE = /^[A-Za-z0-9 _-]{1,12}$/;

/**
 * What a code name may contain, applied as the player types: Vietnamese letters lose their accents
 * (Đức → Duc), anything else outside A–Z, a–z, 0–9, space, "-" and "_" is dropped, max 12 characters.
 */
export function cleanNameInput(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^A-Za-z0-9 _-]/g, '')
    .replace(/ {2,}/g, ' ')
    .replace(/^ +/, '')
    .slice(0, 12);
}

/** The name to store, or null when nothing usable is left. */
export function finalName(raw: string): string | null {
  const name = cleanNameInput(raw).trim();
  return NAME_RE.test(name) ? name : null;
}

/** "booth" → "booth-2" → "booth-3": a fresh, empty board; old scores stay in the database. */
export function nextBoardName(board: string): string {
  const m = /^(.*?)-(\d+)$/.exec(board);
  const base = m ? m[1] : board;
  const suffix = `-${m ? Number(m[2]) + 1 : 2}`;
  return `${base.slice(0, 24 - suffix.length) || 'board'}${suffix}`;
}
