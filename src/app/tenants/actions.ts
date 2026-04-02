"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function addTenantAction(formData: FormData) {
  const name = formData.get("name") as string;
  const niche = formData.get("niche") as string;
  const toneOfVoice = formData.get("toneOfVoice") as string;
  const targetAudience = formData.get("targetAudience") as string;
  const editorialGuidelines = formData.get("editorialGuidelines") as string;
  const writingExample = formData.get("writingExample") as string;
  const telegramTopicId = formData.get("telegramTopicId") as string;
  const cdnUrl = formData.get("cdnUrl") as string;

  const articleTypes = formData.get("articleTypes") as string;
  const localPath = formData.get("localPath") as string;

  if (!name || !niche) {
    throw new Error("Name and Niche are required.");
  }

  await prisma.tenant.create({
    data: {
      name,
      niche,
      articleTypes: articleTypes || "General",
      localPath: localPath || null,
      toneOfVoice: toneOfVoice || null,
      targetAudience: targetAudience || null,
      editorialGuidelines: editorialGuidelines || null,
      writingExample: writingExample || null,
      telegramTopicId: telegramTopicId || null,
      cdnUrl: cdnUrl || null,
    },
  });

  revalidatePath("/tenants");
  return { success: true };
}
