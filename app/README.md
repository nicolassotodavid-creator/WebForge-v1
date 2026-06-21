# App (panel + páginas públicas)

Frontend React + Vite + Tailwind + shadcn/ui, desplegado en Vercel. Ver `ARQUITECTURA_webforge_v2.md` sec. 11.

En **Fase 0**, Claude Code hace aquí el scaffold (`npm create vite`, Tailwind, shadcn) y conecta Supabase.
Pantallas: `/` dashboard, `/leads/:id` (QA + contacto), `/import`, `/settings`,
y públicas `/book/:leadId` + `/gracias`. La "demo" que ve el prospecto es la URL de Lovable (no se
renderiza aquí).
