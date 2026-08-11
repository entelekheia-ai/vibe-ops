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

export default defineOps({
  id: "governance",
  version: "0.0.1",
  summary: "The governance surface: records, links and archival references",
  gates: [
    { gate: "record-header", label: "record-header-adr", options: { schema: "adr" }, paths: ["project/adr/*.md"] },
    { gate: "record-header", label: "record-header-plan", options: { schema: "plan" }, paths: ["project/plans/*.md"] },
    { gate: "record-header", label: "record-header-rfc", options: { schema: "rfc" }, paths: ["project/rfc/**/*.md"] },
    { gate: "record-header", label: "record-header-task", options: { schema: "task" }, paths: ["project/tasks/*.md"] },
    // Emits: a record's declared version is a series worth watching — the population grows, versions
    // move, and what is still behind is exactly the reading Plan-012 exists to produce.
    {
      gate: "template-version",
      label: "template-version-adr",
      options: { template: "<plugin>/templates/adr.md" },
      paths: ["project/adr/*.md"],
      emits: true,
    },
    {
      gate: "template-version",
      label: "template-version-plan",
      options: { template: "<plugin>/templates/plan.md" },
      paths: ["project/plans/**/*.md"],
      emits: true,
    },
    {
      gate: "template-version",
      label: "template-version-rfc",
      options: { template: "<plugin>/templates/rfc.md" },
      paths: ["project/rfc/**/*.md"],
      emits: true,
    },
    {
      gate: "template-version",
      label: "template-version-task",
      options: { template: "<plugin>/templates/task.md" },
      paths: ["project/tasks/*.md"],
      emits: true,
    },
    {
      gate: "template-version",
      label: "template-version-log",
      options: { template: "<plugin>/templates/log.md" },
      paths: ["project/log/*.md"],
      emits: true,
    },
    {
      gate: "template-version",
      label: "template-version-research",
      options: { template: "<plugin>/templates/plan.md" },
      paths: ["project/research/*.md"],
      emits: true,
    },
    { gate: "markdown-link", emits: true },
    { gate: "breadcrumb", emits: true },
    {
      gate: "fragment-parity",
      // Same population markdown-link itself examines — see the header comment on the gate for why
      // that alignment is what makes the comparison mean anything.
      paths: ["**/*.md"],
      options: {
        runner: "cli/packages/module-check/sh/check-agents-md.sh",
        fragment: "links",
        against: "markdown-link",
      },
    },
  ],
});
