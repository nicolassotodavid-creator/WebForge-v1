import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const p = (...parts) => path.join(ROOT, ...parts);

export const today = () => new Date().toISOString().slice(0, 10);

export function readJson(file, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    if (fallback !== null && err.code === 'ENOENT') return fallback;
    throw new Error(`No se pudo leer ${file}: ${err.message}`);
  }
}

export function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
}

// Sin tildes, minúsculas: para comparar especialidades y nombres.
export const plain = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

export function domainOf(url) {
  if (!url) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return null;
  }
}

// Meses entre una fecha ISO (AAAA-MM o AAAA-MM-DD) y la de referencia. null si no hay fecha válida.
export function monthsAgo(iso, ref) {
  if (!iso) return null;
  const m = String(iso).match(/^(\d{4})-(\d{2})(?:-(\d{2}))?/);
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +(m[3] || 15)));
  const r = new Date(`${ref}T00:00:00Z`);
  return (r - d) / (1000 * 60 * 60 * 24 * 30.44);
}
