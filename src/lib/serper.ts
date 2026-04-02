import axios from "axios";

const JINA_READER_BASE = "https://r.jina.ai/";

/**
 * Scrape SERP data + deep content dari halaman kompetitor.
 * Flow: Serper.dev → URL teratas → Jina.ai Reader → Full markdown content
 */
export async function scrapeSerpData(keyword: string): Promise<string[]> {
  if (!process.env.SERPER_API_KEY) {
    console.warn("[Serper] API key missing, using mock data");
    return ["Mock fact 1: This is placeholder data for development.", "Mock fact 2: Replace with real SERP data."];
  }

  try {
    // Step 1: Ambil 10 hasil teratas dari Google via Serper
    const serpRes = await axios.post(
      "https://google.serper.dev/search",
      { q: keyword, gl: "id", hl: "id", num: 10 },
      { headers: { "X-API-KEY": process.env.SERPER_API_KEY, "Content-Type": "application/json" } }
    );

    const organicResults = serpRes.data.organic || [];
    console.log(`[Serper] Found ${organicResults.length} results for "${keyword}"`);

    // Step 2: Deep scrape top 5 URL via Jina.ai Reader (gratis, bypass Cloudflare)
    const deepFacts: string[] = [];
    const urlsToScrape = organicResults.slice(0, 5);

    for (const result of urlsToScrape) {
      try {
        console.log(`[Jina] Scraping: ${result.link}`);
        const jinaRes = await axios.get(`${JINA_READER_BASE}${result.link}`, {
          headers: { 
            "Accept": "text/plain",
            "X-Return-Format": "text",
          },
          timeout: 15000, // 15 detik timeout per URL
        });

        // Ambil maksimal 3000 karakter per halaman (sudah cukup untuk context)
        const content = (jinaRes.data as string).substring(0, 3000);
        deepFacts.push(
          `SOURCE: ${result.title}\nURL: ${result.link}\nCONTENT:\n${content}\n---`
        );
      } catch (scrapeErr: any) {
        // Jika gagal scrape, fallback ke snippet Serper
        console.warn(`[Jina] Failed to scrape ${result.link}: ${scrapeErr.message}`);
        deepFacts.push(
          `SOURCE: ${result.title}\nSNIPPET: ${result.snippet}\n---`
        );
      }
    }

    // Step 3: Tambahkan juga People Also Ask jika tersedia (gold mine untuk FAQ)
    const paaQuestions: string[] = [];
    if (serpRes.data.peopleAlsoAsk) {
      for (const paa of serpRes.data.peopleAlsoAsk.slice(0, 5)) {
        paaQuestions.push(`Q: ${paa.question}\nA: ${paa.snippet || "N/A"}`);
      }
    }

    if (paaQuestions.length > 0) {
      deepFacts.push(`\nPEOPLE ALSO ASK (Gunakan untuk FAQ section):\n${paaQuestions.join("\n\n")}`);
    }

    // Step 4: Related searches untuk LSI keywords
    if (serpRes.data.relatedSearches) {
      const related = serpRes.data.relatedSearches.map((r: any) => r.query).join(", ");
      deepFacts.push(`\nRELATED SEARCHES (Sisipkan secara natural): ${related}`);
    }

    console.log(`[Serper+Jina] Total deep facts collected: ${deepFacts.length} blocks`);
    return deepFacts;

  } catch (error: any) {
    console.error("[Serper] API Error:", error.message);
    throw new Error("Gagal mengambil data SERP: " + error.message);
  }
}
