// Ported from cli/packages/module-check/sh/unported/checks/30-bridge.sh. The .agents/ ↔ .claude/ bridge. Two
// distinct failures: a real file where a symlink belongs, and a symlink that git checked out as text
// (core.symlinks=false) — which looks like a working rule file containing one line of nonsense.
//
// This gate ignores the `files` the ops handed it and re-derives its own population, because the mode
// bit it needs (120000 = symlink) is not carried by a plain path list — only `git ls-files -s` has it.
// GateOutcome.examined exists for exactly this: a gate that discovers its own subjects.

import { defineGate } from "@entelekheia/vibe-ops-core";
import type { GateFinding } from "@entelekheia/vibe-ops-core";
import { spawnSync } from "node:child_process";
import { existsSync, lstatSync } from "node:fs";
import path from "node:path";

function isBridged(rel: string): boolean {
  if (/^\.claude\/rules\/[^/]+\.md$/.test(rel)) return true;
  // One level: the skill itself is the symlinked entry, not a file inside it.
  const parts = rel.split("/");
  return parts.length === 3 && parts[0] === ".claude" && parts[1] === "skills";
}

export default defineGate(
  { id: "bridge", version: 1, summary: "Every .claude/ rule and skill is a resolving relative symlink into .agents/" },
  async ({ repoRoot }) => {
    if (!existsSync(path.join(repoRoot, ".claude"))) {
      return { findings: [], skipped: "no .claude/ directory — nothing to bridge" };
    }
    const result = spawnSync("git", ["-C", repoRoot, "ls-files", "-s", ".claude"], { encoding: "utf8" });
    const lines = (result.stdout ?? "").split("\n").filter((line) => line !== "");

    const findings: GateFinding[] = [];
    let examined = 0;
    for (const line of lines) {
      // `<mode> <hash> <stage>\t<path>`
      const [meta, rel] = line.split("\t");
      if (rel === undefined || !isBridged(rel)) continue;
      const mode = (meta ?? "").split(" ")[0];
      examined += 1;

      if (mode !== "120000") {
        findings.push({ rule: "bridge", file: rel, evidence: "a regular file — .claude/ must hold a relative symlink into .agents/" });
        continue;
      }
      const abs = path.join(repoRoot, rel);
      let isSymlink = false;
      try {
        isSymlink = lstatSync(abs).isSymbolicLink();
      } catch {
        isSymlink = false;
      }
      if (!isSymlink) {
        findings.push({ rule: "bridge", file: rel, evidence: "a symlink in git but not on disk — checked out as text (core.symlinks=false)" });
      } else if (!existsSync(abs)) {
        findings.push({ rule: "bridge", file: rel, evidence: "a symlink whose target does not exist" });
      }
    }
    return { findings, examined };
  },
);
