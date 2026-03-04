# Sin Pelos en el Micrófono (MVP)

Plataforma adulta 21+ con feed unificado, comunidad propia, foro sin censura ideológica, noticias curadas y panel admin.

## Stack
- Next.js (web + admin)
- Supabase (Auth, Postgres, Storage)

## Setup
1. Crear proyecto en Supabase.
2. Ejecutar el esquema en `supabase/schema.sql`.
3. (Opcional) Ejecutar `supabase/seed.sql` para datos de prueba.
4. Crear `.env.local` con:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_SITE_URL=http://localhost:3000
CRON_SECRET=...
META_GRAPH_VERSION=v24.0
META_PAGE_ID=...
META_PAGE_ACCESS_TOKEN=...
IG_USER_ID=...
# opcional (si no se define, se usa META_PAGE_ACCESS_TOKEN)
IG_ACCESS_TOKEN=...
```

5. Instalar dependencias y correr dev:

```bash
pnpm install
pnpm dev
```

## Áreas clave
- `/feed` feed unificado
- `/community` comunidad
- `/foro` foro sin pelos
- `/noticias` noticias
- `/confesiones` confesiones
- `/teorias` teorías
- `/zona-cruda` zona paga
- `/admin` panel admin

## Reglas 21+
- Registro con fecha de nacimiento
- Checkbox legal obligatorio
- Confirmación al entrar a áreas sin censura (en UI completa)

## Próximos pasos
- Conectar publicación a redes
- Integrar Stripe para membresías
- Endurecer RLS con reglas 21+ y membership
