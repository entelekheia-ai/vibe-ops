// Ports the detection half of module-check/sh/checks/20-links.sh onto the parsed model instead of a
// fenced-block-and-code-span-stripped-then-regexed file. The fragment strips backticks before it looks
// for `](...)`, which is correct for its own purpose and the reason it has never seen a link written
// inside a code span. This gate needs no equivalent stripping: a link inside a code_span never becomes
// an inline_link node at all — the grammar gives the distinction structurally (see
// project/tasks/003-the-inline-layer-gates.md, Surprises).
//
// Walks every `text.markdown_inline` layer the model resolved, declared AND supplemental — the
// supplement (project/tasks/003-…, item 1) is what makes a link written inside a table cell visible
// here at all; the fragment's own regex has no notion of structure and already saw those.
//
// Collects nodes carrying a `link_destination` child, which covers `inline_link` and `image`
// uniformly. `shortcut_link` carries no such child and needs no explicit skip — it is simply never
// collected.

import { defineGate, lineAt, walkLayersWithHostPositions } from "@entelekheia/vibe-ops-core";
import type { GateFinding } from "@entelekheia/vibe-ops-core";
import { existsSync } from "node:fs";
import path from "node:path";

const LINK_NODE_TYPES = ["inline_link", "image"];

// Same skip list as the fragment: an external link, an in-page anchor, a mail link, or a path still
// carrying an unexpanded template variable are not this gate's concern.
function isSkipped(rawTarget: string): boolean {
  return (
    rawTarget.startsWith("http") ||
    rawTarget.startsWith("#") ||
    rawTarget.startsWith("mailto:") ||
    rawTarget.includes("${")
  );
}

/**
 * `dirRel/target`, normalized to a repository-relative path — a stack of path components, the same
 * algorithm `check-agents-md.sh`'s own `norm_rel` uses. Returns `"OUTSIDE"` when a `..` climbs past the
 * repository root, matching the fragment's own sentinel rather than throwing or clamping.
 */
function normalizeRelative(dirRel: string, target: string): string | "OUTSIDE" {
  const combined = dirRel === "." ? target : `${dirRel}/${target}`;
  const out: string[] = [];
  for (const part of combined.split("/")) {
    if (part === "" || part === ".") continue;
    if (part === "..") {
      if (out.length === 0) return "OUTSIDE";
      out.pop();
      continue;
    }
    out.push(part);
  }
  return out.join("/");
}

export default defineGate(
  {
    id: "markdown-link",
    summary: "Every relative link in tracked markdown resolves inside the repository",
    defaultPaths: ["**/*.md"],
  },
  async ({ repoRoot, files, documents }) => {
    const findings: GateFinding[] = [];
    let examined = 0;

    for (const file of files) {
      const document = documents.get(file);
      if (document.tree === undefined) continue;
      examined++;

      const dirRel = path.posix.dirname(file);

      for (const { layer, hostStart } of walkLayersWithHostPositions(document.layers)) {
        if (layer.languageId !== "text.markdown_inline") continue;

        for (const node of layer.tree.rootNode.descendantsOfType(LINK_NODE_TYPES)) {
          const destinationNode = node.children.find((c) => c.type === "link_destination");
          if (destinationNode === undefined) continue;

          const rawTarget = destinationNode.text;
          if (isSkipped(rawTarget)) continue;

          const target = rawTarget.split("#")[0]!;
          if (target === "") continue;

          const line = lineAt(document.text, hostStart + destinationNode.startIndex);

          if (target.startsWith("/")) {
            findings.push({
              rule: "links",
              file,
              line,
              evidence: `absolute path in a link: ${target}`,
            });
            continue;
          }

          const normalized = normalizeRelative(dirRel, target);
          if (normalized === "OUTSIDE") {
            findings.push({
              rule: "links",
              file,
              line,
              evidence: `link reaches outside the repository: ${target}`,
            });
            continue;
          }
          if (!existsSync(path.join(repoRoot, normalized))) {
            findings.push({
              rule: "links",
              file,
              line,
              evidence: `link does not resolve: ${target}`,
            });
          }
        }
      }
    }

    return { findings, examined };
  },
);
