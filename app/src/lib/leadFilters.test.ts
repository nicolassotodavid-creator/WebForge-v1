// Test de un solo uso (no hay framework): se ejecuta con
//   node --experimental-strip-types src/lib/leadFilters.test.ts
// Reproduce el bug real: con el estado fijado en "new" (persistido en
// localStorage), la pestaña "Sin web" prometía 6 pero abría una lista vacía,
// porque ninguno de los leads sin web seguía en estado "new".
import { matchesBaseFilters, matchesView, type LeadFilterState } from "./leadFilters.ts";
import type { Lead } from "./types.ts";

let failures = 0;
function assertEq(actual: unknown, expected: unknown, msg: string) {
  const ok = actual === expected;
  console.log(`${ok ? "✓" : "✗"} ${msg}  (got ${actual}, want ${expected})`);
  if (!ok) failures++;
}

// Mini-fábrica de leads con solo los campos que tocan los filtros.
function lead(p: Partial<Lead>): Lead {
  return {
    status: "new",
    city: "València",
    category: "clínica",
    name: "Negocio",
    phone: "+34000",
    seen_at: null,
    is_favorite: false,
    has_website: true,
    ...p,
  } as Lead;
}

// Espejo de la distribución real comprobada vía REST:
// new=14, analyzed=5, build_queued=5, approved=1; sin web=6 (ninguno "new").
const leads: Lead[] = [
  ...Array.from({ length: 14 }, () => lead({ status: "new", has_website: true })),
  ...Array.from({ length: 5 }, () => lead({ status: "analyzed", has_website: false })),
  ...Array.from({ length: 1 }, () => lead({ status: "build_queued", has_website: false })),
  ...Array.from({ length: 5 }, () => lead({ status: "build_queued", has_website: true })),
  ...Array.from({ length: 1 }, () => lead({ status: "approved", has_website: true })),
];

function countTab(state: LeadFilterState, view: Parameters<typeof matchesView>[1]) {
  return leads.filter((l) => matchesBaseFilters(l, state) && matchesView(l, view)).length;
}

// --- Escenario del bug: estado = "new" persistido ---
const newState: LeadFilterState = { statusFilter: "new", city: "", category: "", search: "" };

// El contador HONESTO (mismo predicado que la tabla) debe coincidir con la tabla.
assertEq(countTab(newState, "noweb"), 0, "Sin web con estado=new: el contador y la tabla son 0 (antes mentía 6)");
assertEq(countTab(newState, "all"), 14, "Todos con estado=new: 14 (no 25)");
assertEq(countTab(newState, "unseen"), 14, "No vistos con estado=new: 14 (no 25)");

// --- Sin filtro de estado: las cifras 'globales' siguen siendo correctas ---
const allState: LeadFilterState = { statusFilter: "all", city: "", category: "", search: "" };
assertEq(countTab(allState, "all"), 26, "Todos sin filtro: 26");
assertEq(countTab(allState, "noweb"), 6, "Sin web sin filtro: 6 (los candidatos sí aparecen)");

// --- La búsqueda también recorta las pestañas de forma coherente ---
const searchState: LeadFilterState = { statusFilter: "all", city: "", category: "", search: "noexiste" };
assertEq(countTab(searchState, "all"), 0, "Búsqueda sin coincidencias: 0 en todas las pestañas");

console.log(failures === 0 ? "\nTODO OK" : `\n${failures} FALLO(S)`);
process.exit(failures === 0 ? 0 : 1);
