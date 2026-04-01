export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    console.log("[Instrumentation] Starting Pabrik Artikel Backend Worker...");
    
    // Setup Cron Jobs
    const cron = await import('node-cron');
    const { processArticleQueue } = await import('./worker/cron');
    const { getBot, handleTelegramReply } = await import('./lib/telegram');

    // Menjalankan queue runner setiap 15 menit
    // ("*/15 * * * *")
    cron.default.schedule('*/15 * * * *', async () => {
      try {
        await processArticleQueue();
      } catch (e: any) {
        console.error("[Fatal Cron Error]", e.message);
      }
    });

    // Menjalankan Telebot Polling untuk menerima Thumbnail dari Admin
    const bot = getBot();
    if (bot) {
      console.log("[Instrumentation] Starting Telegram Long Polling...");
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
