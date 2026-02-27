# SEO Slug Migration Plan (News) + 301

## Estado actual
- Ruta pública de noticias: `/noticias/[id]`
- La página ya soporta búsqueda por `id` o `slug`.
- Si entra por UUID y existe slug, se hace `301` a `/noticias/{slug}`.
- Links internos principales ya usan helper `newsHref()` (slug-first).

## Objetivo
- Canonical único por noticia: `/noticias/{slug}`
- Mantener compatibilidad de links viejos con `301` permanente.
- Evitar pérdida de SEO durante migración.

## Ejecución por fases

### Fase 1 — Base de datos
1. Ejecutar `/Users/gabriel/Sin Pelos Sin Censura/supabase/news_slugs_301_ready.sql`.
2. Validar:
   - `slug` existe.
   - Índice único `news_items_slug_unique` creado.
   - Trigger `trg_news_items_ensure_slug` activo.
3. Muestreo rápido:
   ```sql
   select id, slug, title
   from public.news_items
   order by published_at desc
   limit 30;
   ```

### Fase 2 — App
1. Publicar cambios actuales de app:
   - canonical consistente en Home, Noticias, Feed, Blog y hubs.
   - `robots.ts` y `sitemap.ts`.
   - links internos slug-first.
2. Confirmar redirect:
   - abrir `/noticias/{uuid}` y verificar status `301`.
   - destino esperado: `/noticias/{slug}`.

### Fase 3 — Indexación
1. Enviar sitemap nuevo: `https://www.sinpelosenelmicrofono.com/sitemap.xml`.
2. En Google Search Console:
   - inspeccionar 5-10 URLs nuevas con slug.
   - inspeccionar 5-10 URLs viejas con UUID y validar “URL redirigida”.
3. Monitorear 2 semanas:
   - páginas indexadas por `/noticias/{slug}`
   - caída progresiva de URLs UUID en índice.

## Reglas SEO
- Canonical por noticia siempre debe ser slug.
- No cambiar slug de noticias antiguas salvo necesidad crítica.
- Si un título cambia, mantener slug previo cuando aplique (opcional futura mejora con historial de slugs).

## Rollback (si algo falla)
1. Mantener redirect activo (no retirar).
2. Revertir solo generación automática de slug:
   - desactivar trigger `trg_news_items_ensure_slug`.
3. No eliminar columna `slug` ni índice durante recuperación para no romper URLs ya indexadas.

