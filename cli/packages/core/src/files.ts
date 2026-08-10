// The two facts about a target repository that every gate would otherwise re-derive, resolved once.

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
