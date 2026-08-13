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
 * string first and then matching against the result sidesteps the question.
 *
 * NOT THE DEFAULT. Blanking a code span is right only when quoted syntax is being *shown* rather than
 * used. A detector whose signal is a claim about a name wants `describedText` below — reaching for this
 * one there blanks the signal and reports clean.
 */
export function proseText(document: Document): string {
  return maskInline(document, ["code_span"]);
}

/**
 * `document.text` masked the same way `proseText` masks it, with one deliberate inversion: the interior
 * of an inline `code_span` is KEPT, and a link destination is blanked instead.
 *
 * The two are not interchangeable and the choice is not a preference. `proseText` exists for a detector
 * whose signal is *quoted syntax being shown rather than used* — a `[[slug]]` inside backticks is an
 * example, not a link. This one exists for the opposite case: a detector whose signal is a **claim about
 * a name**, and a name is conventionally written in backticks. A sentence asserting that a plan carries
 * `Progress` is exactly as wrong as one asserting it without the backticks, so masking the code span
 * would blank the signal and report a clean file — a green with the same shape as a correct one.
 *
 * A link destination is blanked because `[…](#surprises--discoveries)` names an anchor, not a section a
 * document claims exists. Frontmatter, HTML blocks and fenced code blocks are excluded too — see
 * `maskInline` for why the last of those takes an explicit pass rather than coming for free.
 *
 * Same length as `document.text`, so a match index is a valid `lineAt(document.text, index)` argument.
 */
export function describedText(document: Document): string {
  return maskInline(document, ["link_destination"]);
}

/** Every inline layer copied into a same-length buffer, with `blank` node types masked back out. */
function maskInline(document: Document, blank: readonly string[]): string {
  const masked = new Array<string>(document.text.length).fill(" ");
  for (const { layer, hostStart } of walkLayersWithHostPositions(document.layers)) {
    if (layer.languageId !== "text.markdown_inline") continue;
    const root = layer.tree.rootNode;
    for (let i = 0; i < root.text.length; i++) {
      masked[hostStart + i] = root.text[i]!;
    }
    for (const node of root.descendantsOfType([...blank])) {
      for (let i = node.startIndex; i < node.endIndex; i++) {
        masked[hostStart + i] = " ";
      }
    }
  }
  // A FENCED BLOCK IS NOT EXCLUDED FOR FREE, and this used to say it was. A fence carrying an info
  // string the injection resolver knows — ```markdown being the case that found this — is reparsed as
  // that language, and markdown injects its own inline layers, so the fence's contents arrive in the
  // buffer above as ordinary prose. Blanking the block-level fences afterwards is what makes the
  // exclusion true for a fence with an info string as well as one without.
  for (const fence of document.tree?.rootNode.descendantsOfType("fenced_code_block") ?? []) {
    for (let i = fence.startIndex; i < fence.endIndex; i++) {
      masked[i] = " ";
    }
  }
  return masked.join("");
}
