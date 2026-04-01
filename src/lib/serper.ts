import axios from "axios";

export async function scrapeSerpData(keyword: string) {
  if (!process.env.SERPER_API_KEY) {
    console.warn("SERPER_API_KEY missing, using mock data for MVP");
    return ["Mock fact 1", "Mock fact 2"];
  }

  const data = JSON.stringify({
    q: keyword,
    gl: "id", // Google Indonesia
    hl: "id", // Language Indonesian
    num: 5,   // Ambil 5 teratas
  });

  try {
    const config = {
      method: 'post',
      url: 'https://google.serper.dev/search',
      headers: { 
        'X-API-KEY': process.env.SERPER_API_KEY, 
        'Content-Type': 'application/json'
      },
      data: data
    };
    
    const response = await axios(config);
    const topUrls = response.data.organic.map((r: any) => r.link);
    
    // Note: Di produksi asli yang lebih berat, kita akan mengambil teks asli dari 5 URL ini 
    // menggunakan Cheerio. Untuk MVP stabilitas awal dan karena SERP description Serper
    // seringkali sudah memuat jawaban E-A-A-T yang relevan, kita bisa memberikan snippet saja
    // ke Claude agar ia membaca rangkuman langsung (jauh lebih hemat resource VPS).
    const extractedFacts = response.data.organic.map((r: any) => `Title: ${r.title}\nSnippet: ${r.snippet}`);

    return extractedFacts;

  } catch (error) {
    console.error("Serper API Error:", error);
    throw new Error("Gagal mengambil data SERP.");
  }
}
