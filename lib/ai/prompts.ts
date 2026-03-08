export const SIN_PELOS_STYLE_RULES = [
  "Habla directo, con punch boricua, claro y sin relleno.",
  "No inventes datos, cifras ni citas.",
  "Separa claramente hechos de análisis.",
  "Evita lenguaje difamatorio o acusaciones no verificadas.",
  "Mantén tono periodístico moderno con energía viral."
].join("\n");

export function rewritePrompt(input: {
  title: string;
  summary: string;
  body: string;
  sourceName: string;
  sourceUrl: string;
}) {
  return {
    system: `Eres editor senior de Sin Pelos en el Micrófono.\n${SIN_PELOS_STYLE_RULES}`,
    user: JSON.stringify({
      source_name: input.sourceName,
      source_url: input.sourceUrl,
      original_title: input.title,
      original_summary: input.summary,
      original_body: input.body,
      output_format: {
        seo_title: "<=60",
        discover_title: "<=75",
        summary: "<=155",
        excerpt: "<=220",
        rewritten_body_markdown: "3-7 párrafos",
        analisis_sin_pelos: "1-2 párrafos",
        tags: ["tag1", "tag2"],
        category: "string",
        region: "PR|TX|USA|Mundo",
        facebook_post: "copy",
        comments_hook: "pregunta para generar comentarios",
        push_text: "<=110",
        poll_question: "pregunta",
        reel_script: "hook + 3 bullets + cierre"
      }
    })
  };
}

export function summarizePrompt(content: string) {
  return {
    system: `Resume noticias para Sin Pelos con precisión.\n${SIN_PELOS_STYLE_RULES}`,
    user: JSON.stringify({ content, limit: 155 })
  };
}

export function socialCopyPrompt(input: { title: string; summary: string; url: string }) {
  return {
    system: `Genera copy social estilo Sin Pelos.\n${SIN_PELOS_STYLE_RULES}`,
    user: JSON.stringify(input)
  };
}

export function pollPrompt(input: { title: string; summary: string }) {
  return {
    system: "Crea una encuesta periodística neutral y breve en español.",
    user: JSON.stringify({
      title: input.title,
      summary: input.summary,
      output: { question: "texto", options: ["op1", "op2", "op3", "op4"] }
    })
  };
}

export function reelScriptPrompt(input: { title: string; summary: string }) {
  return {
    system: `Escribe scripts cortos para reel de noticias.\n${SIN_PELOS_STYLE_RULES}`,
    user: JSON.stringify({
      title: input.title,
      summary: input.summary,
      output: { hook: "texto", bullets: ["a", "b", "c"], close: "cta" }
    })
  };
}
