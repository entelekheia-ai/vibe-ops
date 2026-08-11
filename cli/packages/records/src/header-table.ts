// Moved here from cli/packages/gates/src/record-header/, Plan-011 Track 2 — the ONLY definition of
// where a governance record's header table is, imported by that gate rather than duplicated by it, and
// available to the action side (this package) for the same reading without a second implementation.
//
// THE HEADER TABLE IS THE FIRST `pipe_table` REACHED BEFORE THE FIRST LEVEL-2 HEADING, never simply
// "the first `pipe_table`" — measured exact over this repository's own 28 tracked records (21 hits, 7
// correct misses, 0 misfires; see project/tasks/004-the-governance-ops.md, item 3). The naive reading
// instead grabs a CONTENT table in four research documents, one of them with `Field` as its own first
// column.

import type Parser from "tree-sitter";

/**
 * The first `pipe_table` in document order, but only when it appears before the first level-2 heading
 * — a level-2 heading with no `pipe_table` ahead of it means there is no header table at all, not that
 * the search should keep going into the body.
 */
export function findHeaderTable(root: Parser.SyntaxNode): Parser.SyntaxNode | undefined {
  for (const node of root.descendantsOfType(["pipe_table", "atx_heading"])) {
    if (node.type === "pipe_table") return node;
    if (node.children.some((child) => child.type === "atx_h2_marker")) return undefined;
  }
  return undefined;
}

/** Each data row's (never the header row's, never the delimiter row's) first cell, trimmed. */
export function keysOf(table: Parser.SyntaxNode): Set<string> {
  const keys = new Set<string>();
  for (const row of table.children) {
    if (row.type !== "pipe_table_row") continue;
    const firstCell = row.children.find((child) => child.type === "pipe_table_cell");
    if (firstCell !== undefined) keys.add(firstCell.text.trim());
  }
  return keys;
}

/** A key's value cell, trimmed — `undefined` when the key has no row. Used by an action that needs the
 *  VALUE of a header field (`plan status` reading `Status`), never by `record-header`, which is
 *  presence-only by design. */
export function valueOf(table: Parser.SyntaxNode, key: string): string | undefined {
  for (const row of table.children) {
    if (row.type !== "pipe_table_row") continue;
    const cells = row.children.filter((child) => child.type === "pipe_table_cell");
    if (cells.length >= 2 && cells[0]!.text.trim() === key) return cells[1]!.text.trim();
  }
  return undefined;
}
