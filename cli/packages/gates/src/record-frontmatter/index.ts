// The `frontmatter` carrier's half of what `record-header` does for the `table` one — Plan-030 Track 2.
// A type's manifest declares `schema: { carrier, required }`, and each carrier maps onto exactly one
// gate: `table` here's sibling, `frontmatter` this.
//
// WHY NOT `check-frontmatter`, which already reads frontmatter. Three measured reasons, and any one of
// them is enough. Its three schemas are not required-field lists: the only presence check is
// `description`, identical across all three, and everything else is per-schema LOGIC — a line heuristic
// for an unquoted value containing `": "`, a three-key forbidden list for `agent`, an enum on
// `isolation`. Its population is the instruction surface (rules, skills, agents), not governance
// records. And two `fragment-parity` entries compare it against `40-frontmatter.sh` and
// `45-skill-frontmatter.sh`, so its behaviour is pinned until those fragments retire — the comparison
// RFC-0001 requires before a fragment may be removed. Bending it would have put that comparison at risk
// to serve a population it was never about.
//
// PRESENCE ONLY, never a value — the same boundary `record-header` draws, for the same reason: a
// vocabulary exists for some of these fields, and reading it mechanically is a different act with its
// own scope.
//
// IT READS `readFrontmatter`, NOT THE LINES ABOVE THE SECOND `---`. That helper walks the parsed yaml
// layer, which is what makes two real shapes in this repository's own log entries come out right: a
// FOLDED scalar spanning several lines, and a SEQUENCE (`path:` is a list of globs). A line reader gets
// both wrong, and a truncated sentence still reads like a sentence.

import { defineGate } from "@entelekheia/vibe-ops-core";
import type { GateFinding } from "@entelekheia/vibe-ops-core";
import { readFrontmatter } from "@entelekheia/governance-base";

interface RecordFrontmatterOptions {
  /** The record type this entry examines. Names the finding's rule; never validated against a list. */
  readonly type?: string;
  /** The frontmatter keys that type declares — from its manifest's `schema.required`. */
  readonly required?: readonly string[];
}

export default defineGate(
  {
    id: "record-frontmatter",
    version: 1,
    summary: "A governance record's frontmatter declares its type's required keys",
  },
  async ({ files, documents, options }) => {
    const { type, required } = options as RecordFrontmatterOptions;
    // Loud rather than vacuous, exactly as in `record-header`: an entry examining a real population
    // against an empty field list reports a clean sweep, indistinguishable from a correct one.
    if (typeof type !== "string" || type === "") {
      throw new Error(`record-frontmatter requires options.type — the record type it examines, got ${String(type)}`);
    }
    if (!Array.isArray(required) || required.length === 0) {
      throw new Error(
        `record-frontmatter requires options.required — the frontmatter keys a ${type} declares, from its type unit`,
      );
    }

    const findings: GateFinding[] = [];
    let examined = 0;

    for (const file of files) {
      const document = documents.get(file);
      if (document.tree === undefined) continue;
      examined++;

      const frontmatter = readFrontmatter(document);
      if (frontmatter === undefined) {
        findings.push({
          rule: `record-frontmatter-${type}`,
          file,
          evidence: `no frontmatter — a ${type} record declares ${required.join(", ")}`,
        });
        continue;
      }

      const present = new Set(frontmatter.keys);
      const missing = required.filter((key) => !present.has(key));
      if (missing.length > 0) {
        findings.push({
          rule: `record-frontmatter-${type}`,
          file,
          // Line 1 by construction: frontmatter is the layer starting at offset 0, so there is no
          // position to compute — naming a line inside it would point at a key that IS there.
          line: 1,
          evidence: `frontmatter is missing ${missing.join(", ")}`,
        });
      }
    }

    return { findings, examined };
  },
);
