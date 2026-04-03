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
  thumbnailSuggestion: z.string().describe("Deskripsi spesifik foto/gambar yang ideal untuk thumbnail artikel, misal: 'Close-up tangan memegang smartphone dengan layar menampilkan grafik saham'"),
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
    articleTypes?: string|null,
    language?: string,
    targetCountry?: string
  }
) {
  const categories = tenantConfig.articleTypes || "General";
  const lang = tenantConfig.language === "en" ? "English" : "Bahasa Indonesia";
  const country = tenantConfig.targetCountry || "ID";

  const systemPrompt = `
Kamu adalah Chief Editor untuk situs publishing tier-1 dengan jutaan session/bulan.
Niche: ${tenantConfig.niche}
Tone: ${tenantConfig.toneOfVoice || "Profesional, mendalam, namun mudah dicerna"}
Editorial Guidelines: ${tenantConfig.editorialGuidelines || "Tulis secara netral dan data-driven."}
Bahasa output: ${lang}
Negara target: ${country}

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
7. Tulis outline dalam ${lang}
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
  tenantConfig: { writingExample?: string|null, toneOfVoice?: string|null, tenantId?: string, language?: string }
) {
  const lang = tenantConfig.language === "en" ? "English" : "Bahasa Indonesia";
  
  // === Internal Linking: Ambil artikel PUBLISHED yang paling RELEVAN dari tenant yang sama ===
  let internalLinksInstruction = "";
  if (tenantConfig.tenantId) {
    try {
      const publishedArticles = await prisma.article.findMany({
        where: { 
          tenantId: tenantConfig.tenantId, 
          status: "PUBLISHED",
        },
        select: { title: true, keyword: true },
      });

      if (publishedArticles.length > 0) {
        // Ranking berdasarkan relevansi keyword (word overlap scoring)
        const currentWords = new Set(
          keyword.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(w => w.length > 2)
        );

        const scored = publishedArticles
          .map((a: { title: string | null; keyword: string }) => {
            const articleWords = (a.keyword || "").toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(w => w.length > 2);
            let overlap = 0;
            for (const word of articleWords) {
              if (currentWords.has(word)) overlap++;
            }
            // Skor = jumlah kata overlap / total kata unik di kedua keyword
            const totalUnique = new Set([...currentWords, ...articleWords]).size;
            const score = totalUnique > 0 ? overlap / totalUnique : 0;
            return { ...a, score };
          })
          .filter(a => a.score > 0 && a.score < 0.8) // >0 = ada relevansi, <0.8 = bukan duplikat
          .sort((a, b) => b.score - a.score)
          .slice(0, 10); // Ambil 10 artikel paling relevan

        if (scored.length > 0) {
          const linkList = scored.map(a => {
            const slug = (a.title || a.keyword).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");
            return `- [${a.title || a.keyword}](/${slug}) (relevansi: ${Math.round(a.score * 100)}%)`;
          }).join("\n");

          internalLinksInstruction = `
INTERNAL LINKING WAJIB:
Sisipkan 2-4 internal link ke artikel lain yang RELEVAN secara natural dalam paragraf (bukan di akhir).
Gunakan format markdown link. Hanya link ke artikel yang topiknya benar-benar relevan.
Prioritaskan artikel dengan relevansi tertinggi.

Artikel yang tersedia untuk di-link (diurutkan dari paling relevan):
${linkList}
`;
        }
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
Buat section "## Pertanyaan yang Sering Diajukan" lalu gunakan komponen <FAQSection>.
JANGAN gunakan H3 (###) untuk masing-masing soal.

Format Wajib:
<FAQSection faqs={[
${outline.faqItems?.map((faq: any, i: number) => 
  `  {
    question: "${faq.question}",
    answer: "Ekspansi jawaban singkat ini menjadi 1-2 paragraf yang komprehensif dan natural: ${faq.answerBrief.replace(/"/g, '\\"')}"
  }${i < (outline.faqItems?.length || 0) - 1 ? ',' : ''}`
).join('\n')}
]} />
`;
  }

  const prompt = `
Kamu adalah copywriter profesional tier-1. 
Topik: ${keyword}
Tone: ${tenantConfig.toneOfVoice || "Kasual namun otoritatif, seperti editor majalah premium"}
Bahasa: ${lang}

${injection}

${internalLinksInstruction}

Tulis artikel LENGKAP dalam ${lang} berdasarkan outline berikut. Target: **2500+ kata**.
Gunakan Markdown. Setiap section MINIMAL 200 kata.

JUDUL: ${outline.seoTitle}

OUTLINE:
${JSON.stringify(outline.sections, null, 2)}

${faqInstruction}

ATURAN PENULISAN:
1. Mulai langsung dengan dua baris import ini di urutan paling atas artikel: 
import ProductCard from '../../components/ProductCard.astro';
import FAQSection from '../../components/FAQSection.astro';
2. Lanjutkan dengan paragraf pembuka yang memikat (JANGAN tulis judul H1, sudah disisipkan otomatis). Pastikan paragraf pertama LANGSUNG relevan dengan keyword.
3. Saat membuat artikel rekomendasi produk, WAJIB gunakan komponen <ProductCard title="..." badge="..." price="..." specs={["...", "..."]}>[Deskripsi mendalam]</ProductCard> untuk setiap item rekomendasi (JANGAN pakai bold list/H3).
4. Gunakan data spesifik dari instruksi outline (angka, nama, tahun).
5. Setiap H2 harus punya minimal 2-3 paragraf substantif jika bukan daftar produk.
6. Akhiri dengan section "## Kesimpulan" yang ringkas dan actionable.
7. JANGAN gunakan frasa AI kaku: "di era digital ini", "tidak bisa dipungkiri", "penting untuk diingat". Tulis seolah kamu adalah pakar yang berbicara santai tapi ahli ke pembaca.
8. Gunakan bold (**) untuk emphasis poin penting dalam paragraf.

Tulis artikel lengkap sekarang. Hanya return Markdown.
  `;

  const { text } = await generateText({
    model: geminiModel,
    prompt: prompt,
    maxOutputTokens: 8000, // ~3000-4000 kata
  });

  return `# ${outline.seoTitle}\n\n${text}`;
}
