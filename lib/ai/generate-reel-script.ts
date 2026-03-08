import { reelScriptPrompt } from "@/lib/ai/prompts";
import { runJsonChat } from "@/lib/ai/client";
import { asString, asStringArray } from "@/lib/validations/common";

export async function generateReelScript(input: { title: string; summary: string }) {
  const prompt = reelScriptPrompt(input);
  const result = await runJsonChat([
    { role: "system", content: prompt.system },
    { role: "user", content: prompt.user }
  ]);

  const bullets = asStringArray(result.bullets, 4, 120);

  return {
    hook: asString(result.hook ?? input.title, 120),
    bullets: bullets.length ? bullets : [asString(input.summary, 120)],
    close: asString(result.close ?? "Síguenos para más análisis sin filtro.", 140)
  };
}
