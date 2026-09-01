// vibe-ops governance — the governance surface as an ops: this repository's own record types, the
// links inside every tracked markdown file, and the `git show <sha>:<path>` breadcrumbs a task's
// closure leaves behind. Composition only: no detector lives here — see cli/packages/gates/.
//
// THE COLLECTION IS `ops.json`, AND THIS FILE IS ITS TYPING SUGAR (Plan-034 Track 2). The data form
// is canonical — measured before the move: the entry lists held zero functions — and what follows is
// the narrative the JSON cannot carry.
//
// THE PER-TYPE ENTRIES ARE DERIVED, NOT LISTED (Plan-034). `derives` in the collection is the whole
// per-type story: for each governance the repository activates (ADR-0019 — the config is the
// registry), the `record-schema` rule emits the entry its carrier calls for (`table` →
// `record-header`, `frontmatter` → `record-frontmatter`) with `required` read from that package's own
// `type.json`, and the `template-version` rule emits one versioning entry handed `<template:<type>>`
// — the current version is whatever the resolved template declares, so a template bump needs no edit
// here. The hand-written list this replaces restated each type's `required` and was held in step by a
// guard test; the derivation deleted the literals and the guard together, and a repository binding a
// sixth governance package sees its entries appear with no edit to this package.
//
// `project/research/` derives nothing because no governance package serves it — the type entered the
// old list by mistake and sat disabled in vibeops.config.ts from the day it was composed (Plan-030's
// Decision Log carries the rationale); the derivation deletes it rather than reproducing it.
//
// WHAT EMITS, AND WHY. The derived `template-version` entries emit — a record's declared version is a
// series worth watching. `markdown-link` and `breadcrumb` emit too, and both recur for as long as
// this repository has markdown: links rot as files move, and every task closure adds another
// breadcrumb that a rewritten history can break. The derived schema entries do not: once a record has
// a `Status` it keeps it, and a series of zeros there would say nothing. `fragment-parity` does not
// either — it is temporary by construction, tied to a shell fragment RFC-0001 expects to eventually
// delete, and a series that dies with its subject is one nobody reads. Its entry runs over the same
// population `markdown-link` itself examines — the alignment is what makes the comparison mean
// anything — and it records which two versions agreed as the gate's `compared:` tag, because a
// demonstration that is printed and not recorded is not evidence the next time either side moves.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineOps, parseOpsDefinition } from "@entelekheia/vibe-ops-core";

const collection = new URL("../ops.json", import.meta.url);

export default defineOps(parseOpsDefinition(readFileSync(collection, "utf8"), fileURLToPath(collection)));
