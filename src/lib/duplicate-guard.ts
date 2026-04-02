import { prisma } from "./prisma";

/**
 * Duplicate Keyword Guard (Per-Tenant)
 * 
 * Cek apakah keyword yang akan ditambahkan sudah ada atau terlalu mirip
 * dengan keyword lain di tenant/blog yang sama.
 * 
 * Mencegah keyword cannibalization di Google.
 */
export async function checkDuplicateKeyword(
  keyword: string,
  tenantId: string
): Promise<{ isDuplicate: boolean; matchedKeyword?: string; matchedStatus?: string }> {
  
  // Normalisasi keyword: lowercase, hilangkan tanda baca, trim
  const normalized = normalizeKeyword(keyword);

  // Ambil semua keyword yang ada di tenant ini (kecuali FAILED)
  const existingArticles = await prisma.article.findMany({
    where: {
      tenantId,
      status: { notIn: ["FAILED"] },
    },
    select: { keyword: true, status: true },
  });

  for (const article of existingArticles) {
    const existingNormalized = normalizeKeyword(article.keyword);

    // Cek 1: Exact match (setelah normalisasi)
    if (normalized === existingNormalized) {
      return { isDuplicate: true, matchedKeyword: article.keyword, matchedStatus: article.status };
    }

    // Cek 2: Satu keyword mengandung keyword lainnya (subset match)
    // Contoh: "hp murah 2026" vs "handphone murah terbaik 2026"
    if (normalized.includes(existingNormalized) || existingNormalized.includes(normalized)) {
      return { isDuplicate: true, matchedKeyword: article.keyword, matchedStatus: article.status };
    }

    // Cek 3: Kesamaan kata > 70% (word overlap)
    const similarity = calculateWordOverlap(normalized, existingNormalized);
    if (similarity >= 0.7) {
      return { isDuplicate: true, matchedKeyword: article.keyword, matchedStatus: article.status };
    }
  }

  return { isDuplicate: false };
}

/**
 * Normalisasi keyword untuk perbandingan yang fair
 */
function normalizeKeyword(keyword: string): string {
  return keyword
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "") // Hapus semua selain huruf, angka, spasi
    .replace(/\s+/g, " ")        // Gabungkan spasi ganda
    .trim();
}

/**
 * Hitung persentase kata yang overlap antara 2 keyword.
 * "hp murah 2026" vs "hp murah terbaik 2026" = 3/4 = 75% overlap
 */
function calculateWordOverlap(a: string, b: string): number {
  const wordsA = new Set(a.split(" ").filter(w => w.length > 1)); // Skip kata 1 huruf
  const wordsB = new Set(b.split(" ").filter(w => w.length > 1));

  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  let overlap = 0;
  for (const word of wordsA) {
    if (wordsB.has(word)) overlap++;
  }

  // Gunakan set yang lebih kecil sebagai pembagi (agar "hp murah" match "hp murah terbaik 2026")
  const minSize = Math.min(wordsA.size, wordsB.size);
  return overlap / minSize;
}
