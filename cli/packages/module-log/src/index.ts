// vibe-ops log — the write-once trap tier. Plan-011 Track 2 delivers `resolve` only; `index`, `sweep`
// and `lint` are Track 5, on this same module. `log` has no number — `resolve` deliberately reports no
// NEXT-shaped field, matching `new-log`'s Step 2: "Do not call resolve-governance.sh — a log entry has
// no number."

import { existsSync } from "node:fs";
import path from "node:path";
import { defineModule } from "@entelekheia/vibe-ops-core";

const CANDIDATE_DIRS = ["project/log", "log"] as const;

export default defineModule(
  {
    id: "log",
    version: "0.0.1",
    summary: "The write-once trap tier: resolve where entries live",
    commands: [{ name: "resolve", summary: "where entries live — no number, deliberately" }],
    flags: [{ name: "json", type: "boolean", description: "print the structured object instead of a DIR= line" }],
  },
  async (context) => {
    if (context.command === "resolve") {
      const dir = CANDIDATE_DIRS.find((candidate) => existsSync(path.join(context.repoRoot, candidate)));
      const resolved = { type: "log" as const, root: context.repoRoot, dir };
      if (context.flags.json !== true) context.log(`DIR=${dir ?? "(none)"}`);
      return { code: 0, data: resolved };
    }
    return { code: 2, summary: `log ${String(context.command)} is not implemented yet` };
  },
);
