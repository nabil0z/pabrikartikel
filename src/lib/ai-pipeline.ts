import { generateText, generateObject } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { z } from "zod";
import { prisma } from "./prisma";

// Initialize providers
const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' });
const google = createGoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY || '' });

const claudeModel = anthropic('claude-sonnet-4-6');
const geminiModel = google('gemini-3-flash-preview');

// ============================================================
// Schema for Claude's Outline Output (Enhanced for SEO 10/10)
// ============================================================
const outlineSchema = z.object({
  seoTitle: z.string().describe("Judul SEO memikat, 50-60 karakter, mengandung keyword utama di awal"),
  metaDescription: z.string().describe("Meta description 150-160 karakter yang memikat klik, mengandung keyword dan CTA implisit"),
  category: z.string().describe("Kategori blog yang paling cocok, pilih dari daftar yang diberikan"),
  sections: z.array(z.object({
    heading: z.string().describe("Judul H2 bergaya natural, hindari pola 'Apa itu X', gunakan variasi menarik"),
    instructions: z.string().describe("Instruksi detail: poin utama, data/statistik yang harus disertakan, angle unik"),
    estimatedWords: z.number().describe("Estimasi jumlah kata ideal untuk section ini (minimal 200)"),
  })),
  faqItems: z.array(z.object({
    question: z.string().describe("Pertanyaan FAQ berbasis People Also Ask data"),
    answerBrief: z.string().describe("Jawaban singkat 2-3 kalimat untuk diekspansi Gemini"),
  })).describe("5 FAQ items berdasarkan People Also Ask data dari SERP"),
});

// ============================================================
// Phase 2: Claude Sonnet 4.6 — Strategic Outline + Meta + FAQ
// ============================================================
export async function draftWithClaude(
  keyword: string, 
  serpFacts: string[], 
  tenantConfig: { 
    niche: string, 
    toneOfVoice?: string|null, 
    editorialGuidelines?: string|null, 
    articleTypes?: string|null 
  }
) {
  const categories = tenantConfig.articleTypes || "General";

  const systemPrompt = `
Kamu adalah Chief Editor untuk situs publishing tier-1 Indonesia dengan jutaan session/bulan.
Niche: ${tenantConfig.niche}
Tone: ${tenantConfig.toneOfVoice || "Profesional, mendalam, namun mudah dicerna"}
Editorial Guidelines: ${tenantConfig.editorialGuidelines || "Tulis secara netral dan data-driven."}

Kategori tersedia: [${categories}]
Pilih TEPAT SATU kategori dari list di atas.

TARGET KEYWORD: "${keyword}"

REFERENSI SERP & KONTEN KOMPETITOR (Gunakan sebagai sumber fakta utama):
${serpFacts.join('\n\n')}

INSTRUKSI:
1. Buat judul SEO yang memikat (50-60 karakter, keyword di awal)
2. Buat meta description yang memicu klik (150-160 karakter)
3. Buat 5-8 section H2 dengan instruksi DETAIL per section
4. Setiap section harus mengandung DATA SPESIFIK dari SERP (angka, nama produk, statistik real)
5. Estimasikan minimal 200 kata per section (total target: 2500+ kata)
6. Buat 5 FAQ items berdasarkan "People Also Ask" jika tersedia di data SERP
7. JANGAN pernah mengarang data — hanya gunakan fakta dari referensi SERP di atas
8. Tulis outline dalam perspective Bahasa Indonesia
  `;

  const { object } = await generateObject({
    model: claudeModel,
    schema: outlineSchema,
    prompt: systemPrompt,
  });

  return object;
}

// ============================================================
// Phase 3: Gemini 3 Flash — Full Article Expansion with Internal Links + FAQ
// ============================================================
export async function expandWithGemini(
  keyword: string,
  outline: { seoTitle: string, sections: any[], faqItems?: any[] },
  tenantConfig: { writingExample?: string|null, toneOfVoice?: string|null, tenantId?: string }
) {
  
  // === Internal Linking: Ambil artikel PUBLISHED dari tenant yang sama ===
  let internalLinksInstruction = "";
  if (tenantConfig.tenantId) {
    try {
      const publishedArticles = await prisma.article.findMany({
        where: { 
          tenantId: tenantConfig.tenantId, 
          status: "PUBLISHED",
        },
        select: { title: true, keyword: true },
        take: 20, // Ambil 20 artikel terbaru
        orderBy: { publishedAt: "desc" },
      });

      if (publishedArticles.length > 0) {
        const linkList = publishedArticles.map((a: { title: string | null; keyword: string }) => {
          const slug = (a.title || a.keyword).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");
          return `- [${a.title || a.keyword}](/${slug})`;
        }).join("\n");

        internalLinksInstruction = `
INTERNAL LINKING WAJIB:
Sisipkan 2-4 internal link ke artikel lain yang RELEVAN secara natural dalam paragraf (bukan di akhir).
Gunakan format markdown link. Hanya link ke artikel yang topiknya benar-benar relevan.

Artikel yang tersedia untuk di-link:
${linkList}
`;
      }
    } catch (e) {
      // Silently skip if DB query fails
    }
  }

  // === Few-Shot Style Injection ===
  let injection = "";
  if (tenantConfig.writingExample && tenantConfig.writingExample.length > 50) {
    injection = `
CRITICAL FEW-SHOT STYLE INJECTION:
Kamu WAJIB mengkloning ritme, struktur kalimat, kadensa, dan vibe dari contoh tulisan berikut. Jangan pernah keluar dari tone ini.
CONTOH MULAI---
${tenantConfig.writingExample}
---CONTOH SELESAI
`;
  }

  // === FAQ Section ===
  let faqInstruction = "";
  if (outline.faqItems && outline.faqItems.length > 0) {
    faqInstruction = `

BAGIAN FAQ (WAJIB ada di akhir artikel sebelum kesimpulan):
Buat section "## Pertanyaan yang Sering Diajukan" dengan format:

${outline.faqItems.map((faq: any, i: number) => 
  `### ${faq.question}\n(Ekspansi jawaban ini menjadi 2-3 paragraf detail: ${faq.answerBrief})`
).join('\n\n')}
`;
  }

  const prompt = `
Kamu adalah copywriter profesional tier-1 Indonesia. 
Topik: ${keyword}
Tone: ${tenantConfig.toneOfVoice || "Kasual namun otoritatif, seperti editor majalah premium"}

${injection}

${internalLinksInstruction}

Tulis artikel LENGKAP berdasarkan outline berikut. Target: **2500+ kata**.
Gunakan Markdown. Setiap section MINIMAL 200 kata.

JUDUL: ${outline.seoTitle}

OUTLINE:
${JSON.stringify(outline.sections, null, 2)}

${faqInstruction}

ATURAN PENULISAN:
1. Mulai langsung dengan paragraf pembuka yang memikat (JANGAN tulis judul H1, sudah disisipkan otomatis)
2. Gunakan data spesifik dari instruksi outline (angka, nama, tahun)
3. Setiap H2 harus punya minimal 3 paragraf substantif
4. Gunakan bold (**) untuk emphasis poin penting
5. Sisipkan bullet points atau numbered list di minimal 2 section
6. Akhiri dengan section "## Kesimpulan" yang ringkas dan actionable
7. JANGAN gunakan frasa AI: "di era digital ini", "tidak bisa dipungkiri", "perlu diketahui bahwa"
8. Tulis seolah kamu adalah pakar yang berbicara langsung ke pembaca
9. Pastikan paragraf pertama LANGSUNG relevan dengan keyword (untuk Google snippet)

Tulis artikel lengkap sekarang. Hanya return Markdown.
  `;

  const { text } = await generateText({
    model: geminiModel,
    prompt: prompt,
    maxOutputTokens: 8000, // ~3000-4000 kata
  });

  return `# ${outline.seoTitle}\n\n${text}`;
}
