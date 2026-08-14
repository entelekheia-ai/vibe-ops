// The facts about a target repository that every gate would otherwise re-derive, resolved once.

import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

/**
 * Every file git tracks, repository-relative. One spawn per run, shared across every gate in an ops —
 * the shell runner paid for `git ls-files` once per fragment that needed it.
 */
export function trackedFiles(repoRoot: string): readonly string[] {
  const result = spawnSync("git", ["-C", repoRoot, "ls-files"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  const out = (result.stdout ?? "").trim();
  return out === "" ? [] : out.split("\n");
}

/**
 * Where the target's *plugin* surface lives — skills/, hooks/, references/, .claude-plugin/. A
 * repository that publishes a Claude Code plugin from a subdirectory (vibe-ops itself, since the CLI
 * was split out) keeps them under plugin/; one laid out flat keeps them at the root.
 *
 * The same rule check-agents-md.sh applies, and it exists here so there is one copy of it. Hardcoding
 * one layout for the other made every dogfooding pair unreachable in a flat repository once already.
 */
export function resolvePluginDir(repoRoot: string): string {
  return existsSync(path.join(repoRoot, "plugin", ".claude-plugin", "plugin.json"))
    ? path.join(repoRoot, "plugin")
    : repoRoot;
}

/**
 * Where an `artifactDir` actually is, which is not `path.resolve(repoRoot, declared)` whenever the
 * declaration starts at `.git/` — the shape this tooling's own config uses and its docs recommend.
 *
 * **In a linked working tree `.git` is a file, not a directory**, 85 bytes holding `gitdir: …`. So
 * `.git/gate-artifacts` resolves to a path *under a file*, `mkdir` raises ENOTDIR, and the emitter
 * throws. `harness sync` is the only verb that commits inside a linked working tree, so it is the only
 * caller that can hit this — and it hits it while running the *target's* gate, which makes an emission
 * failure read as the target's gate refusing a clean commit. Every other invocation of the same gate,
 * in the same repository, passes. Measured 2026-08-14, promulgating into a real repository.
 *
 * `--git-common-dir` is `.git` in an ordinary checkout and the main clone's `.git` from inside a linked
 * working tree, so the resolved path is **unchanged for every existing repository** — this moves no
 * artifacts. It is also the better answer on its own terms: every working tree of one clone accumulates
 * into the one place a drain reads.
 *
 * Only a `.git`-relative declaration pays the spawn; anything else is the plain resolve it always was.
 */
export function resolveArtifactDir(repoRoot: string, declared: string): string {
  const absolute = path.resolve(repoRoot, declared);
  const dotGit = path.join(repoRoot, ".git");
  if (absolute !== dotGit && !absolute.startsWith(`${dotGit}${path.sep}`)) return absolute;

  const result = spawnSync("git", ["-C", repoRoot, "rev-parse", "--git-common-dir"], { encoding: "utf8" });
  const common = (result.stdout ?? "").trim();
  // Not a repository, or a git too old to know the flag. The plain resolve is what this did before, and
  // it is right in the ordinary checkout that is the only place either condition can hold.
  if (result.status !== 0 || common === "") return absolute;

  return path.resolve(repoRoot, common, path.relative(dotGit, absolute));
}

/**
 * `<plugin>/` in a declared path expands to wherever the plugin surface actually is, so an ops can
 * name `<plugin>/skills/*` and be right in both layouts. Repository-relative, so it expands to
 * `plugin/skills/*` here and `skills/*` in a flat repo.
 */
export function expandPluginToken(pattern: string, repoRoot: string, pluginDir: string): string {
  if (!pattern.includes("<plugin>/")) return pattern;
  const rel = path.relative(repoRoot, pluginDir);
  return pattern.replaceAll("<plugin>/", rel === "" ? "" : `${rel}/`);
}

/** Files matching any of the patterns. `path.matchesGlob` is native, so this costs no dependency. */
export function filterByGlobs(files: readonly string[], patterns: readonly string[]): readonly string[] {
  return files.filter((file) => patterns.some((pattern) => path.matchesGlob(file, pattern)));
}

/** Files matching NONE of the patterns — the population contract's `ignore` side of `filterByGlobs`. */
export function excludeByGlobs(files: readonly string[], patterns: readonly string[]): readonly string[] {
  if (patterns.length === 0) return files;
  return files.filter((file) => !patterns.some((pattern) => path.matchesGlob(file, pattern)));
}
