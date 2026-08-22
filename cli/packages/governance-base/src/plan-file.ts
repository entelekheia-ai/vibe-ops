// `vibe-ops plan file` and `plan close` — Plan-011 Track 6. Between them they are the two ends of a
// plan's life on disk: an approved plan-mode plan lands in the plans directory, and a shipped one moves
// into `shipped/` keeping its number.
//
// Every edit here is a SPLICE OVER A NODE'S OWN SPAN, never a substitution over the text. Two of them
// would be wrong done any other way, and both are ordinary rather than exotic:
//
//   - Removing the `| Repository |` row. `plan-approved-copy.sh` deleted every line matching
//     `^|\s*Repository\s*|`, which is the whole file, not the header table — and a plan's Design section
//     legitimately shows a table with that first column. Here the row is located inside the header table
//     the record-header gate already defines, and nothing outside it can be caught.
//   - Setting `Status`. Splicing the value CELL leaves the row's spacing and every other cell exactly as
//     the author wrote them; a line rewrite reflows a table someone aligned by hand.

import type { Document } from "@entelekheia/vibe-ops-core";
import { findHeaderTable, keysOf, valueOf } from "./header-table.ts";

/** What `plan file` needs to know about an approved plan before it writes anything. */
export interface PlanShape {
  /** The H1's own text, with a `Plan-NNN:` prefix stripped — the source of the filename slug. */
  readonly title?: string;
  /** Whether the header table declares `Status`. With no H1 and no Status this is not a durable record. */
  readonly hasStatus: boolean;
  /** The `| Repository |` cell's value, when the row is present. */
  readonly repository?: string;
}

const PLAN_PREFIX = /^Plan-[A-Za-z0-9]*:\s*/i;

export function readPlanShape(document: Document): PlanShape {
  const root = document.tree?.rootNode;
  if (root === undefined) return { hasStatus: false };

  const heading = root
    .descendantsOfType("atx_heading")
    .find((node) => node.children.some((child) => child.type === "atx_h1_marker"));
  const inline = heading?.children.find((child) => child.type === "inline");
  const title = inline === undefined ? undefined : inline.text.trim().replace(PLAN_PREFIX, "");

  const table = findHeaderTable(root);
  if (table === undefined) return { title, hasStatus: false };

  const repository = valueOf(table, "Repository");
  return {
    title,
    hasStatus: keysOf(table).has("Status"),
    // The template's own placeholder is an HTML comment in the cell, which is a value nobody wants.
    repository: repository === undefined || repository === "" || repository.startsWith("<") ? undefined : repository,
  };
}

/**
 * `document.text` with the header table's `| Repository |` row removed, or unchanged when there is none.
 *
 * The row is routing metadata for the filing step and nothing else, and it is the one thing in a plan
 * that is an absolute path on somebody's machine — leaving it in writes a home directory into a
 * permanent, possibly public record. Removed here rather than left for a person to notice, because the
 * model never sees this file get written.
 */
export function withoutRepositoryRow(document: Document): string {
  const root = document.tree?.rootNode;
  if (root === undefined) return document.text;
  const table = findHeaderTable(root);
  if (table === undefined) return document.text;

  for (const row of table.children) {
    if (row.type !== "pipe_table_row") continue;
    const firstCell = row.children.find((child) => child.type === "pipe_table_cell");
    if (firstCell?.text.trim() !== "Repository") continue;
    // To the end of the line: a row node stops at the last cell, and leaving its newline behind would
    // put a blank line in the middle of the table.
    let end = row.endIndex;
    while (end < document.text.length && document.text[end] !== "\n") end++;
    return `${document.text.slice(0, row.startIndex)}${document.text.slice(end + 1)}`;
  }
  return document.text;
}

/**
 * `document.text` with the header table's `Status` value replaced. `undefined` when there is no header
 * table or no `Status` row — a caller must not invent one, because a plan without that row is a plan this
 * repository's own `record-header` gate is already reporting.
 */
export function withStatus(document: Document, status: string): string | undefined {
  const root = document.tree?.rootNode;
  if (root === undefined) return undefined;
  const table = findHeaderTable(root);
  if (table === undefined) return undefined;

  for (const row of table.children) {
    if (row.type !== "pipe_table_row") continue;
    const cells = row.children.filter((child) => child.type === "pipe_table_cell");
    if (cells.length < 2 || cells[0]!.text.trim() !== "Status") continue;

    const cell = cells[1]!;
    // The cell node's span INCLUDES the padding the author wrote around the value — measured: the cell
    // for `| Status | Shipped |` is `"Shipped "`, trailing space and all. So the padding is carried over
    // rather than re-added, which is what keeps a table someone aligned by hand aligned, and keeps the
    // diff to the one word that changed.
    const leading = cell.text.slice(0, cell.text.length - cell.text.trimStart().length);
    const trailing = cell.text.slice(cell.text.trimEnd().length);
    return `${document.text.slice(0, cell.startIndex)}${leading}${status}${trailing}${document.text.slice(cell.endIndex)}`;
  }
  return undefined;
}

/**
 * A filename slug from a plan's title: lowercase, anything non-alphanumeric collapsed to one hyphen,
 * trimmed, capped so a long heading cannot produce an unusable filename. Same rule the shell used, so a
 * plan filed before and after this port lands under the same name.
 */
export function slugFor(title: string | undefined): string {
  const slug = (title ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/, "");
  return slug === "" ? "untitled" : slug;
}
