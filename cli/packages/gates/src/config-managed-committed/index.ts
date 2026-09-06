// RFC-0004 §4, gate 2: `vibeops.config.json` present on disk but absent from the git index. Runs
// `git ls-files --error-unmatch`, the same "is this path tracked" test the file's own promise ("committed,
// tracked, written only by this tooling") depends on; `git check-ignore -v` is consulted only to NAME the
// rule that is hiding it, per RFC-0004 §4.

import { defineGate, MANAGED_FILENAME } from "@entelekheia/vibe-ops-core";
import type { GateFinding } from "@entelekheia/vibe-ops-core";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

export default defineGate(
  {
    id: "config-managed-committed",
    version: 1,
    summary: "vibeops.config.json exists at the toplevel but is not tracked by git",
  },
  async ({ repoRoot }) => {
    const file = path.join(repoRoot, MANAGED_FILENAME);
    if (!existsSync(file)) {
      return { findings: [], skipped: `no ${MANAGED_FILENAME} at the toplevel` };
    }

    const tracked = spawnSync("git", ["-C", repoRoot, "ls-files", "--error-unmatch", MANAGED_FILENAME], { encoding: "utf8" });
    if (tracked.status === 0) {
      return { findings: [], examined: 1 };
    }

    const ignored = spawnSync("git", ["-C", repoRoot, "check-ignore", "-v", MANAGED_FILENAME], { encoding: "utf8" });
    const rule = ignored.stdout.trim();
    const findings: GateFinding[] = [
      {
        rule: "config-managed-committed",
        file: MANAGED_FILENAME,
        evidence:
          rule === ""
            ? `${MANAGED_FILENAME} exists but is not tracked by git — this tooling can only write what it can also read back`
            : `${MANAGED_FILENAME} exists but is not tracked — ${rule}`,
      },
    ];
    return { findings, examined: 1 };
  },
);
