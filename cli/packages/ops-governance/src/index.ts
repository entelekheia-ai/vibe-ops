// vibe-ops governance — the governance surface as an ops: this repository's own adr/plan/rfc/task
// records, the links inside every tracked markdown file, and the `git show <sha>:<path>` breadcrumbs a
// task's closure leaves behind. Composition only: no detector lives here — see cli/packages/gates/.
//
// The last two entries of the four record-header ones share a gate but never a population or a
// schema: `plan` and `rfc` happen to require the same three fields today, but the entries stay
// separate so a future divergence between the two costs an edited `options.schema`, not a shared one
// quietly drifting apart from what each type actually declares.
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
