// New gate — not a port. plugin/AGENTS.md says a CLAUDE.md "may legitimately hold content another
// agent would ignore or misread" beside its @AGENTS.md import, so this is not `pairing`'s job: a
// CLAUDE.md that exists and links back is already correct by that gate's rule. This one asks a
// different, softer question — is the extra content here on purpose? — and can only ever warn.
//
// Not fixable. Deciding whether a paragraph belongs in CLAUDE.md or in the AGENTS.md it imports is a
// judgement about someone's content, the same reason pairing's own claude-md-no-import finding is
// unrepairable: this gate would have to guess where the words go, not just that they exist.
//
// Plan-013 Track 4: the HTML-comment strip (`/<!--[\s\S]*?-->/g`) is replaced by `proseText`, which
// blanks an `html_block` the same way it blanks a fenced code block — structurally, not by a regular
// expression that has to agree with the grammar's own comment syntax.

import { defineGate, proseText } from "@entelekheia/vibe-ops-core";
import type { GateFinding } from "@entelekheia/vibe-ops-core";

/** What is left after the expected shape — the import, HTML comments, and blank lines — is removed. */
function residualContent(masked: string): string {
  const lines = masked.split("\n").filter((line) => {
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
  async ({ files, documents }) => {
    const findings: GateFinding[] = [];
    for (const file of files) {
      const document = documents.get(file);
      if (document.tree === undefined) continue;
      if (residualContent(proseText(document)) === "") continue;
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
