// URL pública de la demo de Luvia: {base}/demo/{id}. base sin slash final.
export function buildDemoUrl(base: string, id: string): string {
  return `${base.replace(/\/+$/, "")}/demo/${id}`;
}
