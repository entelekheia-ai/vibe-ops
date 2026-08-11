// vibe-ops plan — the permanent design record's lifecycle. `resolve` (Track 2), `status` and `context`
// (Track 3) here; `file` and `close` are Track 6, on this same module — the noun is `plan`, the verbs
// accumulate on it.

import { createDocumentStore, defineModule } from "@entelekheia/vibe-ops-core";
import {
  formatResolved,
  planModeGuidance,
  planStatusFindings,
  resolveRecord,
  RecordsConfigError,
} from "@entelekheia/vibe-ops-records";
import type { PlanStatusFinding } from "@entelekheia/vibe-ops-records";

export default defineModule(
  {
    id: "plan",
    version: "0.0.1",
    summary: "The permanent design record: resolve its layout, check Status against its tracks",
    commands: [
      { name: "resolve", summary: "directory, template, next number, active status, living sections" },
      {
        name: "status",
        summary: "every plan whose Status disagrees with its own track checkboxes — the coherence read",
      },
      {
        name: "context",
        summary: "the plan-mode guidance text, built from the resolved living sections",
        flags: [{ name: "project-dir", type: "string", description: "the session's nominal project root, if it may differ from repoRoot" }],
      },
    ],
    flags: [{ name: "json", type: "boolean", description: "print the structured object instead of KEY=value lines" }],
  },
  async (context) => {
    // One store for the whole invocation, the way `defineOps` builds one for a gate composition: the
    // template, the authority and every plan under the resolved directory are parsed once, however many
    // of the verbs below happen to read them.
    const documents = createDocumentStore(context.repoRoot);

    if (context.command === "resolve") {
      let resolved;
      try {
        resolved = resolveRecord("plan", context.repoRoot, context.config, documents);
      } catch (error) {
        if (error instanceof RecordsConfigError) return { code: 2, summary: error.message };
        throw error;
      }
      if (context.flags.json !== true) {
        for (const line of formatResolved(resolved)) context.log(line);
      }
      return { code: 0, data: resolved };
    }

    if (context.command === "status") {
      let resolved;
      try {
        resolved = resolveRecord("plan", context.repoRoot, context.config, documents);
      } catch (error) {
        if (error instanceof RecordsConfigError) return { code: 2, summary: error.message };
        throw error;
      }
      const findings: readonly PlanStatusFinding[] =
        resolved.dir === undefined
          ? []
          : planStatusFindings(documents, context.repoRoot, resolved.dir, resolved.plan?.active, resolved.plan?.terminal);

      if (context.flags.json !== true) {
        if (findings.length === 0) context.log("no incoherent plan found");
        for (const finding of findings) {
          const reason =
            finding.reason === "terminal-with-open-tracks"
              ? `Status is "${finding.status}" (terminal) but ${finding.tracksTotal - finding.tracksChecked} of ${finding.tracksTotal} tracks are unchecked`
              : `Status is "${finding.status}" (active) but all ${finding.tracksTotal} tracks are checked`;
          context.log(`${finding.file}: ${reason}`);
        }
      }
      return { code: 0, data: { findings } };
    }

    if (context.command === "context") {
      let resolved;
      try {
        resolved = resolveRecord("plan", context.repoRoot, context.config, documents);
      } catch (error) {
        if (error instanceof RecordsConfigError) return { code: 2, summary: error.message };
        throw error;
      }
      const projectDir = typeof context.flags["project-dir"] === "string" ? context.flags["project-dir"] : undefined;
      const text = planModeGuidance(resolved, projectDir);
      if (context.flags.json !== true && text !== "") context.log(text);
      return { code: 0, data: { text } };
    }

    return { code: 2, summary: `plan ${String(context.command)} is not implemented yet` };
  },
);
