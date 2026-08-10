// Track 2 deliberately left `Layer.parentStart`/`parentEnd` relative to the immediate parent, recording
// that a consumer wanting a host-relative position walks the parent chain itself. `gates/markdown-link`
// and `gates/breadcrumb` (Plan-010 Tracks 3+4) are that consumer, and both need the same two things: a
// layer's span translated into the host document's own offsets, and a host offset turned into the
// `GateFinding.line` a reader can jump to. See project/tasks/003-the-inline-layer-gates.md, item 2.

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
