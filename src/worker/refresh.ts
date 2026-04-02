import { prisma } from "@/lib/prisma";
import { scrapeSerpData } from "@/lib/serper";
import { expandWithGemini } from "@/lib/ai-pipeline";
import { sendReviewNotification } from "@/lib/telegram";

const REFRESH_INTERVAL_DAYS = 90; // Refresh setiap 3 bulan
const MAX_REFRESHES_PER_RUN = 1;  // 1 artikel per cycle agar tidak overload API

/**
 * Content Freshness Monitor
 * Cek artikel evergreen yang sudah usang → re-scrape SERP → update konten.
 * 
 * Dijalankan oleh cron setiap 6 jam (beda jadwal dari article queue).
 */
export async function processRefreshQueue() {
  console.log(`[Freshness] Checking for stale evergreen articles...`);

  const staleDate = new Date();
  staleDate.setDate(staleDate.getDate() - REFRESH_INTERVAL_DAYS);

  // Cari artikel published yang:
  // 1. Evergreen (layak di-refresh)
  // 2. Tidak dikunci dari refresh
  // 3. Terakhir direfresh > 90 hari lalu (atau belum pernah)
  const staleArticle = await prisma.article.findFirst({
    where: {
      status: "PUBLISHED",
      isEvergreen: true,
      isLockedFromRefresh: false,
      OR: [
        { lastRefreshedAt: null, publishedAt: { lte: staleDate } },
        { lastRefreshedAt: { lte: staleDate } },
      ],
    },
    include: { tenant: true },
    orderBy: { publishedAt: "asc" }, // Paling lama dulu
  });

  if (!staleArticle) {
    console.log(`[Freshness] No stale articles found.`);
    return;
  }

  console.log(`[Freshness] Refreshing: "${staleArticle.keyword}" (last updated: ${staleArticle.lastRefreshedAt || staleArticle.publishedAt})`);

  try {
    // Kunci artikel sementara
    await prisma.article.update({
      where: { id: staleArticle.id },
      data: { status: "UPDATING" },
    });

    const tenant = staleArticle.tenant;

    // 1. Re-scrape SERP terbaru
    console.log(`[Freshness] Phase 1: Re-scraping SERP for "${staleArticle.keyword}"`);
    const newFacts = await scrapeSerpData(staleArticle.keyword, tenant.language, tenant.targetCountry);

    // 2. Re-expand dengan Gemini (pakai outline asli + data baru)
    // Parse outline lama jika ada
    let outline = { seoTitle: staleArticle.title || staleArticle.keyword, sections: [] as any[], faqItems: [] as any[] };
    if (staleArticle.outline) {
      try {
        outline = JSON.parse(staleArticle.outline);
      } catch {}
    }

    // Inject instruksi update ke prompt
    const updatePrompt = `
INSTRUKSI KHUSUS: Ini adalah UPDATE dari artikel yang sudah ada.
Pertahankan struktur H2 yang sama, tapi UPDATE semua data/statistik/harga dengan informasi terbaru dari SERP berikut:

DATA SERP TERBARU:
${newFacts.join('\n\n')}

Pastikan semua angka, nama produk, dan tanggal sudah akurat per ${new Date().toISOString().split("T")[0]}.
`;

    console.log(`[Freshness] Phase 2: Re-writing with updated data`);
    const updatedContent = await expandWithGemini(
      staleArticle.keyword,
      { ...outline, sections: outline.sections.map((s: any) => ({ ...s, instructions: s.instructions + "\n" + updatePrompt })) },
      { writingExample: tenant.writingExample, toneOfVoice: tenant.toneOfVoice, tenantId: tenant.id, language: tenant.language }
    );

    // 3. Update database
    await prisma.article.update({
      where: { id: staleArticle.id },
      data: {
        content: updatedContent,
        status: "PENDING_REVIEW",
        lastRefreshedAt: new Date(),
      },
    });

    // 4. Notifikasi admin via Telegram
    const chatId = process.env.TELEGRAM_MONITOR_GROUP_ID || "";
    await sendReviewNotification(
      chatId,
      tenant.telegramTopicId || undefined,
      staleArticle.id,
      `🔄 UPDATE: ${outline.seoTitle}`,
      updatedContent
    );

    console.log(`[Freshness] Successfully refreshed article: ${staleArticle.id}`);

  } catch (error: any) {
    console.error(`[Freshness] Error refreshing ${staleArticle.id}:`, error.message);
    
    // Kembalikan status ke PUBLISHED jika gagal
    await prisma.article.update({
      where: { id: staleArticle.id },
      data: { 
        status: "PUBLISHED",
        errorLog: `Refresh failed: ${error.message}`,
      },
    });
  }
}
