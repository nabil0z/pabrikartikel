import { prisma } from "@/lib/prisma";
import { checkDuplicateKeyword } from "@/lib/duplicate-guard";

/**
 * Auto-Discovery Engine
 * 
 * Menggunakan Google Trends API untuk menemukan keyword trending
 * yang relevan dengan niche tenant, lalu memasukkannya ke antrean otomatis.
 * 
 * Hanya berjalan untuk tenant yang autoDiscovery = true.
 * Dijalankan oleh cron 1x sehari.
 */
export async function processAutoDiscovery() {
  console.log(`[Auto-Discovery] Scanning for trending topics...`);

  // Ambil semua tenant yang autoDiscovery = true
  const tenants = await prisma.tenant.findMany({
    where: { autoDiscovery: true },
  });

  if (tenants.length === 0) {
    console.log(`[Auto-Discovery] No tenants with autoDiscovery enabled.`);
    return;
  }

  // Dynamic import (Google Trends API)
  const googleTrends = await import("google-trends-api");

  for (const tenant of tenants) {
    try {
      console.log(`[Auto-Discovery] Processing tenant: ${tenant.name} (niche: ${tenant.niche})`);

      // Cari niche-related keywords dari Google Trends
      const geo = tenant.targetCountry || "ID";
      const hl = tenant.language || "id";

      // 1. Ambil daily trends untuk negara target
      const dailyTrendsRaw = await googleTrends.dailyTrends({
        trendDate: new Date(),
        geo,
        hl,
      });

      const dailyData = JSON.parse(dailyTrendsRaw);
      const trendingSearches = dailyData?.default?.trendingSearchesDays?.[0]?.trendingSearches || [];

      // 2. Ambil related queries berdasarkan niche
      let relatedKeywords: string[] = [];
      try {
        const nicheWords = tenant.niche.split(/[,\s]+/).filter((w: string) => w.length > 3).slice(0, 2);
        
        for (const nicheWord of nicheWords) {
          const relatedRaw = await googleTrends.relatedQueries({
            keyword: nicheWord,
            geo,
            hl,
          });

          const relatedData = JSON.parse(relatedRaw);
          const rising = relatedData?.default?.rankedList?.[1]?.rankedKeyword || [];
          const topRelated = rising.slice(0, 5).map((r: any) => r.query);
          relatedKeywords.push(...topRelated);
        }
      } catch (e: any) {
        console.warn(`[Auto-Discovery] Related queries failed for ${tenant.name}: ${e.message}`);
      }

      // 3. Filter trending searches yang relevan dengan niche
      const nicheKeywords = tenant.niche.toLowerCase().split(/[,\s]+/).filter((w: string) => w.length > 2);
      const categories = (tenant.articleTypes || "").toLowerCase().split(/[,\s]+/).filter((w: string) => w.length > 2);
      const allNicheTerms = [...nicheKeywords, ...categories];

      const relevantTrends = trendingSearches
        .map((t: any) => t.title?.query || "")
        .filter((query: string) => {
          if (!query || query.length < 5) return false;
          const queryLower = query.toLowerCase();
          // Cek apakah trending topic relevan dengan niche
          return allNicheTerms.some(term => queryLower.includes(term));
        })
        .slice(0, 5);

      // Gabungkan trending + related keywords
      const candidates = [...new Set([...relevantTrends, ...relatedKeywords])].slice(0, 8);

      if (candidates.length === 0) {
        console.log(`[Auto-Discovery] No relevant trending topics found for ${tenant.name}`);
        continue;
      }

      // 4. Masukkan ke antrean (dengan duplicate guard)
      let added = 0;
      for (const keyword of candidates) {
        const dupCheck = await checkDuplicateKeyword(keyword, tenant.id);
        if (dupCheck.isDuplicate) {
          console.log(`[Auto-Discovery] ⏭️ Skip "${keyword}" — mirip dengan "${dupCheck.matchedKeyword}"`);
          continue;
        }

        await prisma.article.create({
          data: {
            keyword,
            tenantId: tenant.id,
            source: "AUTO",
            status: "SCHEDULED",
            targetDate: new Date(), // Proses hari ini
          },
        });
        added++;
        console.log(`[Auto-Discovery] ✅ Added: "${keyword}" for ${tenant.name}`);
      }

      console.log(`[Auto-Discovery] ${tenant.name}: +${added} new keywords discovered`);

    } catch (error: any) {
      console.error(`[Auto-Discovery] Error for ${tenant.name}:`, error.message);
    }
  }
}
