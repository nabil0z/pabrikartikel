import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["@prisma/client", "prisma", "better-sqlite3", "@prisma/adapter-better-sqlite3", "node-telegram-bot-api", "node-cron", "jsonwebtoken", "sharp", "google-trends-api"],
};

export default nextConfig;
