// vibe-ops records — the generic resolver, for a record type none of the three noun modules own. `adr`
// and `rfc` get no lifecycle actions in this plan (Plan-011 Out of scope), but `/new` still needs their
// layout resolved. This module exists for those two types, and is not a detour for the three that have a
// noun: `plan`, `task` and `log` resolve under their own, which is the whole of Plan-027 Track 1's
// decision. `resolve` therefore answers for `adr|rfc`; `list`, `census` and `show` still answer for all
// four, because nothing on a noun answers their question and narrowing them would remove the only way to
// ask it.
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
import {
  createDocumentStore,
  defineModule,
  effectiveGovernanceBindings,
  resolvePluginDir,
} from "@entelekheia/vibe-ops-core";
import {
  depthFor,
  formatResolved,
  listMarkdownFiles,
  resolveRecord,
  RecordsConfigError,
} from "@entelekheia/governance-base";
import type { ModuleResult, RecordType, VibeOpsConfig } from "@entelekheia/vibe-ops-core";
import { census, formatCensus } from "./census.ts";
import { formatHandling, handlingFor } from "./handling.ts";
import { composedOwnership } from "@entelekheia/vibe-ops-harness";
import { formatShown, LISTABLE, LIST_DEFAULT, pickFrom, showRecord, summariseShown } from "./show.ts";
import { describeNormType, listNormMigrationNotes as listMigrationNotes, resolveNormFacet } from "@entelekheia/governance-base";
import type { NormFacet } from "@entelekheia/governance-base";
import type { ListField } from "./show.ts";

const TYPES: readonly RecordType[] = ["adr", "rfc", "plan", "task"];

/**
 * What `resolve` answers for: the two record types with no noun of their own. `plan` and `task` were
 * reachable here and under their own nouns at once, which is the duplication Plan-027 Track 1 exists to
 * remove — the noun is the spelling, so this verb no longer offers a second name for either.
 *
 * `list`, `census` and `show` keep all four deliberately. Nothing on a noun answers their question, so
 * narrowing them would remove the only way to ask it.
 */
const RESOLVE_TYPES: readonly RecordType[] = ["adr", "rfc"];

/** Where a type that used to resolve here resolves now — named in the refusal, so a removal reads as a rename. */
const RESOLVES_UNDER: Partial<Record<string, string>> = {
  plan: "vibe-ops plan resolve",
  task: "vibe-ops task resolve",
};

/** Every type this repository declared a directory for — a declaration somebody made on purpose, which
 *  is what separates a contributed type from a misspelling. */
function declaredTypes(config: VibeOpsConfig | undefined): readonly string[] {
  return Object.keys(config?.records?.dirs ?? {});
}

/** The names this tooling itself ships. A name outside it is contributed, and `gateType` lets it through
 *  rather than measuring it against a vocabulary that no longer closes. */
const ORDER_SHIPPED: readonly string[] = ["adr", "rfc", "plan", "task", "log"];

/**
 * The one `--type` gate. It was written twice, byte-identical, back when both verbs took the same four
 * types; the moment their domains differ is the moment two copies stop being harmless. Returns the
 * validated type or the failure to return verbatim — never a thrown error, because an unknown flag value
 * is the caller's typo and not this module's exception.
 */
function gateType(
  value: string | boolean | undefined,
  allowed: readonly RecordType[],
  declared?: readonly string[],
  config?: VibeOpsConfig,
): { readonly type: RecordType } | { readonly failure: ModuleResult } {
  if (typeof value === "string" && allowed.includes(value as RecordType)) return { type: value as RecordType };
  // A CONTRIBUTED TYPE AND A TYPO ARE THE SAME STRING, so the question cannot be "is this outside the
  // shipped list" — that would let `--type wat` resolve against `project/wat` by convention and report a
  // confident empty answer. It is "does anything DECLARE this": the repository, through `records.dirs`
  // or a `types` binding — the config is the registry (ADR-0019; the Plan-029 node_modules scan left
  // the resolution path with it). Both are declarations somebody made on purpose; a misspelling is
  // neither, and still fails naming the set.
  if (typeof value === "string" && value !== "" && RESOLVES_UNDER[value] === undefined && !ORDER_SHIPPED.includes(value)) {
    if (declared?.includes(value) === true) return { type: value };
    if (effectiveGovernanceBindings(config)[value] !== undefined) return { type: value };
  }
  const elsewhere = typeof value === "string" ? RESOLVES_UNDER[value as RecordType] : undefined;
  return {
    failure: {
      code: 2,
      summary:
        elsewhere === undefined
          ? `--type must be one of ${allowed.join(", ")}, got ${String(value)}`
          : `--type must be one of ${allowed.join(", ")} — ${value} resolves under its own noun (${elsewhere})`,
    },
  };
}

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
    // `handling` and `show` dispatch on migration notes, which belong to the installed norm rather than
    // to the repository being read — the same reason `plan` and `task` declare it.
    needsSource: true,
    commands: [
      {
        name: "resolve",
        summary: "directory, template and next number for a record type with no noun of its own",
        flags: [
          {
            name: "type",
            type: "string",
            description: "adr | rfc — plan and task resolve under their own nouns",
            required: true,
            choices: RESOLVE_TYPES,
          },
          // 17 greps for `[0-9]{3}` over project/ in the measured corpus, all asking this. The number was
          // already in the payload, as one `NEXT=` line among a dozen — which is not the same as being
          // answerable.
          { name: "next-number", type: "boolean", description: "print only the next free number" },
          // Five `resolve → Read` pairs in the same corpus: the command named the template and the caller
          // then opened it. Behind a flag rather than always, because a template body is ~150 lines and
          // the common path should not carry it.
          { name: "template", type: "boolean", description: "print the template's body, not only its path" },
        ],
      },
      {
        // The proxy verb (Plan-033): the Claude plugin reads the norm's template, authoring rules and
        // migration notes through this — never through a `${CLAUDE_PLUGIN_ROOT}` path, which an
        // npm-only install does not have. `--type` is open: a bound contributed type answers the same
        // way the shipped five do.
        name: "norm",
        summary: "where the norm's copy of a type's facet is — the file the plugin skills read",
        flags: [
          { name: "type", type: "string", description: "any resolvable record type", required: true },
          {
            name: "facet",
            type: "string",
            description: "which facet of the type's unit",
            required: true,
            choices: ["template", "authoring", "migrations", "policy"],
          },
          {
            name: "name",
            type: "string",
            description: "which of the type's facets.* policy files — required for, and only valid with, --facet policy",
          },
          { name: "print", type: "boolean", description: "print the facet's content (for migrations: the note paths)" },
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
        flags: [
          { name: "type", type: "string", description: "adr | rfc | plan | task", required: true, choices: TYPES },
          // The caller picks the projection rather than choosing between two points on a line somebody
          // else drew. `sections` across every record was 78.7% of this verb's first payload and answers
          // a question about ONE record — but "which plans still carry a Surprises section?" is a real
          // cross-record question, and a boolean makes it all-or-nothing.
          {
            name: "fields",
            type: "string",
            description: `comma-separated subset of ${LISTABLE.join(",")}, or "all" (default: ${LIST_DEFAULT.join(",")})`,
          },
        ],
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
    if (context.command === "norm") {
      const type = context.flags["type"];
      const facet = context.flags["facet"] as NormFacet;
      const nameFlag = context.flags["name"];
      const name = typeof nameFlag === "string" && nameFlag !== "" ? nameFlag : undefined;
      if (typeof type !== "string" || type === "") {
        return { code: 2, summary: "norm needs --type <record type>" };
      }
      // `--name` and `--facet policy` come as a pair, in both directions: one without the other is a
      // request that cannot be answered — either "which facet" (no --name) or "--name means nothing
      // here" (a facet with one fixed field already).
      if (facet === "policy" && name === undefined) {
        return { code: 2, summary: "norm --facet policy needs --name — which of the type's facets to serve" };
      }
      if (facet !== "policy" && name !== undefined) {
        return { code: 2, summary: `norm --name only applies to --facet policy, not --facet ${facet}` };
      }
      // Both refusals below need to know what the type ACTUALLY declares, so they name it rather than
      // reporting a bare "does not exist" — the same "visible and attributable" standard the rest of
      // this facet ladder already holds itself to.
      if (facet === "policy" || facet === "template") {
        const description = await describeNormType(type, context.repoRoot, context.config, context.sourceRoot);
        if (description !== undefined) {
          if (facet === "template" && !description.hasTemplate) {
            return { code: 2, summary: `${type} is policy-only — it declares no template` };
          }
          if (facet === "policy" && !description.facetNames.includes(name!)) {
            return {
              code: 2,
              summary:
                description.facetNames.length === 0
                  ? `${type} declares no facets — nothing named "${name}" to serve`
                  : `${type} declares no facet "${name}" — it has: ${description.facetNames.join(", ")}`,
            };
          }
        }
      }
      const answer = await resolveNormFacet(type, facet, context.repoRoot, context.config, context.sourceRoot, name);
      if (answer === undefined) {
        return {
          code: 2,
          summary: `nothing resolves "${type}" — no repository unit, no activated governance package, no pinned tree`,
        };
      }
      if (context.flags["print"] === true && answer.exists) {
        if (facet === "migrations") {
          const notes = listMigrationNotes(answer.path);
          if (context.surface === "cli") for (const note of notes) context.log(note);
          return { code: 0, summary: `${notes.length} migration note(s) for ${type} (${answer.source})`, data: { ...answer, notes } };
        }
        const body = readFileSync(answer.path, "utf8");
        if (context.surface === "cli") context.log(body);
        return { code: 0, summary: `${type} ${facet} from ${answer.source}`, data: { ...answer, body } };
      }
      if (context.surface === "cli" && context.flags["json"] !== true) {
        context.log(`${answer.path}${answer.exists ? "" : "  (does not exist)"}`);
      }
      return {
        code: answer.exists ? 0 : 1,
        summary: `${type} ${facet}: ${answer.source}${answer.exists ? "" : ", not present"}`,
        data: answer,
      };
    }

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
      // The composed boundary, once per run (Plan-031): handling reports each record's effective
      // ownership class so the consulting actor — migration, above all — never re-decides it per file.
      const boundary = await composedOwnership(context.config);
      let answers;
      try {
        answers = await Promise.all(
          context.args.map((file) =>
            handlingFor(file, context.repoRoot, pluginDir, context.config, documents, context.sourceRoot, boundary),
          ),
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
      const gated = gateType(context.flags.type, TYPES, declaredTypes(context.config), context.config);
      if ("failure" in gated) return gated.failure;
      const type = gated.type;
      const documents = createDocumentStore(context.repoRoot);
      const pluginDir = resolvePluginDir(context.repoRoot);
      let resolved;
      try {
        resolved = resolveRecord(type, context.repoRoot, context.config, documents);
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
      const files = listMarkdownFiles(path.join(context.repoRoot, resolved.dir), depthFor(type)).map(
        (name) => `${resolved.dir}/${name}`,
      );
      // Resolved before the records are read: an unknown field name is the caller's typo, and reporting it
      // after doing the work would be answering a question they did not ask.
      const raw = context.flags.fields;
      let fields = LIST_DEFAULT;
      if (typeof raw === "string") {
        if (raw.trim() === "all") {
          fields = LISTABLE;
        } else {
          const asked = raw.split(",").map((name) => name.trim()).filter((name) => name !== "");
          const unknown = asked.filter((name) => !LISTABLE.includes(name as ListField));
          if (unknown.length > 0) {
            return {
              code: 2,
              summary: `unknown field(s) ${unknown.join(", ")} — --fields takes ${LISTABLE.join(",")} or "all"`,
            };
          }
          if (asked.length === 0) {
            return { code: 2, summary: `--fields was empty — it takes ${LISTABLE.join(",")} or "all"` };
          }
          fields = asked as ListField[];
        }
      }

      const shown = await Promise.all(
        files.map((file) => showRecord(file, context.repoRoot, pluginDir, context.config, documents)),
      );
      if (context.flags.json !== true) {
        for (const row of shown) {
          const tracks = row.tracks === undefined ? "" : `  ${row.tracks.open}/${row.tracks.total} open`;
          context.log(`${(row.status ?? "(no Status)").padEnd(14)} ${row.file}${tracks}`);
        }
      }
      // The printed line is fixed — it is the human summary, and it stays the same whatever `--fields`
      // selects. What varies is `data`, which is the surface the selection is for.
      const rows = shown.map((one) => pickFrom(one, fields));
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
        shown = await Promise.all(
          context.args.map((file) =>
            showRecord(file, context.repoRoot, pluginDir, context.config, documents, context.sourceRoot),
          ),
        );
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
      const gated = gateType(context.flags.type, RESOLVE_TYPES, declaredTypes(context.config), context.config);
      if ("failure" in gated) return gated.failure;
      const type = gated.type;

      let resolved;
      try {
        resolved = resolveRecord(type, context.repoRoot, context.config, createDocumentStore(context.repoRoot));
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
