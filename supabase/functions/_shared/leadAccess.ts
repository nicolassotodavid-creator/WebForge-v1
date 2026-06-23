// Aislamiento por cuenta en las Edge Functions de ACCIÓN. Estas funciones corren con
// service_role (que se salta RLS), así que la propiedad del lead se comprueba a mano: un
// operador solo puede actuar sobre SUS leads; el admin (por email) sobre cualquiera.
//
// Las llamadas internas de confianza (secret del webhook o service_role del Orquestador)
// pasan `operator = null` y se saltan la comprobación a propósito.
//
// Debe coincidir con is_admin() de la migración 0016_lead_ownership.sql.
export const ADMIN_EMAIL = "nicolassotodavid@gmail.com";

export type Operator = { id: string; email: string };

export function isAdminEmail(email: string | null | undefined): boolean {
  return (email ?? "").trim().toLowerCase() === ADMIN_EMAIL;
}

// ¿Puede `op` actuar sobre un lead cuyo dueño es `ownerId`? Admin: siempre. Resto: solo si es suyo.
export function canAccessLead(ownerId: string | null | undefined, op: Operator): boolean {
  if (isAdminEmail(op.email)) return true;
  return !!ownerId && ownerId === op.id;
}
