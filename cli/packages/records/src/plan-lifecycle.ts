// Filing an approved plan, and closing a shipped one — the two acts that move a plan file. Ported from
// plugin/hooks/plan-approved-copy.sh (the first) and new for Plan-011 Track 6 (the second).
//
// A closed plan MOVES INTO `shipped/` and keeps its number, which is why `DEPTH.plan` is 2: the resolver
// already carried this exact case for `rfc`, with the reason in its own comment — a record that leaves
// the active directory must keep owning its number, or the next one collides.

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { documentFromText } from "@entelekheia/vibe-ops-core";
import { linksToBasenames, relativeLinks, spliceLinks } from "./links.ts";
import type { DocumentStore } from "@entelekheia/vibe-ops-core";
import { readPlanShape, slugFor, withoutRepositoryRow, withStatus } from "./plan-file.ts";

export class PlanCloseError extends Error {}

export const SHIPPED = "shipped";

export interface FilePlanOptions {
  readonly repoRoot: string;
  readonly dir: string;
  readonly next: string;
  readonly text: string;
}

export interface FiledPlan {
  readonly file?: string;
  /** Why nothing was written. Absent exactly when `file` is present. */
  readonly skipped?: string;
  /** The repository the plan's own `| Repository |` row named, when it carried one. */
  readonly repository?: string;
  readonly droppedRepositoryRow: boolean;
  /** True when the plan's own heading does not already carry the number it was filed under. */
  readonly staleNumber: boolean;
}

/**
 * Writes an approved plan into `dir` as `<next>-<slug>.md`, dropping its `| Repository |` row.
 *
 * The admission gate is the same one the shell used and for the same reason: an H1 *and* a `Status` row
 * is what the plan-mode hook asks for only when the turn intends a durable design record, so a throwaway
 * plan has neither and is never filed. Copy, never move, and **never overwrite** — the target check
 * guards a genuine double delivery of the same event, not a second plan, which gets its own number for
 * free from a freshly resolved `next`.
 */
export function filePlan(options: FilePlanOptions): FiledPlan {
  const { repoRoot, dir, next, text } = options;
  const document = documentFromText(`${dir}/${next}-pending.md`, text);
  const shape = readPlanShape(document);

  if (shape.title === undefined) return { skipped: "no H1 — not a durable design record", droppedRepositoryRow: false, staleNumber: false };
  if (!shape.hasStatus) {
    return { skipped: "no Status row in the header table — not a durable design record", droppedRepositoryRow: false, staleNumber: false };
  }

  const file = `${dir}/${next}-${slugFor(shape.title)}.md`;
  if (existsSync(path.join(repoRoot, file))) {
    return { skipped: `${file} already exists`, repository: shape.repository, droppedRepositoryRow: false, staleNumber: false };
  }

  mkdirSync(path.join(repoRoot, dir), { recursive: true });
  writeFileSync(path.join(repoRoot, file), withoutRepositoryRow(document));

  return {
    file,
    repository: shape.repository,
    droppedRepositoryRow: shape.repository !== undefined,
    // Flagged rather than rewritten: text surgery on a heading a person may have hand-edited is worse
    // than asking for one line to be corrected.
    staleNumber: !text.includes(`Plan-${next}`),
  };
}

export interface ClosePlanOptions {
  readonly repoRoot: string;
  readonly dir: string;
  /** The plan, repository-relative or relative to `dir`. */
  readonly file: string;
  readonly terminal: string;
  readonly dryRun: boolean;
}

export interface ClosedPlan {
  readonly steps: readonly string[];
  readonly from: string;
  readonly to: string;
  readonly status: string;
  /** Files whose links to this plan were rewritten to its new location. */
  readonly repointed: readonly string[];
  /** Whether the plan's own outbound relative links were re-based one level deeper. */
  readonly rebased: number;
}

/** `git grep -l` exits 1 when it matches nothing, which is not an error here. */
function gitGrepFiles(repoRoot: string, needle: string): readonly string[] {
  try {
    return execFileSync("git", ["grep", "-l", "-F", needle, "--", "."], { cwd: repoRoot, encoding: "utf8" })
      .split("\n")
      .filter((line) => line !== "");
  } catch {
    return [];
  }
}

/** A repository-relative link target, expressed relative to `fromFile`'s own directory. */
function relativeFrom(fromFile: string, target: string): string {
  const relative = path.posix.relative(path.posix.dirname(fromFile), target);
  return relative.startsWith(".") ? relative : `./${relative}`;
}

/**
 * Sets the plan's `Status` to the repository's terminal state and moves the file into `<dir>/shipped/`,
 * keeping its number. **The file is never deleted** — it is the record someone reads in a year.
 *
 * `git mv` rather than a write-and-unlink, so the move is a rename in history and `git log --follow`
 * still reaches everything the plan recorded while it was being written.
 */
export function closePlan(options: ClosePlanOptions, documents: DocumentStore): ClosedPlan {
  const { repoRoot, dir, terminal, dryRun } = options;
  const from = options.file.startsWith(`${dir}/`) ? options.file : `${dir}/${options.file}`;
  const steps: string[] = [];

  if (!existsSync(path.join(repoRoot, from))) throw new PlanCloseError(`no such plan: ${from}`);
  if (from.startsWith(`${dir}/${SHIPPED}/`)) throw new PlanCloseError(`${from} is already in ${SHIPPED}/`);

  const to = `${dir}/${SHIPPED}/${path.basename(from)}`;
  if (existsSync(path.join(repoRoot, to))) throw new PlanCloseError(`${to} already exists`);

  const next = withStatus(documents.get(from), terminal);
  if (next === undefined) {
    throw new PlanCloseError(`${from} has no Status row in its header table — nothing to set`);
  }

  // Referrers are collected BEFORE the move, for the same reason `task close` collects its own then:
  // afterwards the link is broken and finding what pointed at it is manual. Which spans are links is
  // decided by the tree, so a plan that quotes a path inside a code span is not rewritten.
  const basename = path.basename(from);
  const referrers = gitGrepFiles(repoRoot, basename)
    .filter((file) => file !== from)
    .map((file) => ({ file, links: linksToBasenames(documents.get(file), [basename]) }))
    .filter(({ links }) => links.length > 0);

  const outbound = relativeLinks(documents.get(from));

  if (dryRun) {
    steps.push(`  would set Status to ${terminal} in ${from}`);
    steps.push(`  would run: git mv ${from} ${to}`);
    for (const { file, links } of referrers) steps.push(`  would repoint ${links.length} link(s) in ${file}`);
    steps.push(`  would re-base ${outbound.length} relative link(s) inside the plan itself`);
    return { steps, from, to, status: terminal, repointed: referrers.map((r) => r.file), rebased: outbound.length };
  }

  // The plan's own outbound links are re-based in the same write as its Status: the file goes one level
  // deeper, so every relative target it carries would otherwise resolve one level too high. This is the
  // half a hand-run move always forgets, because the broken links are inside the file that moved.
  const rebased = spliceLinks(documents.get(from), outbound, (link) => {
    const absolute = path.posix.normalize(path.posix.join(path.posix.dirname(from), link.target.split("#")[0] ?? ""));
    const anchor = link.target.includes("#") ? `#${link.target.split("#").slice(1).join("#")}` : "";
    return `[${link.text}](${relativeFrom(to, absolute)}${anchor})`;
  });
  const withBoth = withStatus(documentFromText(from, rebased), terminal) ?? next;

  writeFileSync(path.join(repoRoot, from), withBoth);
  steps.push(`  Status set to ${terminal} in ${from}`);
  if (outbound.length > 0) steps.push(`  ${outbound.length} relative link(s) re-based for the new depth`);

  mkdirSync(path.join(repoRoot, dir, SHIPPED), { recursive: true });
  execFileSync("git", ["mv", from, to], { cwd: repoRoot });
  steps.push(`  moved to ${to} — the number is kept, and DEPTH keeps it counted`);

  for (const { file, links } of referrers) {
    const repointedText = spliceLinks(documents.get(file), links, (link) => {
      const anchor = link.target.includes("#") ? `#${link.target.split("#").slice(1).join("#")}` : "";
      return `[${link.text}](${relativeFrom(file, to)}${anchor})`;
    });
    writeFileSync(path.join(repoRoot, file), repointedText);
    steps.push(`  repointed ${links.length} link(s) in ${file}`);
  }

  return { steps, from, to, status: terminal, repointed: referrers.map((r) => r.file), rebased: outbound.length };
}
