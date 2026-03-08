export async function publishTikTokPost(_input: {
  message: string;
  link: string;
  reelVideoUrl?: string | null;
}) {
  // TODO: implementar publicación real via partner API/flujo oficial aprobado.
  return {
    platform: "tiktok" as const,
    ok: false,
    pending: true,
    reason: "TikTok adapter placeholder: requiere pipeline externo de video + API oficial."
  };
}
