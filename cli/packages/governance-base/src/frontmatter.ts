// A record's YAML frontmatter, read from the parsed yaml layer rather than from the lines above the
// second `---`.
//
// Markdown's own injection query hands frontmatter to the yaml grammar, so `document.layers` already
// carries it as a `source.yaml` tree (verified against this repository's own log entry). Two things
// follow that a line reader gets wrong, and both are present in real entries here:
//
//   - A FOLDED SCALAR spans several lines. `project/log/adding-a-second-tree-sitter-grammar-to-core.md`
//     writes `description:` across three, and `^description:\s*(.*)$` returns the first of them — which
//     then becomes a truncated index row and a truncated hook injection, silently, because a truncated
//     sentence still reads like a sentence.
//   - A SEQUENCE is a sequence. `path:` is a list of globs; a line reader either takes the first item or
//     concatenates them, and neither is the value.

import type { Document } from "@entelekheia/vibe-ops-core";
import { walkLayersWithHostPositions } from "@entelekheia/vibe-ops-core";

export interface Frontmatter {
  /** Every key present, in document order — so a check for a FORBIDDEN key can see it at all. */
  readonly keys: readonly string[];
  /** A scalar value, folded to one line. Absent for a key whose value is a sequence. */
  readonly scalars: ReadonlyMap<string, string>;
  /** A sequence value, one entry per item, unquoted. */
  readonly lists: ReadonlyMap<string, readonly string[]>;
}

/** A folded YAML scalar's continuation lines are indentation, not content. */
function fold(text: string): string {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "")
    .join(" ");
}

/**
 * A BLOCK scalar's header is syntax, not value — `>-`, `|`, `|+`, `>2-` all introduce the lines below
 * rather than being part of them. The node's text carries it, so folding without stripping it first
 * prepends `>-` to the description, which then travels into the generated index and into every hook that
 * injects one. Caught by `project/log/README.md` rendering it that way (Plan-030 Track 2).
 *
 * Distinct from the multi-line PLAIN scalar this file was written for, where continuation lines are bare
 * indentation and there is no header to remove.
 */
const BLOCK_SCALAR_HEADER = /^[|>][+-]?\d*[+-]?[ \t]*\r?\n/;

function stripBlockScalarHeader(text: string): string {
  return text.replace(BLOCK_SCALAR_HEADER, "");
}

function unquote(text: string): string {
  return text.replace(/^["']/, "").replace(/["']$/, "");
}

/**
 * `document`'s frontmatter, or `undefined` when it has none.
 *
 * Every record type's template carries frontmatter from Plan-012 onward, so a *newly written* record
 * always has it. Absence is still never an error here: a record written against an older template has
 * none, and a target repository may be entirely on the previous shape — see `template-version.ts`, which
 * reads both forms rather than reporting every older artifact as undeclared.
 */
export function readFrontmatter(document: Document): Frontmatter | undefined {
  const layer = walkLayersWithHostPositions(document.layers).find(
    // Frontmatter is the layer that starts at offset 0: markdown injects fenced yaml blocks under the
    // same language, and a `” ```yaml ` example further down the file is not this document's metadata.
    ({ layer: candidate, hostStart }) => candidate.languageId === "source.yaml" && hostStart === 0,
  );
  if (layer === undefined) return undefined;

  const keys: string[] = [];
  const scalars = new Map<string, string>();
  const lists = new Map<string, readonly string[]>();

  for (const pair of layer.layer.tree.rootNode.descendantsOfType("block_mapping_pair")) {
    const key = pair.childForFieldName("key");
    const value = pair.childForFieldName("value");
    if (key === null) continue;

    const name = key.text.trim();
    if (keys.includes(name)) continue;
    keys.push(name);

    if (value === null) {
      scalars.set(name, "");
      continue;
    }
    const items = value.descendantsOfType("block_sequence_item");
    if (items.length > 0) {
      lists.set(
        name,
        items.map((item) => unquote(item.text.replace(/^-\s*/, "").trim())),
      );
      continue;
    }
    scalars.set(name, unquote(fold(stripBlockScalarHeader(value.text))));
  }

  return { keys, scalars, lists };
}
