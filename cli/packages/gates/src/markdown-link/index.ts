// Ports the detection half of module-check/sh/unported/checks/20-links.sh onto the parsed model instead of a
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

import { createTargetResolver, defineGate, lineAt, walkLayersWithHostPositions } from "@entelekheia/vibe-ops-core";
import type { GateFinding, TargetReading, TargetState } from "@entelekheia/vibe-ops-core";
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

/**
 * What one classified target means for this gate: nothing when the link holds, otherwise the rule it
 * breaks, the words a reader needs to fix it, and — only where it should differ from `fail` — a level.
 *
 * The rule is the repository's handle on the finding: `settings.<ops>.level` and `ignore` key on it, so a
 * state that deserves its own policy needs its own rule rather than a different sentence under `links`.
 * `reading.followed` is set only for an `ignored` target under `targets.ignored: "follow"`.
 */
function verdictFor(
  reading: TargetReading,
  target: string,
  source: TargetState,
): Pick<GateFinding, "rule" | "evidence" | "level"> | undefined {
  switch (reading.state) {
    case "tracked":
      return undefined;
    case "absent":
      return { rule: "links", evidence: `link does not resolve: ${target}` };
    case "untracked":
      // Resolves on this machine and in no other checkout — and this commit is the last moment the author
      // can still fix it, so it blocks.
      return { rule: "links-untracked", evidence: `link points at a file git does not track as written: ${target} — add it, or match the spelling git tracks (case, Unicode form); otherwise the link breaks in every other checkout` };
    case "ignored": {
      if (reading.followed !== undefined) {
        return reading.followed.exists
          ? undefined
          : { rule: "links", evidence: `link does not resolve: ${target} (followed into the main working tree: ${reading.followed.where})` };
      }
      // An ignored document linking into an ignored path never reaches a clone, so neither end can break
      // there — worth a word, not a refusal. A tracked one carries the link into every checkout that lacks it.
      return {
        rule: "links-ignored",
        evidence: `link points into a path this repository ignores: ${target} — declare targets.ignored "follow" if the repository means it`,
        ...(source === "ignored" ? { level: "warn" as const } : {}),
      };
    }
  }
}

export default defineGate(
  {
    id: "markdown-link",
    // 2: the verdict reads the repository (the index and its ignore rules) instead of the disk, and a
    // target the repository ignores or does not track is a finding under a rule of its own.
    version: 2,
    summary: "Every relative link in tracked markdown resolves inside the repository",
    defaultPaths: ["**/*.md"],
  },
  async ({ repoRoot, files, documents, targets: given }) => {
    const targets = given ?? createTargetResolver(repoRoot);
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
          const verdict = verdictFor(targets.classify(normalized), target, targets.classify(file).state);
          if (verdict !== undefined) findings.push({ file, line, ...verdict });
        }
      }
    }

    return { findings, examined };
  },
);
