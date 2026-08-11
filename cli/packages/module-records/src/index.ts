// vibe-ops records — the generic resolver, for a record type none of the three noun modules own. `adr`
// and `rfc` get no lifecycle actions in this plan (Plan-011 Out of scope), but `/new` still needs their
// layout resolved, and the hook that used to shell out to resolve-governance.sh needs one command that
// answers for all four types. `plan`/`task`/`log` also resolve through this same library directly —
// this module exists for the two types that have no noun of their own, not as a detour for the three
// that do.

import { defineModule } from "@entelekheia/vibe-ops-core";
import { formatResolved, resolveRecord, RecordsConfigError } from "@entelekheia/vibe-ops-records";
import type { RecordType } from "@entelekheia/vibe-ops-core";

const TYPES: readonly RecordType[] = ["adr", "rfc", "plan", "task"];

export default defineModule(
  {
    id: "records",
    version: "0.0.1",
    summary: "Resolve a governance record type's layout — directory, template, next number",
    flags: [
      { name: "type", type: "string", description: "adr | rfc | plan | task" },
      { name: "json", type: "boolean", description: "print the structured object instead of KEY=value lines" },
    ],
  },
  async (context) => {
    const type = context.flags.type;
    if (typeof type !== "string" || !TYPES.includes(type as RecordType)) {
      return { code: 2, summary: `--type must be one of ${TYPES.join(", ")}, got ${String(type)}` };
    }

    let resolved;
    try {
      resolved = resolveRecord(type as RecordType, context.repoRoot, context.config);
    } catch (error) {
      if (error instanceof RecordsConfigError) return { code: 2, summary: error.message };
      throw error;
    }

    if (context.flags.json === true) {
      return { code: 0, data: resolved };
    }
    for (const line of formatResolved(resolved)) context.log(line);
    return { code: 0, data: resolved };
  },
);
