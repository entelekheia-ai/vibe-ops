// vibe-ops governance — the governance surface as an ops: this repository's own adr/plan/rfc/task
// records, the links inside every tracked markdown file, and the `git show <sha>:<path>` breadcrumbs a
// task's closure leaves behind. Composition only: no detector lives here — see cli/packages/gates/.
//
// The last two entries of the four record-header ones share a gate but never a population or a
// schema: `plan` and `rfc` happen to require the same three fields today, but the entries stay
// separate so a future divergence between the two costs an edited `options.schema`, not a shared one
// quietly drifting apart from what each type actually declares.
//
// The `template-version` entries mirror that split for the same reason, and each is handed its own
// template rather than a version number: the current version is whatever that file declares, so a
// template bump needs no edit here. `project/research/` has an entry too, disabled in
// `vibeops.config.ts` with its reason — the type has no template and its shape is not settled
// (Plan-012). A disabled entry reports SKIP naming the reason, which is a statement; leaving research
// out of the composition entirely would have been silence, and silence reads identically to clean.
//
// `markdown-link` and `breadcrumb` emit — both recur for as long as this repository has markdown:
// links rot as files move, and every task closure adds another breadcrumb that a rewritten history can
// break. `record-header` does not: once a record has a `Status` it keeps it, and a series of zeros
// there would say nothing. `fragment-parity` does not either — it is temporary by construction, tied
// to a shell fragment RFC-0001 expects to eventually delete, and a series that dies with its subject is
// one nobody reads.

import { defineOps } from "@entelekheia/vibe-ops-core";
import type { OpsGateEntry } from "@entelekheia/vibe-ops-core";

/**
 * The entries that restate a type's own `schema.required`, exported so this package's test can hold each
 * one to `plugin/types/<t>/type.json` — the same reason `ops-self` exports its fixture notes: an
 * assertion written against a copy of the object cannot prove anything about the object.
 *
 * TEMPORARY BY CONSTRUCTION (Plan-030 Track 2). The restatement exists only until Track 4 derives these
 * entries from the installed units; the literals, this export and that test are deleted together.
 */
export const RESTATED_TYPE_ENTRIES: readonly OpsGateEntry[] = [
  {
    gate: "record-header",
    label: "record-header-adr",
    options: { type: "adr", required: ["Status", "Date", "Deciders"] },
    paths: ["<records:adr>/*.md"],
  },
  {
    gate: "record-header",
    label: "record-header-plan",
    options: { type: "plan", required: ["Status", "Created", "Author"] },
    paths: ["<records:plan>/*.md"],
  },
  {
    gate: "record-header",
    label: "record-header-rfc",
    options: { type: "rfc", required: ["Status", "Created", "Author"] },
    paths: ["<records:rfc>/**/*.md"],
  },
  {
    gate: "record-header",
    label: "record-header-task",
    options: { type: "task", required: ["Status", "Created", "Author", "Issue"] },
    paths: ["<records:task>/*.md"],
  },
  // `log` carries its fields in YAML frontmatter rather than a header table, which is why it has no
  // `record-header` entry and is not missing one — a second carrier, not an absent facet. Its ten real
  // entries all declare all six keys, so this lands green rather than as a declared backlog.
  {
    gate: "record-frontmatter",
    label: "record-frontmatter-log",
    options: { type: "log", required: ["name", "description", "kind", "path", "attempted", "source"] },
    paths: ["<records:log>/*.md"],
    // A log entry missing four of the six. The decoy beside it is complete: a gate reporting on every
    // file it examined would fire on both, and only one of them is a finding.
    fixture: {
      expect: ["record-frontmatter-log"],
      files: {
        "project/log/incomplete.md": "---\nname: incomplete\ndescription: one line\n---\n\n# x\n",
        "project/log/complete.md": [
          "---",
          "name: complete",
          "description: one line",
          "kind: trap",
          'path:\n  - "src/**"',
          "attempted: 2026-08-20",
          "source: a commit",
          "---",
          "",
          "# x",
          "",
        ].join("\n"),
      },
    },
  },
];

export default defineOps({
  id: "governance",
  version: "0.0.1",
  summary: "The governance surface: records, links and archival references",
  gates: [
    // The five entries that restate their type's own `schema.required` — see the constant above,
    // and the test that holds each one to `plugin/types/index.json` while the restatement lasts.
    ...RESTATED_TYPE_ENTRIES,
    // Emits: a record's declared version is a series worth watching — the population grows, versions
    // move, and what is still behind is exactly the reading Plan-012 exists to produce.
    {
      gate: "template-version",
      label: "template-version-adr",
      options: { template: "<template:adr>" },
      paths: ["<records:adr>/*.md"],
      emits: true,
    },
    {
      gate: "template-version",
      label: "template-version-plan",
      options: { template: "<template:plan>" },
      paths: ["<records:plan>/**/*.md"],
      emits: true,
    },
    {
      gate: "template-version",
      label: "template-version-rfc",
      options: { template: "<template:rfc>" },
      paths: ["<records:rfc>/**/*.md"],
      emits: true,
    },
    {
      gate: "template-version",
      label: "template-version-task",
      options: { template: "<template:task>" },
      paths: ["<records:task>/*.md"],
      emits: true,
    },
    {
      gate: "template-version",
      label: "template-version-log",
      options: { template: "<template:log>" },
      paths: ["<records:log>/*.md"],
      emits: true,
    },
    {
      gate: "template-version",
      label: "template-version-research",
      options: { template: "<template:plan>" },
      paths: ["<records:research>/*.md"],
      emits: true,
    },
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
