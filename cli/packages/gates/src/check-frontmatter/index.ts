// Ported from cli/packages/module-check/sh/checks/40-frontmatter.sh and 45-skill-frontmatter.sh — the
// same detector against three schemas: *this markdown declares the frontmatter its type requires*. One
// gate, an `options.schema` argument, and a third type costs a schema rather than a fragment
// (RFC-0001, Implementation Notes) — `agent` is that third type, added by Plan-024 with no shell
// precedent at all and none coming, since the fragments are being retired rather than extended. The
// `rule` on a finding names the failure per type ("frontmatter" / "skill-frontmatter" /
// "agent-frontmatter"), because they are distinct failure modes: an unsurfaced rule, a silently-dropped
// skill and an agent that runs under permissions its own file disclaims are different consequences for
// the reader who hits them.
//
// A rule with no description is never surfaced to the agent. A skill whose frontmatter does not parse
// loads with EMPTY metadata — the unquoted-": "-in-a-value fault that shipped once and was invisible
// from inside the repository until `claude plugin tag` caught it at release (ADR-0004).
//
// Plan-013 Track 5: the manual `lines[0] !== "---"` / `indexOf("---", 1)` block extraction is replaced by
// `readFrontmatter`, which reads the parsed yaml layer instead of guessing where the block ends — it
// folds a multi-line `description:` correctly, which a line reader does not. The `skill` schema's
// unquoted-`": "` heuristic stays: it names the offending key and says exactly what breaks, which
// `hasError` alone cannot. Beside it, `hasError` is now a real, independent finding — measured
// 2026-08-12 against the installed `@tree-sitter-grammars/tree-sitter-yaml@0.7.1`: a tab-indented key or
// an unclosed quote sets it and the heuristic below cannot see either. The ERROR node's own span ends
// exactly at the fault and still contains every `block_mapping_pair` the parser recovered before it, so
// the finding can usually still name the last key that parsed cleanly. The two findings are
// complementary, not redundant — a parse failure and a missing `description:` are different faults and
// both can be true of the same file. `schema` is untouched: both shapes require the same one key today,
// and generalizing it into a declarative format is deliberately out of scope (Plan-013 Decision Log).

import { defineGate, lineAt, walkLayersWithHostPositions } from "@entelekheia/vibe-ops-core";
import type { GateFinding } from "@entelekheia/vibe-ops-core";
import { readFrontmatter } from "@entelekheia/vibe-ops-records";

type Schema = "rule" | "skill" | "agent";

interface FrontmatterOptions {
  readonly schema?: Schema;
}

const KEY_VALUE = /^([A-Za-z0-9_-]+): (.*)$/;

// Plan-024 Track 6: the third schema, and the first whose faults are not about parsing at all. A
// plugin-shipped agent declaring one of these is not rejected and not warned about — the field is
// dropped at load, for security, so the agent runs with the caller's permission context while its own
// file says otherwise. That is the failure shape this gate exists for: silent, and readable as working.
const IGNORED_IN_A_PLUGIN = ["hooks", "mcpServers", "permissionMode"] as const;

// The only value the field accepts. Anything else is a typo that reads as configuration.
const ISOLATION_VALUE = "worktree";

const RULE_BY_SCHEMA: Record<Schema, string> = {
  rule: "frontmatter",
  skill: "skill-frontmatter",
  agent: "agent-frontmatter",
};

// What the reader loses when the frontmatter is dropped, per type — the consequence, not the fault.
const NEVER_BY_SCHEMA: Record<Schema, string> = {
  rule: "surfaced",
  skill: "matched",
  agent: "delegated to",
};

export default defineGate(
  {
    id: "check-frontmatter",
    version: 1,
    summary: "The declared type's frontmatter parses and declares a description",
  },
  async ({ files, documents, options }) => {
    const schema = (options as FrontmatterOptions).schema ?? "rule";
    const rule = RULE_BY_SCHEMA[schema];
    const noun = schema;
    const findings: GateFinding[] = [];
    let examined = 0;

    for (const file of files) {
      const document = documents.get(file);
      if (document.tree === undefined) continue;
      examined += 1;

      const positioned = walkLayersWithHostPositions(document.layers).find(
        ({ layer, hostStart }) => layer.languageId === "source.yaml" && hostStart === 0,
      );
      if (positioned === undefined) {
        findings.push({ rule, file, evidence: "has no frontmatter block" });
        continue;
      }
      const root = positioned.layer.tree.rootNode;

      if (root.hasError) {
        const error = root.descendantsOfType("ERROR")[0];
        const line = lineAt(document.text, positioned.hostStart + (error?.endIndex ?? root.endIndex));
        const keys = (error?.descendantsOfType("block_mapping_pair") ?? [])
          .map((pair) => pair.childForFieldName("key")?.text)
          .filter((key): key is string => key !== undefined);
        const lastKey = keys[keys.length - 1];
        findings.push({
          rule,
          file,
          line,
          evidence:
            lastKey === undefined
              ? "frontmatter does not parse"
              : `frontmatter does not parse — the fault follows \`${lastKey}:\``,
        });
      }

      // Kept beside `hasError` deliberately: it names the offending key in language that says what will
      // happen, not merely that something is wrong. Reads `document.text` sliced to the layer's own
      // HOST span, not `root.text` — a parse error truncates the tree's own `.text` to what it managed
      // to consume (measured: a colon two keys deep leaves `root.text` ending mid-line, well before the
      // fault this heuristic exists to catch), while `hostEnd` comes from the injection query's capture
      // span and always covers the full `---`-to-`---` block regardless of what the sub-parse recovered.
      if (schema === "skill" || schema === "agent") {
        const block = document.text.slice(positioned.hostStart, positioned.hostEnd);
        const offenders: string[] = [];
        for (const line of block.split("\n")) {
          const match = KEY_VALUE.exec(line);
          if (match === null) continue;
          const value = match[2] ?? "";
          if (!/^["']/.test(value) && value.includes(": ")) offenders.push(match[1] ?? "");
        }
        if (offenders.length > 0) {
          findings.push({
            rule,
            file,
            evidence: `${offenders.join(" ")} — unquoted value contains ": ", frontmatter will not parse and ALL fields are silently dropped`,
          });
        }
      }

      const frontmatter = readFrontmatter(document);
      const description = frontmatter?.scalars.get("description");
      if (description === undefined || description === "") {
        findings.push({ rule, file, evidence: `has no description: — a ${noun} without one is never ${NEVER_BY_SCHEMA[schema]}` });
      }

      if (schema === "agent" && frontmatter !== undefined) {
        for (const key of IGNORED_IN_A_PLUGIN) {
          if (!frontmatter.keys.includes(key)) continue;
          findings.push({
            rule,
            file,
            evidence: `declares \`${key}:\`, which a plugin-shipped agent does not support — it is dropped at load, silently, and the agent runs under the caller's own instead`,
          });
        }
        const isolation = frontmatter.scalars.get("isolation");
        if (isolation !== undefined && isolation.replace(/^["']|["']$/g, "") !== ISOLATION_VALUE) {
          findings.push({
            rule,
            file,
            evidence: `isolation: ${isolation} — the only value is \`${ISOLATION_VALUE}\`, and anything else reads as configuration while doing nothing`,
          });
        }
      }
    }
    return { findings, examined };
  },
);
