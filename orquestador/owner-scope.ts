// Aislamiento WebForge ↔ Luvia en el orquestador. El DUEÑO del lead decide el producto: solo los
// leads del admin (o sin dueño) pasan por briefs, builds y scoring de webs; los de Luvia, nunca.
//
// Antes el filtro era `if (ADMIN_USER_ID) q = q.or(...)`: con la variable vacía era un no-op
// silencioso y entre el 13 y el 17 de agosto de 2026 el orquestador les hizo brief de web a 15
// clínicas de Luvia (pasaron a 'analyzed' y desaparecieron de su panel). Ahora, sin un
// ADMIN_USER_ID válido, el orquestador no arranca.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function requireAdminUserId(value: string | undefined): string {
  const id = value?.trim() ?? "";
  if (!UUID.test(id)) {
    throw new Error(
      `ADMIN_USER_ID ${id ? "no es un UUID válido" : "no está definido"} en el .env de la raíz. ` +
        "Sin él el orquestador procesaría también los leads de Luvia; no arranco.",
    );
  }
  return id;
}

// Filtro PostgREST para `.or(...)`: leads del admin o sin dueño (los del cron).
export function adminOwnerFilter(adminUserId: string): string {
  return `owner.eq.${adminUserId},owner.is.null`;
}

// Mismo criterio para un lead ya cargado (modo --lead).
export function isAdminScopedOwner(owner: string | null | undefined, adminUserId: string): boolean {
  return !owner || owner === adminUserId;
}
