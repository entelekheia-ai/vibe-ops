// vibe-ops agents-md — the instruction surface as an ops.
//
// Composition only: no detector lives here. Each gate is resolved from @entelekheia/vibe-ops-gates,
// where it is importable on its own — an ops that owned its gates outright would force `memory-slug`
// to be copied into every ops that also needs it, and the copies would drift exactly the way two
// copies of anything drift in this repository. See project/rfc/0001-gates-and-ops-as-the-cli-unit-of-composition.md.
//
// This ops runs BESIDE cli/packages/module-check/sh/check.sh, not instead of it — five of the seven
// entries below port 10-budget.sh, 30-bridge.sh, 40-frontmatter.sh, 45-skill-frontmatter.sh and
// 60-memory-slugs.sh, and the two are meant to be compared, finding by finding, before the shell
// fragments are ever removed. That removal is a separate, later act. `pairing` and `claude-md-content`
// are not ports — the shell runner never checked the AGENTS.md ↔ CLAUDE.md pairing at all.
//
// Plan-013 Track 6: the three `fragment-parity` entries below are that comparison, made mechanical —
// same runner as `ops-governance`'s own `links` entry, same shape. Not emitted, same reasoning as that
// entry: `fragment-parity` is temporary by construction, tied to a shell fragment RFC-0001 expects to
// eventually delete, and a series that dies with its subject is one nobody reads. Each entry's `paths`
// mirrors the population of the check it is comparing against, so the comparison means what it says.

import { defineOps } from "@entelekheia/vibe-ops-core";

const CHECK_AGENTS_MD_RUNNER = "cli/packages/module-check/sh/check-agents-md.sh";

export default defineOps({
  id: "agents-md",
  version: "0.0.1",
  summary: "The instruction surface: AGENTS.md, CLAUDE.md, and the .agents/ ↔ .claude/ bridge",
  gates: [
    { gate: "budget", paths: ["AGENTS.md"] },
    { gate: "pairing", paths: ["**/AGENTS.md"] },
    { gate: "claude-md-content", paths: ["**/CLAUDE.md"] },
    { gate: "bridge" },
    { gate: "check-frontmatter", paths: [".agents/rules/*.md"], options: { schema: "rule" } },
    {
      gate: "check-frontmatter",
      label: "skill-frontmatter",
      options: { schema: "skill" },
      paths: ["<plugin>/skills/*/SKILL.md", ".agents/skills/*/SKILL.md"],
    },
    // The only entry that emits (RFC-0001, Rationale): the other four are structural properties that,
    // once corrected, stay corrected. This one is behavioural and recurrent, and worth a series.
    {
      gate: "memory-slug",
      emits: true,
      paths: ["AGENTS.md", "**/AGENTS.md", "**/CLAUDE.md", "**/README.md"],
    },
    {
      gate: "fragment-parity",
      label: "fragment-parity-frontmatter",
      paths: [".agents/rules/*.md"],
      options: { runner: CHECK_AGENTS_MD_RUNNER, fragment: "frontmatter", against: "check-frontmatter", options: { schema: "rule" } },
    },
    {
      gate: "fragment-parity",
      label: "fragment-parity-skill-frontmatter",
      paths: ["<plugin>/skills/*/SKILL.md", ".agents/skills/*/SKILL.md"],
      options: {
        runner: CHECK_AGENTS_MD_RUNNER,
        fragment: "skill-frontmatter",
        against: "check-frontmatter",
        options: { schema: "skill" },
      },
    },
    {
      gate: "fragment-parity",
      label: "fragment-parity-memory-slug",
      paths: ["AGENTS.md", "**/AGENTS.md", "**/CLAUDE.md", "**/README.md"],
      options: { runner: CHECK_AGENTS_MD_RUNNER, fragment: "memory-slugs", against: "memory-slug" },
    },
  ],
});
