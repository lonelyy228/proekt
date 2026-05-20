#!/usr/bin/env node

const REQUIRED_CONTEXTS = ["preview-smoke", "release-gate"];
const DEFAULT_BRANCHES = ["develop", "master"];

const token = process.env.GITHUB_TOKEN;
if (!token) {
  console.error("Missing GITHUB_TOKEN. Provide a token with repository administration permissions.");
  process.exit(1);
}

const repoInput = process.argv[2] ?? process.env.GITHUB_REPOSITORY;
if (!repoInput || !repoInput.includes("/")) {
  console.error("Missing repository. Use: node scripts/setup-branch-protection.mjs <owner/repo>");
  process.exit(1);
}

const [owner, repo] = repoInput.split("/");
const dryRun = process.env.DRY_RUN === "1";
const strictBranches = process.env.STRICT_BRANCHES === "1";
const branches = (process.env.BRANCHES ?? DEFAULT_BRANCHES.join(","))
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

const apiBase = "https://api.github.com";

const headers = {
  Authorization: `Bearer ${token}`,
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "rsh-branch-protection-script"
};

async function githubRequest(path, init = {}) {
  const response = await fetch(`${apiBase}${path}`, {
    ...init,
    headers: {
      ...headers,
      ...(init.headers ?? {})
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub API ${response.status} ${response.statusText}: ${text}`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

function parseGithubApiError(error) {
  const message = typeof error?.message === "string" ? error.message : "";
  const match = message.match(/^GitHub API (\d{3})\s/);
  if (!match) {
    return null;
  }

  return Number.parseInt(match[1], 10);
}

function toReviewConfig(current) {
  return {
    dismiss_stale_reviews: current?.dismiss_stale_reviews ?? true,
    require_code_owner_reviews: current?.require_code_owner_reviews ?? false,
    required_approving_review_count: current?.required_approving_review_count ?? 1,
    require_last_push_approval: current?.require_last_push_approval ?? false
  };
}

async function updateBranchProtection(branch) {
  try {
    await githubRequest(`/repos/${owner}/${repo}/branches/${branch}`);
  } catch (error) {
    const status = parseGithubApiError(error);
    if (status === 404 && !strictBranches) {
      console.log(`Skip ${owner}/${repo}:${branch} (branch not found).`);
      return;
    }

    throw error;
  }

  let current = null;
  try {
    current = await githubRequest(`/repos/${owner}/${repo}/branches/${branch}/protection`);
  } catch (error) {
    const status = parseGithubApiError(error);
    if (status !== 404) {
      throw error;
    }
    console.log(`Branch ${branch} has no existing protection. Initializing from defaults.`);
  }

  const existingContexts = Array.isArray(current?.required_status_checks?.contexts)
    ? current.required_status_checks.contexts
    : [];
  const contexts = Array.from(new Set([...existingContexts, ...REQUIRED_CONTEXTS]));

  const payload = {
    required_status_checks: {
      strict: true,
      contexts
    },
    enforce_admins: current?.enforce_admins?.enabled ?? true,
    required_pull_request_reviews: toReviewConfig(current?.required_pull_request_reviews),
    restrictions: current?.restrictions ? { users: [], teams: [], apps: [] } : null,
    required_linear_history: current?.required_linear_history?.enabled ?? true,
    allow_force_pushes: false,
    allow_deletions: false,
    block_creations: current?.block_creations?.enabled ?? false,
    required_conversation_resolution: current?.required_conversation_resolution?.enabled ?? true,
    lock_branch: current?.lock_branch?.enabled ?? false,
    allow_fork_syncing: current?.allow_fork_syncing?.enabled ?? true
  };

  if (dryRun) {
    console.log(`[DRY_RUN] ${owner}/${repo}:${branch}`);
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  await githubRequest(`/repos/${owner}/${repo}/branches/${branch}/protection`, {
    method: "PUT",
    body: JSON.stringify(payload),
    headers: {
      "Content-Type": "application/json"
    }
  });

  console.log(`Updated branch protection for ${owner}/${repo}:${branch}`);
}

async function main() {
  console.log(`Repository: ${owner}/${repo}`);
  console.log(`Branches: ${branches.join(", ")}`);
  console.log(`Required checks: ${REQUIRED_CONTEXTS.join(", ")}`);
  console.log(`Strict branch mode: ${strictBranches ? "enabled" : "disabled"}`);

  for (const branch of branches) {
    await updateBranchProtection(branch);
  }

  console.log("Branch protection setup complete.");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
