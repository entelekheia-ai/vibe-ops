// GH_REMOTE / GH_AUTH — the two GitHub facts only `task` needs, since a task dossier's identity depends
// on an issue. One spawn instead of the shell's two (`command -v gh` then `gh auth status`): a spawn
// failure with `error` set means the binary was never found (ENOENT), which is what "absent" means;
// a resolved spawn with a non-zero exit means gh is installed but not authenticated.

import { spawnSync } from "node:child_process";

/** The `owner/repo` slug from `origin`, stripped of protocol/host/`.git` — `undefined` when there is no
 *  `origin` remote at all, which is not an error: a repository not yet on GitHub is a normal state. */
export function githubRemote(repoRoot: string): string | undefined {
  const result = spawnSync("git", ["-C", repoRoot, "remote", "get-url", "origin"], { encoding: "utf8" });
  const url = result.stdout.trim();
  if (url === "") return undefined;
  return url
    .replace(/^git@[^:]*:/, "")
    .replace(/^https?:\/\/[^/]*\//, "")
    .replace(/\.git$/, "");
}

export type GithubAuth = "ok" | "no" | "absent";

export function githubAuth(): GithubAuth {
  const result = spawnSync("gh", ["auth", "status"], { stdio: "ignore" });
  if (result.error !== undefined) return "absent";
  return result.status === 0 ? "ok" : "no";
}
