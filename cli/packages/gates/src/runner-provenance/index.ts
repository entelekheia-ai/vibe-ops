// The trap named in .agents/rules/repo-onboarding.md: "Do not copy the runner in. Inside this workspace
// _run.sh resolves it from the sibling vibe-ops checkout... taking [the snapshot] here creates a stale
// duplicate that WINS the resolution order and silently shadows the live runner with an older set of
// checks." resolve_runner() (plugin/skills/setup/templates/harness/checks/_run.sh) tries, in order: a
// snapshot copied to scripts/check-agents-md.sh, a sibling `../vibe-ops` checkout, then
// $CLAUDE_PLUGIN_ROOT. Branch 1 winning is correct for a repository cloned on its own — the shape the
// snapshot exists for — and a defect the moment a live sibling also resolves, because the snapshot never
// updates itself and now permanently outranks the tree that does.
//
// Composed into `governance` since 2026-09-06 — the ops every consumer's pre-commit runs, which is where a
// repository under this workspace meets the sibling checkout.

import { defineGate } from "@entelekheia/vibe-ops-core";
import { existsSync, realpathSync } from "node:fs";
import path from "node:path";

const SNAPSHOT_PATH = "scripts/check-agents-md.sh";
const SIBLING_RUNNER = path.join("..", "vibe-ops", "cli", "packages", "module-check", "sh", "check-agents-md.sh");

export default defineGate(
  {
    id: "runner-provenance",
    version: 1,
    summary: "A copied-in gate runner snapshot never silently outranks a live sibling checkout",
  },
  async ({ repoRoot }) => {
    const snapshot = path.join(repoRoot, SNAPSHOT_PATH);
    if (!existsSync(snapshot)) {
      return { findings: [], skipped: `no ${SNAPSHOT_PATH} in this repository — nothing to check provenance for` };
    }
    const sibling = path.join(repoRoot, SIBLING_RUNNER);
    // In the runner's own repository `../vibe-ops` resolves to the repository itself: its snapshot has no
    // sibling to outrank, only its own source, and that pair is dogfooding-drift's question, not this one.
    if (existsSync(sibling) && realpathSync(sibling).startsWith(`${realpathSync(repoRoot)}${path.sep}`)) {
      return { findings: [], skipped: "this repository is the live runner's own source — a snapshot here has no sibling to outrank" };
    }
    if (!existsSync(sibling)) {
      // A snapshot with no live sibling to shadow is exactly the shape it was written for — a
      // repository cloned on its own, where the snapshot IS the only source.
      return { findings: [], examined: 1 };
    }
    return {
      findings: [
        {
          rule: "runner-provenance",
          file: SNAPSHOT_PATH,
          evidence:
            `a copied-in snapshot at ${SNAPSHOT_PATH} outranks the live sibling checkout at ` +
            `${SIBLING_RUNNER} in _run.sh's resolution order — it does not update itself and can silently ` +
            `run an older set of checks than the sibling would`,
        },
      ],
      examined: 1,
    };
  },
);
