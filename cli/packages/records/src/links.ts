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
