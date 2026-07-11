import type { Lead, LeadStatus } from "./types";

/** Pestañas de vista rápida de la bandeja. Mutuamente excluyentes. */
export type ViewFilter = "all" | "unseen" | "seen" | "favorites" | "noweb" | "chat" | "whatsapp";

/** Filtros que NO dependen de la pestaña de vista. */
export interface LeadFilterState {
  statusFilter: LeadStatus | "all";
  city: string;
  category: string;
  search: string;
}

/**
 * ¿El lead pasa los filtros base (estado, ciudad, categoría, búsqueda)?
 *
 * Es el predicado COMÚN para la tabla y para los contadores de las pestañas.
 * Compartir esta función es lo que garantiza que el número de cada pestaña
 * coincida siempre con lo que verás al pulsarla: antes había dos cálculos
 * distintos (la tabla aplicaba estos filtros, los contadores no), así que una
 * pestaña podía marcar "Sin web 6" y abrir una lista vacía si el estado
 * seleccionado dejaba fuera a esos 6.
 */
export function matchesBaseFilters(l: Lead, f: LeadFilterState): boolean {
  if (f.statusFilter !== "all" && l.status !== f.statusFilter) return false;
  if (f.city && !(l.city ?? "").toLowerCase().includes(f.city.toLowerCase()))
    return false;
  if (
    f.category &&
    !(l.category ?? "").toLowerCase().includes(f.category.toLowerCase())
  )
    return false;
  if (f.search) {
    const q = f.search.toLowerCase();
    const matches =
      (l.name ?? "").toLowerCase().includes(q) ||
      (l.city ?? "").toLowerCase().includes(q) ||
      (l.category ?? "").toLowerCase().includes(q) ||
      (l.phone ?? "").toLowerCase().includes(q);
    if (!matches) return false;
  }
  return true;
}

/** ¿El lead pertenece a la pestaña de vista rápida indicada? */
export function matchesView(l: Lead, view: ViewFilter): boolean {
  switch (view) {
    case "unseen":
      return !l.seen_at;
    case "seen":
      return !!l.seen_at;
    case "favorites":
      return !!l.is_favorite;
    case "noweb":
      return !l.has_website;
    case "chat":
      return l.site_has_chat === true;
    case "whatsapp":
      return l.site_has_whatsapp === true;
    case "all":
    default:
      return true;
  }
}
