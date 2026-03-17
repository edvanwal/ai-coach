type GitHubConfig = {
  owner: string;
  repo: string;
  token: string;
  baseBranch: string;
};

import https from "https";

const httpsAgent = new https.Agent({ keepAlive: true });

function getGitHubConfig(): GitHubConfig {
  const token = process.env.GITHUB_TOKEN ?? "";
  const owner = process.env.GITHUB_OWNER ?? "edvanwal";
  const repo = process.env.GITHUB_REPO ?? "ai-coach";
  const baseBranch = process.env.GITHUB_BASE_BRANCH ?? "main";

  if (!token) {
    throw new Error("GITHUB_TOKEN ontbreekt");
  }
  return { owner, repo, token, baseBranch };
}

async function ghRequest<T>(params: {
  method: "GET" | "POST" | "PUT";
  path: string;
  body?: unknown;
}): Promise<{ status: number; data?: T; text?: string }> {
  const { token } = getGitHubConfig();
  const url = new URL(`https://api.github.com${params.path}`);
  const payload = params.body ? JSON.stringify(params.body) : undefined;

  const attemptOnce = () =>
    new Promise<{ status: number; data?: T; text?: string }>((resolve, reject) => {
      const req = https.request(
        {
          method: params.method,
          hostname: url.hostname,
          path: url.pathname + url.search,
          agent: httpsAgent,
          headers: {
            Accept: "application/vnd.github+json",
            Authorization: `Bearer ${token}`,
            "User-Agent": "ai-coach-mobile-control",
            "X-GitHub-Api-Version": "2022-11-28",
            "Content-Type": "application/json",
            ...(payload ? { "Content-Length": Buffer.byteLength(payload) } : {}),
          },
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
          res.on("end", () => {
            const text = Buffer.concat(chunks).toString("utf8");
            const status = res.statusCode ?? 0;
            if (!text) return resolve({ status });
            try {
              const data = JSON.parse(text) as T;
              resolve({ status, data });
            } catch {
              resolve({ status, text });
            }
          });
        }
      );
      req.on("error", reject);
      req.setTimeout(12_000, () => req.destroy(new Error("timeout")));
      if (payload) req.write(payload);
      req.end();
    });

  // Retries voor sporadische TLS/egress issues op serverless.
  const maxAttempts = 3;
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await attemptOnce();
    } catch (err) {
      lastErr = err;
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 400 * attempt));
        continue;
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("GitHub request faalde");
}

function requireOk(status: number, text?: string): void {
  if (status >= 200 && status < 300) return;
  throw new Error(`GitHub API fout (${status}): ${text ?? "onbekend"}`);
}

async function getBaseSha(): Promise<string> {
  const { owner, repo, baseBranch } = getGitHubConfig();
  const res = await ghRequest<{ object?: { sha?: string } }>({
    method: "GET",
    path: `/repos/${owner}/${repo}/git/ref/heads/${baseBranch}`,
  });
  requireOk(res.status, res.text);
  const sha = res.data?.object?.sha;
  if (!sha) throw new Error("Base SHA niet gevonden");
  return sha;
}

async function createBranch(branchName: string, sha: string): Promise<void> {
  const { owner, repo } = getGitHubConfig();
  const res = await ghRequest({
    method: "POST",
    path: `/repos/${owner}/${repo}/git/refs`,
    body: { ref: `refs/heads/${branchName}`, sha },
  });

  // Als hij al bestaat, is dat ok.
  if (res.status === 422) return;
  requireOk(res.status, res.text);
}

async function upsertFile(params: {
  branchName: string;
  path: string;
  contentUtf8: string;
  message: string;
}): Promise<void> {
  const { owner, repo } = getGitHubConfig();
  const encoded = Buffer.from(params.contentUtf8, "utf8").toString("base64");

  // Bestaande SHA ophalen (als file al bestaat op branch)
  let sha: string | undefined;
  const existing = await ghRequest<{ sha?: string }>({
    method: "GET",
    path: `/repos/${owner}/${repo}/contents/${encodeURIComponent(params.path)}?ref=${encodeURIComponent(params.branchName)}`,
  });
  if (existing.status >= 200 && existing.status < 300) {
    sha = existing.data?.sha;
  }

  const res = await ghRequest({
    method: "PUT",
    path: `/repos/${owner}/${repo}/contents/${encodeURIComponent(params.path)}`,
    body: {
      message: params.message,
      content: encoded,
      branch: params.branchName,
      ...(sha ? { sha } : {}),
    },
  });
  requireOk(res.status, res.text);
}

export async function createMobileBuildPr(params: {
  runId: string;
  commandText: string;
  sender?: string;
}): Promise<{ prUrl: string; branchName: string }> {
  const { owner, repo, baseBranch } = getGitHubConfig();
  const baseSha = await getBaseSha();
  const branchName = `mobile/${params.runId.toLowerCase()}`;

  await createBranch(branchName, baseSha);

  const now = new Date().toISOString();
  const filePath = `docs/mobile-builds/${params.runId}.md`;
  const content = [
    `# Mobile build – ${params.runId}`,
    "",
    `- Tijd: ${now}`,
    `- Afzender: ${params.sender ?? "(onbekend)"}`,
    "",
    "## Opdracht",
    params.commandText,
    "",
    "## Notitie",
    "Deze PR is automatisch aangemaakt vanuit mobile control.",
    "",
  ].join("\n");

  await upsertFile({
    branchName,
    path: filePath,
    contentUtf8: content,
    message: `mobile: start build ${params.runId}`,
  });

  const prRes = await ghRequest<{ html_url?: string }>({
    method: "POST",
    path: `/repos/${owner}/${repo}/pulls`,
    body: {
      title: `Mobile build: ${params.runId}`,
      head: branchName,
      base: baseBranch,
      body: [
        "Automatisch aangemaakt vanuit WhatsApp/mobile control.",
        "",
        `Run: ${params.runId}`,
        "",
        "Opdracht:",
        params.commandText,
      ].join("\n"),
      draft: true,
    },
  });
  requireOk(prRes.status, prRes.text);
  const prUrl = prRes.data?.html_url;
  if (!prUrl) throw new Error("PR URL ontbreekt");
  return { prUrl, branchName };
}

