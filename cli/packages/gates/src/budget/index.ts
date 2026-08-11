// Ported from cli/packages/module-check/sh/checks/10-budget.sh — behaviour unchanged, only the
// language. See project/rfc/0001-gates-and-ops-as-the-cli-unit-of-composition.md: this gate runs
// beside the shell fragment until the two are shown to agree, achado por achado.
//
// AGENTS.md stays under a line budget. Over budget the instruction is to relocate content and leave a
// pointer, not to compress prose — a shorter file that says the same things is not the goal.

import { defineGate } from "@entelekheia/vibe-ops-core";
import { readFile } from "node:fs/promises";
import path from "node:path";

interface BudgetOptions {
  readonly max?: number;
}

export default defineGate(
  { id: "budget", version: 1, summary: "AGENTS.md stays under a line budget", defaultPaths: ["AGENTS.md"] },
  async ({ repoRoot, files, options }) => {
    const max = (options as BudgetOptions).max ?? 150;
    if (!files.includes("AGENTS.md")) {
      return { findings: [{ rule: "budget", evidence: "no AGENTS.md at the repository root" }] };
    }
    const content = await readFile(path.join(repoRoot, "AGENTS.md"), "utf8");
    // A trailing newline should not count as an extra line — matches `wc -l`, which counts newlines.
    const n = content === "" ? 0 : content.split("\n").length - (content.endsWith("\n") ? 1 : 0);
    if (n > max) {
      return {
        findings: [
          {
            rule: "budget",
            file: "AGENTS.md",
            evidence: `AGENTS.md is ${n} lines, over the ${max}-line budget — relocate content and leave a pointer`,
          },
        ],
      };
    }
    return { findings: [] };
  },
);
