// `config set` / `config unset` — the one writer the skills need (RFC-0004 §5): `setup` and `migrate`
// write `types` bindings and nothing else in that table's "writes" column belongs to this noun. Every
// other writable key already has its own verb — `ownership set` for `ownership`, `harness sync` for
// `harness.applied`/`boundary`/`agreed` — so this file's whole job is refusing everything but
// `types.<name>`, naming the verb that does own it.

import { loadLayerFile, MANAGED_FILENAME, writeManagedConfig } from "@entelekheia/vibe-ops-core";
import type { WriteManagedConfigResult } from "@entelekheia/vibe-ops-core";
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

/** `true` only for exactly `types.<name>` — the one shape `config set`/`unset` accept. */
export function isTypesBinding(key: string): boolean {
  const segments = key.split(".");
  return segments.length === 2 && segments[0] === "types" && segments[1] !== "";
}

/** The refusal message for a key `config set`/`unset` does not own, naming the key and, when one
 *  exists, the verb that does. */
export function notWritableMessage(key: string): string {
  const owner = ownerVerbFor(key);
  return owner === undefined
    ? `${key} is not writable through config set/unset — the managed layer's closed set is types.<name>, ownership, harness.applied, harness.boundary and harness.agreed, and only types.<name> has a verb here`
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

/** `config set types.<name> <value>` — success unless the managed layer already binds `<name>` to a
 *  DIFFERENT package (R5), in which case it is a rebind, and rebinds are `migrate`'s job. A repeat of the
 *  same binding is reported as a no-op, not routed through `writeManagedConfig` at all: R5 does not fire
 *  on a same-package repeat, and calling it anyway would print a write report for a file that did not
 *  change. */
export async function setTypesBinding(
  repoRoot: string,
  name: string,
  value: string,
): Promise<{ readonly code: number; readonly lines: readonly string[] }> {
  const managedFile = path.join(repoRoot, MANAGED_FILENAME);
  let current: Record<string, string> | undefined;
  try {
    current = (await loadLayerFile(managedFile))?.types as Record<string, string> | undefined;
  } catch {
    current = undefined; // an unparseable managed file is R2, which writeManagedConfig below will report
  }
  if (current?.[name] === value) {
    return { code: 0, lines: [`already bound: types.${name} is ${value} in ${managedFile}`] };
  }
  const result = await writeManagedConfig(repoRoot, { types: { [name]: value } });
  return reportFor(result);
}

/** `config unset types.<name>` — "nothing to remove" is refused, not reported as success: absence of a
 *  binding is not the same state as one this call just removed. */
export async function unsetTypesBinding(
  repoRoot: string,
  name: string,
): Promise<{ readonly code: number; readonly lines: readonly string[] }> {
  const managedFile = path.join(repoRoot, MANAGED_FILENAME);
  let current: Record<string, string> | undefined;
  try {
    current = (await loadLayerFile(managedFile))?.types as Record<string, string> | undefined;
  } catch {
    current = undefined;
  }
  if (current?.[name] === undefined) {
    return { code: 1, lines: [`${managedFile} does not bind types.${name} — nothing to remove`] };
  }
  const result = await writeManagedConfig(repoRoot, {}, { remove: [`types.${name}`] });
  return reportFor(result);
}
