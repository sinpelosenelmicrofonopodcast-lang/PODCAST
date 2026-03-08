import { socialCopyPrompt } from "@/lib/ai/prompts";
import { runJsonChat } from "@/lib/ai/client";
import { asString } from "@/lib/validations/common";

export async function generateSocialCopy(input: { title: string; summary: string; url: string }) {
  const prompt = socialCopyPrompt(input);
  const result = await runJsonChat([
    { role: "system", content: prompt.system },
    { role: "user", content: prompt.user }
  ]);

  return {
    facebook: asString(result.facebook ?? result.copy ?? `${input.title}\n\n${input.url}`, 500),
    x: asString(result.x ?? result.twitter ?? `${input.title} ${input.url}`, 260),
    instagram: asString(result.instagram ?? input.summary, 1000),
    tiktok: asString(result.tiktok ?? input.summary, 220)
  };
}
