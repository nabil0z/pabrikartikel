import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";
import fs from "fs";
import path from "path";

// Minimal AWS SDK v3 wrapper for Cloudflare R2
const S3 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.CF_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
  },
});

// Ukuran gambar optimal untuk SEO & web performance
const IMAGE_WIDTH = 1200; // Max width, tinggi mengikuti rasio asli admin

/**
 * Proses gambar: resize ke 1200x630, convert ke WebP, upload ke R2.
 * WebP 40-60% lebih kecil dari JPEG → page speed lebih cepat → ranking naik.
 */
export async function uploadToR2(rawBuffer: Buffer, filename: string, customCdnDomain?: string): Promise<string> {
  if (!process.env.CF_ACCOUNT_ID || !process.env.R2_BUCKET_NAME) {
    console.warn("R2 credentials missing, skipping actual R2 upload. Returning mock URL.");
    const base = customCdnDomain || "https://mock.cdn.com";
    return `${base.replace(/\/$/, '')}/${filename.replace(/\.\w+$/, '.webp')}`;
  }

  // Auto-resize + convert ke WebP
  let processedBuffer: Buffer;
  let finalFilename: string;

  try {
    processedBuffer = await sharp(rawBuffer)
      .resize({ width: IMAGE_WIDTH, withoutEnlargement: true }) // Max width 1200, rasio asli dipertahankan
      .webp({ quality: 85 })
      .toBuffer();

    finalFilename = filename.replace(/\.\w+$/, '.webp');
    console.log(`[R2] Image processed: ${rawBuffer.length} bytes → ${processedBuffer.length} bytes (WebP)`);
  } catch (err) {
    // Fallback: upload as-is jika sharp gagal
    console.warn("[R2] Sharp processing failed, uploading original");
    processedBuffer = rawBuffer;
    finalFilename = filename;
  }

  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: finalFilename,
    Body: processedBuffer,
    ContentType: finalFilename.endsWith('.webp') ? "image/webp" : "image/jpeg",
  });

  await S3.send(command);
  
  const cdnBase = customCdnDomain || process.env.R2_PUBLIC_URL || "https://img.hanyut.com";
  return `${cdnBase.replace(/\/$/, '')}/${finalFilename}`;
}

export async function pushToAstroLocalPath(
  localPath: string, 
  title: string, 
  markdownContent: string, 
  imageUrl: string,
  categoryId: string = "general",
  metaDescription?: string,
  authorName: string = "Redaksi"
) {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");
  const filePath = path.join(localPath, `${slug}.mdx`);
  
  const today = new Date().toISOString().split("T")[0];

  // Gunakan metaDescription dari Claude jika ada, fallback ke auto-truncate
  const description = metaDescription 
    ? metaDescription.replace(/"/g, '\\"')
    : markdownContent.substring(0, 150).replace(/"/g, '\\"').replace(/\n/g, ' ').replace(/#/g, '').trim() + "...";

  const frontmatter = `---
title: "${title.replace(/"/g, '\\"')}"
description: "${description}"
heroImage: "${imageUrl}"
pubDate: ${today}
updatedDate: ${today}
category: "${categoryId}"
author: "${authorName.replace(/"/g, '\\"')}"
tags: ["${categoryId.toLowerCase()}", "${slug.split("-").slice(0, 2).join('", "')}"]
---

`;

  const finalContent = frontmatter + markdownContent;
  
  if (!fs.existsSync(localPath)) {
    fs.mkdirSync(localPath, { recursive: true });
  }

  fs.writeFileSync(filePath, finalContent, "utf-8");
  console.log(`[Push Success] Written .mdx to ${filePath}`);
}
