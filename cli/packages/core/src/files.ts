// The facts about a target repository that every gate would otherwise re-derive, resolved once.

import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import type { RecordsConfig, RecordType } from "./config.ts";

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

/**
 * The directories a record type's template is searched in, nearest convention first. Exported because
 * `@entelekheia/governance-base` builds its own candidate map from this list rather than restating it —
 * two search orders would drift, and a drift here is invisible from either side because both answers look
 * like a template path.
 */
export const TEMPLATE_DIRS = ["project/templates", "templates", ".agents/templates"] as const;

/** Where a type's template could be, in search order. Generic in the type name, so `log` and any type a
 *  repository brings resolve by the same rule as the four the tooling ships. */
export function templateCandidates(type: string): readonly string[] {
  return TEMPLATE_DIRS.map((dir) => `${dir}/${type}.md`);
}

const TEMPLATE_TOKEN = /<template:([a-z][a-z0-9-]*)>/g;

/**
 * `<template:<type>>` in a declared option expands to where that type's template ACTUALLY is — what the
 * repository declared in `records.templates`, else the first candidate that exists, else the first
 * candidate so an absent template is reported against a path a reader recognises.
 *
 * It exists because the composition cannot name the path. `<plugin>/templates/adr.md` resolves to the
 * repository root in a repo laid out flat, and `setup repo` writes templates to `project/templates/`
 * — never to a root-level `templates/`. So every repository scaffolded by this tooling had its template
 * checked at a path nothing writes, the gate read the absence as "no records of that type" and reported
 * SKIP. Measured 2026-08-14 on a repository holding five stamped templates, naming all five in its own
 * config, with 43 records carrying no stamp and the composition reporting no failure at all.
 *
 * The repository's `records` declaration is what the records resolver already honours; this is what
 * carries that same declaration to the half that examines.
 */
export function expandTemplateToken(
  value: string,
  repoRoot: string,
  pluginDir: string,
  records: RecordsConfig | undefined,
  normTemplates?: Readonly<Record<string, string>>,
): string {
  if (!TEMPLATE_TOKEN.test(value)) {
    TEMPLATE_TOKEN.lastIndex = 0;
    return value;
  }
  TEMPLATE_TOKEN.lastIndex = 0;
  return value.replace(TEMPLATE_TOKEN, (_match, type: string) => {
    const declared = records?.templates?.[type as RecordType];
    if (declared !== undefined) return declared;
    // The plugin surface stays a candidate for a repository that kept templates there before Plan-033
    // moved the norm's own copies into governance packages.
    const candidates = [...templateCandidates(type), path.join(path.relative(repoRoot, pluginDir), "templates", `${type}.md`)];
    const existing = candidates.find((candidate) => existsSync(path.join(repoRoot, candidate)));
    if (existing !== undefined) return existing;
    // The activated governance package's template, LAST among real answers (ADR-0019): the repository's
    // own copy — declared or found — always wins, so a promulgated repo compares against what it holds,
    // and only a repo with no copy at all reads the norm's. Absolute, because the norm is not under
    // repoRoot; downstream readers join relative candidates but pass an absolute path through.
    const activated = normTemplates?.[type];
    if (activated !== undefined) return activated;
    return candidates[0]!;
  });
}

/**
 * The directories a record type is searched in, in order. Irregular by type — plural for some, a
 * different stem for others — so unlike templates it cannot be generated from a prefix list, and the
 * four the tooling ships are named. Exported because `@entelekheia/governance-base` builds its own
 * candidate map from this rather than restating it.
 */
export const RECORD_DIRS: Readonly<Record<string, readonly string[]>> = {
  adr: ["project/adr", "adr", "docs/adr"],
  rfc: ["project/rfc", "project/rfcs", "rfc", "rfcs", "docs/rfc"],
  plan: ["project/plans", "plans", "docs/plans"],
  task: ["project/tasks", "tasks"],
};

/**
 * Where a type's records could be, in search order. A type the map does not name — `log`, `research`,
 * and any type a repository brings — gets the generic convention, which is what makes a custom type
 * resolvable without this map growing an entry for it.
 */
export function recordDirCandidates(type: string): readonly string[] {
  return RECORD_DIRS[type] ?? [`project/${type}`, type, `docs/${type}`];
}

const RECORDS_TOKEN = /<records:([a-z][a-z0-9-]*)>/g;

/**
 * `<records:<type>>` expands to where that type's records actually live — declared `records.dirs` first,
 * then the first candidate that exists, then the first candidate.
 *
 * A declared directory is used **even when it does not exist**, deliberately. The records resolver throws
 * there, which is right for a verb about to write; here it would abort a whole gate run over a
 * misconfiguration, so the entry examines zero files against the path the repository named — visible in
 * the report, and attributable to the declaration rather than to a search that quietly went elsewhere.
 */
export function expandRecordsToken(value: string, repoRoot: string, records: RecordsConfig | undefined): string {
  if (!RECORDS_TOKEN.test(value)) {
    RECORDS_TOKEN.lastIndex = 0;
    return value;
  }
  RECORDS_TOKEN.lastIndex = 0;
  return value.replace(RECORDS_TOKEN, (_match, type: string) => {
    const declared = records?.dirs?.[type as RecordType];
    if (declared !== undefined) return declared;
    const candidates = recordDirCandidates(type);
    return candidates.find((candidate) => existsSync(path.join(repoRoot, candidate))) ?? candidates[0]!;
  });
}

/**
 * Every token an ops expands, in one place, applied to `paths` and to `options` alike.
 *
 * One expander for both is the point: `paths` was expanded and `options` was not, so the same text meant
 * two different things depending on which field it sat in, and nothing type-checked either.
 */
export function expandTokens(
  value: string,
  repoRoot: string,
  pluginDir: string,
  records: RecordsConfig | undefined,
  normTemplates?: Readonly<Record<string, string>>,
): string {
  return expandRecordsToken(
    expandTemplateToken(expandPluginToken(value, repoRoot, pluginDir), repoRoot, pluginDir, records, normTemplates),
    repoRoot,
    records,
  );
}

/**
 * Every token an ops expands in a gate's free-form `options`, applied to string values only.
 *
 * `paths` was expanded and `options` was not, which made a path inside `options` a different kind of
 * string with no help finding out — a trap this repository's own guidance had to describe in prose
 * because nothing enforced it. Expanding both here is what removes the asymmetry rather than documenting
 * it. A gate that expands `<plugin>/` itself keeps working: an already-expanded string carries no token,
 * so the second pass is a no-op.
 */
export function expandOptionTokens(
  options: Readonly<Record<string, unknown>>,
  repoRoot: string,
  pluginDir: string,
  records: RecordsConfig | undefined,
  normTemplates?: Readonly<Record<string, string>>,
): Readonly<Record<string, unknown>> {
  // Recursive, because an entry's options are not always flat: a path can sit inside an array of pairs or
  // inside a nested source object, and a token left unexpanded there resolves to a file that is not
  // there — reported as a difference rather than as a composition error.
  const walk = (value: unknown): unknown => {
    if (typeof value === "string") return expandTokens(value, repoRoot, pluginDir, records, normTemplates);
    if (Array.isArray(value)) return value.map(walk);
    if (typeof value === "object" && value !== null) {
      return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, walk(item)]));
    }
    return value;
  };
  return walk(options) as Readonly<Record<string, unknown>>;
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
