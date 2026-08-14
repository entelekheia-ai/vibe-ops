// The built-in search order — directory, template, numbering authority — one entry per record type,
// ported field for field from plugin/scripts/resolve-governance.sh. A repository declaring nothing in
// `vibeops.config.ts`'s `records` key gets exactly this, unchanged.

import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { recordDirCandidates, templateCandidates } from "@entelekheia/vibe-ops-core";
import type { RecordType, RecordsConfig } from "@entelekheia/vibe-ops-core";

/** Built from core's own list, for the same reason CANDIDATE_TEMPLATES is: the `<records:<type>>` token
 *  an ops expands and this resolver must agree, and two search orders drift invisibly. */
export const CANDIDATE_DIRS: Readonly<Record<RecordType, readonly string[]>> = {
  adr: recordDirCandidates("adr"),
  rfc: recordDirCandidates("rfc"),
  plan: recordDirCandidates("plan"),
  task: recordDirCandidates("task"),
};

/** Built from core's own list rather than restated: the `<template:<type>>` token an ops expands and this
 *  resolver must agree, and two copies of a search order drift invisibly — both answers look like a path. */
export const CANDIDATE_TEMPLATES: Readonly<Record<RecordType, readonly string[]>> = {
  adr: templateCandidates("adr"),
  rfc: templateCandidates("rfc"),
  plan: templateCandidates("plan"),
  task: templateCandidates("task"),
};

export const DEFAULT_PAD: Readonly<Record<RecordType, number>> = { adr: 4, rfc: 4, plan: 3, task: 3 };

/**
 * How deep a record type's directory is searched for existing `.md` files, counting only the
 * directory itself as depth 1. `rfc` is 2 because an Implemented or Rejected RFC moves into a
 * subfolder and must keep owning its number — Plan-011 Track 6 gives `plan` the same depth for the
 * same reason, once `project/plans/shipped/` exists; until then this matches the shell exactly.
 */
export const DEPTH: Readonly<Record<RecordType, number>> = { adr: 1, rfc: 2, plan: 2, task: 1 };

/** Thrown when a declared `records.dirs`/`records.templates` entry does not resolve — never silently
 *  falls back to the search order, which would trade one silent wrong answer for another. */
export class RecordsConfigError extends Error {}

export interface DirResult {
  readonly dir?: string;
}

export function findDir(repoRoot: string, type: RecordType, config: RecordsConfig | undefined): DirResult {
  const declared = config?.dirs?.[type];
  if (declared !== undefined) {
    if (!existsSync(path.join(repoRoot, declared))) {
      throw new RecordsConfigError(
        `vibeops.config.ts declares records.dirs.${type} = "${declared}", which does not exist in this repository`,
      );
    }
    return { dir: declared };
  }
  for (const candidate of CANDIDATE_DIRS[type]) {
    if (existsSync(path.join(repoRoot, candidate))) return { dir: candidate };
  }
  return {};
}

export interface TemplateResult {
  readonly template?: string;
  readonly source?: "config" | "search";
}

export function findTemplate(repoRoot: string, type: RecordType, config: RecordsConfig | undefined): TemplateResult {
  const declared = config?.templates?.[type];
  if (declared !== undefined) {
    if (!existsSync(path.join(repoRoot, declared))) {
      throw new RecordsConfigError(
        `vibeops.config.ts declares records.templates.${type} = "${declared}", which does not exist in this repository`,
      );
    }
    return { template: declared, source: "config" };
  }
  for (const candidate of CANDIDATE_TEMPLATES[type]) {
    if (existsSync(path.join(repoRoot, candidate))) return { template: candidate, source: "search" };
  }
  return {};
}

/**
 * The numbering authority — the file that overrides this resolver on numbering and lifecycle, when a
 * repository predates the convention or ties ids to something else. `(default)` in the shell becomes
 * `undefined` here.
 */
export function findAuthority(repoRoot: string, dir: string | undefined): string | undefined {
  if (dir !== undefined && existsSync(path.join(repoRoot, dir, "AGENTS.md"))) return `${dir}/AGENTS.md`;
  if (existsSync(path.join(repoRoot, ".agents/rules/governance.md"))) return ".agents/rules/governance.md";
  return undefined;
}

const EXCLUDED_BASENAMES = /^(agents|readme|index|contributing)\.md$/i;

/**
 * Basenames of every `.md` file under `dir`, to `maxDepth` (1 = the directory itself, matching `find
 * -maxdepth`). Basenames only, never the full relative path — the shell strips to basename too, so a
 * same-named file at two depths is indistinguishable here exactly as it was there.
 */
// (definition below, after its dir-relative sibling)

/**
 * Markdown that sits in a record directory without being a record: the generated index, the append-only
 * retirement ledger, and the two instruction files. One set, because a second copy of it is how a reader
 * starts counting a README as an undeclared record while its neighbour does not.
 */
export const NOT_A_RECORD = new Set(["README.md", "RETIRED.md", "AGENTS.md", "CLAUDE.md"]);

/**
 * Every `.md` file under `dir` as a DIR-RELATIVE path — `shipped/009-x.md`, not `009-x.md`. What a
 * caller that must OPEN each file needs, where `listMarkdownBasenames` answers the numbering question
 * and can flatten because a number is a number wherever the file sits.
 */
/**
 * Every `.md` under `absDir`, as paths **relative to `absDir`** — `plan.md`, `shipped/026-x.md` — never
 * absolute and never repository-relative. Join them back onto the directory you passed to get either.
 *
 * Stated because the shape is invisible at the call site and the failure is silent: running the result
 * through `path.relative(repoRoot, …)` a second time yields a bare basename, which still resolves to
 * nothing, so a listing built on it renders in full with every field empty. Cost one `records list` that
 * reported `(no Status)` for all 27 plans and read as plausible output.
 */
export function listMarkdownFiles(absDir: string, maxDepth: number): string[] {
  const out: string[] = [];
  function walk(dir: string, prefix: string, depth: number): void {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (depth < maxDepth) walk(path.join(dir, entry.name), `${prefix}${entry.name}/`, depth + 1);
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        out.push(`${prefix}${entry.name}`);
      }
    }
  }
  walk(absDir, "", 1);
  return out;
}

export function listMarkdownBasenames(absDir: string, maxDepth: number): string[] {
  const out: string[] = [];
  function walk(dir: string, depth: number): void {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (depth < maxDepth) walk(path.join(dir, entry.name), depth + 1);
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        out.push(entry.name);
      }
    }
  }
  walk(absDir, 1);
  return out;
}

export type NextNumber = string | { readonly unknown: true };

export interface Numbering {
  readonly pad: number;
  readonly existing: number;
  readonly next: NextNumber;
}

function stripLeadingZeros(value: string): number {
  const stripped = value.replace(/^0+/, "");
  return stripped === "" ? 0 : Number(stripped);
}

function zeroPad(value: number, width: number): string {
  return String(value).padStart(width, "0");
}

/**
 * `EXISTING`, `PAD` and `NEXT`, from a directory's own `.md` basenames — port of resolve-governance.sh
 * lines 69–97. `NEXT` is `{ unknown: true }` when records exist but none matches this repository's own
 * `NNN-slug.md` numbering (a repo using a custom scheme like `DA01-02-slug.md`), which tells the caller
 * to read `AUTHORITY` rather than being handed a confidently wrong number.
 */
export function computeNumbering(basenames: readonly string[], defaultPad: number): Numbering {
  const records = basenames.filter((name) => !EXCLUDED_BASENAMES.test(name));
  const existing = records.length;

  const numbered = records
    .map((name) => /^(\d+)-.*\.md$/.exec(name))
    .filter((match): match is RegExpExecArray => match !== null)
    .map((match) => match[1]!);

  if (numbered.length === 0) {
    return { pad: defaultPad, existing, next: existing > 0 ? { unknown: true } : zeroPad(1, defaultPad) };
  }

  let last = numbered[0]!;
  for (const candidate of numbered) {
    if (Number(candidate) > Number(last)) last = candidate;
  }
  const pad = last.length;
  return { pad, existing, next: zeroPad(stripLeadingZeros(last) + 1, pad) };
}
