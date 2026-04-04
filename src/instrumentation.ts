export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    console.log("[Instrumentation] Starting Pabrik Artikel Backend Worker...");
    
    // Setup Cron Jobs
    const cron = await import('node-cron');
    const { processArticleQueue } = await import('./worker/cron');
    const { processRefreshQueue } = await import('./worker/refresh');
    const { processAutoDiscovery } = await import('./worker/discovery');
    const { getBot, handleTelegramReply } = await import('./lib/telegram');

    // Menjalankan queue runner setiap 15 menit
    cron.default.schedule('*/15 * * * *', async () => {
      try {
        await processArticleQueue();
      } catch (e: any) {
        console.error("[Fatal Cron Error]", e.message);
      }
    });

    // Content Freshness Monitor — setiap 6 jam cek artikel usang
    cron.default.schedule('0 */6 * * *', async () => {
      try {
        await processRefreshQueue();
      } catch (e: any) {
        console.error("[Fatal Refresh Error]", e.message);
      }
    });

    // Auto-Discovery — setiap jam, namun proses akan dijaga (guarded) oleh waktu lokal tenant.
    cron.default.schedule('0 * * * *', async () => {
      try {
        await processAutoDiscovery();
      } catch (e: any) {
        console.error("[Fatal Discovery Error]", e.message);
      }
    });

    // Menjalankan Telebot Polling untuk menerima Thumbnail dari Admin
    const bot = getBot();
    if (bot && !(globalThis as any).__TG_POLLING_STARTED) {
      (globalThis as any).__TG_POLLING_STARTED = true;
      console.log("[Instrumentation] Starting Telegram Long Polling...");
      
      // Error handler untuk menekan pesan log 409 Conflict jika masih ada sisa sesi
      bot.on("polling_error", (error: any) => {
        if (error.code !== "ETELEGRAM") console.warn("[Telegram Polling Error]", error.message);
      });

      bot.startPolling();
      
      bot.on("message", async (msg) => {
        try {
          // Hanya tangani pesan yang berupa balasan foto
          if (msg.photo && msg.reply_to_message) {
             await handleTelegramReply(msg);
          }
        } catch (error) {
           console.error("Error handling reply", error);
        }
      });
    }

    // (Opsional) Jalankan Queue 1 kali langsung saat restart Docker
    setTimeout(() => {
      processArticleQueue().catch(() => {});
    }, 10000);
  }
}
