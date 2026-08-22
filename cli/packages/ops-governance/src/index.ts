// vibe-ops governance — the governance surface as an ops: this repository's own record types, the
// links inside every tracked markdown file, and the `git show <sha>:<path>` breadcrumbs a task's
// closure leaves behind. Composition only: no detector lives here — see cli/packages/gates/.
//
// THE PER-TYPE ENTRIES ARE DERIVED, NOT LISTED (Plan-034). `derives` below is the whole per-type
// story: for each governance the repository activates (ADR-0019 — the config is the registry), the
// `record-schema` rule emits the entry its carrier calls for (`table` → `record-header`,
// `frontmatter` → `record-frontmatter`) with `required` read from that package's own `type.json`, and
// the `template-version` rule emits one versioning entry handed `<template:<type>>` — the current
// version is whatever the resolved template declares, so a template bump needs no edit here. The
// hand-written list this replaces restated each type's `required` and was held in step by a guard
// test; the derivation deleted the literals and the guard together, and a repository binding a sixth
// governance package sees its entries appear with no edit to this file.
//
// `project/research/` derives nothing because no governance package serves it — the type entered the
// old list by mistake and sat disabled in vibeops.config.ts from the day it was composed (Plan-030's
// Decision Log carries the rationale); the derivation deletes it rather than reproducing it.
//
// The derived `template-version` entries emit — a record's declared version is a series worth
// watching. `markdown-link` and `breadcrumb` emit too, and both recur for as long as this repository
// has markdown: links rot as files move, and every task closure adds another breadcrumb that a
// rewritten history can break. The derived schema entries do not: once a record has a `Status` it
// keeps it, and a series of zeros there would say nothing. `fragment-parity` does not either — it is
// temporary by construction, tied to a shell fragment RFC-0001 expects to eventually delete, and a
// series that dies with its subject is one nobody reads.

import { defineOps } from "@entelekheia/vibe-ops-core";

export default defineOps({
  id: "governance",
  version: "0.0.1",
  summary: "The governance surface: records, links and archival references",
  derives: ["record-schema", "template-version"],
  gates: [
    { gate: "markdown-link", emits: true },
    { gate: "breadcrumb", emits: true },
    {
      gate: "fragment-parity",
      // Same population markdown-link itself examines — see the header comment on the gate for why
      // that alignment is what makes the comparison mean anything.
      paths: ["**/*.md"],
      // RFC-0001 removes a fragment only once its port is SHOWN to agree with it, and a demonstration
      // that is printed and not recorded is not evidence the next time either side moves. The record
      // carries which two versions agreed, as the gate's `compared:` tag — a clean run writes one too,
      // because "they agreed over 94 files on this date" is the whole reading.
      emits: true,
      options: {
        runner: "cli/packages/module-check/sh/check-agents-md.sh",
        fragment: "links",
        against: "markdown-link",
      },
    },
  ],
});
