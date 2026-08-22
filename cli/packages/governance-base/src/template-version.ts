// Which template version a record or a template declares, read through the document model rather than
// by scanning lines.
//
// TWO FORMS COEXIST, and both are read here. Frontmatter (`vibe-ops-template: plan@3`) is the current
// one; the HTML comment above the H1 is what every artifact written before Plan-012 carries, and a
// target repository may still be entirely on it. Reading only the new form would report every older
// record as undeclared, which is the same wrong answer as defaulting — just in the other direction.
//
// ANCHORED, NOT MATCHED ANYWHERE. The comment form is looked for only in the header region: the text
// before the first heading. A plan that discusses versioning mentions `plan@0.2` in its prose, and a
// substring match over the whole file counts that as a declaration — measured on this repository, where
// it made the undeclared population look smaller than it is. The heading is located in the parsed tree,
// so the anchor is structural rather than a guess about line numbers.
//
// NOTHING IS INFERRED. A file that declares no version returns `undefined`, and the caller reports it as
// unknown. It is never resolved to the oldest known version: that is an assertion about the file's shape
// which nobody verified, and it is wrong in both directions — a record already written in the current
// shape would be handed a migration that does not apply to it, and a genuinely old one would look
// handled when it was guessed at.

import type { Document } from "@entelekheia/vibe-ops-core";
import { readFrontmatter } from "./frontmatter.ts";

/** The frontmatter key, and the same token the legacy comment opens with. */
export const VERSION_KEY = "vibe-ops-template";

export interface DeclaredVersion {
  /** The record type the declaration names — `plan`, `adr`, … */
  readonly type: string;
  /** The version as written: an integer from `3` onward, `0.1`/`0.2` for what predates Plan-012. */
  readonly version: string;
  /** Which form carried it. `comment` means the artifact predates the move and is a migration candidate. */
  readonly source: "frontmatter" | "comment";
}

const DECLARATION = /^([a-z][a-z0-9-]*)@([0-9]+(?:\.[0-9]+)*)$/;

function parseDeclaration(
  value: string,
  source: DeclaredVersion["source"],
): DeclaredVersion | undefined {
  const matched = DECLARATION.exec(value.trim());
  if (matched === null) return undefined;
  const [, type, version] = matched;
  if (type === undefined || version === undefined) return undefined;
  return { type, version, source };
}

/**
 * The text before the document's first heading, or `undefined` when there is no parsed tree to anchor
 * against. Absent anchoring is reported as no answer rather than falling back to the whole file — the
 * fallback is precisely the substring match this function exists to avoid.
 */
function headerRegion(document: Document): string | undefined {
  if (document.tree === undefined) return undefined;
  const heading = document.tree.rootNode.descendantsOfType("atx_heading")[0];
  return heading === undefined ? document.text : document.text.slice(0, heading.startIndex);
}

const COMMENT = new RegExp(`<!--\\s*${VERSION_KEY}\\s+(\\S+)`);

/**
 * The version `document` declares, from either form, or `undefined` when it declares none.
 *
 * Frontmatter wins when both are present: a file carrying both is mid-migration, and the frontmatter is
 * what the migration wrote.
 */
export function readTemplateVersion(document: Document | undefined): DeclaredVersion | undefined {
  if (document === undefined) return undefined;

  const declared = readFrontmatter(document)?.scalars.get(VERSION_KEY);
  if (declared !== undefined) {
    const parsed = parseDeclaration(declared, "frontmatter");
    if (parsed !== undefined) return parsed;
  }

  const header = headerRegion(document);
  if (header === undefined) return undefined;
  const token = COMMENT.exec(header)?.[1];
  return token === undefined ? undefined : parseDeclaration(token, "comment");
}
