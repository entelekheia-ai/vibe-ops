// The effective value of a dotted key, its origin, and every value shadowed beneath it — read side of
// RFC-0004 §1/§3. Two things this file deliberately does NOT do: hardcode the set of keys `config list`
// enumerates (it derives them from whatever the loaded config actually has), and re-derive `merge`'s
// granularity rules from scratch (it re-states them once, as `attributionSegments`, because origin
// attribution has to know the same boundaries `merge` does — a key merged whole must be attributed
// whole, or "config list --show-origin" would name a file that did not actually decide the value).

import type { ConfigLayer, VibeOpsConfig } from "@entelekheia/vibe-ops-core";

/** One layer file that contributed to the cascade, as `loadConfig` reports it — nearest first. */
export interface LayerRef {
  readonly file: string;
  readonly layer: ConfigLayer;
}

/** Reads a dotted path (`"settings.governance.level"`) out of an arbitrary object. `undefined` at any
 *  missing segment, never a thrown error — a caller asking about a key nothing sets gets an answer, not
 *  an exception. */
export function getPath(obj: unknown, key: string): unknown {
  let current: unknown = obj;
  for (const segment of key.split(".")) {
    if (current === null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

/**
 * The path segments that decide ORIGIN ATTRIBUTION for a dotted key — the same granularity `merge()`
 * applies, stated once so this module and `merge` cannot silently disagree:
 *
 * - `types.<name>` — per local name (`merge`'s per-key spread).
 * - `harness.applied` / `harness.boundary` / `harness.agreed` — each whole, and `managed`-only (RFC-0004
 *   §3); a deeper path under one of them (`harness.applied.plan`) still attributes to the whole key,
 *   because that is the smallest unit `writeManagedConfig` and `merge` ever move independently.
 * - `harness.source` — whole, but ordinary cascade (any layer).
 * - `settings.<ops>` — whole per ops id (`merge`'s one-level-deep rule stops there; a path further in,
 *   `settings.governance.level`, still attributes to `settings.governance` as a whole object).
 * - `records.dirs` / `records.templates` — whole per half, same one-level-deep shape as `settings`.
 * - `ownership` — the array as a whole; a caller wanting one entry's origin is `ownership get`'s job, not
 *   this module's, since narrowings concatenate rather than shadow at the top level.
 * - everything else (`modules`, `artifactDir`, an unrecognised top key) — whole.
 */
export function attributionSegments(key: string): readonly string[] {
  const segments = key.split(".");
  const [top, second] = segments;
  if (top === "types" && second !== undefined) return [top, second];
  if (top === "harness" && (second === "applied" || second === "boundary" || second === "agreed")) return [top, second];
  if (top === "harness" && second === "source") return [top, second];
  if (top === "settings" && second !== undefined) return [top, second];
  if (top === "records" && second !== undefined) return [top, second];
  return [top ?? ""];
}

function definesPath(config: VibeOpsConfig, segments: readonly string[]): boolean {
  return getPath(config, segments.join(".")) !== undefined;
}

/**
 * Which of `layers` (nearest first, as `loadConfig` returns them) define this key — the origin is the
 * first entry, everything after it is what the write report would call `shadowedBy`. `loadRaw` is
 * injected rather than imported so this stays testable without touching the filesystem, and so the
 * caller can apply the one exception attribution needs beyond raw per-file content: `harness.applied`,
 * `.boundary` and `.agreed` are stripped from every non-`managed` contribution before the general
 * cascade ever sees them (RFC-0004 §3) — a raw `declared` file may still HOLD the key on disk, and that
 * must not count as defining it here, or a hand-written `harness.applied` would misreport as this
 * request's origin instead of as what `config-shadow` calls a shadow of nothing at all.
 */
export async function attributingLayers(
  key: string,
  layers: readonly LayerRef[],
  loadRaw: (file: string) => Promise<VibeOpsConfig | undefined>,
): Promise<readonly LayerRef[]> {
  const segments = attributionSegments(key);
  const managedOnly = segments[0] === "harness" && segments[1] !== "source";
  const found: LayerRef[] = [];
  for (const ref of layers) {
    if (managedOnly && ref.layer !== "managed") continue;
    const raw = await loadRaw(ref.file);
    if (raw !== undefined && definesPath(raw, segments)) found.push(ref);
  }
  return found;
}

/**
 * Every top-level and second-level key of `VibeOpsConfig` that this loaded config actually carries —
 * derived from the object itself, never from a hand-kept list, so a key nobody declared here yet still
 * shows up the day something writes it. `types.<name>`, `harness.applied`/`boundary`/`agreed`/`source`,
 * `settings.<ops>`, `records.dirs`/`records.templates` expand one level; `ownership`, `modules` and
 * `artifactDir` do not, because their granularity IS the top-level key (an array is not a per-name map).
 */
export function effectiveKeys(config: VibeOpsConfig): readonly string[] {
  const keys: string[] = [];
  const expandable = new Set(["types", "harness", "settings", "records"]);
  for (const top of Object.keys(config)) {
    const value = (config as Record<string, unknown>)[top];
    if (expandable.has(top) && value !== null && typeof value === "object" && !Array.isArray(value)) {
      const subKeys = Object.keys(value as Record<string, unknown>);
      if (subKeys.length === 0) keys.push(top);
      else for (const sub of subKeys) keys.push(`${top}.${sub}`);
    } else {
      keys.push(top);
    }
  }
  return keys;
}

/** `"<layer>:<file>"`, the origin spelling RFC-0004 §3/§4 uses throughout. */
export function originLabel(ref: LayerRef): string {
  return `${ref.layer}:${ref.file}`;
}
