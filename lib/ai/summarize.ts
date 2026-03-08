import { summarizePrompt } from "@/lib/ai/prompts";
import { runJsonChat } from "@/lib/ai/client";
import { asString } from "@/lib/validations/common";

export async function summarizeContent(content: string, limit = 155) {
  const prompt = summarizePrompt(content);
  const result = await runJsonChat([
    { role: "system", content: prompt.system },
    { role: "user", content: prompt.user }
  ]);

  return asString(result.summary ?? result.text ?? content, limit);
}
