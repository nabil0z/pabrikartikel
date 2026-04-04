import { prisma } from "@/lib/prisma";
import { checkDuplicateKeyword } from "@/lib/duplicate-guard";
import axios from "axios";
import { generateObject } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { z } from "zod";

const google = createGoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY || '' });
const geminiModel = google('gemini-3-flash-preview');

/**
 * Auto-Discovery Engine (Pintar: Serper News + Gemini Ideator)
 * 
 * Menggunakan Serper untuk mengambil berita live hari ini sesuai niche, 
 * lalu Gemini mengekstraknya menjadi kumpulan ide keyword evergreen unik.
 * 
 * Hanya berjalan untuk tenant yang autoDiscovery = true.
 * Dijalankan oleh cron 1 jam sekali, diproses hanya jika waktu lokal jam 6 pagi.
 */
export async function processAutoDiscovery(force: boolean = false) {
  console.log(`[Auto-Discovery] Scanning for trending topics via Serper+Gemini... ${force ? '(FORCE TRIGGERED)' : ''}`);

  // Ambil semua tenant yang autoDiscovery = true
  const tenants = await prisma.tenant.findMany({
    where: { autoDiscovery: true },
  });

  if (tenants.length === 0) {
    console.log(`[Auto-Discovery] No tenants with autoDiscovery enabled.`);
    return;
  }

  const timezoneMap: Record<string, string> = {
    "ID": "Asia/Jakarta",
    "US": "America/New_York",
    "GB": "Europe/London",
    "SG": "Asia/Singapore",
    "MY": "Asia/Kuala_Lumpur",
    "AU": "Australia/Sydney",
  };

  for (const tenant of tenants) {
    try {
      const geo = tenant.targetCountry || "ID";
      const hl = tenant.language || "id";
      const timeZone = timezoneMap[geo] || "UTC";

      // Pengecekan Jam Lokal (Format 24 Jam)
      const localHourStr = new Date().toLocaleString("en-US", { timeZone, hour: 'numeric', hour12: false });
      const localHour = parseInt(localHourStr, 10);

      // Guard: Cuma narik trends saat jam 6 pagi waktu setempat (kecuali dipaksa)
      if (!force && localHour !== 6) {
        console.log(`[Auto-Discovery] ⏭️ Skip ${tenant.name} (${geo}) — Waktu lokal: ${localHour.toString().padStart(2, '0')}:00 (Target: 06:00)`);
        continue;
      }

      console.log(`[Auto-Discovery] Processing tenant: ${tenant.name} (niche: ${tenant.niche}, Waktu Lokal: ${localHour.toString().padStart(2, '0')}:00)`);

      // 1. Serper "News" Search untuk memancing Topik Live
      let liveNewsHeadlines = "";
      if (process.env.SERPER_API_KEY) {
        try {
          const serpRes = await axios.post(
            "https://google.serper.dev/news",
            { q: `berita terbaru trend ${tenant.niche}`, gl: geo.toLowerCase(), hl, num: 10 },
            { headers: { "X-API-KEY": process.env.SERPER_API_KEY, "Content-Type": "application/json" } }
          );
          const news = serpRes.data.news || [];
          liveNewsHeadlines = news.map((n: any) => `- ${n.title}`).join("\n");
          console.log(`[Auto-Discovery] Serper found ${news.length} live news for ${tenant.name}`);
        } catch (e: any) {
          console.warn(`[Auto-Discovery] Serper failed, fallback to pure AI imagination: ${e.message}`);
        }
      }

      // 2. Tanya AI (Gemini)
      // Tarik 10 artikel historis agar AI tidak mengulangi topik
      const history = await prisma.article.findMany({
        where: { tenantId: tenant.id },
        select: { keyword: true },
        orderBy: { createdAt: 'desc' },
        take: 10
      });
      const historyStr = history.map(h => h.keyword).join(", ");

      const promptContext = liveNewsHeadlines 
        ? `BERITA HARI INI DI NICHE INI:\n${liveNewsHeadlines}\n\nTugas: Berdasarkan berita di atas, ciptakan 5 ide keyword populer (High Search Volume) yang sangat spesifik dan menarik berbentuk 'Evergreen'.` 
        : `Tugas: Berikan 5 ide keyword tipe 'Evergreen' terpanas (High Search Volume) untuk niche ini.`;

      const aiResponse = await generateObject({
        model: geminiModel,
        schema: z.object({
          keywords: z.array(z.string()).describe("Array of 5 highly searched engaging keywords/Long-tail"),
        }),
        prompt: `Anda adalah pakar SEO Master tingkat global yang bertugas mencari ide konten.
Website ini berfokus pada Niche: "${tenant.niche}".
Target Bahasa: ${hl}.

${promptContext}

ATURAN:
1. Pastikan keyword panjang (Long-tail) berbentuk edukasi/Tips/Review populer. JANGAN hanya meliput gosip berita sesaat.
2. JANGAN ulangi keyword yang sudah pernah ditulis sebelumnya: [${historyStr}].
3. Pastikan bahasa natural (seperti apa yang diketik manusia asli di kotak pencarian Google).
Output HANYA JSON array string.
`
      });

      const candidates = aiResponse.object.keywords || [];

      if (candidates.length === 0) {
        console.log(`[Auto-Discovery] AI failed to generate keywords for ${tenant.name}`);
        continue;
      }

      // 3. Masukkan ke antrean (dengan duplicate guard)
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
            targetDate: new Date(), // Dikerjakan hari ini juga
          },
        });
        added++;
        console.log(`[Auto-Discovery] ✅ Added: "${keyword}" for ${tenant.name}`);
      }

      console.log(`[Auto-Discovery] ${tenant.name}: +${added} new keywords created via Serper+Gemini`);

    } catch (error: any) {
      console.error(`[Auto-Discovery] Error for ${tenant.name}:`, error.message);
    }
  }
}
