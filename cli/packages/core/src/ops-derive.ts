// The derivation an ops names instead of a hand-written per-type entry list — Plan-034.
//
// THE RULE REPLACES THE LITERALS AND THE GUARD THAT HELD THEM. `ops-governance` carried four
// `record-header` entries, one `record-frontmatter` and six `template-version` ones, each restating a
// `required` list its type's own `type.json` already declared, kept honest by a test. Deriving the
// entries from the activated governances (ADR-0019: the config is the registry) deletes the literals
// and the guard together — the duplication window Plan-030 Track 2 opened "until Track 4".
//
// A RULE, NOT A LONGER LIST. A static collection cannot hold per-type entries without re-opening the
// duplication, so the data form names the rule — "for each activated governance, emit the entry its
// carrier calls for" — and the entries exist only at run time, computed from the repository being run
// against. Adding a type is publishing a package and adding one config key; no ops edits.
//
// ORDER IS CARRIER GROUPS, EACH SORTED BY LOCAL NAME — table first, then frontmatter. That is the
// order the hand-written list had (adr, plan, rfc, task, then log), kept so a before/after diff of a
// run is the derivation's own acceptance test rather than a reshuffle to explain away.
//
// A BOUND-BUT-UNRESOLVED TYPE IS A SKIP NAMING THE REASON, NEVER A SILENT GAP. A repository may bind
// a package it has not installed, or deliberately unbind a shipped default; either way the run says
// so in `skipped`, the same channel a disabled entry uses — a statement, where silence reads
// identically to clean.

import { activateGovernance, effectiveGovernanceBindings } from "./governance-map.ts";
import type { ActivatedGovernance } from "./governance-map.ts";
import type { VibeOpsConfig } from "./config.ts";
import type { OpsFixture, OpsGateEntry, OpsSkip } from "./ops.ts";

/**
 * The rules an ops may name in its `derives` list. Each is code here and a name in the ops's data —
 * the collection stays serialisable while the derivation stays testable.
 *
 * - `record-schema`: one entry per activated governance, gate chosen by its `schema.carrier`
 *   (`table` → `record-header`, `frontmatter` → `record-frontmatter`), `options.required` read from
 *   the unit — the entry the literals used to restate.
 * - `template-version`: one emitting `template-version` entry per activated governance, handed
 *   `<template:<type>>` so the current version is whatever the resolved template declares.
 */
export type OpsDeriveRule = "record-schema" | "template-version";

export interface DerivedOpsEntries {
  readonly entries: readonly OpsGateEntry[];
  readonly skips: readonly OpsSkip[];
}

/** The record-directory glob for one type: its resolved dir, one level deep unless the unit says two. */
function recordGlob(name: string, unit: ActivatedGovernance["unit"]): string {
  return `<records:${name}>/${(unit.depth ?? 1) >= 2 ? "**/" : ""}*.md`;
}

/**
 * A deliberately broken tree for the derived schema entry, synthesised from the schema itself: one
 * record missing everything past the first required field, and a complete decoy beside it — a gate
 * reporting on every file it examined would fire on both, and only one of them is a finding. The
 * hand-written list proved one type this way (log); the synthesis proves every derived entry, because
 * a fixture that must be hand-written per type is a fixture most types end up without.
 */
function schemaFixture(label: string, unit: ActivatedGovernance["unit"], dir: string): OpsFixture {
  const required = unit.schema?.required ?? [];
  const carrier = unit.schema?.carrier;
  if (carrier === "frontmatter") {
    const incomplete = ["---", `${required[0]}: present`, "---", "", "# x", ""].join("\n");
    const complete = ["---", ...required.map((key) => `${key}: present`), "---", "", "# x", ""].join("\n");
    return { expect: [label], files: { [`${dir}/incomplete.md`]: incomplete, [`${dir}/complete.md`]: complete } };
  }
  const table = (fields: readonly string[]): string =>
    ["# X", "", "| Field | Value |", "|---|---|", ...fields.map((f) => `| ${f} | present |`), "", "## Context", ""].join("\n");
  return {
    expect: [label],
    files: { [`${dir}/incomplete.md`]: table(required.slice(0, 1)), [`${dir}/complete.md`]: table(required) },
  };
}

/**
 * The entries the named rules produce against this repository's activated governances, plus a skip for
 * every binding that did not resolve. Activation is cached per process (governance-map), so the cost
 * is one dynamic import per bound package per run, already paid by `<template:<type>>` expansion.
 */
export async function deriveOpsEntries(
  rules: readonly OpsDeriveRule[],
  config: VibeOpsConfig | undefined,
): Promise<DerivedOpsEntries> {
  const names = Object.keys(effectiveGovernanceBindings(config)).sort();
  const activated = new Map<string, ActivatedGovernance | undefined>();
  for (const name of names) activated.set(name, await activateGovernance(name, config));

  // Carrier groups, sorted within each: the hand-written order, derived. Unresolved bindings have no
  // carrier and close each rule's group, so a missing package never reshuffles the resolved entries.
  const ordered = [
    ...names.filter((n) => activated.get(n)?.unit.schema?.carrier === "table"),
    ...names.filter((n) => activated.get(n)?.unit.schema?.carrier === "frontmatter"),
  ];
  const unresolved = names.filter((n) => activated.get(n) === undefined);

  const entries: OpsGateEntry[] = [];
  const skips: OpsSkip[] = [];
  for (const rule of rules) {
    for (const name of ordered) {
      const governance = activated.get(name)!;
      const unit = governance.unit;
      if (unit.schema === undefined) continue; // a package that declares no schema derives no entry
      const dir = unit.dirs?.[0] ?? `project/${name}`;
      if (rule === "record-schema") {
        const gate = unit.schema.carrier === "table" ? "record-header" : "record-frontmatter";
        const label = `${gate}-${name}`;
        entries.push({
          gate,
          label,
          options: { type: name, required: unit.schema.required },
          paths: [recordGlob(name, unit)],
          fixture: schemaFixture(label, unit, dir),
        });
      } else {
        entries.push({
          gate: "template-version",
          label: `template-version-${name}`,
          options: { template: `<template:${name}>` },
          paths: [recordGlob(name, unit)],
          emits: true,
        });
      }
    }
    for (const name of unresolved) {
      const binding = effectiveGovernanceBindings(config)[name]!;
      skips.push({
        gate: `${rule}-${name}`,
        reason: `type "${name}" is bound to ${binding.packageName}, which did not resolve — install it or rebind`,
      });
    }
  }
  return { entries, skips };
}
