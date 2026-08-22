// New gate — no shell precedent. A governance record (adr/plan/rfc/task) carries a `| Field | Value |`
// markdown table right after its H1, never YAML frontmatter — `check-frontmatter` reads only
// `lines[0] === "---"` and has never touched one of these files. The guarded surfaces before this gate
// were the ones a MACHINE parses (frontmatter, links); a record's header table is read only by people
// and agents, and no breakage ever forced a guard for it — sensor placement followed tool failure
// rather than the load-bearing-ness of the field.
//
// THE HEADER TABLE IS THE FIRST `pipe_table` REACHED BEFORE THE FIRST LEVEL-2 HEADING — `findHeaderTable`
// and `keysOf` live in @entelekheia/governance-base (Plan-011 Track 2), the one definition of where a
// record's header is, shared with the action side that reads the same table's VALUES. Measured exact
// over this repository's own 28 tracked records (21 hits, 7 correct misses, 0 misfires; see
// project/tasks/004-the-governance-ops.md, item 3) — the naive reading instead grabs a CONTENT table in
// four research documents, one of them with `Field` as its own first column.
//
// PRESENCE ONLY — the value in each row is never validated. A status vocabulary exists, but it lives
// in prose in .agents/rules/governance.md, and reading it mechanically is a different act with its own
// scope than this one — see `vibe-ops plan status` (Plan-011 Track 3), which reads the value.

// THE TYPE AND ITS FIELDS ARE DATA, NOT A UNION HERE (Plan-030 Track 2). This gate used to hold
// `"adr" | "plan" | "rfc" | "task"` and a `REQUIRED` map keyed by it, and THREW on anything else — so a
// type a package contributes could not get an entry without editing this repository, which is the
// coupling RFC-0003 exists to remove. Both facts now arrive through `options`, from the type's own
// manifest (`types/<name>/type.json`, `schema.required`).
//
// `options.type`, NOT `options.schema`: with the field list arriving as data this names a record type
// rather than selecting a schema. `check-frontmatter` keeps `schema` precisely because there it does
// select behaviour — `rule`/`skill`/`agent` are not record types.
//
// THE RULE STAYS `record-header-<type>`, AND SO DOES THE ENTRY'S LABEL. They coincide by construction,
// and everything downstream keys on one or the other: `ignore`, `disabled` and `--fix` on the label,
// `level` on the rule first, the emitted artifact on both. Changing either would silently unbind a
// repository's configuration from the entries it names.

import { defineGate, lineAt } from "@entelekheia/vibe-ops-core";
import type { GateFinding } from "@entelekheia/vibe-ops-core";
import { findHeaderTable, keysOf } from "@entelekheia/governance-base";

interface RecordHeaderOptions {
  /** The record type this entry examines. Names the finding's rule; never validated against a list. */
  readonly type?: string;
  /** The header fields that type declares — from its manifest's `schema.required`. */
  readonly required?: readonly string[];
}

export default defineGate(
  {
    id: "record-header",
    version: 1,
    summary: "A governance record's header table declares its type's required fields",
  },
  async ({ files, documents, options }) => {
    const { type, required } = options as RecordHeaderOptions;
    // Loud rather than vacuous: a misconfigured entry that examined a real population against an empty
    // field list would report a clean sweep, which is indistinguishable from a correct one.
    if (typeof type !== "string" || type === "") {
      throw new Error(`record-header requires options.type — the record type it examines, got ${String(type)}`);
    }
    if (!Array.isArray(required) || required.length === 0) {
      throw new Error(
        `record-header requires options.required — the header fields a ${type} declares, from its type unit`,
      );
    }

    const findings: GateFinding[] = [];
    let examined = 0;

    for (const file of files) {
      const document = documents.get(file);
      if (document.tree === undefined) continue;
      examined++;

      const table = findHeaderTable(document.tree.rootNode);
      if (table === undefined) {
        findings.push({
          rule: `record-header-${type}`,
          file,
          evidence: `no header table before its first level-2 heading — a ${type} record declares ${required.join(", ")}`,
        });
        continue;
      }

      const keys = keysOf(table);
      const missing = required.filter((key) => !keys.has(key));
      if (missing.length > 0) {
        findings.push({
          rule: `record-header-${type}`,
          file,
          line: lineAt(document.text, table.startIndex),
          evidence: `header table is missing ${missing.join(", ")}`,
        });
      }
    }

    return { findings, examined };
  },
);
