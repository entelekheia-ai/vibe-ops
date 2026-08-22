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
import type { VibeOpsConfig } from "./config.ts";

/** The shipped bindings — a product statement, not discovery. A new DEFAULT type is an edit here. */
export const DEFAULT_GOVERNANCE_BINDINGS: Readonly<Record<string, string>> = {
  adr: "@entelekheia/governance-adr",
  rfc: "@entelekheia/governance-rfc",
  plan: "@entelekheia/governance-plan",
  task: "@entelekheia/governance-task",
  log: "@entelekheia/governance-log",
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

/** The effective map: shipped defaults overlaid per key by `config.types`. */
export function effectiveGovernanceBindings(
  config: VibeOpsConfig | undefined,
): Readonly<Record<string, GovernanceBinding>> {
  const merged: Record<string, GovernanceBinding> = {};
  for (const [name, value] of Object.entries({ ...DEFAULT_GOVERNANCE_BINDINGS, ...config?.types })) {
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
  /** The parsed type.json; facet paths are package-relative, resolved against `root`. */
  readonly unit: {
    readonly type: string;
    readonly template: string;
    readonly authoring: string;
    readonly migrations: string;
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

const activationCache = new Map<string, ActivatedGovernance | undefined>();

function isActivated(value: unknown): value is ActivatedGovernance {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as { root?: unknown; unit?: { type?: unknown; template?: unknown } };
  return typeof candidate.root === "string" && typeof candidate.unit?.template === "string";
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
  if (activationCache.has(binding.packageName)) return activationCache.get(binding.packageName);
  let activated: ActivatedGovernance | undefined;
  try {
    const imported = (await import(binding.packageName)) as { default?: unknown };
    activated = isActivated(imported.default) ? imported.default : undefined;
  } catch {
    activated = undefined;
  }
  activationCache.set(binding.packageName, activated);
  return activated?.unit.type === binding.typeName ? activated : undefined;
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
    if (activated !== undefined) out[name] = path.resolve(activated.root, activated.unit.template);
  }
  return out;
}
