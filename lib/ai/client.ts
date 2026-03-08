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
  const apiKey = String(process.env.OPENAI_API_KEY ?? "").trim();
  if (!apiKey) throw new Error("Falta OPENAI_API_KEY.");

  const model = String(process.env.OPENAI_NEWS_MODEL ?? "gpt-4o-mini").trim();
  const endpoint = `${String(process.env.OPENAI_API_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "")}/chat/completions`;

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

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      temperature: 0.25,
      response_format: { type: "json_object" },
      messages: normalizedMessages
    }),
    cache: "no-store"
  });

  const json = (await response.json().catch(() => ({}))) as {
    choices?: Array<{ message?: { content?: string | null } }>;
    error?: { message?: string };
  };

  if (!response.ok) {
    throw new Error(json?.error?.message ?? `OpenAI HTTP ${response.status}`);
  }

  const content = asString(json?.choices?.[0]?.message?.content ?? "", 120000);
  return parseJsonPayload(content) as Record<string, unknown>;
}
