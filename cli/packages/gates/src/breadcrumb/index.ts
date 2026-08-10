// New gate — no shell precedent. `/vibe-ops:close-task` leaves a `git show <sha>:<path>` reference
// behind when it deletes a task dossier (see .agents/rules/governance.md), and nothing has ever checked
// one of these against this repository's own history. Possible only because the block grammar's own
// `code_span` carries no link node and no further structure — nothing here strips backticks first,
// because the model already drew that boundary; the reference lives inside the span verbatim.
//
// Detection only. Plan-010 puts the reference FORM itself out of scope — no record declares it, so
// rewriting a malformed one toward a form nothing has agreed on is a judgement, not a mechanical repair.
// This gate never declares `fixable` and exposes no `fix()`, the same posture `pairing` takes for the
// one finding it also cannot safely repair.

import { defineGate, lineAt, walkLayersWithHostPositions } from "@entelekheia/vibe-ops-core";
import type { GateFinding } from "@entelekheia/vibe-ops-core";
import { existsSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const BREADCRUMB_PREFIX = "git show ";
// The form found in this repository's own corpus: a full 40-character sha, a colon, then the path —
// no space, no abbreviation. See project/tasks/003-the-inline-layer-gates.md, item 4.
const BREADCRUMB_PATTERN = /^git show ([0-9a-f]{40}):(.+)$/;

function gitObjectExists(repoRoot: string, ref: string): boolean {
  return spawnSync("git", ["cat-file", "-e", ref], { cwd: repoRoot, stdio: "ignore" }).status === 0;
}

/** A code_span node's own `.text` includes its backtick delimiters — stripped by matching them, not by a fixed offset, since a span containing a literal backtick opens with more than one. */
function stripCodeSpanDelimiters(text: string): string {
  const match = /^(`+)([\s\S]*)\1$/.exec(text);
  return match?.[2] ?? text;
}

export default defineGate(
  {
    id: "breadcrumb",
    summary: "Every `git show <sha>:<path>` reference resolves against this repository's own history",
    defaultPaths: ["**/*.md"],
  },
  async ({ repoRoot, files, documents }) => {
    const findings: GateFinding[] = [];
    let examined = 0;

    for (const file of files) {
      const document = documents.get(file);
      if (document.tree === undefined) continue;
      examined++;

      for (const { layer, hostStart } of walkLayersWithHostPositions(document.layers)) {
        if (layer.languageId !== "text.markdown_inline") continue;

        for (const node of layer.tree.rootNode.descendantsOfType("code_span")) {
          const inner = stripCodeSpanDelimiters(node.text);
          if (!inner.startsWith(BREADCRUMB_PREFIX)) continue;
          // `<sha>`, `<path>`, `NNN-slug.md` — governance.md and every task/plan template teach this
          // convention using placeholder syntax, in a real code_span, starting with "git show ". A real
          // sha is never spelled with "<" in it, so this is the one signal that distinguishes "teaching
          // the form" from "attempting to use it" without hand-listing every doc that does the teaching.
          if (inner.includes("<")) continue;

          const line = lineAt(document.text, hostStart + node.startIndex);
          const match = BREADCRUMB_PATTERN.exec(inner);
          if (match === null) {
            findings.push({ rule: "breadcrumb", file, line, evidence: `malformed breadcrumb reference: ${inner}` });
            continue;
          }
          const sha = match[1]!;
          const refPath = match[2]!;

          if (!gitObjectExists(repoRoot, `${sha}^{commit}`)) {
            findings.push({
              rule: "breadcrumb",
              file,
              line,
              evidence: `commit does not resolve in this repository: ${sha}`,
            });
            continue;
          }

          if (!gitObjectExists(repoRoot, `${sha}:${refPath}`)) {
            findings.push({
              rule: "breadcrumb",
              file,
              line,
              evidence: `path did not exist at that commit: ${refPath}`,
            });
            continue;
          }

          if (existsSync(path.join(repoRoot, refPath))) {
            findings.push({
              rule: "breadcrumb",
              file,
              line,
              evidence: `the file this breadcrumb points at is still in the working tree: ${refPath}`,
              level: "warn",
            });
          }
        }
      }
    }

    return { findings, examined };
  },
);
