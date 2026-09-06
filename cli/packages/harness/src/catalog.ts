// harness catalog — what exists and is not composed into anything this repository actually runs.
//
// "Composed" spans two systems that share nothing but the word: the seventeen shell fragments
// `check.sh` runs at commit time (`check --list`), and the TypeScript gates the three ops packages wire
// into `vibe-ops agents-md`/`governance`/`for-vibe-ops` (each ops's own `--list`). A gate that has no shell
// precedent — most of them — would show up as "available but not composed" if only the shell side were
// read, even when an ops already runs it on every commit. That false gap is exactly the wrong
// recommendation this verb exists to prevent ("build something already written and merely unwired"), so
// `composed` here is the union of both readings, not `check --list` alone.

import type { ModuleContext, ModulePlugin } from "@entelekheia/vibe-ops-core";
import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const OPS_MODULES = ["agents-md", "governance", "for-vibe-ops", "mirror", "exposure"] as const;

async function loadPlugin(specifier: string): Promise<ModulePlugin | undefined> {
  try {
    const loaded = (await import(specifier)) as { default: ModulePlugin };
    return loaded.default;
  } catch {
    return undefined;
  }
}

interface ShellComposed {
  readonly ids: readonly string[];
  readonly sourceBasenames: readonly string[];
}

/** `check --list`'s own report, called in-process the way `module-check`'s own self-test calls an ops. */
async function shellComposed(context: ModuleContext): Promise<ShellComposed> {
  const check = await loadPlugin("@entelekheia/vibe-ops-module-check");
  if (check === undefined) return { ids: [], sourceBasenames: [] };
  const result = await check.run({ ...context, command: undefined, flags: { list: true }, log: () => {} });
  const checks = (result.data as { checks?: readonly { id: string; source: string } []} | undefined)?.checks ?? [];
  return {
    ids: checks.map((c) => c.id),
    sourceBasenames: checks.map((c) => path.basename(c.source)),
  };
}

/** Every gate id (`entry.gate`, not the label) composed into any of the three shipped ops. */
async function gatesComposed(context: ModuleContext): Promise<ReadonlySet<string>> {
  const ids = new Set<string>();
  for (const name of OPS_MODULES) {
    const ops = await loadPlugin(`@entelekheia/vibe-ops-${name}`);
    if (ops === undefined) continue; // an ops that fails to load composes nothing from here — fail open, not a guess
    const result = await ops.run({ ...context, command: undefined, flags: { list: true }, log: () => {} });
    const gates = (result.data as { gates?: readonly { gate: string } [] } | undefined)?.gates ?? [];
    for (const g of gates) ids.add(g.gate);
  }
  return ids;
}

/**
 * Every gate this install ships, by directory name under `@entelekheia/vibe-ops-gates`'s own `dist/`.
 * Resolved through "bridge" — one of the oldest gates, always present — because the package's own
 * `exports` map declares only `"./*"`, not a bare `"."` or `"./package.json"` this could resolve
 * directly; there is no install-independent way to ask the package "what do you contain" otherwise.
 */
function availableGateIds(): readonly string[] {
  try {
    const anchor = import.meta.resolve("@entelekheia/vibe-ops-gates/bridge");
    const dist = path.dirname(path.dirname(fileURLToPath(anchor)));
    return readdirSync(dist, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();
  } catch {
    return [];
  }
}

/** Every shell fragment file this install ships, by reading the same directory `check --list` reads. */
function availableShellFragmentFiles(): readonly string[] {
  try {
    const indexUrl = import.meta.resolve("@entelekheia/vibe-ops-module-check");
    const dist = path.dirname(fileURLToPath(indexUrl));
    const checksDir = path.join(path.dirname(dist), "sh", "checks");
    return readdirSync(checksDir)
      .filter((f) => f.endsWith(".sh"))
      .sort();
  } catch {
    return [];
  }
}

export interface CatalogEntry {
  readonly kind: "gate" | "shell-fragment";
  readonly id: string;
}

export interface Catalog {
  /** Available and not composed anywhere this repository runs. Empty is a real, common answer. */
  readonly uncomposed: readonly CatalogEntry[];
}

export async function buildCatalog(context: ModuleContext): Promise<Catalog> {
  const shell = await shellComposed(context);
  const gates = await gatesComposed(context);

  const uncomposed: CatalogEntry[] = [];
  for (const id of availableGateIds()) {
    if (!gates.has(id)) uncomposed.push({ kind: "gate", id });
  }
  // Always empty in practice — check --list enumerates exactly the fragments it composes, so a shell
  // fragment file present here and absent from that report would mean the runner itself failed to pick
  // it up (a naming or extension defect), not a fragment merely unwired.
  for (const file of availableShellFragmentFiles()) {
    if (!shell.sourceBasenames.includes(file)) uncomposed.push({ kind: "shell-fragment", id: file });
  }
  return { uncomposed };
}
