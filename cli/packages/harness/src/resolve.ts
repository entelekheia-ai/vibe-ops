// `harness resolve` — where this target's harness surfaces are.
//
// Written last of the module's verbs and deliberately so: it waited on Plan-027 Track 1, because four
// verbs already shared one resolver and had diverged, and adding a fifth before that was settled would
// have added the defect that plan existed to remove. Track 1 decided the noun is the spelling, which
// makes this unambiguous — a verb on `harness`, no `--type`, answering only for the noun it sits under.
//
// It does NOT print through `formatResolved`. That function answers "where does a record type live", in
// keys about directories, templates and numbering; a harness resolution shares none of them. Routing this
// through it would mean one function with two disjoint output sets selected by a discriminant — which is
// the coupling Track 1 removed, wearing the costume of the convergence it created.

import { existsSync, lstatSync, readdirSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { MANAGED_FILENAME, STATE_FILENAME } from "@entelekheia/vibe-ops-core";
import type { VibeOpsConfig } from "@entelekheia/vibe-ops-core";

export interface Surface {
  /** Repository-relative, always — a resolution that printed an absolute path would leak one machine. */
  readonly path: string;
  readonly present: boolean;
  /** What is there, when the count is the interesting part: rules in a directory, symlinks in a bridge. */
  readonly detail?: string;
}

export interface ResolvedHarness {
  readonly root: string;
  readonly rules: Surface;
  readonly bridge: Surface;
  readonly hook: Surface;
  readonly entrypoint: Surface;
  readonly runner: Surface;
  readonly config: Surface;
  readonly configLocal: Surface;
  /** The managed layer (RFC-0004): the configuration a tool writes, committed at the toplevel. */
  readonly managed: Surface;
  /** The retired state layer. Present means `leave`: never read, retired by the next `harness sync`. */
  readonly state: Surface;
  /** Where observations go, from config. Absent disables emission entirely, which is a state and not a gap. */
  readonly artifactDir?: string;
  /** Where git looks for hooks — `.git/hooks` unless the repository moved it. */
  readonly hooksPath: string;
}

function surface(repoRoot: string, rel: string, detail?: (absolute: string) => string | undefined): Surface {
  const absolute = path.join(repoRoot, rel);
  const present = existsSync(absolute);
  return { path: rel, present, detail: present ? detail?.(absolute) : undefined };
}

function markdownCount(dir: string): string | undefined {
  const files = readdirSync(dir).filter((name) => name.endsWith(".md"));
  return `${files.length} rule(s)`;
}

/**
 * A bridge entry is only doing its job if it is a symlink. A repository that copied the file instead has
 * a bridge that silently stops tracking its source, which looks identical from a directory listing — so
 * the count that matters here is the symlink count, not the file count.
 */
function bridgeDetail(dir: string): string | undefined {
  const entries = readdirSync(dir);
  const links = entries.filter((name) => lstatSync(path.join(dir, name)).isSymbolicLink());
  return links.length === entries.length
    ? `${links.length} symlink(s)`
    : `${links.length} symlink(s) of ${entries.length} entries — the rest are copies and will not track their source`;
}

export function resolveHarness(repoRoot: string, config: VibeOpsConfig): ResolvedHarness {
  const hooksPath = (() => {
    const result = spawnSync("git", ["-C", repoRoot, "config", "core.hooksPath"], { encoding: "utf8" });
    const declared = (result.stdout ?? "").trim();
    return declared === "" ? ".git/hooks" : declared;
  })();

  return {
    root: repoRoot,
    rules: surface(repoRoot, ".agents/rules", markdownCount),
    bridge: surface(repoRoot, ".claude/rules", bridgeDetail),
    hook: surface(repoRoot, path.join(hooksPath === ".git/hooks" ? ".githooks" : hooksPath, "pre-commit")),
    entrypoint: surface(repoRoot, "scripts/check.sh"),
    runner: surface(repoRoot, "scripts/checks/_run.sh"),
    config: surface(repoRoot, "vibeops.config.ts"),
    configLocal: surface(repoRoot, "vibeops.config.local.ts"),
    managed: surface(repoRoot, MANAGED_FILENAME),
    state: surface(repoRoot, STATE_FILENAME, () => "leave — retired, never read; the next harness sync moves its map into the managed file and deletes it"),
    artifactDir: config.artifactDir,
    hooksPath,
  };
}

export function formatResolvedHarness(resolved: ResolvedHarness): string[] {
  const line = (key: string, one: Surface): string =>
    `${key}=${one.present ? one.path + (one.detail === undefined ? "" : ` (${one.detail})`) : "(none)"}`;

  return [
    line("RULES", resolved.rules),
    line("BRIDGE", resolved.bridge),
    `HOOKS_PATH=${resolved.hooksPath}`,
    line("HOOK", resolved.hook),
    line("ENTRYPOINT", resolved.entrypoint),
    line("RUNNER", resolved.runner),
    line("CONFIG", resolved.config),
    line("CONFIG_LOCAL", resolved.configLocal),
    line("MANAGED", resolved.managed),
    line("STATE", resolved.state),
    `ARTIFACTS=${resolved.artifactDir ?? "(none — emission is off)"}`,
  ];
}
