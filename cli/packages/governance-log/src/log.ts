// `vibe-ops log index | sweep | lint` — Plan-011 Track 5. The first noun with no shell to port: the log
// tier was specified and then maintained by hand, and `new-log`'s Step 5 says so in its own comment —
// "when the index generator exists this step becomes 'run it'. Until then the row is written here, and
// that is the drift surface: an index maintained by hand disagrees with the directory eventually."
//
// Everything here reads the tree. An entry's metadata comes from its parsed yaml layer (see
// frontmatter.ts for why a line reader gets two real entries wrong), and the index's preamble boundary is
// the first level-2 heading NODE — not a line count, not a marker comment someone has to remember to
// keep. The generated half is everything from that heading down; the prose above it is the author's and
// is copied through untouched.

import path from "node:path";
import { existsSync } from "node:fs";
import type { Document, DocumentStore } from "@entelekheia/vibe-ops-core";
import { filterByGlobs, trackedFiles } from "@entelekheia/vibe-ops-core";
import { readFrontmatter } from "@entelekheia/governance-base";
import { listMarkdownFiles, NOT_A_RECORD } from "@entelekheia/governance-base";

/** Not entries: the index this command generates, and the append-only retirement ledger. */
const NOT_AN_ENTRY = NOT_A_RECORD;


export interface LogEntry {
  readonly file: string;
  readonly basename: string;
  readonly name?: string;
  readonly description?: string;
  readonly kind?: string;
  readonly paths: readonly string[];
  readonly relatedTo: readonly string[];
  readonly attempted?: string;
  readonly source?: string;
  /** Every frontmatter key present, so a lint can see a key that should not be there. */
  readonly keys: readonly string[];
  readonly hasFrontmatter: boolean;
}

export interface LogFinding {
  readonly file: string;
  readonly rule: "name-mismatch" | "kind-invalid" | "status-present" | "attempted-invalid" | "no-recurrence-surface" | "no-frontmatter";
  readonly evidence: string;
}

export interface LogRetirable {
  readonly file: string;
  readonly unresolved: readonly string[];
}

function scalarOrUndefined(value: string | undefined): string | undefined {
  return value === undefined || value === "" ? undefined : value;
}

/** Every entry directly under `dir`, parsed. Depth 1, matching the resolver's own DEPTH for `log`. */
export function readLogEntries(documents: DocumentStore, repoRoot: string, dir: string): readonly LogEntry[] {
  const entries: LogEntry[] = [];
  for (const basename of listMarkdownFiles(path.join(repoRoot, dir), 1)) {
    if (NOT_AN_ENTRY.has(basename)) continue;
    const file = `${dir}/${basename}`;
    const frontmatter = readFrontmatter(documents.get(file));
    if (frontmatter === undefined) {
      entries.push({ file, basename, paths: [], relatedTo: [], keys: [], hasFrontmatter: false });
      continue;
    }
    const single = (key: string): readonly string[] => {
      const list = frontmatter.lists.get(key);
      if (list !== undefined) return list;
      const scalar = scalarOrUndefined(frontmatter.scalars.get(key));
      return scalar === undefined ? [] : [scalar];
    };
    entries.push({
      file,
      basename,
      name: scalarOrUndefined(frontmatter.scalars.get("name")),
      description: scalarOrUndefined(frontmatter.scalars.get("description")),
      kind: scalarOrUndefined(frontmatter.scalars.get("kind")),
      paths: single("path"),
      relatedTo: single("relatedTo"),
      attempted: scalarOrUndefined(frontmatter.scalars.get("attempted")),
      source: scalarOrUndefined(frontmatter.scalars.get("source")),
      keys: frontmatter.keys,
      hasFrontmatter: true,
    });
  }
  return entries.sort((a, b) => a.basename.localeCompare(b.basename));
}

// ---------------------------------------------------------------------------------------------- lint

const KINDS = new Set(["trap", "debt"]);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The four shapes `new-log`'s own checklist names, plus the admission test it calls "the only retirement
 * detector this tier has". Nothing here judges an entry's *content* — that is the skill's job and cannot
 * be mechanised.
 */
export function logLint(entries: readonly LogEntry[]): readonly LogFinding[] {
  const findings: LogFinding[] = [];
  for (const entry of entries) {
    if (!entry.hasFrontmatter) {
      findings.push({ file: entry.file, rule: "no-frontmatter", evidence: "no YAML frontmatter — the template puts it first, and it is only frontmatter when it opens the file" });
      continue;
    }

    const slug = entry.basename.replace(/\.md$/, "");
    if (entry.name !== slug) {
      findings.push({
        file: entry.file,
        rule: "name-mismatch",
        evidence: `name: is ${entry.name ?? "(absent)"} but the filename says ${slug} — the two must match so a rename stays visible`,
      });
    }
    if (entry.kind === undefined || !KINDS.has(entry.kind)) {
      findings.push({
        file: entry.file,
        rule: "kind-invalid",
        evidence: `kind: is ${entry.kind ?? "(absent)"} — it is trap or debt, and they say opposite things on the same path`,
      });
    }
    if (entry.keys.includes("status")) {
      findings.push({
        file: entry.file,
        rule: "status-present",
        evidence: "status: exists — there is deliberately no such field; an entry that retires is deleted, so there is no state to drift",
      });
    }
    if (entry.attempted === undefined || !ISO_DATE.test(entry.attempted)) {
      findings.push({
        file: entry.file,
        rule: "attempted-invalid",
        evidence: `attempted: is ${entry.attempted ?? "(absent)"} — it is a real YYYY-MM-DD, never guessed`,
      });
    }
    if (entry.paths.length === 0 && entry.relatedTo.length === 0) {
      findings.push({
        file: entry.file,
        rule: "no-recurrence-surface",
        evidence: "neither path: nor relatedTo: — nobody meets this again, so it is not a log entry",
      });
    }
  }
  return findings;
}

// --------------------------------------------------------------------------------------------- sweep

/**
 * Entries whose `path:` no longer resolves to anything tracked. **Reports; never deletes.** Retirement is
 * a judgement — an entry whose path merely moved is not the same as one whose trap is gone — and the
 * tombstone in `RETIRED.md` is the skill's to write.
 *
 * An entry with only `relatedTo:` is never swept: it names a package or tool with no path of its own, so
 * there is nothing here that could go missing.
 */
export function logSweep(repoRoot: string, entries: readonly LogEntry[]): readonly LogRetirable[] {
  const tracked = trackedFiles(repoRoot);
  const retirable: LogRetirable[] = [];

  for (const entry of entries) {
    if (entry.paths.length === 0) continue;

    // A glob is resolved against the tracked file list; a plain path may name a directory, which no file
    // list contains, so that case falls back to asking the filesystem.
    const unresolved = entry.paths.filter((pattern) => {
      if (filterByGlobs(tracked, [pattern]).length > 0) return false;
      return !existsSync(path.join(repoRoot, pattern));
    });
    if (unresolved.length === entry.paths.length) retirable.push({ file: entry.file, unresolved });
  }
  return retirable;
}

// --------------------------------------------------------------------------------------------- index

/**
 * The group an entry belongs to: its `path:` up to the first globbed segment, as a directory. A path of
 * `cli/packages/core/package.json` groups under `cli/packages/core/`, and `cli/packages/**` under
 * `cli/packages/` — the grouping is derived, never chosen, which is what makes a whole group collapse
 * when its prefix stops existing.
 */
export function groupOf(entry: LogEntry): string {
  const pattern = entry.paths[0];
  if (pattern === undefined) return entry.relatedTo[0] ?? "(ungrouped)";

  const segments: string[] = [];
  for (const segment of pattern.split("/")) {
    if (segment.includes("*")) break;
    segments.push(segment);
  }
  // A trailing segment carrying a dot is a filename, and a file is not a group.
  const last = segments[segments.length - 1];
  if (last !== undefined && last.includes(".")) segments.pop();
  return segments.length === 0 ? "(repository root)" : `${segments.join("/")}/`;
}

/** One index row, wrapped the way this repository's own README already wraps them. */
function row(entry: LogEntry, width: number): string {
  const link = `- [\`${entry.basename}\`](${entry.basename}) —`;
  const words = (entry.description ?? "(no description)").split(/\s+/).filter((word) => word !== "");

  const lines: string[] = [link];
  for (const word of words) {
    const current = lines[lines.length - 1]!;
    if (`${current} ${word}`.length <= width) lines[lines.length - 1] = `${current} ${word}`;
    else lines.push(`  ${word}`);
  }
  return lines.join("\n");
}

/**
 * Everything in `document` before its first level-2 heading — the title and the prose the author wrote,
 * copied through untouched. Located as a NODE, so nothing depends on a line count or on a marker comment
 * somebody has to remember not to delete. A README with no level-2 heading yet is all preamble.
 */
export function preambleOf(document: Document): string {
  const root = document.tree?.rootNode;
  if (root === undefined) return document.text;
  for (const heading of root.descendantsOfType("atx_heading")) {
    if (heading.children.some((child) => child.type === "atx_h2_marker")) {
      return document.text.slice(0, heading.startIndex);
    }
  }
  return document.text;
}

/** The generated index: the preamble, then one section per group, groups and rows both in path order. */
export function logIndex(entries: readonly LogEntry[], preamble: string, width = 108): string {
  const groups = new Map<string, LogEntry[]>();
  for (const entry of entries) {
    const group = groupOf(entry);
    const existing = groups.get(group);
    if (existing === undefined) groups.set(group, [entry]);
    else existing.push(entry);
  }

  const sections = [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([group, members]) => [`## \`${group}\``, "", ...members.map((entry) => row(entry, width))].join("\n"));

  return `${preamble.replace(/\s*$/, "")}\n\n${sections.join("\n\n")}\n`;
}
