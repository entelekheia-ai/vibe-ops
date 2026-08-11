// New gate — not a port. plugin/AGENTS.md says a CLAUDE.md "may legitimately hold content another
// agent would ignore or misread" beside its @AGENTS.md import, so this is not `pairing`'s job: a
// CLAUDE.md that exists and links back is already correct by that gate's rule. This one asks a
// different, softer question — is the extra content here on purpose? — and can only ever warn.
//
// Not fixable. Deciding whether a paragraph belongs in CLAUDE.md or in the AGENTS.md it imports is a
// judgement about someone's content, the same reason pairing's own claude-md-no-import finding is
// unrepairable: this gate would have to guess where the words go, not just that they exist.

import { defineGate } from "@entelekheia/vibe-ops-core";
import type { GateFinding } from "@entelekheia/vibe-ops-core";
import { readFile } from "node:fs/promises";
import path from "node:path";

/** What is left after the expected shape — the import, HTML comments, and blank lines — is removed. */
function residualContent(raw: string): string {
  const withoutComments = raw.replace(/<!--[\s\S]*?-->/g, "");
  const lines = withoutComments.split("\n").filter((line) => {
    const trimmed = line.trim();
    return trimmed !== "" && trimmed !== "@AGENTS.md";
  });
  return lines.join("\n").trim();
}

export default defineGate(
  {
    id: "claude-md-content",
    version: 1,
    summary: "A CLAUDE.md carries only its @AGENTS.md import, or the rest looks like a deliberate choice",
    defaultPaths: ["**/CLAUDE.md"],
  },
  async ({ repoRoot, files }) => {
    const findings: GateFinding[] = [];
    for (const file of files) {
      const raw = await readFile(path.join(repoRoot, file), "utf8");
      if (residualContent(raw) === "") continue;
      findings.push({
        rule: "claude-md-carries-content",
        file,
        evidence: "carries content beyond @AGENTS.md — confirm it belongs here rather than in the AGENTS.md it imports",
        level: "warn",
      });
    }
    return { findings };
  },
);
