// Ported from cli/packages/module-check/sh/checks/40-frontmatter.sh and 45-skill-frontmatter.sh — the
// same detector against two schemas: *this markdown declares the frontmatter its type requires*. One
// gate, an `options.schema` argument, and a third type costs a schema rather than a fragment
// (RFC-0001, Implementation Notes). The `rule` on a finding still names the shell fragment it replaces
// ("frontmatter" / "skill-frontmatter"), because the two really are distinct failure modes: an
// unsurfaced rule and a silently-dropped skill are different consequences for the reader who hits them.
//
// A rule with no description is never surfaced to the agent. A skill whose frontmatter does not parse
// loads with EMPTY metadata — the unquoted-": "-in-a-value fault that shipped once and was invisible
// from inside the repository until `claude plugin tag` caught it at release (ADR-0004).

import { defineGate } from "@entelekheia/vibe-ops-core";
import type { GateFinding } from "@entelekheia/vibe-ops-core";
import { readFile } from "node:fs/promises";
import path from "node:path";

type Schema = "rule" | "skill";

interface FrontmatterOptions {
  readonly schema?: Schema;
}

const DESCRIPTION = /^description:\s*\S/m;
const KEY_VALUE = /^([A-Za-z0-9_-]+): (.*)$/;

function frontmatterBlock(content: string): string[] | undefined {
  const lines = content.split("\n");
  if (lines[0] !== "---") return undefined;
  const close = lines.indexOf("---", 1);
  return close === -1 ? lines.slice(1) : lines.slice(1, close);
}

export default defineGate(
  {
    id: "check-frontmatter",
    summary: "The declared type's frontmatter parses and declares a description",
  },
  async ({ repoRoot, files, options }) => {
    const schema = (options as FrontmatterOptions).schema ?? "rule";
    const rule = schema === "skill" ? "skill-frontmatter" : "frontmatter";
    const noun = schema === "skill" ? "skill" : "rule";
    const findings: GateFinding[] = [];

    for (const file of files) {
      const content = await readFile(path.join(repoRoot, file), "utf8");
      const block = frontmatterBlock(content);
      if (block === undefined) {
        findings.push({ rule, file, evidence: "has no frontmatter block" });
        continue;
      }

      if (schema === "skill") {
        const offenders: string[] = [];
        for (const line of block) {
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

      if (!DESCRIPTION.test(block.join("\n"))) {
        findings.push({ rule, file, evidence: `has no description: — a ${noun} without one is never ${schema === "skill" ? "matched" : "surfaced"}` });
      }
    }
    return { findings };
  },
);
