// Track 2 deliberately left `Layer.parentStart`/`parentEnd` relative to the immediate parent, recording
// that a consumer wanting a host-relative position walks the parent chain itself. `gates/markdown-link`
// and `gates/breadcrumb` (Plan-010 Tracks 3+4) are that consumer, and both need the same two things: a
// layer's span translated into the host document's own offsets, and a host offset turned into the
// `GateFinding.line` a reader can jump to. See project/tasks/003-the-inline-layer-gates.md, item 2.

import type { Document } from "./document.ts";
import type { Layer } from "./injections.ts";

/** A layer alongside its span in HOST document offsets — not parent-relative. */
export interface HostPositionedLayer {
  readonly layer: Layer;
  readonly hostStart: number;
  readonly hostEnd: number;
}

/**
 * Every layer in `layers`, and everything nested under it, with each one's span translated to host
 * document offsets by accumulating each ancestor's own `parentStart` on the way down. Depth-first,
 * parent before its own children — offsets compose by plain addition because a node's `startIndex` is a
 * JavaScript string index, the same unit `text.slice` already uses (verified against a fixture carrying
 * an em-dash and an emoji: `startIndex` 39, `text.indexOf` 39, UTF-8 byte offset 43 — the three would
 * disagree if this composed by bytes).
 */
export function walkLayersWithHostPositions(
  layers: readonly Layer[],
  parentHostStart = 0,
): readonly HostPositionedLayer[] {
  const result: HostPositionedLayer[] = [];
  for (const layer of layers) {
    const hostStart = parentHostStart + layer.parentStart;
    const hostEnd = parentHostStart + layer.parentEnd;
    result.push({ layer, hostStart, hostEnd });
    result.push(...walkLayersWithHostPositions(layer.layers, hostStart));
  }
  return result;
}

/**
 * The 1-indexed line number containing `hostOffset` in `text` — counting `\n` characters directly,
 * consistent with `walkLayersWithHostPositions` treating every offset as a string index rather than a
 * byte offset.
 */
export function lineAt(text: string, hostOffset: number): number {
  let line = 1;
  const end = Math.min(hostOffset, text.length);
  for (let i = 0; i < end; i++) {
    if (text.charCodeAt(i) === 10 /* "\n" */) line++;
  }
  return line;
}

/**
 * `document.text`, with everything except inline markdown prose blanked to spaces (` `) — a fenced
 * code block, frontmatter, an HTML block, and, within what remains, the interior of every inline
 * `code_span`. The result is the same length as `document.text`, so a match index against it is a
 * valid argument to `lineAt(document.text, index)` with no offset arithmetic at the call site: masking,
 * never slicing.
 *
 * Exists because a caller cannot tell prose from code by walking node types alone. `[[slug]]` inside a
 * code span never becomes a `text` node under the inline grammar at all — it parses as
 * `(shortcut_link (link_text))`, and that node's own `.text` is `[slug]`, one bracket pair, so a
 * pattern written against plain text never matches it whether or not it should. Masking the source
 * string first and then matching against the result sidesteps the question, the same way a fenced code
 * block is excluded "for free": markdown never injects one as a `text.markdown_inline` layer, so it is
 * never copied into the buffer in the first place.
 */
export function proseText(document: Document): string {
  const masked = new Array<string>(document.text.length).fill(" ");
  for (const { layer, hostStart } of walkLayersWithHostPositions(document.layers)) {
    if (layer.languageId !== "text.markdown_inline") continue;
    const root = layer.tree.rootNode;
    for (let i = 0; i < root.text.length; i++) {
      masked[hostStart + i] = root.text[i]!;
    }
    for (const span of root.descendantsOfType("code_span")) {
      for (let i = span.startIndex; i < span.endIndex; i++) {
        masked[hostStart + i] = " ";
      }
    }
  }
  return masked.join("");
}
