// The instructions governance — pure sugar over @entelekheia/governance-base, the same shape
// @entelekheia/governance-classification uses. It owns the instruction surface: AGENTS.md's CLAUDE.md
// import, the .agents/ <-> .claude/ bridge, and repo-guardrails.md — as policy (`instruction-surfaces@1`,
// moved from plugin/references/) and as the three scaffold files a fresh repository is seeded with
// (`scaffold/root/CLAUDE.md`, `scaffold/agents/rules/repo-guardrails.md`,
// `scaffold/agents/skills/gitkeep`). It ships no record and no gate: gates are resolved from
// @entelekheia/vibe-ops-gates alone (RFC-0001), and the `agents-md` ops keeps composing them exactly as
// it does today (RFC-0005 §2, Plan-040 Track 5).
//
// behaviour-equal across artifacts lives in defineGovernance, written once; this file only tells it
// where THIS package is, because an installed package sits wherever npm put it and nothing else can
// know. The data (type.json, policy/, scaffold/, ownership.json) ships beside dist/.

import { fileURLToPath } from "node:url";
import path from "node:path";
import { defineGovernance } from "@entelekheia/governance-base";

// One level up from src/ (or dist/ — tsc preserves the depth), so this resolves identically from a
// checkout and from an installed package.
export default defineGovernance({
  root: path.join(path.dirname(fileURLToPath(import.meta.url)), ".."),
  version: "0.0.1",
});
