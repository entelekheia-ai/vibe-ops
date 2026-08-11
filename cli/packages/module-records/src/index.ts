// vibe-ops records — the generic resolver, for a record type none of the three noun modules own. `adr`
// and `rfc` get no lifecycle actions in this plan (Plan-011 Out of scope), but `/new` still needs their
// layout resolved, and the hook that used to shell out to resolve-governance.sh needs one command that
// answers for all four types. `plan`/`task`/`log` also resolve through this same library directly —
// this module exists for the two types that have no noun of their own, not as a detour for the three
// that do.

import { createDocumentStore, defineModule, resolvePluginDir } from "@entelekheia/vibe-ops-core";
import { formatResolved, resolveRecord, RecordsConfigError } from "@entelekheia/vibe-ops-records";
import type { RecordType } from "@entelekheia/vibe-ops-core";
import { census, formatCensus } from "./census.ts";
import { formatHandling, handlingFor } from "./handling.ts";

const TYPES: readonly RecordType[] = ["adr", "rfc", "plan", "task"];

export default defineModule(
  {
    id: "records",
    version: "0.0.1",
    summary:
      "Resolve a governance record type's layout — directory, template, next number — or, with --census, list every record and the template version it declares",
    flags: [
      { name: "type", type: "string", description: "adr | rfc | plan | task" },
      {
        name: "census",
        type: "boolean",
        description: "list every record in this repository with the template version it declares",
      },
      {
        name: "handling",
        type: "boolean",
        description: "for the given record paths, the version each declares and the document that describes it",
      },
      { name: "json", type: "boolean", description: "print the structured object instead of KEY=value lines" },
    ],
  },
  async (context) => {
    // A flag rather than a verb: this module deliberately declares no `commands`, so `vibe-ops records
    // --type <t>` stays its whole surface and adding one here would turn every existing call into an
    // error. Census answers before `--type` is looked at — it spans every type at once, so requiring one
    // would be asking which type the whole-repository question is about.
    if (context.flags.census === true) {
      let entries;
      try {
        entries = census(context.repoRoot, context.config, createDocumentStore(context.repoRoot));
      } catch (error) {
        if (error instanceof RecordsConfigError) return { code: 2, summary: error.message };
        throw error;
      }
      if (context.flags.json !== true) for (const line of formatCensus(entries)) context.log(line);
      return { code: 0, data: entries };
    }

    // Also before `--type`, and for the same reason: the type is resolved from where each file lives,
    // so asking for one would be asking the caller to assert what this verb exists to answer.
    if (context.flags.handling === true) {
      if (context.args.length === 0) {
        return { code: 2, summary: "records --handling needs at least one record path" };
      }
      const documents = createDocumentStore(context.repoRoot);
      const pluginDir = resolvePluginDir(context.repoRoot);
      let answers;
      try {
        answers = context.args.map((file) =>
          handlingFor(file, context.repoRoot, pluginDir, context.config, documents),
        );
      } catch (error) {
        if (error instanceof RecordsConfigError) return { code: 2, summary: error.message };
        throw error;
      }
      if (context.flags.json !== true) {
        for (const answer of answers) for (const line of formatHandling(answer)) context.log(line);
      }
      return { code: 0, data: answers };
    }

    const type = context.flags.type;
    if (typeof type !== "string" || !TYPES.includes(type as RecordType)) {
      return { code: 2, summary: `--type must be one of ${TYPES.join(", ")}, got ${String(type)}` };
    }

    let resolved;
    try {
      resolved = resolveRecord(type as RecordType, context.repoRoot, context.config, createDocumentStore(context.repoRoot));
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
