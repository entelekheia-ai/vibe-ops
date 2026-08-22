// Finding a markdown link to a given file, structurally — the reader `task close` uses both to repoint
// referrers and to check afterwards that none survived.
//
// This walks the INLINE layers, not the block tree, because markdown's block-to-inline hand-off is itself
// an injection: an `inline_link` node does not exist in `document.tree.rootNode` at all. See
// cli/packages/core/README.md#two-places-to-look-and-they-are-not-interchangeable.
//
// Why not a regular expression, measured 2026-08-10 against a fixture holding one real link, one link
// written inside a code span, and one inside a fenced block: `\[([^\]]*)\]\([^)]*<base>\)` matches all
// THREE, the tree finds the one. Rewriting the other two would corrupt a document that was explaining its
// own link syntax — and a plan referring to a task dossier is exactly the document most likely to be
// doing that. The grammar puts a code span in a different node rather than requiring anything to be
// stripped first, which is the same property `markdown-link` was built on.

import type { Document } from "@entelekheia/vibe-ops-core";
import { walkLayersWithHostPositions } from "@entelekheia/vibe-ops-core";

export interface FoundLink {
  /** The link's whole span, in HOST document offsets — `[text](target)` inclusive. */
  readonly start: number;
  readonly end: number;
  /** The link's visible text, without its brackets. */
  readonly text: string;
  /** The destination exactly as written, so a relative path stays relative. */
  readonly target: string;
}

const LINK_NODE_TYPES = ["inline_link", "image"];

/** Not this reader's concern: an external link, an in-page anchor, a mail link, an unexpanded variable. */
function isExternal(target: string): boolean {
  return target.startsWith("http") || target.startsWith("#") || target.startsWith("mailto:") || target.includes("${");
}

/** Every RELATIVE link in `document`, in document order — what a file that moved has to re-base. */
export function relativeLinks(document: Document): readonly FoundLink[] {
  const found: FoundLink[] = [];

  for (const { layer, hostStart } of walkLayersWithHostPositions(document.layers)) {
    if (layer.languageId !== "text.markdown_inline") continue;

    for (const node of layer.tree.rootNode.descendantsOfType(LINK_NODE_TYPES)) {
      const destination = node.children.find((child) => child.type === "link_destination");
      if (destination === undefined) continue;
      const target = destination.text;
      if (isExternal(target) || target.startsWith("/")) continue;

      const label = node.children.find((child) => child.type === "link_text");
      found.push({
        start: hostStart + node.startIndex,
        end: hostStart + node.endIndex,
        text: label?.text ?? "",
        target,
      });
    }
  }
  return found.sort((a, b) => a.start - b.start);
}

/**
 * Every real link in `document` whose destination ends in one of `basenames`, in document order.
 *
 * Matched on the basename rather than the repository-relative path: a referrer writes
 * `](../tasks/001-x.md)`, so comparing against `project/tasks/001-x.md` finds nothing and reports clean —
 * which is the silent half of the failure this reader exists for.
 */
export function linksToBasenames(document: Document, basenames: readonly string[]): readonly FoundLink[] {
  const found: FoundLink[] = [];

  for (const { layer, hostStart } of walkLayersWithHostPositions(document.layers)) {
    if (layer.languageId !== "text.markdown_inline") continue;

    for (const node of layer.tree.rootNode.descendantsOfType(LINK_NODE_TYPES)) {
      const destination = node.children.find((child) => child.type === "link_destination");
      if (destination === undefined) continue;

      // A destination may carry a `#anchor`; the file is what identifies the link.
      const target = destination.text;
      const withoutAnchor = target.split("#")[0] ?? "";
      if (!basenames.some((base) => withoutAnchor.endsWith(`/${base}`) || withoutAnchor === base)) continue;

      const label = node.children.find((child) => child.type === "link_text");
      found.push({
        start: hostStart + node.startIndex,
        end: hostStart + node.endIndex,
        text: label?.text ?? "",
        target,
      });
    }
  }

  return found.sort((a, b) => a.start - b.start);
}

/** A code span naming a file, in HOST document offsets. */
export interface FoundCitation {
  readonly start: number;
  readonly end: number;
  /** The span's contents, without its backticks. */
  readonly text: string;
}

/**
 * Every CODE SPAN in `document` that IS a bare path to one of `basenames`.
 *
 * A link is not the only way to name a file, and this is the other one that matters: a plan's track list
 * writes ``Task: `project/tasks/001-x.md` `` rather than a link. `linksToBasenames` does not match it —
 * rewriting a code span would corrupt a document explaining its own syntax — so after a deletion the
 * citation points at a path that no longer exists, while the check that runs afterwards asks only about
 * links and reports clean. Measured on Plan-012: five dead citations, zero dangling reported.
 *
 * THE SPAN'S WHOLE CONTENT MUST BE THE PATH, and that is what separates a citation from a demonstration
 * rather than any guess about intent. Two spans in the same document are not the same thing:
 *
 *   `project/tasks/001-x.md`                    a citation — dead once the file is gone
 *   `[name](../tasks/001-x.md)`                 an example of link syntax, and correct forever
 *   `git show <sha>:project/tasks/001-x.md`     the repaired form, which resolves and must not be flagged
 *
 * Requiring the trimmed content to be a whitespace-free path ending in the basename admits the first and
 * excludes the other two by construction — the second ends in `)`, the third carries spaces. A substring
 * match would flag all three, and flagging the repaired form would make the fix look like the defect.
 *
 * REPORTED, NEVER REWRITTEN. What the right replacement is depends on what the span was for, which is a
 * judgement; going green while the reference is dead is not.
 *
 * Prose without backticks is out of scope on purpose: a sentence mentioning a filename is not a
 * reference, and separating the two is a detector's job, not a closing verb's.
 */
export function citationsToBasenames(document: Document, basenames: readonly string[]): readonly FoundCitation[] {
  const found: FoundCitation[] = [];

  for (const { layer, hostStart } of walkLayersWithHostPositions(document.layers)) {
    if (layer.languageId !== "text.markdown_inline") continue;

    for (const node of layer.tree.rootNode.descendantsOfType(["code_span"])) {
      const text = node.text.replaceAll("`", "").trim();
      if (/\s/.test(text)) continue;
      if (!basenames.some((base) => text.endsWith(`/${base}`) || text === base)) continue;
      found.push({ start: hostStart + node.startIndex, end: hostStart + node.endIndex, text });
    }
  }

  return found.sort((a, b) => a.start - b.start);
}

/**
 * `document.text` with each of `links` replaced by `replace(link)`. Applied back to front so an earlier
 * splice never invalidates a later offset — the same reason `tickClosureBox` splices a single span rather
 * than running a substitution.
 */
export function spliceLinks(document: Document, links: readonly FoundLink[], replace: (link: FoundLink) => string): string {
  let text = document.text;
  for (const link of [...links].sort((a, b) => b.start - a.start)) {
    text = `${text.slice(0, link.start)}${replace(link)}${text.slice(link.end)}`;
  }
  return text;
}
