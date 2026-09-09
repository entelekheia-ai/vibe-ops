// harness audit — the measured inventory. Not a grid placement, not a block/allow judgement (both need
// a model and belong to the next track); this is only what a command cannot get wrong and a model
// repeatedly does: guides with their always-on cost as a number, sensors with where they fire, and the
// governance overlay pulled from `records list` rather than re-read from `project/*/`.
//
// THREE MEASUREMENT TRAPS, each closed by construction rather than by a comment asking a reader to be
// careful (see the dossier for Plan-025 Track 4 item 5):
//
//   1. A shell glob that matches nothing while an error is swallowed reads identically to a genuinely
//      empty population. `sensorsAtCi` reuses `workflowFiles()` from shape.ts, which already reads the
//      directory directly instead of globbing with a swallowed error.
//   2. A line count derived from a proxy (word count, byte count / 80) drifts from what a reader would
//      get running `wc -l` themselves. `lineCount` below counts newline characters the same way `wc -l`
//      does, not `text.split("\n").length`, which over-counts by one on a file with no trailing newline.
//   3. A configured-but-unexecuted tool (a linter's config file with nothing wired to run it) is a
//      guide, not a sensor. Sensors here are sourced ONLY from `check --list` (what actually runs at
//      commit) and `.github/workflows/` (what actually runs in CI) — nothing here scans for config file
//      presence, so a repository cannot gain a sensor entry it never wired up.

import type { ModuleContext, ModulePlugin } from "@entelekheia/vibe-ops-core";
import { trackedFiles } from "@entelekheia/vibe-ops-core";
import { readFileSync } from "node:fs";
import path from "node:path";
import { workflowFiles } from "./shape.ts";

const RECORD_TYPES = ["adr", "rfc", "plan", "task"] as const;
const INSTRUCTION_BASENAMES = new Set(["AGENTS.md", "CLAUDE.md"]);

/** Counts newline characters, matching `wc -l` — NOT `text.split("\n").length`, which over-counts by one
 *  on a file with no trailing newline (see trap 2 above). */
export function lineCount(text: string): number {
  return (text.match(/\n/g) ?? []).length;
}

/** Whether a `.agents/rules/*.md` file's frontmatter declares `paths:` — scoped when it does, always-on
 *  (loaded on every turn) when it does not. Reads only the frontmatter block, never the body. */
export function isScopedRule(text: string): boolean {
  if (!text.startsWith("---\n")) return false;
  const end = text.indexOf("\n---", 4);
  if (end === -1) return false;
  const frontmatter = text.slice(4, end);
  return /^paths:/m.test(frontmatter);
}

export interface GuideEntry {
  readonly path: string;
  readonly lines: number;
  readonly scope: "always-on" | "scoped";
}

export interface SensorEntry {
  readonly id: string;
  readonly source: string;
  readonly firesAt: "commit" | "ci";
}

export interface RecordOverlayEntry {
  readonly type: (typeof RECORD_TYPES)[number];
  readonly count: number;
  /** Records whose `migrations` list is non-empty — behind the current template, per `records list`. */
  readonly behind: number;
}

export interface Audit {
  readonly guides: readonly GuideEntry[];
  readonly sensors: readonly SensorEntry[];
  readonly governance: readonly RecordOverlayEntry[];
}

function guides(repoRoot: string): readonly GuideEntry[] {
  const entries: GuideEntry[] = [];
  for (const file of trackedFiles(repoRoot)) {
    // A shipped copy under a templates/ or scaffold/ directory is written to resolve in a TARGET
    // repository, never this one — the same safe default `governance`/`for-vibe-ops` apply via their own
    // `ignore` config, applied here directly because this reading has no ops config to consult.
    // `scaffold/` joined `templates/` at Plan-040 Track 5: a governance package's own scaffold
    // contribution (`cli/packages/governance-instructions/scaffold/root/CLAUDE.md`) is the same kind of
    // shipped copy as the setup skill's `templates/`, and without this it silently became a counted
    // "always-on" guide of this repository's own — a file nobody here ever loads.
    if (file.includes("templates/") || file.includes("scaffold/")) continue;
    const isInstructionFile = INSTRUCTION_BASENAMES.has(path.basename(file));
    const isRule = /(^|\/)\.agents\/rules\/[^/]+\.md$/.test(file);
    if (!isInstructionFile && !isRule) continue;
    let text: string;
    try {
      text = readFileSync(path.join(repoRoot, file), "utf8");
    } catch {
      continue; // tracked but unreadable in this checkout (a submodule, a case-sensitivity mismatch) — not this verb's error to raise
    }
    entries.push({
      path: file,
      lines: lineCount(text),
      scope: isRule && isScopedRule(text) ? "scoped" : "always-on",
    });
  }
  return entries.sort((a, b) => a.path.localeCompare(b.path));
}

async function loadPlugin(specifier: string): Promise<ModulePlugin | undefined> {
  try {
    const loaded = (await import(specifier)) as { default: ModulePlugin };
    return loaded.default;
  } catch {
    return undefined;
  }
}

async function sensorsAtCommit(context: ModuleContext): Promise<readonly SensorEntry[]> {
  const check = await loadPlugin("@entelekheia/vibe-ops-module-check");
  if (check === undefined) return [];
  const result = await check.run({ ...context, command: undefined, flags: { list: true }, log: () => {} });
  const checks = (result.data as { checks?: readonly { id: string; source: string } [] } | undefined)?.checks ?? [];
  return checks.map((c) => ({ id: c.id, source: c.source, firesAt: "commit" as const }));
}

function sensorsAtCi(repoRoot: string): readonly SensorEntry[] {
  return workflowFiles(repoRoot).map((file) => ({
    id: file,
    source: path.join(".github", "workflows", file),
    firesAt: "ci" as const,
  }));
}

async function governanceOverlay(context: ModuleContext): Promise<readonly RecordOverlayEntry[]> {
  const records = await loadPlugin("@entelekheia/vibe-ops-module-records");
  if (records === undefined) return [];
  const overlay: RecordOverlayEntry[] = [];
  for (const type of RECORD_TYPES) {
    const result = await records.run({
      ...context,
      command: "list",
      flags: { type, fields: "status,migrations" },
      log: () => {},
    });
    const list = (result.data as readonly { migrations?: readonly string[] }[] | undefined) ?? [];
    overlay.push({
      type,
      count: list.length,
      behind: list.filter((row) => (row.migrations?.length ?? 0) > 0).length,
    });
  }
  return overlay;
}

export async function buildAudit(context: ModuleContext): Promise<Audit> {
  const [sensorsCommit, sensorsCi, governance] = await Promise.all([
    sensorsAtCommit(context),
    Promise.resolve(sensorsAtCi(context.repoRoot)),
    governanceOverlay(context),
  ]);
  return {
    guides: guides(context.repoRoot),
    sensors: [...sensorsCommit, ...sensorsCi],
    governance,
  };
}
