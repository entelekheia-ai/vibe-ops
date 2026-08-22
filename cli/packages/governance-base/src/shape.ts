// Reading a governance record's SHAPE — which sections it has, and how many entries stand under the
// ones that accumulate work. This is the half `records show` needed and nothing here had: `resolve`
// answers where a type lives, `status` answers whether one plan is coherent, and neither says what is
// inside a given file.
//
// It exists because the questions below were being asked by grep. Measured across ~390 session
// transcripts: `^## ` 41 times, `^## Surprises` 31, `^- Observation:` 15 — each one a structured
// question with a deterministic answer, asked against raw text by whoever needed it.
//
// Everything here reads the block tree rather than the text, for the reason `trackCheckboxes` already
// documents: a heading inside a fenced example block is structurally not a heading, so nothing has to
// strip anything first. A `## Surprises` written inside a template's own code fence — which is exactly
// what the shipped templates contain — is not counted, and would be by a grep.

import type { Document } from "@entelekheia/vibe-ops-core";
import type Parser from "tree-sitter";

/** A section heading, as written, in document order. */
export interface Heading {
  readonly text: string;
  /** 2 for `##`, 3 for `###`. Deeper levels are not collected — a record's shape is its H2s. */
  readonly level: 2 | 3;
}

function headingTextOf(heading: Parser.SyntaxNode): string | undefined {
  return heading.children.find((child) => child.type === "inline")?.text.trim();
}

/**
 * Every level-2 and level-3 heading, in order. The answer to "what sections does this record have",
 * which is the single most-grepped question in the corpus and the one a reader asks before anything
 * else about an unfamiliar record.
 */
export function sectionHeadings(document: Document): readonly Heading[] {
  const root = document.tree?.rootNode;
  if (root === undefined) return [];

  const headings: Heading[] = [];
  for (const heading of root.descendantsOfType("atx_heading")) {
    const level = heading.children.some((child) => child.type === "atx_h2_marker")
      ? 2
      : heading.children.some((child) => child.type === "atx_h3_marker")
        ? 3
        : undefined;
    if (level === undefined) continue;
    const text = headingTextOf(heading);
    if (text === undefined || text === "") continue;
    headings.push({ level, text });
  }
  return headings;
}

/**
 * The section whose H2 heading STARTS WITH `prefix`, case-insensitively.
 *
 * Prefix rather than equality because the same section is spelled several ways across this workspace's
 * own records — `## Surprises`, `## Surprises & Discoveries` — and a reader asking "are there surprises
 * to route" means the same question under either spelling. `trackCheckboxes` matches `Tracks` exactly
 * because that heading is fixed by the template; these are not.
 */
function sectionStartingWith(root: Parser.SyntaxNode, prefix: string): Parser.SyntaxNode | undefined {
  const wanted = prefix.toLowerCase();
  for (const heading of root.descendantsOfType("atx_heading")) {
    if (!heading.children.some((child) => child.type === "atx_h2_marker")) continue;
    const text = headingTextOf(heading)?.toLowerCase();
    if (text !== undefined && text.startsWith(wanted)) {
      return heading.parent?.type === "section" ? heading.parent : undefined;
    }
  }
  return undefined;
}

/**
 * How many list items stand directly under the section whose heading starts with `prefix`, or
 * `undefined` when the record has no such section at all.
 *
 * The distinction is the point, and it is why this returns `undefined` rather than 0: a plan with an
 * empty `## Surprises & Discoveries` and a plan with no such section are different states, and only one
 * of them means "nothing was found worth routing". Collapsing both to zero is the same class of lie as
 * a command returning an empty string.
 */
export function entriesUnder(document: Document, prefix: string): number | undefined {
  const root = document.tree?.rootNode;
  if (root === undefined) return undefined;

  const section = sectionStartingWith(root, prefix);
  if (section === undefined) return undefined;

  // `list_item`, not `list`: one section may hold several lists, and it is the entries that are being
  // counted. Nested items count once each, which is correct — a sub-bullet under an Observation is
  // part of that entry's evidence and is written as its own item.
  return section.descendantsOfType("list_item").length;
}

/**
 * The `section` node (a heading with everything up to the next same-or-higher heading — the grammar
 * groups them, so the section boundary is declared by the document rather than inferred from a blank
 * line) whose level-2 heading reads exactly `headingText`.
 */
function findH2Section(root: Parser.SyntaxNode, headingText: string): Parser.SyntaxNode | undefined {
  for (const heading of root.descendantsOfType("atx_heading")) {
    if (!heading.children.some((child) => child.type === "atx_h2_marker")) continue;
    const inline = heading.children.find((child) => child.type === "inline");
    if (inline?.text.trim() === headingText) {
      return heading.parent?.type === "section" ? heading.parent : undefined;
    }
  }
  return undefined;
}

/**
 * Every `- [ ]`/`- [x]` under the `## Tracks` section — one checkbox per track, plus the closure line
 * ("Run `/vibe-ops:close-plan`") the `plan@0.2` template itself adds as the section's last item.
 *
 * Reads the block tree, not the text: `task_list_marker_checked`/`task_list_marker_unchecked` are real
 * node types, so a checkbox written inside a fenced example block is structurally not one of these and
 * is never counted. That is the same distinction `markdown-link` relies on for a link inside a code
 * span — the grammar separates them, so nothing has to strip anything first.
 */
export function trackCheckboxes(document: Document): { readonly total: number; readonly checked: number } {
  const root = document.tree?.rootNode;
  if (root === undefined) return { total: 0, checked: 0 };

  const section = findH2Section(root, "Tracks");
  if (section === undefined) return { total: 0, checked: 0 };

  let total = 0;
  let checked = 0;
  for (const marker of section.descendantsOfType(["task_list_marker_checked", "task_list_marker_unchecked"])) {
    total++;
    if (marker.type === "task_list_marker_checked") checked++;
  }
  return { total, checked };
}
