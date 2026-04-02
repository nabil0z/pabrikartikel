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
  const postsPerDay = parseInt(formData.get("postsPerDay") as string) || 3;

  const articleTypes = formData.get("articleTypes") as string;
  const localPath = formData.get("localPath") as string;
  const authorName = formData.get("authorName") as string;
  const publishTarget = formData.get("publishTarget") as string;
  const githubRepo = formData.get("githubRepo") as string;
  const language = formData.get("language") as string;
  const targetCountry = formData.get("targetCountry") as string;
  const autoDiscovery = formData.get("autoDiscovery") === "on";

  if (!name || !niche) {
    throw new Error("Name and Niche are required.");
  }

  await prisma.tenant.create({
    data: {
      name,
      niche,
      authorName: authorName || "Redaksi",
      articleTypes: articleTypes || "General",
      publishTarget: publishTarget || "LOCAL",
      localPath: localPath || null,
      githubRepo: githubRepo || null,
      language: language || "id",
      targetCountry: targetCountry || "ID",
      toneOfVoice: toneOfVoice || null,
      targetAudience: targetAudience || null,
      editorialGuidelines: editorialGuidelines || null,
      writingExample: writingExample || null,
      telegramTopicId: telegramTopicId || null,
      cdnUrl: cdnUrl || null,
      postsPerDay,
      autoDiscovery,
    },
  });

  revalidatePath("/tenants");
  return { success: true };
}
