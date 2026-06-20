// Tipos compartidos del panel. Reflejan el schema de supabase/migrations/0001_init.sql.

export type LeadStatus =
  | "new"
  | "analyzed"
  | "build_queued"   // brief aprobado por el operador — pendiente de construir en Lovable
  | "site_built"
  | "approved"
  | "rejected"
  | "contacted"
  | "viewed"
  | "booked"
  | "won"
  | "nurture"
  | "lost";

// Cambio de planes 2026-06-11: dos públicos / dos canales outbound.
export type LeadSegment = "local" | "b2b"; // 'local' → email · 'b2b' → LinkedIn
export type OutreachChannel = "email" | "linkedin";

export interface Lead {
  id: string;
  name: string;
  category: string | null;
  phone: string | null;
  whatsapp: string | null;
  facebook: string | null; // URL de Facebook (ver 0010_lead_facebook.sql)
  email: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  google_place_id: string | null;
  rating: number | null;
  review_count: number | null;
  has_website: boolean | null;
  // Web real descubierta cuando Google Maps solo enlaza RRSS o no trae web (ver
  // 0009_lead_website_url.sql). Tiene prioridad sobre raw_json.website en el panel.
  website_url: string | null;
  raw_json: unknown;
  source: string | null;
  segment: LeadSegment;
  linkedin_url: string | null;
  contact_name: string | null;
  contact_role: string | null;
  status: LeadStatus;
  created_at: string;
  updated_at: string;
  // Scoring de la web ACTUAL del negocio (la de raw_json). Ver 0007_lead_site_score.sql.
  // Null hasta que el Orquestador (barrido diario) o el botón manual la analizan.
  site_score: number | null;
  site_analysis: SiteAnalysis | null;
  site_analyzed_at: string | null;
  // Bandeja del operador (ver 0008_lead_flags.sql). Independientes del status `viewed`
  // del pipeline (ese es del cliente). seen_at null = no visto.
  is_favorite: boolean;
  seen_at: string | null;
}

export interface BriefService {
  name: string;
  desc: string;
}

export interface BriefPalette {
  primary?: string;
  accent?: string;
  bg?: string;
}

export interface Brief {
  id: string;
  lead_id: string;
  business_summary: string | null;
  tone: string | null;
  value_props: string[] | null;
  highlights_from_reviews: string[] | null;
  recommended_sections: string[] | null;
  services: BriefService[] | null;
  suggested_palette: BriefPalette | null;
  hero_copy: string | null;
  model_used: string | null;
  created_at: string;
}

// Orden del pipeline para mostrar contadores de forma consistente.
export const PIPELINE_ORDER: LeadStatus[] = [
  "new",
  "analyzed",
  "build_queued",
  "site_built",
  "approved",
  "contacted",
  "viewed",
  "booked",
  "won",
];

export const STATUS_LABELS: Record<LeadStatus, string> = {
  new: "Nuevo",
  analyzed: "Brief listo",
  build_queued: "En cola Lovable",
  site_built: "Web lista",
  approved: "Aprobado",
  rejected: "Rechazado",
  contacted: "Contactado",
  viewed: "Visto",
  booked: "Reservado",
  won: "Ganado",
  nurture: "Seguimiento",
  lost: "Perdido",
};

// ===== SITES (web construida en Lovable) =====
// Refleja la tabla `sites` de supabase/migrations/0001_init.sql.
export type SiteStatus =
  | "queued"
  | "building"
  | "built"
  | "failed"
  | "approved"
  | "rejected"
  | "delivered";

// Resultado del scoring IA de la web (analyze-site / orquestador). Ver 0002_site_scoring.sql.
export interface SiteAnalysis {
  score: number;
  summary: string;
  strengths: string[];
  improvements: { area: string; issue: string; fix: string }[];
}

export interface Site {
  id: string;
  lead_id: string;
  lovable_project_id: string | null;
  live_url: string | null;
  build_prompt: string | null;
  status: SiteStatus;
  credits_estimate: number | null;
  notes: string | null;
  created_at: string;
  built_at: string | null;
  approved_at: string | null;
  // Scoring automático de la web (null hasta que se analiza).
  score: number | null;
  analysis: SiteAnalysis | null;
  analyzed_at: string | null;
}

export const SITE_STATUS_LABELS: Record<SiteStatus, string> = {
  queued: "En cola",
  building: "Construyéndose",
  built: "Lista para QA",
  failed: "Falló",
  approved: "Aprobada",
  rejected: "Rechazada",
  delivered: "Entregada",
};
