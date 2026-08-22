// Four cheap facts about a repository's shape — none of them a finding, all of them context `audit`
// and a human deciding what to compose next need before reading further. Each returns `undefined` or an
// empty array on a condition that is not an error (no remote, no `.github/workflows/`) rather than
// throwing, and never swallows a real error into the same silent shape — the trap this module's own
// design note calls out: a caught exception and a genuinely empty directory must not print the same
// nothing, or the reading is not distinguishable from a bug.

import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import path from "node:path";

/** Whether `git remote -v` reports anything at all — not which remote, only that one exists. */
export function hasRemote(repoRoot: string): boolean {
  const result = spawnSync("git", ["-C", repoRoot, "remote", "-v"], { encoding: "utf8" });
  return (result.stdout ?? "").trim() !== "";
}

/** `core.hooksPath`, or the implicit default git itself falls back to when nothing overrides it. */
export function hooksPath(repoRoot: string): string {
  const result = spawnSync("git", ["-C", repoRoot, "config", "core.hooksPath"], { encoding: "utf8" });
  const configured = (result.stdout ?? "").trim();
  return configured === "" ? ".git/hooks" : configured;
}

/**
 * Every workflow file under `.github/workflows/`, by reading the directory directly rather than a shell
 * glob with `2>/dev/null` swallowing the error — that pattern makes a missing directory and a genuinely
 * empty one print the identical nothing, and only one of those is a reading worth trusting.
 */
export function workflowFiles(repoRoot: string): readonly string[] {
  const dir = path.join(repoRoot, ".github", "workflows");
  let entries: readonly string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }
  return entries.filter((name) => name.endsWith(".yml") || name.endsWith(".yaml")).sort();
}

export interface ChurnEntry {
  readonly topLevel: string;
  readonly commits: number;
}

/** Commit touch-count by top-level directory (or file, for one sitting at the root), most-touched first. */
export function churnByTopLevel(repoRoot: string): readonly ChurnEntry[] {
  const result = spawnSync("git", ["-C", repoRoot, "log", "--format=", "--name-only"], { encoding: "utf8" });
  const counts = new Map<string, number>();
  for (const line of (result.stdout ?? "").split("\n")) {
    const file = line.trim();
    if (file === "") continue;
    const topLevel = file.includes("/") ? file.slice(0, file.indexOf("/")) : file;
    counts.set(topLevel, (counts.get(topLevel) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([topLevel, commits]) => ({ topLevel, commits }))
    .sort((a, b) => b.commits - a.commits || a.topLevel.localeCompare(b.topLevel));
}

export interface RepoShape {
  readonly hasRemote: boolean;
  readonly hooksPath: string;
  readonly workflowFiles: readonly string[];
  readonly churnByTopLevel: readonly ChurnEntry[];
}

export function repoShape(repoRoot: string): RepoShape {
  return {
    hasRemote: hasRemote(repoRoot),
    hooksPath: hooksPath(repoRoot),
    workflowFiles: workflowFiles(repoRoot),
    churnByTopLevel: churnByTopLevel(repoRoot),
  };
}
