import { sendOneSignalPush } from "@/lib/onesignalServer";

export async function sendArticlePush(input: {
  title: string;
  message: string;
  url: string;
  imageUrl?: string | null;
  category?: string | null;
}) {
  const result = await sendOneSignalPush({
    title: input.title,
    message: input.message,
    url: input.url,
    imageUrl: input.imageUrl ?? null,
    category: input.category ?? "noticias"
  });

  return {
    ok: true,
    provider: "onesignal",
    id: result.id,
    recipients: result.recipients,
    errors: result.errors
  };
}
