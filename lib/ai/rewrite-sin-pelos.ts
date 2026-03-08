import { rewritePrompt } from "@/lib/ai/prompts";
import { runJsonChat } from "@/lib/ai/client";
import { asString, asStringArray } from "@/lib/validations/common";

export type RewriteSinPelosOutput = {
  seoTitle: string;
  discoverTitle: string;
  summary: string;
  excerpt: string;
  rewrittenBody: string;
  analysis: string;
  tags: string[];
  category: string;
  region: string;
  facebookPost: string;
  commentsHook: string;
  pushText: string;
  pollQuestion: string;
  reelScript: string;
};

export async function rewriteSinPelos(input: {
  title: string;
  summary: string;
  body: string;
  sourceName: string;
  sourceUrl: string;
}): Promise<RewriteSinPelosOutput> {
  const prompt = rewritePrompt(input);
  const result = await runJsonChat([
    { role: "system", content: prompt.system },
    { role: "user", content: prompt.user }
  ]);

  return {
    seoTitle: asString(result.seo_title ?? input.title, 60),
    discoverTitle: asString(result.discover_title ?? input.title, 75),
    summary: asString(result.summary ?? input.summary, 155),
    excerpt: asString(result.excerpt ?? input.summary, 220),
    rewrittenBody: asString(result.rewritten_body_markdown ?? input.body, 12000),
    analysis: asString(result.analisis_sin_pelos ?? input.summary, 3000),
    tags: asStringArray(result.tags, 12, 40),
    category: asString(result.category ?? "Mundo", 50),
    region: asString(result.region ?? "Mundo", 20),
    facebookPost: asString(result.facebook_post ?? input.title, 400),
    commentsHook: asString(result.comments_hook ?? "¿Qué tú piensas?", 180),
    pushText: asString(result.push_text ?? input.title, 110),
    pollQuestion: asString(result.poll_question ?? "¿Estás de acuerdo?", 180),
    reelScript: asString(result.reel_script ?? input.summary, 1200)
  };
}
