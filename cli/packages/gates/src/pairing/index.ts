// New gate — not a port. Every AGENTS.md must have a sibling CLAUDE.md containing `@AGENTS.md`, or it
// never enters context on its own: plugin/references/instruction-surfaces.md measured eleven AGENTS.md
// files across ten repositories with no sibling and no `@`-import reaching them, two of them roots.
//
// Root and nested are not the same failure. A root AGENTS.md is the file a newcomer assumes was read;
// silently unread there is the worse case, so it fails. A nested one still has the `paths:`-scoped-rule
// alternative available, so it warns.

import { defineGate } from "@entelekheia/vibe-ops-core";
import type { GateFinding } from "@entelekheia/vibe-ops-core";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

function levelFor(isRoot: boolean): { level: "warn" } | Record<string, never> {
  return isRoot ? {} : { level: "warn" };
}

export default defineGate(
  {
    id: "pairing",
    summary: "Every AGENTS.md has a sibling CLAUDE.md containing @AGENTS.md",
    defaultPaths: ["**/AGENTS.md"],
  },
  async ({ repoRoot, files }) => {
    const findings: GateFinding[] = [];
    for (const file of files) {
      const dir = path.dirname(file);
      const siblingRel = dir === "." ? "CLAUDE.md" : path.join(dir, "CLAUDE.md");
      const siblingAbs = path.join(repoRoot, siblingRel);
      const isRoot = file === "AGENTS.md";

      if (!existsSync(siblingAbs)) {
        findings.push({
          rule: "pairing",
          file,
          evidence: `no sibling CLAUDE.md — this AGENTS.md never enters context on its own`,
          ...levelFor(isRoot),
        });
        continue;
      }
      const content = await readFile(siblingAbs, "utf8");
      if (!content.includes("@AGENTS.md")) {
        findings.push({
          rule: "pairing",
          file: siblingRel,
          evidence: `does not contain @AGENTS.md — the import that makes the pairing load`,
          ...levelFor(isRoot),
        });
      }
    }
    return { findings };
  },
);
