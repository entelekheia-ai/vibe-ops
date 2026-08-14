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

import { readFileSync } from "node:fs";
import path from "node:path";
import { createDocumentStore, defineModule, resolvePluginDir } from "@entelekheia/vibe-ops-core";
import {
  DEPTH,
  formatResolved,
  listMarkdownFiles,
  resolveRecord,
  RecordsConfigError,
} from "@entelekheia/vibe-ops-records";
import type { RecordType } from "@entelekheia/vibe-ops-core";
import { census, formatCensus } from "./census.ts";
import { formatHandling, handlingFor } from "./handling.ts";
import { formatShown, showRecord, summariseShown } from "./show.ts";

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
        flags: [
          { name: "type", type: "string", description: "adr | rfc | plan | task" },
          // 17 greps for `[0-9]{3}` over project/ in the measured corpus, all asking this. The number was
          // already in the payload, as one `NEXT=` line among a dozen — which is not the same as being
          // answerable.
          { name: "next-number", type: "boolean", description: "print only the next free number" },
          // Five `resolve → Read` pairs in the same corpus: the command named the template and the caller
          // then opened it. Behind a flag rather than always, because a template body is ~150 lines and
          // the common path should not carry it.
          { name: "template", type: "boolean", description: "print the template's body, not only its path" },
          JSON_FLAG,
        ],
      },
      {
        name: "census",
        summary: "every record in this repository with the template version it declares",
      },
      {
        name: "handling",
        summary: "for the given record paths, the version each declares and the documents describing that shape",
      },
      {
        name: "show",
        summary: "one record read: status, sections, open tracks, accumulating entries, migrations owed",
      },
      {
        // Declared here rather than as a fourth `list` on the three nouns. Every ops has `--list` and no
        // noun had any way to answer "which plans exist and where do they stand" short of `census`, but
        // writing the verb once per noun is how the four `resolve` implementations diverged in the first
        // place (Plan-027 Track 1) — one implementation over `--type` cannot drift against itself.
        name: "list",
        summary: "every record of one type with its status and, for a plan, how many tracks are open",
        flags: [{ name: "type", type: "string", description: "adr | rfc | plan | task" }],
      },
    ],
    // Declared once at module level, as `plan`, `task` and `log` each declare theirs. It was repeated on
    // every verb here — invisible over MCP, where the schema unions every verb's flags anyway, and
    // visible only in the terminal's own `--help`.
    flags: [JSON_FLAG],
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
      // No paths means every record: `census` is this same function over the whole repository, reading
      // the same `template-version` out of the same files, and asking which of two verbs answers a
      // question that differs only in its population is a distinction the caller should not have to make.
      // `census` stays as its own verb — it is named in shipped skills — but it is no longer the only
      // way to ask.
      if (context.args.length === 0) {
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
              : `${entries.length} record type(s) censused — handling with no path is the whole repository`,
          data: entries,
        };
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

    if (context.command === "list") {
      const type = context.flags.type;
      if (typeof type !== "string" || !TYPES.includes(type as RecordType)) {
        return { code: 2, summary: `--type must be one of ${TYPES.join(", ")}, got ${String(type)}` };
      }
      const documents = createDocumentStore(context.repoRoot);
      const pluginDir = resolvePluginDir(context.repoRoot);
      let resolved;
      try {
        resolved = resolveRecord(type as RecordType, context.repoRoot, context.config, documents);
      } catch (error) {
        if (error instanceof RecordsConfigError) return { code: 2, summary: error.message };
        throw error;
      }
      if (resolved.dir === undefined) {
        return { code: 0, summary: `no ${type} directory in this repository`, data: [] };
      }
      // The same depth `plan status` sweeps, so a shipped plan is listed rather than quietly missing —
      // "which plans exist" includes the ones that are done.
      // `listMarkdownFiles` returns paths relative to the directory it was handed, not absolute ones —
      // so the repository-relative path is that name joined back onto `resolved.dir`. Getting this wrong
      // produced a listing that looked right and reported `(no Status)` for every record, because each
      // path resolved to nothing and an unparseable document has no header table.
      const files = listMarkdownFiles(path.join(context.repoRoot, resolved.dir), DEPTH[type as RecordType]).map(
        (name) => `${resolved.dir}/${name}`,
      );
      const rows = files.map((file) => showRecord(file, context.repoRoot, pluginDir, context.config, documents));
      if (context.flags.json !== true) {
        for (const row of rows) {
          const tracks = row.tracks === undefined ? "" : `  ${row.tracks.open}/${row.tracks.total} open`;
          context.log(`${(row.status ?? "(no Status)").padEnd(14)} ${row.file}${tracks}`);
        }
      }
      return {
        code: 0,
        summary:
          rows.length === 0
            ? `no ${type} records in ${resolved.dir}`
            : `${rows.length} ${type} record(s) in ${resolved.dir}`,
        data: rows,
      };
    }

    if (context.command === "show") {
      if (context.args.length === 0) {
        return { code: 2, summary: "records show needs at least one record path" };
      }
      const documents = createDocumentStore(context.repoRoot);
      const pluginDir = resolvePluginDir(context.repoRoot);
      let shown;
      try {
        shown = context.args.map((file) => showRecord(file, context.repoRoot, pluginDir, context.config, documents));
      } catch (error) {
        if (error instanceof RecordsConfigError) return { code: 2, summary: error.message };
        throw error;
      }
      if (context.flags.json !== true) {
        for (const one of shown) for (const line of formatShown(one)) context.log(line);
      }
      return {
        code: 0,
        summary: shown.length === 1 ? summariseShown(shown[0]!) : `${shown.length} records read`,
        data: shown.length === 1 ? shown[0] : shown,
      };
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

      if (context.flags["next-number"] === true) {
        if (typeof resolved.next !== "string") {
          return { code: 2, summary: `the next ${type} number is unknown — see ${resolved.authority ?? "the authority"}` };
        }
        if (context.flags.json !== true) context.log(resolved.next);
        return { code: 0, summary: `next ${type} number is ${resolved.next}`, data: { next: resolved.next } };
      }

      if (context.flags["template"] === true) {
        if (resolved.template === undefined) {
          return { code: 2, summary: `no ${type} template found in this repository` };
        }
        let body: string;
        try {
          body = readFileSync(path.resolve(context.repoRoot, resolved.template), "utf8");
        } catch (error) {
          return { code: 2, summary: `${resolved.template} could not be read: ${(error as Error).message}` };
        }
        if (context.flags.json !== true) context.log(body);
        return {
          code: 0,
          summary: `${resolved.template} (${body.split("\n").length} lines)`,
          data: { ...resolved, templateBody: body },
        };
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
