import { execFileSync } from "node:child_process";

const owner = process.env.GITHUB_OWNER || "1174564983";
const repository =
  process.env.GITHUB_REPOSITORY_NAME || "yousheng-companion-demo";
const apiBase = `https://api.github.com/repos/${owner}/${repository}`;

const git = (args, options = {}) =>
  execFileSync("git", args, {
    cwd: process.cwd(),
    maxBuffer: 50 * 1024 * 1024,
    ...options,
  });

const credentialText = git(
  ["credential", "fill"],
  {
    input: "protocol=https\nhost=github.com\n\n",
  },
).toString("utf8");
const token = credentialText
  .split(/\r?\n/)
  .find((line) => line.startsWith("password="))
  ?.slice("password=".length);
if (!token) throw new Error("GitHub credential is unavailable");

const api = async (pathname, options = {}) => {
  const response = await fetch(`${apiBase}${pathname}`, {
    ...options,
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "user-agent": "Codex",
      "x-github-api-version": "2022-11-28",
      ...options.headers,
    },
  });
  if (!response.ok) {
    const details = await response.text();
    throw new Error(
      `GitHub API ${response.status} for ${pathname}: ${details.slice(0, 300)}`,
    );
  }
  return response.json();
};

const remoteRef = await api("/git/ref/heads/main");
const remoteSha = remoteRef.object.sha;
const remoteCommit = await api(`/git/commits/${remoteSha}`);
const localBaseTree = git(["rev-parse", "refs/remotes/origin/main^{tree}"])
  .toString("utf8")
  .trim();
if (remoteCommit.tree.sha !== localBaseTree) {
  throw new Error(
    "Remote main contains unrelated changes; refusing to overwrite it",
  );
}

const statusText = git([
  "-c",
  "core.quotepath=false",
  "diff",
  "--name-status",
  "--no-renames",
  "refs/remotes/origin/main..HEAD",
]).toString("utf8");
const changes = statusText
  .split(/\r?\n/)
  .filter(Boolean)
  .map((line) => {
    const [status, filePath] = line.split("\t", 2);
    return { status, filePath };
  });

const entries = [];
for (const change of changes) {
  if (change.status === "D") {
    entries.push({
      path: change.filePath,
      mode: "100644",
      type: "blob",
      sha: null,
    });
    console.log(`delete ${change.filePath}`);
    continue;
  }

  const blobHash = git(["rev-parse", `HEAD:${change.filePath}`])
    .toString("utf8")
    .trim();
  const content = git(["cat-file", "blob", blobHash], {
    encoding: "buffer",
  });
  const blob = await api("/git/blobs", {
    method: "POST",
    body: JSON.stringify({
      content: content.toString("base64"),
      encoding: "base64",
    }),
  });
  const treeLine = git(["ls-tree", "HEAD", "--", change.filePath])
    .toString("utf8")
    .trim();
  const mode = treeLine.split(/\s+/)[0];
  entries.push({
    path: change.filePath,
    mode,
    type: "blob",
    sha: blob.sha,
  });
  console.log(`upload ${change.filePath}`);
}

const tree = await api("/git/trees", {
  method: "POST",
  body: JSON.stringify({
    base_tree: remoteCommit.tree.sha,
    tree: entries,
  }),
});
const authorName = git(["log", "-1", "--format=%an"]).toString("utf8").trim();
const authorEmail = `${owner}@users.noreply.github.com`;
const message = git(["log", "-1", "--format=%B"]).toString("utf8").trim();
const authorDate = git(["log", "-1", "--format=%aI"]).toString("utf8").trim();
const commitDate = git(["log", "-1", "--format=%cI"]).toString("utf8").trim();
const commit = await api("/git/commits", {
  method: "POST",
  body: JSON.stringify({
    message,
    tree: tree.sha,
    parents: [remoteSha],
    author: { name: authorName, email: authorEmail, date: authorDate },
    committer: { name: authorName, email: authorEmail, date: commitDate },
  }),
});
await api("/git/refs/heads/main", {
  method: "PATCH",
  body: JSON.stringify({ sha: commit.sha, force: false }),
});

console.log(
  JSON.stringify(
    {
      remoteCommit: commit.sha,
      remoteTree: tree.sha,
      url: commit.html_url,
    },
    null,
    2,
  ),
);
