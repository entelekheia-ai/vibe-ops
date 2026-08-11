// vibe-ops task — the ephemeral dossier's lifecycle. Plan-011 Track 2 delivers `resolve` only; `close`
// (the finalize.sh port) and `guard` (the closure-box read) are Track 4, on this same module.

import { createDocumentStore, defineModule } from "@entelekheia/vibe-ops-core";
import { formatResolved, resolveRecord, RecordsConfigError } from "@entelekheia/vibe-ops-records";

export default defineModule(
  {
    id: "task",
    version: "0.0.1",
    summary: "The ephemeral dossier: resolve its layout",
    commands: [{ name: "resolve", summary: "directory, template, next number, GitHub remote and auth" }],
    flags: [{ name: "json", type: "boolean", description: "print the structured object instead of KEY=value lines" }],
  },
  async (context) => {
    if (context.command === "resolve") {
      let resolved;
      try {
        resolved = resolveRecord("task", context.repoRoot, context.config, createDocumentStore(context.repoRoot));
      } catch (error) {
        if (error instanceof RecordsConfigError) return { code: 2, summary: error.message };
        throw error;
      }
      if (context.flags.json !== true) {
        for (const line of formatResolved(resolved)) context.log(line);
      }
      return { code: 0, data: resolved };
    }
    return { code: 2, summary: `task ${String(context.command)} is not implemented yet` };
  },
);
