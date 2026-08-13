// vibe-ops records — the generic resolver, for a record type none of the three noun modules own. `adr`
// and `rfc` get no lifecycle actions in this plan (Plan-011 Out of scope), but `/new` still needs their
// layout resolved, and the hook that used to shell out to resolve-governance.sh needs one command that
// answers for all four types. `plan`/`task`/`log` also resolve through this same library directly —
// this module exists for the two types that have no noun of their own, not as a detour for the three
// that do.
//
// VERBS, NOT FLAGS, and it was the other way round for a day. `census` and `handling` shipped as booleans
// on the grounds that declaring `commands` makes the verb mandatory and would break `vibe-ops records
// --type adr`. The break was four lines in four SKILL.md files in this repository, which is a rename
// rather than a break — and the flags were three booleans of which exactly one may be true, an exclusivity
// that lived in the ORDER the `if`s were written rather than in any type: `--census --handling` together
// resolved silently to census. That is a union encoded as booleans, in the same package whose dispatch
// uses a discriminated union for exactly this reason. As verbs it cannot be constructed, `log`/`plan`/
// `task` already name their own resolver `resolve`, and the MCP schema becomes an enum with a summary per
// verb instead of three flags that read as independent.

import { createDocumentStore, defineModule, resolvePluginDir } from "@entelekheia/vibe-ops-core";
import { formatResolved, resolveRecord, RecordsConfigError } from "@entelekheia/vibe-ops-records";
import type { RecordType } from "@entelekheia/vibe-ops-core";
import { census, formatCensus } from "./census.ts";
import { formatHandling, handlingFor } from "./handling.ts";

const TYPES: readonly RecordType[] = ["adr", "rfc", "plan", "task"];

/** Declared once: every verb here can render structured output instead of lines. */
const JSON_FLAG = {
  name: "json",
  type: "boolean",
  description: "print the structured object instead of KEY=value lines",
} as const;

export default defineModule(
  {
    id: "records",
    version: "0.0.1",
    summary: "The record types with no noun of their own: resolve a layout, census the repository, or ask which handling a record needs",
    commands: [
      {
        name: "resolve",
        summary: "directory, template and next number for one record type",
        flags: [{ name: "type", type: "string", description: "adr | rfc | plan | task" }, JSON_FLAG],
      },
      {
        name: "census",
        summary: "every record in this repository with the template version it declares",
        flags: [JSON_FLAG],
      },
      {
        name: "handling",
        summary: "for the given record paths, the version each declares and the documents describing that shape",
        flags: [JSON_FLAG],
      },
    ],
  },
  async (context) => {
    // No `--type` here, and that is the point of it being its own verb: the census spans every type at
    // once, so requiring one would be asking which type the whole-repository question is about.
    if (context.command === "census") {
      let entries;
      try {
        entries = census(context.repoRoot, context.config, createDocumentStore(context.repoRoot));
      } catch (error) {
        if (error instanceof RecordsConfigError) return { code: 2, summary: error.message };
        throw error;
      }
      if (context.flags.json !== true) for (const line of formatCensus(entries)) context.log(line);
      return {
        code: 0,
        summary:
          entries.length === 0
            ? "no governance records found in this repository"
            : `${entries.length} record type(s) censused`,
        data: entries,
      };
    }

    // Also no `--type`, for the same class of reason: the type is resolved from where each file lives,
    // so asking for one would be asking the caller to assert what this verb exists to answer.
    if (context.command === "handling") {
      if (context.args.length === 0) {
        return { code: 2, summary: "records handling needs at least one record path" };
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
      return { code: 0, summary: `${answers.length} record path(s) answered for`, data: answers };
    }

    if (context.command === "resolve") {
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

      if (context.flags.json !== true) for (const line of formatResolved(resolved)) context.log(line);
      return {
        code: 0,
        summary:
          resolved.dir === undefined
            ? `no ${type} directory in this repository`
            : `${type} records live in ${resolved.dir}, next number ${typeof resolved.next === "string" ? resolved.next : "unknown"}`,
        data: resolved,
      };
    }

    return { code: 2, summary: `records ${String(context.command)} is not implemented yet` };
  },
);
