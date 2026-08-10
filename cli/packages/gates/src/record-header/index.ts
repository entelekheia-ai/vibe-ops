// New gate — no shell precedent. A governance record (adr/plan/rfc/task) carries a `| Field | Value |`
// markdown table right after its H1, never YAML frontmatter — `check-frontmatter` reads only
// `lines[0] === "---"` and has never touched one of these files. The guarded surfaces before this gate
// were the ones a MACHINE parses (frontmatter, links); a record's header table is read only by people
// and agents, and no breakage ever forced a guard for it — sensor placement followed tool failure
// rather than the load-bearing-ness of the field.
//
// THE HEADER TABLE IS THE FIRST `pipe_table` REACHED BEFORE THE FIRST LEVEL-2 HEADING, never simply
// "the first `pipe_table`" — measured exact over this repository's own 28 tracked records (21 hits, 7
// correct misses, 0 misfires; see project/tasks/004-the-governance-ops.md, item 3). The naive reading
// instead grabs a CONTENT table in four research documents, one of them with `Field` as its own first
// column. Research carries no schema here for the same reason: nothing declares its shape, and
// inventing one is a decision Plan-004 owns, not this gate.
//
// PRESENCE ONLY — the value in each row is never validated. A status vocabulary exists, but it lives
// in prose in .agents/rules/governance.md, and reading it mechanically is a different act with its own
// scope than this one.

import { defineGate, lineAt } from "@entelekheia/vibe-ops-core";
import type { GateFinding } from "@entelekheia/vibe-ops-core";
import type Parser from "tree-sitter";

type Schema = "adr" | "plan" | "rfc" | "task";

interface RecordHeaderOptions {
  readonly schema?: Schema;
}

const REQUIRED: Readonly<Record<Schema, readonly string[]>> = {
  adr: ["Status", "Date", "Deciders"],
  plan: ["Status", "Created", "Author"],
  rfc: ["Status", "Created", "Author"],
  task: ["Status", "Created", "Author", "Issue"],
};

const SCHEMAS = new Set<Schema>(["adr", "plan", "rfc", "task"]);

/**
 * The first `pipe_table` in document order, but only when it appears before the first level-2 heading
 * — a level-2 heading with no `pipe_table` ahead of it means there is no header table at all, not that
 * the search should keep going into the body.
 */
function findHeaderTable(root: Parser.SyntaxNode): Parser.SyntaxNode | undefined {
  for (const node of root.descendantsOfType(["pipe_table", "atx_heading"])) {
    if (node.type === "pipe_table") return node;
    if (node.children.some((child) => child.type === "atx_h2_marker")) return undefined;
  }
  return undefined;
}

/** Each data row's (never the header row's, never the delimiter row's) first cell, trimmed. */
function keysOf(table: Parser.SyntaxNode): Set<string> {
  const keys = new Set<string>();
  for (const row of table.children) {
    if (row.type !== "pipe_table_row") continue;
    const firstCell = row.children.find((child) => child.type === "pipe_table_cell");
    if (firstCell !== undefined) keys.add(firstCell.text.trim());
  }
  return keys;
}

export default defineGate(
  {
    id: "record-header",
    summary: "A governance record's header table declares its type's required fields",
  },
  async ({ files, documents, options }) => {
    const schema = (options as RecordHeaderOptions).schema;
    if (schema === undefined || !SCHEMAS.has(schema)) {
      throw new Error(`record-header requires options.schema to be one of adr/plan/rfc/task, got ${String(schema)}`);
    }
    const required = REQUIRED[schema];
    const findings: GateFinding[] = [];
    let examined = 0;

    for (const file of files) {
      const document = documents.get(file);
      if (document.tree === undefined) continue;
      examined++;

      const table = findHeaderTable(document.tree.rootNode);
      if (table === undefined) {
        findings.push({
          rule: `record-header-${schema}`,
          file,
          evidence: `no header table before its first level-2 heading — a ${schema} record declares ${required.join(", ")}`,
        });
        continue;
      }

      const keys = keysOf(table);
      const missing = required.filter((key) => !keys.has(key));
      if (missing.length > 0) {
        findings.push({
          rule: `record-header-${schema}`,
          file,
          line: lineAt(document.text, table.startIndex),
          evidence: `header table is missing ${missing.join(", ")}`,
        });
      }
    }

    return { findings, examined };
  },
);
