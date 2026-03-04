type SupabaseLikeError = {
  message?: string | null;
  code?: string | null;
  details?: string | null;
  hint?: string | null;
};

const AUTO_POSTS_MIGRATION_HINT =
  "Falta la migracion de Auto Posts. Ejecuta `supabase/auto_posts.sql` en Supabase SQL Editor y vuelve a intentar.";

function text(v: unknown) {
  return String(v ?? "");
}

function isScheduledPostsMissingInSchemaCache(error: SupabaseLikeError | null | undefined) {
  const code = text(error?.code).toUpperCase();
  const msg = `${text(error?.message)} ${text(error?.details)} ${text(error?.hint)}`.toLowerCase();
  if (code === "PGRST205" && msg.includes("scheduled_posts")) return true;
  if (msg.includes("could not find the table") && msg.includes("scheduled_posts")) return true;
  if (msg.includes("schema cache") && msg.includes("scheduled_posts")) return true;
  return false;
}

export function withScheduledPostsMigrationHint(error: SupabaseLikeError | null | undefined) {
  const raw = text(error?.message).trim();
  if (!isScheduledPostsMissingInSchemaCache(error)) return raw || "Database error";
  return raw ? `${raw}. ${AUTO_POSTS_MIGRATION_HINT}` : AUTO_POSTS_MIGRATION_HINT;
}
