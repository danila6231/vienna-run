import * as P from '../render/placeholders/paint';
import { baseName, edgeRadius, groupIds } from './resolve';

type Painter = () => HTMLCanvasElement;
type Source = 'designer' | 'placeholder';

export interface ArtSet {
  /** Canvas for an asset id; designer file if present, otherwise the placeholder. Throws if neither exists. */
  get(id: string): HTMLCanvasElement;
  has(id: string): boolean;
  /** Numbered sets such as facade-01…, waiter-run-01…; an empty array for an optional set nobody drew. */
  group(prefix: string): HTMLCanvasElement[];
  source(id: string): Source | 'missing';
  /** Raw designer file URL (for HTML images such as gift cards and the logo), or null. */
  url(id: string): string | null;
  list(): Array<{ id: string; source: Source }>;
}

/** Paper edge added to designer cutouts: share of the longest side (0 = none) and whether to cast the soft shadow. */
interface Finish { edge: number; shadow: boolean }
const FINISHES: Array<[string, Finish]> = [
  ['item-', { edge: 0.045, shadow: true }],
  ['waiter-', { edge: 0.016, shadow: true }],
  ['riesenrad-cabin', { edge: 0.03, shadow: false }],
  ['prop-', { edge: 0.01, shadow: false }],
  ['facade-', { edge: 0.0065, shadow: false }],
  ['back-', { edge: 0, shadow: false }],
  ['cloud-', { edge: 0.0125, shadow: false }],
  ['texture-', { edge: 0, shadow: false }],
  ['skyline', { edge: 0, shadow: false }],
  ['sky', { edge: 0, shadow: false }],
  ['gift-', { edge: 0, shadow: false }],
  ['logo', { edge: 0, shadow: false }],
];
const DEFAULT_FINISH: Finish = { edge: 0.008, shadow: true };
const finishFor = (id: string): Finish => FINISHES.find(([prefix]) => id.startsWith(prefix))?.[1] ?? DEFAULT_FINISH;
/** HTML-only files: never drawn into the 3D scene. */
const isUiOnly = (id: string) => id.startsWith('gift-') || id === 'logo';

const EMOJI: Record<string, string> = { sacher: '🍰', kipferl: '🥐', melange: '☕', mozart: '🍬', krampus: '👹', bomb: '💣' };
const numbered = (prefix: string, count: number, paint: (i: number) => HTMLCanvasElement): Array<[string, Painter]> =>
  Array.from({ length: count }, (_, i) => [`${prefix}${String(i + 1).padStart(2, '0')}`, () => paint(i)]);

const PLACEHOLDERS: Record<string, Painter> = Object.fromEntries<Painter>([
  ...numbered('facade-', 6, (i) => P.paintFacadeA(i)),
  ...numbered('back-', 5, (i) => P.paintBackA(i)),
  ['landmark-stephansdom', () => P.paintStephansdomA()],
  ['landmark-karlskirche', () => P.paintKarlskircheA()],
  ['landmark-hofburg', () => P.paintHofburgA()],
  ['landmark-tram', () => P.paintTramA()],
  ['riesenrad-wheel', () => P.paintWheelA()],
  ['riesenrad-cabin', () => P.paintCabinA()],
  ['riesenrad-support', () => P.paintWheelSupportA()],
  ...Object.entries(EMOJI).map(([k, e]): [string, Painter] => [`item-${k}`, () => P.paperEdge(P.emojiCanvas(e, 128, 0.6), 6)]),
  ...numbered('waiter-run-', 2, (i) => P.paintWaiterA(i)),
  ['prop-lamp', () => P.paintLampA()],
  ['banner-finish', () => P.paintBannerA()],
  ['cloud-01', () => P.paintCloudA()],
  ['skyline', () => P.paintSkylineA()],
  ['texture-road', () => P.paintRoadA()],
  ['texture-sidewalk', () => P.paintWalkA()],
]);

const DESIGNER_URLS: Record<string, string> = Object.fromEntries(
  Object.entries(import.meta.glob('./art/*.{png,webp,svg}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>)
    .map(([path, url]) => [baseName(path), url]),
);

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`could not load ${url}`));
    img.src = url;
  });
}

async function loadDesignerCanvas(id: string, url: string): Promise<HTMLCanvasElement> {
  const img = await loadImage(url);
  const scale = Math.min(1, 2048 / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(img.naturalWidth * scale));
  c.height = Math.max(1, Math.round(img.naturalHeight * scale));
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
  const f = finishFor(id);
  return f.edge > 0 ? P.paperEdge(c, edgeRadius(f.edge, c.width, c.height), '#fffaf0', f.shadow ? 'rgba(60,35,20,0.32)' : '') : c;
}

/** Loads fonts (Josefin Sans and Be Vietnam Pro for the screens, Federo for the placeholder signs), then every designer file; broken files fall back to placeholders. */
export async function loadArt(): Promise<ArtSet> {
  await Promise.race([
    // The sample text pulls in the Vietnamese subsets too, so accented letters never flash in a fallback font.
    Promise.all(['40px Federo', '600 40px "Josefin Sans"', '24px "Be Vietnam Pro"', '600 24px "Be Vietnam Pro"'].map((f) => document.fonts.load(f, 'Điểm của bạn ạ ố'))),
    new Promise((resolve) => setTimeout(resolve, 2500)),
  ]).catch(() => undefined);

  const designer = new Map<string, HTMLCanvasElement>();
  await Promise.all(
    Object.entries(DESIGNER_URLS)
      .filter(([id]) => !isUiOnly(id))
      .map(async ([id, url]) => {
        try {
          designer.set(id, await loadDesignerCanvas(id, url));
        } catch (err) {
          console.warn(`[art] ${id}: ${String(err)}. Using the placeholder.`);
        }
      }),
  );

  const painted = new Map<string, HTMLCanvasElement>();
  const get = (id: string): HTMLCanvasElement => {
    const d = designer.get(id);
    if (d) return d;
    let c = painted.get(id);
    if (!c) {
      const paint = PLACEHOLDERS[id];
      if (!paint) throw new Error(`no art for "${id}"`);
      c = paint();
      painted.set(id, c);
    }
    return c;
  };
  const source = (id: string): Source | 'missing' => (designer.has(id) ? 'designer' : id in PLACEHOLDERS ? 'placeholder' : 'missing');
  return {
    get,
    has: (id) => designer.has(id) || id in PLACEHOLDERS,
    group: (prefix) => groupIds(prefix, [...designer.keys()], Object.keys(PLACEHOLDERS)).ids.map(get),
    source,
    url: (id) => DESIGNER_URLS[id] ?? null,
    // A designer file that failed to load is listed as "placeholder", because that's what the booth shows.
    list: () =>
      [...new Set([...Object.keys(PLACEHOLDERS), ...Object.keys(DESIGNER_URLS)])]
        .sort()
        .map((id): { id: string; source: Source } => ({ id, source: designer.has(id) || (isUiOnly(id) && id in DESIGNER_URLS) ? 'designer' : 'placeholder' })),
  };
}
