import { pollPrompt } from "@/lib/ai/prompts";
import { runJsonChat } from "@/lib/ai/client";
import { asString, asStringArray } from "@/lib/validations/common";

export async function generatePollFromArticle(input: { title: string; summary: string }) {
  const prompt = pollPrompt(input);
  const result = await runJsonChat([
    { role: "system", content: prompt.system },
    { role: "user", content: prompt.user }
  ]);

  const options = asStringArray(result.options, 4, 120);

  return {
    question: asString(result.question ?? "¿Qué opinas de este tema?", 180),
    options: options.length >= 2 ? options : ["De acuerdo", "En desacuerdo", "Depende", "No sé"]
  };
}
