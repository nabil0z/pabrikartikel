import TelegramBot from "node-telegram-bot-api";
import { prisma } from "./prisma";
import { uploadToR2, pushToAstroLocalPath } from "./r2";
import { submitUrlForIndexing, buildArticleUrl } from "./indexing";

const token = process.env.TELEGRAM_BOT_TOKEN || "";
let bot: TelegramBot | null = null;

if (token && process.env.NODE_ENV !== "test") {
  bot = new TelegramBot(token, { polling: false }); // Polling handled externally or start manually in worker
}

export function getBot() {
  return bot;
}

export async function sendReviewNotification(
  chatId: string, 
  messageThreadId: string | undefined, 
  articleId: string, 
  title: string, 
  previewText: string
) {
  if (!bot) return;

  const text = `
✅ <b>Draf Selesai!</b>
<b>Judul:</b> ${title}
<b>ID:</b> <code class="article-id">${articleId}</code>

<i>Preview:</i>
${previewText.substring(0, 300)}...

👉 <b>Cara Publish:</b> <i>Reply</i> pesan ini dengan <b>Foto/Gambar Thumbnail</b>, maka artikel akan langsung go-live!
`;

  try {
    const opts: any = { parse_mode: "HTML" };
    if (messageThreadId) opts.message_thread_id = parseInt(messageThreadId);
    
    await bot.sendMessage(chatId, text, opts);
  } catch (error) {
    console.error("Telegram send error:", error);
  }
}

// Logic untuk mengekstrak foto yang direply
export async function handleTelegramReply(msg: TelegramBot.Message) {
  if (!msg.reply_to_message || !msg.photo || !bot) return;

  // Cek apakah original message adalah milik bot dan ada ID artikel
  const originalText = msg.reply_to_message.text || "";
  const match = originalText.match(/ID:\s*([a-zA-Z0-9_-]+)/);
  if (!match) return;

  const articleId = match[1];

  // Ambil gambar terbesar
  const photo = msg.photo[msg.photo.length - 1];
  const fileLink = await bot.getFileLink(photo.file_id);
  
  // Download file dari TG
  const { default: axios } = await import("axios");
  const response = await axios.get(fileLink, { responseType: "arraybuffer" });
  const buffer = Buffer.from(response.data, "binary");

  try {
    const article = await prisma.article.findUnique({ 
      where: { id: articleId },
      include: { tenant: true }
    });

    bot.sendMessage(msg.chat.id, "⏳ Menyimpan gambar ke objek R2...", { 
      reply_to_message_id: msg.message_id,
      message_thread_id: msg.message_thread_id 
    });

    const customCdnUrl = article?.tenant?.cdnUrl || undefined;
    const imageUrl = await uploadToR2(buffer, `${articleId}.jpg`, customCdnUrl);

    bot.sendMessage(msg.chat.id, "✅ Tersimpan! Sedang melakukan push ke repositori Astro...", { 
      reply_to_message_id: msg.message_id,
      message_thread_id: msg.message_thread_id 
    });

    if (article && article.content) {
      // Ekstrak Title (misal pakai H1 markdown)
      const h1Match = article.content.match(/^#\s+(.*)/m);
      const title = h1Match ? h1Match[1] : article.keyword;

      // Ekstrak category dan metaDescription dari outline JSON yang disimpan Claude
      let category = article.tenant.niche;
      let metaDescription: string | undefined;
      if (article.outline) {
        try {
          const outlineData = JSON.parse(article.outline);
          if (outlineData.category) category = outlineData.category;
          if (outlineData.metaDescription) metaDescription = outlineData.metaDescription;
        } catch {}
      }

      // 1. Ekspor file MDX ke Astro localPath
      if (article.tenant.localPath) {
        await pushToAstroLocalPath(article.tenant.localPath, title, article.content, imageUrl, category, metaDescription);
      }

      // 2. Tandai sukses di DB
      await prisma.article.update({
        where: { id: articleId },
        data: {
          status: "PUBLISHED",
          featuredImage: imageUrl,
          publishedAt: new Date(),
          isEvergreen: true, // Default evergreen agar bisa di-refresh nanti
        }
      });

      // 3. Auto-submit ke Google Indexing API
      const articleUrl = buildArticleUrl(article.tenant.name, title);
      const indexResult = await submitUrlForIndexing(articleUrl);
      const indexStatus = indexResult.success ? "✅ Google Indexing: Submitted" : "⚠️ Indexing: Skip (no credentials)";

      bot.sendMessage(msg.chat.id, `🎉 <b>PUBLISHED!</b> Artikel telah dikirim ke web.\n${indexStatus}`, { 
        parse_mode: "HTML",
        reply_to_message_id: msg.message_id,
        message_thread_id: msg.message_thread_id 
      });
    }

  } catch (e: any) {
    console.error("Upload/Publish Fail:", e.message);
    bot.sendMessage(msg.chat.id, "❌ Gagal merilis: " + e.message, { 
      reply_to_message_id: msg.message_id,
      message_thread_id: msg.message_thread_id 
    });
  }
}
