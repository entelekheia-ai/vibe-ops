// Two sides that must say the same thing.
//
// Every "these must agree" check is one operation: produce a left, produce a right, report what is in the
// left and not in the right. A scalar is a set of one, which is why a copy-vs-copy check and a
// name-vs-directory check are the same gate.
//
// `compare` names the mode, and the mode carries the machinery:
//
//   text   both sides read as text and held together, minus whatever `ignore` names.
//   sha    a side that IS a file is hashed; a side that is a value (a column, a JSON field) is already
//          the digest and stands as it is.
//   group  both sides are sets; membership is the question rather than equality.
//
// The ops supplies data — which files, which field, what to disregard — and never how to compare. An
// options object carrying patterns and replacements would move the detection out of the gate and into
// configuration that nothing versions.
//
// Subjects are read off disk by name; `files` is used only by a source that asks for a population by
// glob. `examined` counts comparisons, and a run that resolves none reports `skipped`.

import { defineGate } from "@entelekheia/vibe-ops-core";
import type { GateFinding } from "@entelekheia/vibe-ops-core";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

/** How the two sides are reduced before they are held against each other. */
type CompareKind = "text" | "sha" | "group";

/** What `text` mode disregards. Named by what it is; finding one is this gate's business. */
type Ignorable = "copyright" | "trailing-newline";

/**
 * Where one side comes from. `file` `column` `json` `capture` yield one value; `scan` `entries`
 * `resolving` yield a set.
 */
type Source =
  /** The named file's content. `${N}` expands to column N when the comparison came from a row. */
  | { readonly file: string }
  /** Column N of the current row. Only meaningful under `rows`. */
  | { readonly column: number }
  /** A top-level field of a JSON file. An array field yields its members as a set. */
  | { readonly json: string; readonly in: string }
  /** The first capture of a pattern against a file's text. */
  | { readonly capture: string; readonly in: string }
  /** Every capture of a pattern across a population of files — a set, with where each was first seen. */
  | { readonly scan: string; readonly in: readonly string[] }
  /** Directory entries — a set. `matching` narrows it to the names a rule is actually about. */
  | { readonly entries: string; readonly kind?: "file" | "dir"; readonly matching?: string }
  /**
   * The left's members that resolve: each substituted into the template, kept if the path exists. A list
   * of templates means a member resolves if ANY of them does — one name can be served by more than one
   * surface.
   */
  | { readonly resolving: string | readonly string[] };

interface MirrorOptions {
  readonly compare: CompareKind;
  readonly left: Source;
  readonly right: Source;
  /** `text` mode: what is not part of the comparison. */
  readonly ignore?: readonly Ignorable[];
  /** Literal file-against-file comparisons. */
  readonly pairs?: readonly (readonly [string, string])[];
  /** One comparison per row of a table read at run time. */
  readonly rows?: { readonly file: string; readonly format: "tsv"; readonly comment?: string };
  /** `group` mode: report the right's surplus as well as the left's. Defaults to left-only. */
  readonly bothWays?: boolean;
  readonly rule?: string;
  /** Names what the two sides ARE, so a finding says which pair diverged rather than which paths. */
  readonly subject?: string;
}

/**
 * Drop a leading licence block, emitting a leading `---` frontmatter block unchanged.
 *
 * Frontmatter does not hide the block behind it: the search resumes after it. The version inside that
 * frontmatter stays in the comparison, so a gap there is drift.
 */
function withoutCopyright(content: string): string {
  const lines = content.split("\n");
  let at = 0;

  if (lines[0]?.trim() === "---") {
    let end = 1;
    while (end < lines.length && lines[end]?.trim() !== "---") end += 1;
    if (end < lines.length) at = end + 1;
  }

  const start = at;
  while (at < lines.length && lines[at]?.trim() === "") at += 1;

  const opener = lines[at]?.trim() ?? "";
  if (opener.startsWith("<!--")) {
    let end = at;
    while (end < lines.length && !(lines[end] ?? "").includes("-->")) end += 1;
    if (end >= lines.length) return content; // unterminated — not ours to reinterpret
    // Only a block that IS a licence block goes. A leading comment that is guidance stays: one copy
    // carrying a licence block AND guidance, against a copy carrying only guidance, would otherwise have
    // its guidance stripped from the wrong side and every pair would read as diverged.
    const block = lines.slice(at, end + 1).join("\n");
    if (!/Copyright|Licensed under/i.test(block)) return rejoin(lines.slice(0, start), lines.slice(start));
    at = end + 1;
  } else if (/^#\s*(Copyright|Licensed under)/i.test(opener)) {
    while (at < lines.length && (lines[at] ?? "").startsWith("#")) at += 1;
  } else {
    at = start; // no block; still rejoin, so both sides meet the same seam rule
  }

  return rejoin(lines.slice(0, start), lines.slice(at));
}

/**
 * Prefix and body, separated by exactly one blank line when both are non-empty. Applied whether or not a
 * block was removed, so a side that had one and a side that did not meet the same seam.
 */
function rejoin(prefix: readonly string[], body: readonly string[]): string {
  const trimmed = [...body];
  while (trimmed.length > 0 && trimmed[0]!.trim() === "") trimmed.shift();
  if (prefix.length === 0) return trimmed.join("\n");
  return [...prefix, "", ...trimmed].join("\n");
}

function treat(value: string, ignore: readonly Ignorable[]): string {
  let out = value;
  if (ignore.includes("copyright")) out = withoutCopyright(out);
  if (ignore.includes("trailing-newline")) out = out.replace(/\n+$/, "");
  return out;
}

/** `${1}` → column 1 of the row, or a set member substituted into `resolving`. */
function expand(template: string, values: readonly string[]): string {
  return template.replace(/\$\{(\d+)\}/g, (_match, index: string) => values[Number(index)] ?? "");
}

/** One side, reduced. `absent` names a subject that was not there at all. */
interface Reduced {
  readonly members: readonly string[];
  readonly from: string;
  readonly absent?: string;
}

function listEntries(root: string, spec: string, kind: "file" | "dir" | undefined): readonly string[] {
  const dir = path.resolve(root, spec);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => !name.startsWith("."))
    .filter((name) => {
      if (kind === undefined) return true;
      const isDir = statSync(path.join(dir, name)).isDirectory();
      return kind === "dir" ? isDir : !isDir;
    })
    .sort();
}

function jsonMembers(value: unknown): readonly string[] {
  if (Array.isArray(value)) return value.map((item) => String(item));
  if (value === undefined || value === null) return [];
  return [String(value)];
}

function reduce(
  source: Source,
  context: { repoRoot: string; files: readonly string[]; columns: readonly string[]; left?: Reduced },
): Reduced {
  const { repoRoot, files, columns, left } = context;

  if ("column" in source) {
    const value = columns[source.column];
    return value === undefined
      ? { members: [], from: `column ${source.column}`, absent: `column ${source.column}` }
      : { members: [value], from: `column ${source.column}` };
  }

  if ("file" in source) {
    const relative = expand(source.file, columns);
    const absolute = path.resolve(repoRoot, relative);
    if (!existsSync(absolute)) return { members: [], from: relative, absent: relative };
    return { members: [readFileSync(absolute, "utf8")], from: relative };
  }

  if ("json" in source) {
    const relative = expand(source.in, columns);
    const absolute = path.resolve(repoRoot, relative);
    if (!existsSync(absolute)) return { members: [], from: relative, absent: relative };
    try {
      const parsed = JSON.parse(readFileSync(absolute, "utf8")) as Record<string, unknown>;
      return { members: jsonMembers(parsed[source.json]), from: `${relative} (${source.json})` };
    } catch {
      return { members: [], from: relative, absent: `${relative} (unreadable JSON)` };
    }
  }

  if ("capture" in source) {
    const relative = expand(source.in, columns);
    const absolute = path.resolve(repoRoot, relative);
    if (!existsSync(absolute)) return { members: [], from: relative, absent: relative };
    const found = new RegExp(source.capture, "m").exec(readFileSync(absolute, "utf8"));
    return found?.[1] === undefined
      ? { members: [], from: relative, absent: `${relative} (no match)` }
      : { members: [found[1]], from: relative };
  }

  if ("scan" in source) {
    const pattern = new RegExp(source.scan, "g");
    const seen = new Set<string>();
    // A concrete path in `in` is read even when it is not in the population: a registration file is a
    // named subject, not a member of the markdown sweep the entry was scoped to.
    const matched = files.filter((file) => source.in.some((glob) => matchesGlob(file, glob)));
    const named = source.in.filter((entry) => !entry.includes("*") && existsSync(path.resolve(repoRoot, entry)));
    for (const file of [...new Set([...matched, ...named])]) {
      const absolute = path.resolve(repoRoot, file);
      if (!existsSync(absolute)) continue;
      for (const match of readFileSync(absolute, "utf8").matchAll(pattern)) {
        if (match[1] !== undefined) seen.add(match[1]);
      }
    }
    return { members: [...seen].sort(), from: source.in.join(" ") };
  }

  if ("entries" in source) {
    const all = listEntries(repoRoot, source.entries, source.kind);
    const narrowed = source.matching === undefined ? all : all.filter((name) => new RegExp(source.matching!).test(name));
    return { members: narrowed, from: source.entries };
  }

  // `resolving`: the left's members that survive substitution into an existing path.
  const templates = typeof source.resolving === "string" ? [source.resolving] : source.resolving;
  const kept = (left?.members ?? []).filter((member) =>
    templates.some((template) => existsSync(path.resolve(repoRoot, expand(template, [member])))),
  );
  return { members: kept, from: `what resolves under ${templates.map((t) => t.replace("${0}", "…")).join(" or ")}` };
}

/** A small glob: `**` anywhere, `*` within a segment. */
function matchesGlob(file: string, glob: string): boolean {
  const escaped = glob
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*\//g, "(?:.*/)?")
    .replace(/\*\*/g, ".*")
    .replace(/\*/g, "[^/]*");
  return new RegExp(`^${escaped}$`).test(file);
}

export default defineGate(
  {
    id: "mirror",
    version: 1,
    summary: "Two sides that must still say the same thing — a copy, a pin, a field, a set of names",
  },
  async ({ repoRoot, files, options }) => {
    const {
      compare,
      left: leftSpec,
      right: rightSpec,
      ignore = [],
      pairs,
      rows,
      bothWays = false,
      rule = "mirror-drift",
      subject = "these two",
    } = options as unknown as MirrorOptions;

    if (compare === undefined) throw new Error("mirror requires options.compare — one of text, sha, group");
    if (pairs === undefined && rows === undefined && (leftSpec === undefined || rightSpec === undefined)) {
      throw new Error("mirror requires options.left and options.right, or options.pairs, or options.rows");
    }

    /** One comparison: the two sources, the row it came from, and what names it in a finding. */
    const comparisons: { left: Source; right: Source; columns: readonly string[]; where: string }[] = [];

    for (const [a, b] of pairs ?? []) {
      comparisons.push({ left: { file: a }, right: { file: b }, columns: [], where: a });
    }

    if (rows !== undefined) {
      const registry = path.resolve(repoRoot, rows.file);
      if (!existsSync(registry)) {
        return { findings: [], examined: 0, skipped: `no ${rows.file} — nothing names what to compare` };
      }
      const comment = rows.comment ?? "#";
      for (const line of readFileSync(registry, "utf8").split("\n")) {
        if (line.trim() === "" || line.startsWith(comment)) continue;
        const columns = line.split("\t");
        comparisons.push({ left: leftSpec!, right: rightSpec!, columns, where: `${rows.file}` });
      }
    }

    if (pairs === undefined && rows === undefined) {
      comparisons.push({ left: leftSpec!, right: rightSpec!, columns: [], where: subject });
    }

    if (comparisons.length === 0) {
      return { findings: [], examined: 0, skipped: `${subject}: nothing resolved — zero comparisons is not a reading` };
    }

    const findings: GateFinding[] = [];
    for (const comparison of comparisons) {
      const base = { repoRoot, files, columns: comparison.columns };
      const left = reduce(comparison.left, base);
      const right = reduce(comparison.right, { ...base, left });

      // An absent subject is reported as absent: "these two differ" would be true and useless.
      const absent = left.absent ?? right.absent;
      if (absent !== undefined && compare !== "group") {
        findings.push({
          rule,
          file: comparison.where,
          evidence: `${subject}: ${absent} is named but not there — the comparison could not be made`,
        });
        continue;
      }

      if (compare === "group") {
        for (const member of left.members) {
          if (!right.members.includes(member)) {
            findings.push({
              rule,
              file: comparison.where,
              evidence: `${member} is in ${left.from} but not in ${right.from}`,
            });
          }
        }
        if (bothWays) {
          for (const member of right.members) {
            if (!left.members.includes(member)) {
              findings.push({
                rule,
                file: comparison.where,
                evidence: `${member} is in ${right.from} but not in ${left.from}`,
              });
            }
          }
        }
        continue;
      }

      // `sha`: a file side is hashed; a value side is already the digest.
      const reduceOne = (side: Source, value: string): string =>
        compare === "sha" ? ("file" in side ? createHash("sha256").update(value).digest("hex") : value) : treat(value, ignore);

      const a = reduceOne(comparison.left, left.members[0] ?? "");
      const b = reduceOne(comparison.right, right.members[0] ?? "");
      if (a !== b) {
        findings.push({
          rule,
          file: comparison.where,
          evidence: `${subject}: ${left.from} and ${right.from} have diverged — one was changed without the other`,
        });
      }
    }

    return { findings, examined: comparisons.length };
  },
);
