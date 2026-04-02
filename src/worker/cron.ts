import { prisma } from "@/lib/prisma";
import { scrapeSerpData } from "@/lib/serper";
import { draftWithClaude, expandWithGemini } from "@/lib/ai-pipeline";
import { getBot, sendReviewNotification, handleTelegramReply } from "@/lib/telegram";

const RETRY_LIMIT = 3;

export async function processArticleQueue() {
  console.log(`[Queue Cron] Checking for SCHEDULED articles...`);
  
  // Hitung awal hari ini (UTC) untuk pembatasan harian
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  // Cari tenant yang sudah melebihi kuota hari ini
  const tenantsOverQuota = await getTenantsOverDailyQuota(todayStart);
  
  // Ambil 1 artikel yang jadwalnya sudah lewat, belum gagal total, 
  // DAN tenant-nya belum melebihi kuota harian.
  const article = await prisma.article.findFirst({
    where: {
      status: "SCHEDULED",
      targetDate: { lte: new Date() },
      retryCount: { lt: RETRY_LIMIT },
      ...(tenantsOverQuota.length > 0 ? { tenantId: { notIn: tenantsOverQuota } } : {}),
    },
    include: { tenant: true }
  });

  if (!article) {
    return; // Tidak ada antrean, atau semua tenant sudah mencapai kuota harian.
  }
  
  console.log(`[Queue Cron] Tenant "${article.tenant.name}" limit: ${article.tenant.postsPerDay}/day`);

  console.log(`[Queue Cron] Processing ID: ${article.id} | Keyword: ${article.keyword}`);

  try {
    // Kunci status sementara (DRAFTING)
    await prisma.article.update({
      where: { id: article.id },
      data: { status: "DRAFTING" }
    });

    const tenant = article.tenant;

    // 1. Dapatkan Fakta SERP
    console.log(`[Queue Cron] Phase 1/3: Scraping SERP for ${article.keyword} (${tenant.language}/${tenant.targetCountry})`);
    const facts = await scrapeSerpData(article.keyword, tenant.language, tenant.targetCountry);

    // 2. Buat Logika Outline (Claude)
    console.log(`[Queue Cron] Phase 2/3: Generating Outline with Claude Sonnet 4.6`);
    const outline = await draftWithClaude(
      article.keyword,
      facts,
      { niche: tenant.niche, toneOfVoice: tenant.toneOfVoice, editorialGuidelines: tenant.editorialGuidelines, articleTypes: tenant.articleTypes, language: tenant.language, targetCountry: tenant.targetCountry }
    );

    // 3. Tulis Teks Utuh Markdown (Gemini)
    console.log(`[Queue Cron] Phase 3/3: Expanding Draft with Gemini 3 Flash Preview`);
    const mdxContent = await expandWithGemini(
      article.keyword, 
      outline,
      { writingExample: tenant.writingExample, toneOfVoice: tenant.toneOfVoice, tenantId: tenant.id, language: tenant.language }
    );

    // 4. Update Database (simpan outline JSON agar category bisa dipakai saat export .mdx)
    await prisma.article.update({
      where: { id: article.id },
      data: { 
        content: mdxContent,
        outline: JSON.stringify(outline),
        status: "PENDING_REVIEW",
        errorLog: null // Hapus error sisa.
      }
    });

    // 5. Lempar notifikasi ke Grup Telegram agar Admin tahu
    console.log(`[Queue Cron] Sending Telegram review ping...`);
    const chatId = process.env.TELEGRAM_MONITOR_GROUP_ID || "";
    await sendReviewNotification(chatId, tenant.telegramTopicId || undefined, article.id, outline.seoTitle, mdxContent, JSON.stringify(outline));

  } catch (error: any) {
    console.error(`[Queue Cron] Error on ID: ${article.id}:`, error.message);
    
    await prisma.article.update({
      where: { id: article.id },
      data: {
        status: article.retryCount + 1 >= RETRY_LIMIT ? "FAILED" : "SCHEDULED",
        retryCount: article.retryCount + 1,
        errorLog: error.message || "Unknown Generator Error",
      }
    });
  }
}

/**
 * Cari tenant yang sudah melebihi kuota harian (postsPerDay).
 * Menghitung artikel yang status-nya DRAFTING, PENDING_REVIEW, atau PUBLISHED hari ini.
 */
async function getTenantsOverDailyQuota(todayStart: Date): Promise<string[]> {
  // Ambil semua tenant beserta batas hariannya
  const tenants = await prisma.tenant.findMany({
    select: { id: true, postsPerDay: true }
  });

  const overQuota: string[] = [];

  for (const tenant of tenants) {
    const todayCount = await prisma.article.count({
      where: {
        tenantId: tenant.id,
        status: { in: ["DRAFTING", "PENDING_REVIEW", "PUBLISHED", "APPROVED"] },
        updatedAt: { gte: todayStart },
      }
    });

    if (todayCount >= tenant.postsPerDay) {
      console.log(`[Queue Cron] ⏸️ Tenant "${tenant.id}" sudah ${todayCount}/${tenant.postsPerDay} artikel hari ini — SKIP`);
      overQuota.push(tenant.id);
    }
  }

  return overQuota;
}
