// Which package serves each governance type — Plan-033, ADR-0019: the config is the registry.
//
// THE MAP IS DEFAULTS OVERLAID BY DECLARATION. The five shipped types bind to their
// @entelekheia/governance-<t> package unless the repository's `config.types` says otherwise, and a type
// the defaults do not know exists only if config declares it. There is deliberately no scan: a scanner
// answers "who COULD serve this type", and activation makes that question moot — the repository says
// who does. Under an explicit binding the two-claimants ambiguity cannot arise.
//
// THE VALUE KEEPS RFC-0003's ID FORMAT: a package name, plus `#<type>` when the package's own type name
// differs from the local key — `"freeze": "@dot-agent/governance-freeze#freeze-policy"`. The two version
// marks (package semver, template `<type>@<n>`) never appear here; npm owns one and the template the
// other.
//
// ACTIVATION IMPORTS, AND THAT IS ALLOWED HERE. A config binding is the repository's explicit trust
// declaration, unlike the anonymous node_modules scan ADR-0018 forbade imports for (and which ADR-0019
// retired). The import is dynamic — no compile-time edge from core to any governance package, so the
// layering (core below, governances on top) holds at build time.

import path from "node:path";
import { resolveFromHost } from "./host-resolver.ts";
import type { VibeOpsConfig } from "./config.ts";

/**
 * The shipped bindings — a product statement, not discovery. A new DEFAULT type is an edit here.
 *
 * `base` and `instructions` are the two entries here that ship no record — `base` activates
 * `@entelekheia/governance-base` purely for the policy facets it now carries (`records norm --type base
 * --facet policy --name …`, Plan-040 Track 1: `convergence-policy`, `template-shape-change`);
 * `instructions` activates `@entelekheia/governance-instructions` for its `instruction-surfaces` policy
 * facet and its scaffold files (Plan-040 Track 5). Every governance package already depends on
 * `governance-base`, and the instruction surface is universal the same way, so binding both by default
 * costs a consumer nothing it did not already need, unlike `license`/`classification`, which stay opt-in
 * because a repository may not want either.
 *
 * `style` NAMES THE DEFAULT PACKAGE, BUT `effectiveGovernanceBindings` NEVER READS IT HERE. It is listed
 * for the same reason `base` is — a repository that declares nothing about `style` still gets a default —
 * but the entry it names is a one-layer stack (`@entelekheia/governance-style` alone, unscoped), and the
 * stack shape is resolved by `resolveStyleStack` in `governance-base`, not by `parseBinding` below, which
 * only ever handles a single package name.
 */
export const DEFAULT_GOVERNANCE_BINDINGS: Readonly<Record<string, string>> = {
  adr: "@entelekheia/governance-adr",
  rfc: "@entelekheia/governance-rfc",
  plan: "@entelekheia/governance-plan",
  style: "@entelekheia/governance-style",
  task: "@entelekheia/governance-task",
  // `governance-log` retired as a PACKAGE, not as a type (ADR-0020): `knowledge` ships `log` and
  // `learning` as two units of one manifest, and this binding still names the `log` unit by default —
  // no `#fragment` needed, since `log` is that package's first/default-exported unit. `learning` is
  // deliberately absent here: a repository binds it only when it has learnings of its own to keep
  // (RFC-0005 §2), which this workspace does not.
  log: "@entelekheia/governance-knowledge",
  base: "@entelekheia/governance-base",
  instructions: "@entelekheia/governance-instructions",
};

export interface GovernanceBinding {
  /** The npm package serving this local type name. */
  readonly packageName: string;
  /** The type name inside that package — the `#fragment`, defaulting to the local key. */
  readonly typeName: string;
}

function parseBinding(localName: string, value: string): GovernanceBinding {
  const hash = value.indexOf("#");
  if (hash === -1) return { packageName: value, typeName: localName };
  return { packageName: value.slice(0, hash), typeName: value.slice(hash + 1) };
}

/** The effective map: shipped defaults overlaid per key by `config.types`.
 *
 * `style` NEVER APPEARS HERE. Its binding is a stack (`StyleBinding`: an array of layers, or
 * `{ layers, onCollision }`), not one package name, and this map exists for the single-package case
 * every other type keeps — RFC-0005 §2.1 names it the one exception. `resolveStyleStack` in
 * `@entelekheia/governance-base` reads `config.types.style` directly instead of through this map. A
 * non-string value under any OTHER name is a misconfiguration, not a style binding, and is skipped the
 * same way rather than thrown — `parseBinding` only ever receives a string. */
export function effectiveGovernanceBindings(
  config: VibeOpsConfig | undefined,
): Readonly<Record<string, GovernanceBinding>> {
  const merged: Record<string, GovernanceBinding> = {};
  for (const [name, value] of Object.entries({ ...DEFAULT_GOVERNANCE_BINDINGS, ...config?.types })) {
    // `style` is the one binding that is a STACK rather than a package name; `resolveStyleStack` in
    // governance-base reads it, and `parseBinding` below only ever handles a single package name.
    if (name === "style") continue;
    // A NON-STRING IS A REFUSAL, NOT A SKIP. Skipping did not fall back to the shipped default — the
    // spread has already overlaid the bad value, so `continue` REMOVED the type from the map entirely,
    // and `ops-governance` derives its per-type entries from what activates: a repository that typed
    // `types.adr` as an array silently stopped checking its ADRs, with every run still green. The type
    // widened for `style`'s sake, so the check that TypeScript used to make at the index signature has
    // to be made here instead.
    if (typeof value !== "string") {
      throw new TypeError(
        `types.${name} must be a package name string, got ${Array.isArray(value) ? "an array" : typeof value}. ` +
          `Only types.style takes a stack of layers.`,
      );
    }
    merged[name] = parseBinding(name, value);
  }
  return merged;
}

/**
 * What an activated governance package answers with, structurally. The real thing is a
 * `GovernancePlugin` from @entelekheia/governance-base's `defineGovernance` — core cannot name that
 * type without inverting the layers, so it trusts the stamped shape and verifies only what it reads.
 */
export interface ActivatedGovernance {
  /** Absolute path to the package root. */
  readonly root: string;
  /**
   * Every unit a multi-unit package ships, in manifest order — Plan-040 Track 2. Present INSTEAD of
   * `unit` on a package whose manifest declares `units`; `activateGovernance` picks the one the
   * binding's `#type` names and hands the caller a single-unit view, so nothing downstream learns a
   * second shape.
   */
  readonly units?: readonly ActivatedGovernance["unit"][];
  /** The parsed type.json; facet paths are package-relative, resolved against `root`. */
  readonly unit: {
    readonly type: string;
    /**
     * Absent for a POLICY-ONLY package — one that ships `facets` and no record of its own (`base`,
     * Plan-040 Track 1). `isActivated` below no longer requires this to be a string; a caller reading
     * it for a record (`activatedTemplatePaths`) must treat its absence as "this package has none".
     */
    readonly template?: string;
    readonly authoring?: string;
    readonly migrations?: string;
    /** Named policy files this package serves through `records norm --facet policy --name <key>`. */
    readonly facets?: Readonly<Record<string, string>>;
    /** A style package's documented artefact list — advisory, RFC-0005 §2.1; read by `composeStylePolicy`
     *  (`governance-base`) to tell the target vocabulary check what this layer declares. */
    readonly targets?: readonly string[];
    /**
     * The record schema and layout facts an ops derivation reads (Plan-034). Optional in the interface
     * because core verifies only what it reads — `defineGovernance` stamps the full parsed type.json,
     * so a package built on the sugar always carries them; a hand-rolled activation object may not,
     * and a derivation treats their absence as "this package derives no entry", never as an error.
     */
    readonly schema?: {
      readonly carrier: "table" | "frontmatter";
      readonly required: readonly string[];
    };
    readonly depth?: number;
    readonly dirs?: readonly string[];
  };
}

/**
 * Keyed by `<package>#<type>`, not by package name — Plan-040 Track 2. A package may ship several units
 * (`knowledge` ships `log` and `learning`), and the two bind independently: caching by package name
 * would hand the second binding whatever the first one resolved to, which is the same unit under a
 * different name.
 */
const activationCache = new Map<string, ActivatedGovernance | undefined>();

/**
 * The unit a package answers with for one type name. A package built on `defineGovernance` stamps a
 * single `unit`; one shipping several stamps `units`, and the binding's `#type` fragment picks which.
 * A `units` array with no matching type is not this binding's package, which the caller reads the same
 * way it reads a package that is not installed.
 */
function unitFor(activated: ActivatedGovernance, typeName: string): ActivatedGovernance | undefined {
  if (activated.units !== undefined) {
    const unit = activated.units.find((candidate) => candidate.type === typeName);
    return unit === undefined ? undefined : { root: activated.root, unit };
  }
  return activated.unit?.type === typeName ? { root: activated.root, unit: activated.unit } : undefined;
}

function isActivated(value: unknown): value is ActivatedGovernance {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as { root?: unknown; unit?: { type?: unknown }; units?: unknown };
  if (typeof candidate.root !== "string") return false;
  // A multi-unit package carries `units` and no `unit`; every unit in it still names a type.
  if (Array.isArray(candidate.units)) {
    return (
      candidate.units.length > 0 &&
      candidate.units.every((unit) => typeof (unit as { type?: unknown })?.type === "string")
    );
  }
  // A record's template used to be required here; a policy-only package (`base`) declares `facets`
  // and no template at all, so the shape check now asks only for what every activated unit truly has:
  // a root and a type name. A caller after the record facets still treats their absence as an answer,
  // never a crash — `activatedTemplatePaths` below is the one that reads `template` and guards it.
  return typeof candidate.root === "string" && typeof candidate.unit?.type === "string";
}

/**
 * Imports one package by name and picks the unit named `typeName` out of it — the primitive
 * `activateGovernance` builds on for a config-bound single package, and what a `style` stack's layer
 * resolution (`resolveStyleStack`, `governance-base`) calls directly: a layer names its package
 * literally, never through a `types.<name>` binding, so there is no `GovernanceBinding` to look up.
 * Cached by the same `<package>#<type>` key either caller would compute, so a style layer and an
 * ordinary type binding that happen to name the same package share one import.
 */
export async function activateGovernancePackage(
  packageName: string,
  typeName: string,
): Promise<ActivatedGovernance | undefined> {
  const key = `${packageName}#${typeName}`;
  if (activationCache.has(key)) return activationCache.get(key);
  let imported: ActivatedGovernance | undefined;
  try {
    const module = (await import(resolveFromHost(packageName))) as { default?: unknown };
    imported = isActivated(module.default) ? module.default : undefined;
  } catch {
    imported = undefined;
  }
  const activated = imported === undefined ? undefined : unitFor(imported, typeName);
  activationCache.set(key, activated);
  return activated;
}

/**
 * The activated governance for one local type name, or `undefined` when its bound package is not
 * installed — an ordinary state (a repository may bind a package it has not installed yet, and the
 * shipped defaults name packages an npm-only consumer may have skipped), never an error here. The
 * caller decides whether an unresolved binding is a finding.
 */
export async function activateGovernance(
  type: string,
  config: VibeOpsConfig | undefined,
): Promise<ActivatedGovernance | undefined> {
  const binding = effectiveGovernanceBindings(config)[type];
  if (binding === undefined) return undefined;
  return activateGovernancePackage(binding.packageName, binding.typeName);
}

/**
 * Every activated type's resolved template path, absolute — the norm's half of `<template:<type>>`
 * expansion. Computed once per ops run (activation is cached, so the cost is one import per bound
 * package per process) and consulted only when the repository itself offers no candidate: a declared
 * `records.templates` entry or an existing file under the repo's own template dirs always wins.
 */
export async function activatedTemplatePaths(
  config: VibeOpsConfig | undefined,
): Promise<Readonly<Record<string, string>>> {
  const out: Record<string, string> = {};
  for (const name of Object.keys(effectiveGovernanceBindings(config))) {
    const activated = await activateGovernance(name, config);
    // A policy-only package (`base`) activates but has no template — nothing to add for it here, the
    // same "absence is an answer, never a crash" rule the rest of this file follows.
    if (activated?.unit.template !== undefined) out[name] = path.resolve(activated.root, activated.unit.template);
  }
  return out;
}
