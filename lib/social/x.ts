export async function publishXPost(_input: {
  message: string;
  link: string;
}) {
  // TODO: implementar envío real cuando X credentials y permisos estén disponibles.
  return {
    platform: "x" as const,
    ok: false,
    pending: true,
    reason: "X adapter placeholder: faltan credenciales/permisos de publicación."
  };
}
