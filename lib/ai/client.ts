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

function normalizedMessages(messages: ChatMessage[]) {
  const hasJsonKeyword = messages.some((msg) => /\bjson\b/i.test(String(msg.content ?? "")));
  return hasJsonKeyword
    ? messages
    : [
        {
          role: "system" as const,
          content: "Return valid json only. Responde solo en formato json válido."
        },
        ...messages
      ];
}

function openAiBaseUrl() {
  return String(process.env.OPENAI_API_BASE_URL ?? "https://api.openai.com/v1")
    .trim()
    .replace(/\/+$/, "");
}

function directOpenAiModel() {
  const configured = String(process.env.OPENAI_NEWS_MODEL ?? "").trim();
  if (configured) return configured.replace(/^openai\//i, "");

  const gatewayModel = String(process.env.AI_GATEWAY_NEWS_MODEL ?? "").trim();
  if (gatewayModel) return gatewayModel.replace(/^openai\//i, "");

  return "gpt-5-mini";
}

function gatewayModel() {
  return String(process.env.AI_GATEWAY_NEWS_MODEL ?? "openai/gpt-5-mini").trim();
}

function extractAssistantText(message: any) {
  const content = message?.content;
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";

  return content
    .map((part) => {
      if (typeof part === "string") return part;
      if (part?.type === "text") return String(part?.text ?? "");
      return "";
    })
    .filter(Boolean)
    .join("\n");
}

async function runDirectOpenAiJson(messages: ChatMessage[]) {
  const apiKey = String(process.env.OPENAI_API_KEY ?? "").trim();
  if (!apiKey) return null;

  const response = await fetch(`${openAiBaseUrl()}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "X-Client-Request-Id": crypto.randomUUID()
    },
    body: JSON.stringify({
      model: directOpenAiModel(),
      messages,
      response_format: { type: "json_object" }
    }),
    signal: AbortSignal.timeout(110000),
    cache: "no-store"
  });

  if (!response.ok) {
    const detail = asString(await response.text().catch(() => ""), 800);
    throw new Error(`OpenAI direct request failed (${response.status})${detail ? `: ${detail}` : ""}`);
  }

  const payload = (await response.json().catch(() => ({}))) as any;
  const text = extractAssistantText(payload?.choices?.[0]?.message);
  if (!text) throw new Error("OpenAI direct request returned no assistant text.");
  return parseJsonPayload(text) as Record<string, unknown>;
}

export async function runJsonChat(messages: ChatMessage[]) {
  const normalized = normalizedMessages(messages);
  const apiKey = String(process.env.OPENAI_API_KEY ?? "").trim();

  // Prefer the provider directly when a provider key exists. This keeps the
  // editorial/newsroom path independent from AI Gateway account credit state.
  if (apiKey) {
    return runDirectOpenAiJson(normalized) as Promise<Record<string, unknown>>;
  }

  const result = await generateText({
    model: gatewayModel(),
    temperature: 0.25,
    messages: normalized
  });

  return parseJsonPayload(result.text) as Record<string, unknown>;
}
