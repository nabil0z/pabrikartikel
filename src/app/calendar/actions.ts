"use server";

import { prisma } from "@/lib/prisma";
import { checkDuplicateKeyword } from "@/lib/duplicate-guard";
import { createAnthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import { z } from "zod";
import { revalidatePath } from "next/cache";

const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' });

const seasonalPlanSchema = z.object({
  events: z.array(z.object({
    eventName: z.string().describe("Nama event/hari besar/tren musiman dalam Bahasa Indonesia"),
    eventDate: z.string().describe("Tanggal puncak event (format: YYYY-MM-DD)"),
    relevance: z.string().describe("Penjelasan 1 kalimat relevansi event ini dengan niche blog"),
    suggestedKeywords: z.array(z.string()).describe("Hanya 1-2 ide judul/keyword TERBAIK dengan search intent tertinggi untuk event ini. Kualitas > Kuantitas."),
  }))
});

export async function generateSeasonalPlan(formData: FormData) {
  const tenantId = formData.get("tenantId") as string;
  if (!tenantId) return;

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) return;

  const now = new Date();
  const oneYearLater = new Date(now);
  oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);

  const prompt = `
Kamu adalah Content Strategist senior untuk blog "${tenant.name}".
Niche blog: ${tenant.niche}
Kategori konten: ${tenant.articleTypes}
Bahasa: ${tenant.language === "id" ? "Indonesia" : "Inggris"}
Negara target: ${tenant.targetCountry === "ID" ? "Indonesia" : tenant.targetCountry}

TUGAS: Buat rencana konten seasonal untuk 12 bulan ke depan (${now.toISOString().split("T")[0]} s/d ${oneYearLater.toISOString().split("T")[0]}).

ATURAN (DILARANG HANYA BERFOKUS PADA TANGGAL MERAH!):
1. JANGAN hanya mencari hari libur nasional atau kalender pemerintah. Itu membosankan. 
2. Petakan SIKLUS PERILAKU KONSUMEN & EVENT INDUSTRI spesifik untuk niche "${tenant.niche}". Contoh siklus:
   - Siklus finansial (Tanggal gajian, bagi dividen, lapor pajak Maret, THR).
   - Siklus musim (Pancaroba, puncak musim hujan, kemarau panjang).
   - Siklus sosial/tahunan (Anak masuk sekolah, musim wisuda, musim nikah, libur semester).
   - Event Industri (Pameran gadget global tiap September, pameran otomotif tiap Agustus, dll).
3. Untuk setiap event, sertakan HANYA 1 atau maksimal 2 ide keyword/judul artikel. FOKUS PADA KUALITAS (search volume / tren tinggi). Jangan beri ide receh.
4. Hasilkan 12-24 event yang "out-of-the-box" dan berbobot.
5. Tanggal harus akurat (cek kalender Indonesia)
6. Bahasa Indonesia
7. Jangan masukkan event yang sudah lewat

Contoh output yang bagus:
- Event: "Harbolnas 12.12" → keywords: ["Rekomendasi Gadget Diskon 12.12"]
- Event: "Hari Kesehatan Dunia" → keywords: ["Alat Kesehatan Rumah Terbaik 2026", "Tren Telemedicine di Indonesia"]
`;

  const { object } = await generateObject({
    model: anthropic("claude-sonnet-4-6"),
    schema: seasonalPlanSchema,
    prompt,
  });

  // Simpan semua event + keyword suggestions ke database
  for (const event of object.events) {
    const eventDate = new Date(event.eventDate);
    if (isNaN(eventDate.getTime()) || eventDate < now) continue;

    const targetGenDate = new Date(eventDate.getTime() - 60 * 24 * 60 * 60 * 1000);

    await prisma.seasonalEvent.create({
      data: {
        eventName: event.eventName,
        eventDate,
        targetGenDate,
        tenantId,
        keywords: JSON.stringify({
          relevance: event.relevance,
          suggestions: event.suggestedKeywords,
        }),
      }
    });
  }

  revalidatePath("/calendar");
}

// Admin approve keyword → masukkan ke antrean Article sebagai SCHEDULED
export async function approveKeyword(formData: FormData) {
  const eventId = formData.get("eventId") as string;
  const keyword = formData.get("keyword") as string;
  const tenantId = formData.get("tenantId") as string;
  const targetDate = formData.get("targetDate") as string;

  if (!eventId || !keyword || !tenantId) return;

  // Duplicate Guard: Cek cannibalization per tenant
  const dupCheck = await checkDuplicateKeyword(keyword, tenantId);
  if (dupCheck.isDuplicate) return;

  await prisma.article.create({
    data: {
      keyword,
      tenantId,
      source: "SEASONAL",
      status: "SCHEDULED",
      targetDate: targetDate ? new Date(targetDate) : new Date(),
    }
  });

  revalidatePath("/calendar");
}

// Admin reject keyword → hapus dari suggestions
export async function rejectKeyword(formData: FormData) {
  const eventId = formData.get("eventId") as string;
  const keyword = formData.get("keyword") as string;

  if (!eventId || !keyword) return;

  const event = await prisma.seasonalEvent.findUnique({ where: { id: eventId } });
  if (!event || !event.keywords) return;

  const data = JSON.parse(event.keywords);
  data.suggestions = (data.suggestions || []).filter((k: string) => k !== keyword);

  await prisma.seasonalEvent.update({
    where: { id: eventId },
    data: { keywords: JSON.stringify(data) }
  });

  revalidatePath("/calendar");
}

// Approve semua keywords dari 1 event sekaligus
export async function approveAllKeywords(formData: FormData) {
  const eventId = formData.get("eventId") as string;
  const tenantId = formData.get("tenantId") as string;
  const targetDate = formData.get("targetDate") as string;

  if (!eventId || !tenantId) return;

  const event = await prisma.seasonalEvent.findUnique({ where: { id: eventId } });
  if (!event || !event.keywords) return;

  const data = JSON.parse(event.keywords);
  const suggestions: string[] = data.suggestions || [];

  for (const keyword of suggestions) {
    const existing = await checkDuplicateKeyword(keyword, tenantId);
    if (existing.isDuplicate) continue;

    await prisma.article.create({
      data: {
        keyword,
        tenantId,
        source: "SEASONAL",
        status: "SCHEDULED",
        targetDate: targetDate ? new Date(targetDate) : new Date(),
      }
    });
  }

  // Mark event as processed
  await prisma.seasonalEvent.update({
    where: { id: eventId },
    data: { isProcessed: true }
  });

  revalidatePath("/calendar");
}
