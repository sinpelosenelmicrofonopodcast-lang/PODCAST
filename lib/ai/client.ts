import { generateText } from "ai";
import { asString } from "@/lib/validations/common";

type ChatMessage = { role: "system" | "user"; content: string };

function parseJsonPayload(content: string) {
  const clean = asString(content, 120000);
  if (!clean) return {};
  try {
    return JSON.parse(clean);
  } catch {
    const match = clean.match(/\{[\s\S]*\}/);
    if (!match) return {};
    return JSON.parse(match[0]);
  }
}

export async function runJsonChat(messages: ChatMessage[]) {
  const model = String(process.env.AI_GATEWAY_NEWS_MODEL ?? "openai/gpt-5-mini").trim();
  const hasJsonKeyword = messages.some((msg) => /\bjson\b/i.test(String(msg.content ?? "")));
  const normalizedMessages = hasJsonKeyword
    ? messages
    : [
        {
          role: "system" as const,
          content: "Return valid json only. Responde solo en formato json válido."
        },
        ...messages
      ];

  const result = await generateText({
    model,
    temperature: 0.25,
    messages: normalizedMessages
  });

  return parseJsonPayload(result.text) as Record<string, unknown>;
}
