// ¿Este lead pertenece al producto Luvia (usuario de Miguel) y NO al admin (David)?
// Se deriva del dueño del lead:
//  - adminUserId vacío  -> nunca Luvia (comportamiento previo: todo es del admin).
//  - owner null         -> lead del cron/admin, no Luvia.
//  - owner != admin     -> Luvia.
export function isLuviaLead(
  owner: string | null | undefined,
  adminUserId: string | null | undefined,
): boolean {
  if (!adminUserId || !owner) return false;
  return owner !== adminUserId;
}
