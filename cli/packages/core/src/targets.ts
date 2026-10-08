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

import { existsSync, realpathSync } from "node:fs";
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
  // Refused by name: anything but "report" used to read as follow, so a typo passed every ignored link.
  const ignored = policy.ignored ?? "report";
  if (ignored !== "report" && ignored !== "follow") {
    throw new Error(`targets.ignored must be "report" or "follow", not ${JSON.stringify(ignored)}`);
  }
  const effective: Required<TargetsPolicy> = { ignored };
  const env = gitEnvFor(repoRoot);
  let index: { files: Set<string>; dirs: Set<string> } | null | undefined;
  let mainWorktree: string | null | undefined;
  const memo = new Map<string, TargetReading>();

  const loadIndex = (): { files: Set<string>; dirs: Set<string> } | null => {
    if (index !== undefined) return index;
    // `--cached` is the index, not HEAD: a file staged for the commit being attempted is tracked for it.
    const result = spawnSync("git", ["-C", repoRoot, "ls-files", "--cached", "-z"], {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      env,
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

  /**
   * `--no-index` matches the rules against the path itself, so a target that is not on disk here — the
   * whole point in a linked working tree — is classified the same as one that is. The path is tried a
   * second time with a trailing `/`: a directory-only rule (`build/`, the most common form) matches a
   * bare name only when git can see a directory there, which a linked worktree cannot.
   *
   * `unknown` is git declining to answer — exit 128 for a path inside a submodule or beyond a symbolic
   * link. Neither is a file anyone can `git add`, so the caller falls back to the disk.
   */
  const ignoreState = (relative: string): "ignored" | "not" | "unknown" => {
    const probe = (p: string) => spawnSync("git", ["-C", repoRoot, "check-ignore", "-q", "--no-index", "--", p], { env }).status;
    const plain = probe(relative);
    if (plain === 0) return "ignored";
    if (plain !== 1) return "unknown";
    return probe(`${relative}/`) === 0 ? "ignored" : "not";
  };

  const loadMainWorktree = (): string | null => {
    if (mainWorktree !== undefined) return mainWorktree;
    // The first record of `worktree list` is the main working tree in every checkout of the clone — the
    // linked ones included. A bare main has no files to follow into, so it is no answer.
    const result = spawnSync("git", ["-C", repoRoot, "worktree", "list", "--porcelain"], { encoding: "utf8", env });
    const first = (result.stdout ?? "").split("\n\n")[0] ?? "";
    const line = first.split("\n").find((l) => l.startsWith("worktree "));
    const bare = first.split("\n").includes("bare");
    if (result.status !== 0 || line === undefined || bare) return (mainWorktree = null);
    // A `repoRoot` below the toplevel keeps its prefix in the main worktree too — targets are relative to it.
    const prefix = spawnSync("git", ["-C", repoRoot, "rev-parse", "--show-prefix"], { encoding: "utf8", env }).stdout ?? "";
    return (mainWorktree = path.join(line.slice("worktree ".length), prefix.trim()));
  };

  const classifyUncached = (relative: string): TargetReading => {
    const tracked = loadIndex();
    if (tracked === null) return { state: existsSync(path.join(repoRoot, relative)) ? "tracked" : "absent" };
    if (tracked.files.has(relative) || tracked.dirs.has(relative)) return { state: "tracked" };
    const ignoredBy = ignoreState(relative);
    if (ignoredBy === "ignored") {
      if (effective.ignored === "report") return { state: "ignored" };
      const main = loadMainWorktree();
      const where = path.join(main ?? repoRoot, relative);
      return { state: "ignored", followed: { exists: main !== null && existsSync(where), where } };
    }
    const onDisk = existsSync(path.join(repoRoot, relative));
    if (ignoredBy === "unknown") return { state: onDisk ? "tracked" : "absent" };
    return { state: onDisk ? "untracked" : "absent" };
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

/**
 * The environment every spawn above runs in. A git hook exports `GIT_DIR` and `GIT_INDEX_FILE`, and they
 * override `-C`: from a linked worktree's pre-commit they are absolute, so a resolver built for any other
 * directory — every `--self-test` fixture — would read the hook repository's index instead (the class of
 * vibe-ops#36). The inherited environment is kept only when it names this repository's own git dir,
 * because there it is the point: a partial commit's temporary index is what the commit will contain.
 * Scrubbed with `git rev-parse --local-env-vars`, the list `man githooks` prescribes for this case.
 */
function gitEnvFor(repoRoot: string): NodeJS.ProcessEnv {
  if (process.env["GIT_DIR"] === undefined) return process.env;
  const listed = spawnSync("git", ["rev-parse", "--local-env-vars"], { encoding: "utf8" }).stdout ?? "";
  const local = listed.split("\n").filter((v) => v !== "");
  const scrubbed: NodeJS.ProcessEnv = { ...process.env };
  for (const name of local.length > 0 ? local : ["GIT_DIR", "GIT_INDEX_FILE", "GIT_WORK_TREE", "GIT_COMMON_DIR", "GIT_PREFIX"]) {
    delete scrubbed[name];
  }
  const own = spawnSync("git", ["-C", repoRoot, "rev-parse", "--absolute-git-dir"], { encoding: "utf8", env: scrubbed });
  const real = (p: string): string => {
    try {
      return realpathSync(p);
    } catch {
      return p;
    }
  };
  const inherited = real(path.resolve(process.env["GIT_DIR"]));
  return own.status === 0 && real(own.stdout.trim()) === inherited ? process.env : scrubbed;
}
