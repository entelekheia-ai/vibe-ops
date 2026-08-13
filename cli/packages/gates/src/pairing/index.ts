// New gate — not a port. Every AGENTS.md must have a sibling CLAUDE.md containing `@AGENTS.md`, or it
// never enters context on its own: plugin/references/instruction-surfaces.md measured eleven AGENTS.md
// files across ten repositories with no sibling and no `@`-import reaching them, two of them roots.
//
// Two distinct failure modes, not one, and the split is by MODE, not by depth:
//
//   no-sibling-claude-md    the sibling does not exist at all — mechanical, so it fails and is fixable
//   claude-md-no-import     it exists but does not link back — unrepairable on purpose (see below), warn
//
// A nested AGENTS.md with no sibling used to warn, on the theory that a path-scoped rule was an
// available alternative. That choice was made BEFORE the file existed; once it exists, it either loads
// or it does not, and depth changes nothing about that or about the one-line repair. So both modes are
// now level-uniform across root and nested.
//
// claude-md-no-import stays warn rather than fail, and its fix() never touches the file: appending an
// import to a CLAUDE.md someone else wrote is a judgement about their content, which RFC-0001 leaves to
// a human. A hard failure the tool refuses to repair would be a dead end, so it warns instead, naming
// the consequence rather than the rule.
//
// Plan-013 Track 3: `content.includes("@AGENTS.md")` was a bare substring test, so a CLAUDE.md that only
// *mentions* the import inside a code span or a fenced example — showing the convention, not using it —
// read as correctly paired. Testing against `proseText` instead closes that. This gate deliberately does
// NOT read the sibling through `context.documents` — the store caches unconditionally, including the
// "cannot read file" document it synthesises for a path that does not exist yet, and `fix()` below
// creates exactly that file. The ops re-runs this gate afterward to confirm the repair; against the
// cached store that re-run would still see "missing" and report every successful repair as unconfirmed.
// `documentFromText` parses the freshly-read string through the same code path `documents.get()` uses,
// without a cache to go stale.

import { defineGate, documentFromText, proseText } from "@entelekheia/vibe-ops-core";
import type { GateFinding, GateFix } from "@entelekheia/vibe-ops-core";
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const IMPORT = /@AGENTS\.md/;

function importsAgentsMd(siblingRel: string, content: string): boolean {
  return IMPORT.test(proseText(documentFromText(siblingRel, content)));
}

const NO_SIBLING = "no-sibling-claude-md";
const NO_IMPORT = "claude-md-no-import";

export default defineGate(
  {
    id: "pairing",
    version: 1,
    summary: "Every AGENTS.md has a sibling CLAUDE.md containing @AGENTS.md",
    defaultPaths: ["**/AGENTS.md"],
    fixable: true,
  },
  async ({ repoRoot, files }) => {
    const findings: GateFinding[] = [];
    for (const file of files) {
      const dir = path.dirname(file);
      const siblingRel = dir === "." ? "CLAUDE.md" : path.join(dir, "CLAUDE.md");
      const siblingAbs = path.join(repoRoot, siblingRel);

      if (!existsSync(siblingAbs)) {
        findings.push({
          rule: NO_SIBLING,
          file,
          evidence: `no sibling CLAUDE.md — this AGENTS.md never enters context on its own`,
        });
        continue;
      }
      const content = await readFile(siblingAbs, "utf8");
      if (!importsAgentsMd(siblingRel, content)) {
        findings.push({
          rule: NO_IMPORT,
          file: siblingRel,
          evidence: `does not link back to its AGENTS.md — that AGENTS.md never loads from here`,
          level: "warn",
        });
      }
    }
    return { findings };
  },
  async ({ repoRoot }, findings) => {
    const fixes: GateFix[] = [];
    for (const finding of findings) {
      if (finding.rule !== NO_SIBLING || finding.file === undefined) continue;
      const dir = path.dirname(finding.file);
      const siblingRel = dir === "." ? "CLAUDE.md" : path.join(dir, "CLAUDE.md");
      await writeFile(path.join(repoRoot, siblingRel), "@AGENTS.md\n", "utf8");
      fixes.push({ file: siblingRel, action: "created, containing @AGENTS.md" });
    }
    return fixes;
  },
);
