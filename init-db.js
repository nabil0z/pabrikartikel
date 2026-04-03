/**
 * init-db.js — Membuat tabel SQLite jika belum ada.
 * Dijalankan oleh start.sh sebelum server Next.js menyala.
 * Menggunakan better-sqlite3 yang sudah ada di container.
 */
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const envUrl = process.env.DATABASE_URL || 'file:/app/data/pabrik.db';
const dbPath = envUrl.replace('file:', '');

// Pastikan folder /app/data ada
const dir = path.dirname(dbPath);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

console.log(`[init-db] Opening database: ${dbPath}`);
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS Tenant (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  niche TEXT NOT NULL,
  articleTypes TEXT NOT NULL DEFAULT 'Listicle, Tutorial, Review',
  publishTarget TEXT NOT NULL DEFAULT 'LOCAL',
  localPath TEXT,
  githubRepo TEXT,
  frontmatter TEXT,
  postsPerDay INTEGER NOT NULL DEFAULT 3,
  autoDiscovery INTEGER NOT NULL DEFAULT 1,
  language TEXT NOT NULL DEFAULT 'id',
  targetCountry TEXT NOT NULL DEFAULT 'ID',
  authorName TEXT NOT NULL DEFAULT 'Redaksi',
  toneOfVoice TEXT,
  targetAudience TEXT,
  editorialGuidelines TEXT,
  writingExample TEXT,
  telegramTopicId TEXT,
  cdnUrl TEXT,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS Article (
  id TEXT PRIMARY KEY NOT NULL,
  tenantId TEXT NOT NULL,
  keyword TEXT NOT NULL,
  title TEXT,
  outline TEXT,
  content TEXT,
  featuredImage TEXT,
  status TEXT NOT NULL DEFAULT 'SCHEDULED',
  source TEXT NOT NULL DEFAULT 'AUTO',
  targetDate DATETIME,
  publishedAt DATETIME,
  retryCount INTEGER NOT NULL DEFAULT 0,
  errorLog TEXT,
  isEvergreen INTEGER NOT NULL DEFAULT 0,
  lastRefreshedAt DATETIME,
  isLockedFromRefresh INTEGER NOT NULL DEFAULT 0,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenantId) REFERENCES Tenant(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS SeasonalEvent (
  id TEXT PRIMARY KEY NOT NULL,
  tenantId TEXT NOT NULL,
  eventName TEXT NOT NULL,
  eventDate DATETIME NOT NULL,
  targetGenDate DATETIME NOT NULL,
  keywords TEXT,
  isProcessed INTEGER NOT NULL DEFAULT 0,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenantId) REFERENCES Tenant(id) ON DELETE CASCADE
);
`);

db.close();
console.log('[init-db] Database ready!');
