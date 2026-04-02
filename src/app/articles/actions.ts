"use server";

import { prisma } from "@/lib/prisma";
import { checkDuplicateKeyword } from "@/lib/duplicate-guard";
import { revalidatePath } from "next/cache";

export async function addManualKeyword(formData: FormData) {
  const keyword = (formData.get("keyword") as string)?.trim();
  const tenantId = formData.get("tenantId") as string;
  const targetDate = formData.get("targetDate") as string;

  if (!keyword || !tenantId) {
    return { success: false, error: "Keyword dan Tenant wajib diisi." };
  }

  // Duplicate Guard: Cek cannibalization per tenant
  const dupCheck = await checkDuplicateKeyword(keyword, tenantId);
  if (dupCheck.isDuplicate) {
    return {
      success: false,
      error: `⚠️ Keyword terlalu mirip dengan "${dupCheck.matchedKeyword}" (status: ${dupCheck.matchedStatus}). Ganti keyword agar tidak saling bunuh di Google.`,
    };
  }

  await prisma.article.create({
    data: {
      keyword,
      tenantId,
      source: "MANUAL",
      status: "SCHEDULED",
      targetDate: targetDate ? new Date(targetDate) : new Date(),
    },
  });

  revalidatePath("/articles");
  return { success: true };
}
