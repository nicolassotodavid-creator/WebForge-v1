// Lógica pura del puente Luvia: qué se envía a la plataforma Luvia y cuándo se permite.
// El handler HTTP (handoff-luvia/index.ts) solo orquesta; aquí vive lo testeable.
import { isLuviaLead } from "./luvia.ts";

// Subconjunto de columnas de `leads` que necesita el payload.
export type LeadRow = {
  id: string;
  name: string;
  category: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  rating: number | null;
  review_count: number | null;
  owner: string | null;
};

// Cuerpo del POST a la Edge Function crear-cliente de Luvia. Nombres en español para
// encajar con el modelo de Luvia; `source` marca el origen; `webforge_lead_id` permite
// idempotencia también en el lado de Luvia.
export type LuviaClientPayload = {
  webforge_lead_id: string;
  nombre: string;
  categoria: string | null;
  telefono: string | null;
  whatsapp: string | null;
  email: string | null;
  direccion: string | null;
  ciudad: string | null;
  pais: string | null;
  rating: number | null;
  resenas: number | null;
  source: "webforge";
};

export function buildLuviaClientPayload(lead: LeadRow): LuviaClientPayload {
  return {
    webforge_lead_id: lead.id,
    nombre: lead.name,
    categoria: lead.category,
    telefono: lead.phone,
    whatsapp: lead.whatsapp,
    email: lead.email,
    direccion: lead.address,
    ciudad: lead.city,
    pais: lead.country,
    rating: lead.rating,
    resenas: lead.review_count,
    source: "webforge",
  };
}

// ¿Se puede entregar este lead a Luvia? Solo si es un lead Luvia (owner ≠ admin). La
// propiedad del lead (que el operador sea su dueño) la valida canAccessLead aparte.
export function canHandoffToLuvia(
  owner: string | null | undefined,
  adminUserId: string | null | undefined,
): boolean {
  return isLuviaLead(owner, adminUserId);
}
