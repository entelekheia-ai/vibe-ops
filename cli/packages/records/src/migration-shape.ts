// What a template STOPPED having, read from the migration note that recorded the change — Plan-014.
//
// WHY NOT GIT HISTORY. History answers *what changed* and not *what the change meant*: a renamed section
// reads there as a drop plus an addition, and a detector built on that would demand documents stop naming
// a section that still exists. A migration note is the opposite — one row per section, written on purpose
// by whoever moved the template, and already required to exist for every version jump.
//
// THE ROW SHAPE IS A CONTRACT, not a coincidence, and `skills/new-migration/SKILL.md` says so. The notes
// carry two table shapes: the frontmatter-move notes open their table with an empty first header cell,
// while a note that changed content opens it with the literal `Section`. Only the second kind can name a
// dropped section, so keying on that header cell is what separates them — and a note whose table this
// cannot read yields nothing, which is the safe direction: a missed drop is a gate that does not fire,
// never a gate that accuses a correct sentence.
//
// A ROW NAMES A SECTION ONLY WHEN ITS FIRST CELL IS A HEADING IN A CODE SPAN (`` `## Progress` ``). That
// is what excludes the summary rows every such table also carries — `Living sections`, `Header table` —
// without needing a list of their names, which would be a second thing to keep current.

import type Parser from "tree-sitter";
import type { Document } from "@entelekheia/vibe-ops-core";

/** A first cell like `` `## Surprises & Discoveries` ``: a code span holding an ATX heading. */
const SECTION_CELL = /^`\s*#{1,6}\s+(.+?)\s*`$/;

/** A last cell whose verdict opens with the fate this reader is looking for. */
const DROPPED = /^\*\*dropped\*\*/;

/** The header cell that marks a table as the one describing per-section fates. */
const SECTION_HEADER = "Section";

function cellsOf(row: Parser.SyntaxNode): readonly Parser.SyntaxNode[] {
  return row.children.filter((child) => child.type === "pipe_table_cell");
}

/**
 * The section headings a migration note records as dropped, in document order.
 *
 * Reads only tables whose header row's first cell is `Section`; within those, a row counts when its first
 * cell is a heading written as a code span and its LAST cell opens with `**dropped**`. The last cell is
 * the new version's column by construction — these tables are old-shape then new-shape — so a note that
 * grows a fourth column keeps working without this knowing how many it has.
 *
 * Empty for a note that dropped nothing, which is the ordinary case: of this repository's seven notes,
 * six state that no section was added, dropped, renamed or retyped.
 */
export function droppedSections(note: Document): readonly string[] {
  const root = note.tree?.rootNode;
  if (root === undefined) return [];

  const dropped: string[] = [];
  for (const table of root.descendantsOfType("pipe_table")) {
    const header = table.children.find((child) => child.type === "pipe_table_header");
    if (header === undefined) continue;
    const headerCells = cellsOf(header);
    if (headerCells[0]?.text.trim() !== SECTION_HEADER) continue;

    for (const row of table.children) {
      if (row.type !== "pipe_table_row") continue;
      const cells = cellsOf(row);
      if (cells.length < 2) continue;
      const named = SECTION_CELL.exec(cells[0]!.text.trim());
      if (named === null) continue;
      if (!DROPPED.test(cells[cells.length - 1]!.text.trim())) continue;
      dropped.push(named[1]!.trim());
    }
  }
  return dropped;
}
