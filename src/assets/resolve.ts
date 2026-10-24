/** './art/facade-01.png' → 'facade-01' */
export function baseName(path: string): string {
  const file = path.split('/').pop() ?? path;
  return file.replace(/\.(png|webp|svg)$/i, '');
}

/** Numbered sets (facade-01…, waiter-run-01…): designer files replace the whole placeholder set. */
export function groupIds(prefix: string, designer: readonly string[], placeholders: readonly string[]): { ids: string[]; fromDesigner: boolean } {
  const fromDesigner = designer.filter((id) => id.startsWith(prefix)).sort();
  if (fromDesigner.length > 0) return { ids: fromDesigner, fromDesigner: true };
  return { ids: placeholders.filter((id) => id.startsWith(prefix)).sort(), fromDesigner: false };
}

/** Paper border width in pixels for an image, as a share of its longest side. */
export function edgeRadius(ratio: number, w: number, h: number): number {
  return Math.max(2, Math.round(ratio * Math.max(w, h)));
}
