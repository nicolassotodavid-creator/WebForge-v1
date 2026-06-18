// Parser CSV minimalista y robusto (maneja comillas, comas y saltos de línea dentro de campos).
// Devuelve un array de objetos usando la primera fila como cabecera.

export function parseCsv(text: string): Record<string, string>[] {
  const rows = parseRows(text);
  if (rows.length === 0) return [];

  const header = rows[0].map((h) => h.trim());
  const out: Record<string, string>[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    // Saltar filas completamente vacías
    if (row.length === 1 && row[0].trim() === "") continue;
    const obj: Record<string, string> = {};
    header.forEach((key, idx) => {
      obj[key] = (row[idx] ?? "").trim();
    });
    out.push(obj);
  }
  return out;
}

function parseRows(text: string): string[][] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;

  // Normalizar saltos de línea
  const s = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let i = 0; i < s.length; i++) {
    const c = s[i];

    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
      } else if (c === ",") {
        row.push(field);
        field = "";
      } else if (c === "\n") {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else {
        field += c;
      }
    }
  }

  // Último campo/fila
  row.push(field);
  rows.push(row);
  return rows;
}
