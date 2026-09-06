// `config set` / `config unset` — the one writer the skills need (RFC-0004 §5): `setup` and `migrate`
// write `types` bindings and, since the 2026-09-06 amendment, the folder a survey adopts as
// `records.dirs.<type>`; nothing else in that table's "writes" column belongs to this noun. Every other
// writable key already has its own verb — `ownership set` for `ownership`, `harness sync` for
// `harness.applied`/`boundary`/`agreed` — so this file's whole job is refusing everything but those
// two shapes, naming the verb that does own it.

import { loadLayerFile, MANAGED_FILENAME, writeManagedConfig } from "@entelekheia/vibe-ops-core";
import type { ManagedConfigPatch, WriteManagedConfigResult } from "@entelekheia/vibe-ops-core";
import path from "node:path";

/** Where a key outside `types.<name>` is actually written, so a refusal names the verb rather than only
 *  the shape it rejected. `undefined` means no verb owns it at all — outside the managed layer's closed
 *  writable set entirely (RFC-0004 §4, R4). */
export function ownerVerbFor(key: string): string | undefined {
  const [top] = key.split(".");
  if (top === "ownership") return "ownership set";
  if (top === "harness") return "harness sync";
  return undefined;
}

/** `true` for the two shapes `config set`/`unset` accept: `types.<name>` and `records.dirs.<type>`. */
export function isWritableHere(key: string): boolean {
  const segments = key.split(".");
  if (segments.length === 2) return segments[0] === "types" && segments[1] !== "";
  if (segments.length === 3) return segments[0] === "records" && segments[1] === "dirs" && segments[2] !== "";
  return false;
}

/** The patch that writes `key` to `value`, and the dotted path `remove` takes — one place for both shapes. */
function patchFor(key: string, value: string): ManagedConfigPatch {
  const segments = key.split(".");
  return segments[0] === "types" ? { types: { [segments[1]!]: value } } : { records: { dirs: { [segments[2]!]: value } } };
}

/** The value the managed file holds at `key` today, or `undefined` — R2 (unparseable) is left for
 *  `writeManagedConfig` to report. */
async function currentValue(managedFile: string, key: string): Promise<string | undefined> {
  const segments = key.split(".");
  try {
    const loaded = (await loadLayerFile(managedFile)) as Record<string, unknown> | undefined;
    let node: unknown = loaded;
    for (const segment of segments) {
      if (node === undefined || node === null || typeof node !== "object") return undefined;
      node = (node as Record<string, unknown>)[segment];
    }
    return typeof node === "string" ? node : undefined;
  } catch {
    return undefined;
  }
}

/** The refusal message for a key `config set`/`unset` does not own, naming the key and, when one
 *  exists, the verb that does. */
export function notWritableMessage(key: string): string {
  const owner = ownerVerbFor(key);
  return owner === undefined
    ? `${key} is not writable through config set/unset — the managed layer's closed set is types.<name>, ownership, harness.applied, harness.boundary, harness.agreed and records.dirs.<type>, and only types.<name> and records.dirs.<type> have a verb here`
    : `${key} is not writable through config set/unset — it belongs to ${owner}`;
}

/** Relays one of `writeManagedConfig`'s R1–R5 refusals as a `ModuleResult`-shaped pair, and the success
 *  case's report lines — `written managed:<file>` plus one `shadowed by <layer>:<file>` per other layer
 *  still holding the key (RFC-0004 §4). Shared between `set` and `unset`. */
export function reportFor(result: WriteManagedConfigResult): { readonly code: number; readonly lines: readonly string[] } {
  if (!result.ok) return { code: 1, lines: [result.message] };
  const lines = [`written managed:${result.file}`];
  for (const shadow of result.shadowedBy) lines.push(`shadowed by ${shadow.layer}:${shadow.file}`);
  return { code: 0, lines };
}

/** `config set <key> <value>` for the two shapes — success unless the managed layer already binds a
 *  `types.<name>` to a DIFFERENT package (R5), in which case it is a rebind, and rebinds are `migrate`'s
 *  job. A repeat of the same value is reported as a no-op, not routed through `writeManagedConfig` at all:
 *  R5 does not fire on a same-package repeat, and calling it anyway would print a write report for a file
 *  that did not change. */
export async function setBinding(
  repoRoot: string,
  key: string,
  value: string,
): Promise<{ readonly code: number; readonly lines: readonly string[] }> {
  const managedFile = path.join(repoRoot, MANAGED_FILENAME);
  if ((await currentValue(managedFile, key)) === value) {
    return { code: 0, lines: [`already bound: ${key} is ${value} in ${managedFile}`] };
  }
  const result = await writeManagedConfig(repoRoot, patchFor(key, value));
  return reportFor(result);
}

/** `config unset <key>` — "nothing to remove" is refused, not reported as success: absence of a
 *  binding is not the same state as one this call just removed. */
export async function unsetBinding(
  repoRoot: string,
  key: string,
): Promise<{ readonly code: number; readonly lines: readonly string[] }> {
  const managedFile = path.join(repoRoot, MANAGED_FILENAME);
  if ((await currentValue(managedFile, key)) === undefined) {
    return { code: 1, lines: [`${managedFile} does not bind ${key} — nothing to remove`] };
  }
  const result = await writeManagedConfig(repoRoot, {}, { remove: [key] });
  return reportFor(result);
}
