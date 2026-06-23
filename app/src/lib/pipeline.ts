import { PIPELINE_ORDER, type LeadStatus } from "./types.ts";

// Etapas del pipeline que pertenecen a la construcción de webs. Solo el admin las ve;
// el usuario de Luvia no construye webs, así que sus contadores se ocultan.
export const WEB_ONLY_STAGES: LeadStatus[] = [
  "analyzed",
  "build_queued",
  "site_built",
  "approved",
];

// Etapas visibles en el Dashboard según el rol. Admin = todas; no-admin (Luvia) = sin las de web.
export function visibleStages(isAdmin: boolean): LeadStatus[] {
  if (isAdmin) return PIPELINE_ORDER;
  return PIPELINE_ORDER.filter((s) => !WEB_ONLY_STAGES.includes(s));
}
