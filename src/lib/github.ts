import axios from "axios";

/**
 * GitHub Publishing via GitHub API
 * 
 * Mendorong file MDX langsung ke repositori GitHub via REST API.
 * Cocok untuk blog yang di-deploy otomatis via GitHub Pages / Vercel / Netlify.
 * 
 * Env vars:
 * - GITHUB_TOKEN: Personal Access Token (PAT) dengan scope "repo"
 */

interface GitHubPushResult {
  success: boolean;
  url?: string;
  message: string;
}

/**
 * Push file MDX ke repositori GitHub.
 * 
 * @param repo - Format "owner/repo" (contoh: "nabil0z/hanyut-blog")
 * @param filePath - Path file di repo (contoh: "src/content/posts/hp-murah-2026.mdx")
 * @param content - Isi file lengkap (frontmatter + markdown)
 * @param commitMessage - Pesan commit
 */
export async function pushToGitHub(
  repo: string,
  filePath: string,
  content: string,
  commitMessage: string
): Promise<GitHubPushResult> {
  const token = process.env.GITHUB_TOKEN;

  if (!token) {
    console.warn("[GitHub] GITHUB_TOKEN not configured, skipping push");
    return { success: false, message: "GITHUB_TOKEN not configured" };
  }

  try {
    // Cek apakah file sudah ada (untuk mendapatkan SHA jika update)
    let existingSha: string | undefined;
    try {
      const getRes = await axios.get(
        `https://api.github.com/repos/${repo}/contents/${filePath}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github.v3+json",
          },
        }
      );
      existingSha = getRes.data.sha;
    } catch {
      // File belum ada, lanjut create baru
    }

    // Base64 encode content
    const contentBase64 = Buffer.from(content, "utf-8").toString("base64");

    const body: any = {
      message: commitMessage,
      content: contentBase64,
      branch: "main",
    };

    // Jika file sudah ada, sertakan SHA untuk update
    if (existingSha) {
      body.sha = existingSha;
    }

    const res = await axios.put(
      `https://api.github.com/repos/${repo}/contents/${filePath}`,
      body,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github.v3+json",
        },
      }
    );

    const htmlUrl = res.data?.content?.html_url || "";
    console.log(`[GitHub] ✅ Pushed: ${filePath} to ${repo}`);
    return { success: true, url: htmlUrl, message: `Pushed to ${repo}/${filePath}` };

  } catch (error: any) {
    const errMsg = error.response?.data?.message || error.message;
    console.error(`[GitHub] ❌ Failed to push ${filePath}: ${errMsg}`);
    return { success: false, message: errMsg };
  }
}

/**
 * Build path file di dalam repo berdasarkan judul artikel.
 * Default path: src/content/posts/{slug}.mdx
 */
export function buildGitHubFilePath(title: string, basePath?: string): string {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");
  const base = basePath || "src/content/posts";
  return `${base}/${slug}.mdx`;
}
