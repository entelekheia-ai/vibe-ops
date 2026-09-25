// Where a reference written in a document points, as the REPOSITORY sees it rather than as the disk does.
//
// A gate that resolved a link with `existsSync(path.join(repoRoot, target))` answered a question about the
// working tree, while its contract spoke of the repository — and the two agree only in the checkout where
// every ignored and untracked file happens to sit on disk. The same commit then got opposite verdicts: a
// link into a git-ignored sibling folder passed in the main checkout and failed in every `git worktree`,
// which holds tracked files only; a link to an untracked draft passed on the author's machine and failed in
// CI. Measured 2026-09-25 at the entelekheia root: 0 unresolved links in the main checkout, 34 in a worktree
// of the same commit (vibe-ops#41).
//
// So there is one classifier, here, and every gate that resolves a target reads it — five gates each
// deciding with their own `existsSync` would be five divergent answers to one question.

import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

/**
 * - `tracked` — in the index (so a pre-commit run sees a file staged a moment ago), or a directory
 *   holding at least one such file. Every checkout of the commit has it.
 * - `untracked` — on disk here, known to no commit, ignored by no rule. It resolves on this machine and
 *   nowhere else, which is why it is its own state: this is the one place the author can still fix it.
 * - `ignored` — a path the repository's ignore rules exclude, whether or not it is on disk here. The
 *   repository cannot vouch for it from any checkout.
 * - `absent` — none of the above.
 */
export type TargetState = "tracked" | "untracked" | "ignored" | "absent";

/**
 * What the repository declares about targets it ignores — `targets` at the top of `vibeops.config`, or in
 * one ops's `settings` slice, which wins for that ops.
 *
 * - `report` (the default) — an ignored target is a finding of its own, under a rule the repository can
 *   level or ignore like any other.
 * - `follow` — the repository means it: resolve the target on disk, in the MAIN working tree, because a
 *   linked one never holds an ignored path. A workspace root that tracks only its own governance and links
 *   into sibling repositories is the case this exists for.
 */
export interface TargetsPolicy {
  readonly ignored?: "report" | "follow";
}

export interface TargetReading {
  readonly state: TargetState;
  /**
   * Only for `ignored` under `follow`: whether the target exists in the main working tree. Absent
   * otherwise — for the other states the state itself is the answer.
   */
  readonly followed?: { readonly exists: boolean; readonly where: string };
}

export interface TargetResolver {
  readonly policy: Required<TargetsPolicy>;
  /** `relative` is repository-relative, already normalized — no leading `/`, no `..`. */
  classify(relative: string): TargetReading;
}

/**
 * Built once per run by the ops (beside the document store) and lazy in the same way: a run that never
 * classifies a target pays no spawn.
 *
 * **Outside a git repository the disk is the only witness**, so the answer degrades to `tracked` for what
 * exists and `absent` for what does not — exactly what the gates answered before this existed, which keeps
 * every fixture built in a bare temporary directory meaning what it meant.
 */
export function createTargetResolver(repoRoot: string, policy: TargetsPolicy = {}): TargetResolver {
  const effective: Required<TargetsPolicy> = { ignored: policy.ignored ?? "report" };
  let index: { files: Set<string>; dirs: Set<string> } | null | undefined;
  let mainWorktree: string | null | undefined;
  const memo = new Map<string, TargetReading>();

  const loadIndex = (): { files: Set<string>; dirs: Set<string> } | null => {
    if (index !== undefined) return index;
    // `--cached` is the index, not HEAD: a file staged for the commit being attempted is tracked for it.
    const result = spawnSync("git", ["-C", repoRoot, "ls-files", "--cached", "-z"], {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });
    if (result.status !== 0) return (index = null);
    const files = new Set(result.stdout.split("\0").filter((f) => f !== ""));
    const dirs = new Set<string>();
    for (const file of files) {
      for (let dir = path.posix.dirname(file); dir !== "."; dir = path.posix.dirname(dir)) {
        if (dirs.has(dir)) break;
        dirs.add(dir);
      }
    }
    return (index = { files, dirs });
  };

  const isIgnored = (relative: string): boolean => {
    // `--no-index` matches the rules against the path itself, so a target that is not on disk here — the
    // whole point in a linked working tree — is classified the same as one that is.
    const result = spawnSync("git", ["-C", repoRoot, "check-ignore", "-q", "--no-index", "--", relative]);
    return result.status === 0;
  };

  const loadMainWorktree = (): string | null => {
    if (mainWorktree !== undefined) return mainWorktree;
    // The first record of `worktree list` is the main working tree in every checkout of the clone — the
    // linked ones included. A bare main has no files to follow into, so it is no answer.
    const result = spawnSync("git", ["-C", repoRoot, "worktree", "list", "--porcelain"], { encoding: "utf8" });
    const first = (result.stdout ?? "").split("\n\n")[0] ?? "";
    const line = first.split("\n").find((l) => l.startsWith("worktree "));
    const bare = first.split("\n").includes("bare");
    return (mainWorktree = result.status === 0 && line !== undefined && !bare ? line.slice("worktree ".length) : null);
  };

  const classifyUncached = (relative: string): TargetReading => {
    const tracked = loadIndex();
    if (tracked === null) return { state: existsSync(path.join(repoRoot, relative)) ? "tracked" : "absent" };
    if (tracked.files.has(relative) || tracked.dirs.has(relative)) return { state: "tracked" };
    if (isIgnored(relative)) {
      if (effective.ignored === "report") return { state: "ignored" };
      const main = loadMainWorktree();
      const where = path.join(main ?? repoRoot, relative);
      return { state: "ignored", followed: { exists: main !== null && existsSync(where), where } };
    }
    return { state: existsSync(path.join(repoRoot, relative)) ? "untracked" : "absent" };
  };

  return {
    policy: effective,
    classify(relative: string): TargetReading {
      const key = relative.replace(/\/+$/, "");
      // The repository root itself — a link to `./` from the top level.
      if (key === "") return { state: "tracked" };
      let reading = memo.get(key);
      if (reading === undefined) memo.set(key, (reading = classifyUncached(key)));
      return reading;
    },
  };
}
