import axios from "axios";

/**
 * Google Indexing API — Auto-submit URL ke Google setelah artikel published.
 * 
 * Setup yang diperlukan:
 * 1. Buat Service Account di Google Cloud Console
 * 2. Enable "Web Search Indexing API"
 * 3. Download JSON key → simpan path di GOOGLE_INDEXING_KEY_PATH
 * 4. Verify ownership di Search Console → tambahkan service account email sebagai owner
 * 
 * Env vars:
 * - GOOGLE_INDEXING_KEY_PATH: path ke service account JSON key
 *   Atau
 * - GOOGLE_INDEXING_KEY_JSON: JSON string langsung (untuk Docker)
 */

interface IndexingResult {
  success: boolean;
  url: string;
  message: string;
}

async function getAccessToken(): Promise<string | null> {
  try {
    let keyData: any;

    if (process.env.GOOGLE_INDEXING_KEY_JSON) {
      keyData = JSON.parse(process.env.GOOGLE_INDEXING_KEY_JSON);
    } else if (process.env.GOOGLE_INDEXING_KEY_PATH) {
      const fs = await import("fs");
      const raw = fs.readFileSync(process.env.GOOGLE_INDEXING_KEY_PATH, "utf-8");
      keyData = JSON.parse(raw);
    } else {
      return null;
    }

    // Create JWT for Google OAuth2
    const { default: jwt } = await import("jsonwebtoken");
    const now = Math.floor(Date.now() / 1000);

    const privateKey = keyData.private_key.replace(/\\n/g, '\n');

    const token = jwt.sign(
      {
        iss: keyData.client_email,
        scope: "https://www.googleapis.com/auth/indexing",
        aud: "https://oauth2.googleapis.com/token",
        iat: now,
        exp: now + 3600,
      },
      privateKey,
      { algorithm: "RS256" }
    );

    const res = await axios.post("https://oauth2.googleapis.com/token", {
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: token,
    });

    return res.data.access_token;
  } catch (error: any) {
    console.warn(`[Indexing] Failed to get access token: ${error.message}`);
    return null;
  }
}

/**
 * Submit URL ke Google untuk indexing instant.
 * Type: URL_UPDATED (untuk artikel baru atau update)
 */
export async function submitUrlForIndexing(url: string): Promise<IndexingResult> {
  const accessToken = await getAccessToken();

  if (!accessToken) {
    console.warn("[Indexing] No credentials configured, skipping");
    return { success: false, url, message: "No Google Indexing credentials" };
  }

  try {
    const res = await axios.post(
      "https://indexing.googleapis.com/v3/urlNotifications:publish",
      {
        url,
        type: "URL_UPDATED",
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    console.log(`[Indexing] ✅ Submitted: ${url}`);
    return { 
      success: true, 
      url, 
      message: `Indexed at ${res.data.urlNotificationMetadata?.latestUpdate?.notifyTime || "now"}` 
    };
  } catch (error: any) {
    const errMsg = error.response?.data?.error?.message || error.message;
    console.error(`[Indexing] ❌ Failed for ${url}: ${errMsg}`);
    return { success: false, url, message: errMsg };
  }
}

/**
 * Build full URL dari slug + tenant domain.
 * Domain diambil dari tenant name (e.g. "hanyut.com" → "https://hanyut.com/slug")
 */
export function buildArticleUrl(tenantName: string, title: string): string {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");
  
  // Jika tenant name sudah berupa domain
  const domain = tenantName.includes(".") 
    ? tenantName.replace(/^(https?:\/\/)?(www\.)?/, "")
    : `${tenantName}.com`;

  return `https://${domain}/${slug}`;
}
