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

import { defineOps } from "@entelekheia/vibe-ops-core";

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
  ],
});
