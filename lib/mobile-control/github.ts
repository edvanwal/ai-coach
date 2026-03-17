type GitHubConfig = {
  owner: string;
  repo: string;
  token: string;
  baseBranch: string;
};

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

async function ghFetch(path: string, init?: RequestInit): Promise<Response> {
  const { token } = getGitHubConfig();
  return fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
}

async function requireOk(res: Response): Promise<void> {
  if (res.ok) return;
  const text = await res.text().catch(() => "");
  throw new Error(`GitHub API fout (${res.status}): ${text || res.statusText}`);
}

async function getBaseSha(): Promise<string> {
  const { owner, repo, baseBranch } = getGitHubConfig();
  const res = await ghFetch(`/repos/${owner}/${repo}/git/ref/heads/${baseBranch}`);
  await requireOk(res);
  const data = (await res.json()) as { object?: { sha?: string } };
  const sha = data.object?.sha;
  if (!sha) throw new Error("Base SHA niet gevonden");
  return sha;
}

async function createBranch(branchName: string, sha: string): Promise<void> {
  const { owner, repo } = getGitHubConfig();
  const res = await ghFetch(`/repos/${owner}/${repo}/git/refs`, {
    method: "POST",
    body: JSON.stringify({ ref: `refs/heads/${branchName}`, sha }),
  });

  // Als hij al bestaat, is dat ok.
  if (res.status === 422) return;
  await requireOk(res);
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
  const existing = await ghFetch(
    `/repos/${owner}/${repo}/contents/${encodeURIComponent(params.path)}?ref=${encodeURIComponent(params.branchName)}`
  );
  if (existing.ok) {
    const obj = (await existing.json()) as { sha?: string };
    sha = obj.sha;
  }

  const res = await ghFetch(`/repos/${owner}/${repo}/contents/${encodeURIComponent(params.path)}`, {
    method: "PUT",
    body: JSON.stringify({
      message: params.message,
      content: encoded,
      branch: params.branchName,
      ...(sha ? { sha } : {}),
    }),
  });
  await requireOk(res);
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

  const prRes = await ghFetch(`/repos/${owner}/${repo}/pulls`, {
    method: "POST",
    body: JSON.stringify({
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
    }),
  });
  await requireOk(prRes);
  const pr = (await prRes.json()) as { html_url?: string };
  if (!pr.html_url) throw new Error("PR URL ontbreekt");
  return { prUrl: pr.html_url, branchName };
}

