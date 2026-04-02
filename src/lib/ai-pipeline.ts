import { generateText, generateObject } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { z } from "zod";

// Initialize providers
const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' });
const google = createGoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY || '' });

const claudeModel = anthropic('claude-sonnet-4-6');
const geminiModel = google('gemini-3-flash-preview');

// Schema for Claude's Outline Output
const outlineSchema = z.object({
  seoTitle: z.string().describe("Judul memikat bergaya internasional dengan click-through rate tinggi"),
  category: z.string().describe("Kategori blog yang paling cocok untuk artikel ini, pilih dari daftar kategori yang diberikan"),
  sections: z.array(z.object({
    heading: z.string().describe("Judul H2 atau H3"),
    instructions: z.string().describe("Instruksi spesifik poin apa saja yang harus dibahas di paragraf ini untuk draf"),
  }))
});

export async function draftWithClaude(
  keyword: string, 
  serpFacts: string[], 
  tenantConfig: { niche: string, toneOfVoice?: string|null, editorialGuidelines?: string|null, articleTypes?: string|null }
) {
  
  const categories = tenantConfig.articleTypes || "General";

  const systemPrompt = `
You are the Chief Editor for a top-tier publishing site. Niche: ${tenantConfig.niche}.
Tone: ${tenantConfig.toneOfVoice || "Profesional, mendalam, namun mudah dicerna"}.
Editorial Guidelines: ${tenantConfig.editorialGuidelines || "Tidak ada, tulis secara netral."}

Available Blog Categories: [${categories}]
You MUST pick exactly one category from the list above for the "category" field.

Your task is to create an outline for the keyword: "${keyword}".
Base your outline entirely on these SERP Facts (Do not hallucinate facts):
${serpFacts.join('\n\n')}

Create a compelling title, pick the most fitting category, and create logical H2/H3 headings. Provide specific instructions for each section so that a junior writer can execute it flawlessly.
  `;

  const { object } = await generateObject({
    model: claudeModel,
    schema: outlineSchema,
    prompt: systemPrompt,
  });

  return object;
}

export async function expandWithGemini(
  keyword: string,
  outline: { seoTitle: string, sections: any[] },
  tenantConfig: { writingExample?: string|null, toneOfVoice?: string|null }
) {
  
  let injection = "";
  if (tenantConfig.writingExample && tenantConfig.writingExample.length > 50) {
    injection = `
CRITICAL FEW-SHOT STYLE INJECTION:
You MUST perfectly clone the exact rhythm, sentence structure, cadence, and vibe of the following writing example. Never break this tone.
EXAMPLE START---
${tenantConfig.writingExample}
---EXAMPLE END
`;
  }

  const prompt = `
You are the primary copywriter. 
Topic: ${keyword}
Tone: ${tenantConfig.toneOfVoice || "Casual yet authoritative"}

${injection}

Expand the following outline into a FULL 1500+ word article formatted in Markdown.
TITLE: ${outline.seoTitle}

OUTLINE INSTRUCTIONS TO FOLLOW:
${JSON.stringify(outline.sections, null, 2)}

Write the full article now. Only return Markdown.
  `;

  const { text } = await generateText({
    model: geminiModel,
    prompt: prompt,
    // Provide some nice generation settings for large prose
    maxOutputTokens: 3000, 
  });

  return `# ${outline.seoTitle}\n\n${text}`;
}
