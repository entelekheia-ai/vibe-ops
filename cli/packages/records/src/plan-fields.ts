// PLAN_ACTIVE, PLAN_TERMINAL and LIVING — read from a plan template's own markers rather than assumed,
// so a repository whose plan template declares a different status chain or a different living-section
// list still gets a real answer.
//
// Every function here takes a `Document` and reads its BLOCK tree, per
// cli/packages/core/README.md#two-places-to-look-and-they-are-not-interchangeable: an HTML comment, a
// heading and a fenced block are all block-level nodes, so none of them needs a layer walk. Reading the
// tree rather than the raw text is what makes two of these exact instead of approximate — see
// `chainFromAuthority`, where the chain lives inside a fenced block, and the marker lookups, where a
// marker string quoted elsewhere in the file is not an `html_block` at all and cannot be mistaken for
// the real one.

import type { Document } from "@entelekheia/vibe-ops-core";
import type Parser from "tree-sitter";

const STATUS_LIFECYCLE_MARKER = "Status lifecycle:";
const LIVING_START = "===== LIVING SECTIONS";
const LIVING_END = "===== END LIVING SECTIONS";

/**
 * A chain term with a trailing parenthetical gloss removed — the authority writes
 * `Backlog → In Progress → Shipped   (the file is never deleted)`, and the last term of that chain is
 * `Shipped`, not the sentence explaining it. The template cuts its own chain at the first `.` instead
 * and never reaches this, but a term is normalized the same way whichever source it came from.
 */
function term(raw: string): string {
  return raw.replace(/\s*\([^)]*\)\s*$/, "").trim();
}

/**
 * The middle term of an arrow chain — "Backlog → In Progress → Shipped" returns "In Progress" — via
 * the same middle-of-N rule the shell uses (`mid = (n + 1) / 2`, integer division), so a chain longer
 * or shorter than three states still gets a plausible answer instead of a hardcoded assumption of three.
 */
export function extractMidArrow(line: string): string {
  const terms = line.split("→");
  const mid = Math.max(1, Math.floor((terms.length + 1) / 2));
  return term(terms[mid - 1] ?? "");
}

/** The last term of an arrow chain — "Backlog → In Progress → Shipped" returns "Shipped". */
export function extractLastArrow(line: string): string {
  const terms = line.split("→");
  return term(terms[terms.length - 1] ?? "");
}

function blockRoot(document: Document): Parser.SyntaxNode | undefined {
  return document.tree?.rootNode;
}

function htmlBlockContaining(root: Parser.SyntaxNode, needle: string): Parser.SyntaxNode | undefined {
  return root.descendantsOfType("html_block").find((node) => node.text.includes(needle));
}

/** The `Status lifecycle:` comment's own text, cut at its first `.` after the marker — the raw chain,
 *  before either `extractMidArrow` or `extractLastArrow` reduces it to one term. */
function chainFromTemplate(document: Document): string | undefined {
  const root = blockRoot(document);
  if (root === undefined) return undefined;

  const block = htmlBlockContaining(root, STATUS_LIFECYCLE_MARKER);
  if (block === undefined) return undefined;

  const after = block.text.slice(block.text.indexOf(STATUS_LIFECYCLE_MARKER) + STATUS_LIFECYCLE_MARKER.length);
  const chain = (after.split(".")[0] ?? "").trim();
  return chain === "" ? undefined : chain;
}

/**
 * Fallback for a repository with no template but a governance rule: the arrow chain under the first
 * heading naming "Plan".
 *
 * The shell searched the eight lines after such a heading. This searches the heading's own `section`
 * node — the grammar groups a heading with everything up to the next same-or-higher heading — and
 * prefers a `fenced_code_block` inside it, which is where the chain actually is in this repository's own
 * `.agents/rules/governance.md` (measured 2026-08-10: one fenced block in the `### Plan` section,
 * holding exactly the chain). A fixed line count is right only by luck; the section boundary is the
 * thing the document actually declares.
 */
function chainFromAuthority(document: Document): string | undefined {
  const root = blockRoot(document);
  if (root === undefined) return undefined;

  for (const heading of root.descendantsOfType("atx_heading")) {
    const inline = heading.children.find((child) => child.type === "inline");
    if (inline === undefined || !/plan/i.test(inline.text)) continue;

    const section = heading.parent;
    if (section?.type !== "section") continue;

    for (const fence of section.descendantsOfType("fenced_code_block")) {
      const line = fence.text.split("\n").find((candidate) => candidate.includes("→"));
      if (line !== undefined) return line;
    }

    // No fenced block: the chain is written as prose in the section body. The heading is always the
    // section's first child, so slicing its text off is what keeps a heading that itself contains an
    // arrow from being mistaken for the answer.
    const body = section.text.slice(heading.text.length);
    const line = body.split("\n").find((candidate) => candidate.includes("→"));
    if (line !== undefined) return line;
  }
  return undefined;
}

export function planActiveFromTemplate(document: Document): string | undefined {
  const chain = chainFromTemplate(document);
  return chain === undefined ? undefined : extractMidArrow(chain);
}

export function planTerminalFromTemplate(document: Document): string | undefined {
  const chain = chainFromTemplate(document);
  return chain === undefined ? undefined : extractLastArrow(chain);
}

export function planActiveFromAuthority(document: Document): string | undefined {
  const chain = chainFromAuthority(document);
  return chain === undefined ? undefined : extractMidArrow(chain);
}

export function planTerminalFromAuthority(document: Document): string | undefined {
  const chain = chainFromAuthority(document);
  return chain === undefined ? undefined : extractLastArrow(chain);
}

/**
 * Every level-2 heading's own text, for every heading starting strictly between the two
 * `LIVING SECTIONS` marker comments, in document order. `undefined` when either marker is absent or the
 * region between them names no such heading — one marker without the other is treated the same as
 * neither, since a consumer must not guess where the list stops.
 */
export function livingSectionsFromTemplate(document: Document): readonly string[] | undefined {
  const root = blockRoot(document);
  if (root === undefined) return undefined;

  const start = htmlBlockContaining(root, LIVING_START);
  const end = htmlBlockContaining(root, LIVING_END);
  if (start === undefined || end === undefined) return undefined;

  const sections: string[] = [];
  for (const heading of root.descendantsOfType("atx_heading")) {
    if (!heading.children.some((child) => child.type === "atx_h2_marker")) continue;
    if (heading.startIndex <= start.startIndex || heading.startIndex >= end.startIndex) continue;
    const inline = heading.children.find((child) => child.type === "inline");
    if (inline !== undefined) sections.push(inline.text.trim());
  }
  return sections.length > 0 ? sections : undefined;
}
