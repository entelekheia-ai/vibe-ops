// vibe-ops plan — the permanent design record's lifecycle. Plan-011 Track 2 delivers `resolve` only;
// `status`, `context`, `file` and `close` are later tracks on this same module, not separate ones — the
// noun is `plan`, the verbs accumulate on it.

import { defineModule } from "@entelekheia/vibe-ops-core";
import { formatResolved, resolveRecord, RecordsConfigError } from "@entelekheia/vibe-ops-records";

export default defineModule(
  {
    id: "plan",
    version: "0.0.1",
    summary: "The permanent design record: resolve its layout",
    commands: [{ name: "resolve", summary: "directory, template, next number, active status, living sections" }],
    flags: [{ name: "json", type: "boolean", description: "print the structured object instead of KEY=value lines" }],
  },
  async (context) => {
    // context.command is validated against the declared commands array before this ever runs (run.ts),
    // so "resolve" is the only value reachable here today — the branch exists for the verbs Track 3+
    // add, not because this one needs to guard against an impossible value.
    if (context.command === "resolve") {
      let resolved;
      try {
        resolved = resolveRecord("plan", context.repoRoot, context.config);
      } catch (error) {
        if (error instanceof RecordsConfigError) return { code: 2, summary: error.message };
        throw error;
      }
      if (context.flags.json !== true) {
        for (const line of formatResolved(resolved)) context.log(line);
      }
      return { code: 0, data: resolved };
    }
    return { code: 2, summary: `plan ${String(context.command)} is not implemented yet` };
  },
);
