import { createHash } from "node:crypto";
import { supabaseService } from "@/lib/supabaseService";
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
      max_completion_tokens: 8000,
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

async function runProviderJsonChat(messages: ChatMessage[]) {
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
    maxRetries: 0,
    maxOutputTokens: 8000,
    messages: normalized
  });

  return parseJsonPayload(result.text) as Record<string, unknown>;
}

/** One prompt/model identity across jobs, with a durable cap and quota stop. */
export async function runJsonChat(messages: ChatMessage[]): Promise<Record<string, unknown>> {
  const service = supabaseService();
  const key = createHash("sha256").update(JSON.stringify({ messages: normalizedMessages(messages), model: process.env.OPENAI_API_KEY ? directOpenAiModel() : gatewayModel(), provider: process.env.OPENAI_API_KEY ? openAiBaseUrl() : "gateway" })).digest("hex");
  const { data: cached, error: cacheError } = await service.from("ai_generation_cache").select("response,expires_at").eq("cache_key", key).maybeSingle();
  if (cacheError) throw new Error(cacheError.message);
  const saved = cached as { response: Record<string, unknown> | null; expires_at: string } | null;
  if (saved?.response && Date.parse(saved.expires_at) > Date.now()) return saved.response;
  const { data: token, error } = await service.rpc("claim_ai_generation", { p_key: key });
  if (error) throw new Error(error.message);
  if (!token) throw new Error("Generación en curso o presupuesto preventivo de IA alcanzado. Se conserva el contenido guardado.");
  try {
    const result = await runProviderJsonChat(messages) as Record<string, unknown>;
    const { error: saveError } = await service.rpc("finish_ai_generation", { p_key: key, p_token: token, p_response: result });
    if (saveError) throw new Error(saveError.message);
    return result;
  } catch (error: any) {
    const message = String(error?.message ?? "");
    const status = Number(error?.statusCode ?? error?.status ?? 0);
    const pause = /insufficient_quota|credit|billing|quota_exceeded/i.test(message) ? 86400 : status === 429 || /429|rate.limit/i.test(message) ? 60 : 0;
    await service.rpc("finish_ai_generation", { p_key: key, p_token: token, p_pause_seconds: pause });
    throw error;
  }
}
