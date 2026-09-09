// The sugar a per-artifact governance package is built from — Plan-033, ADR-0019.
//
// ONE ARTIFACT, ONE GOVERNANCE PACKAGE, and behaviour equal across artifacts is written HERE, once.
// `governance-adr`'s whole src/ is one call to this function; `governance-plan` passes its own verbs
// and its own `run` on top. Without this layer every equal-behaviour governance would carry a copy of
// the same resolve verb, and the copies would drift — the exact failure the base layer exists to remove.
//
// THE RETURNED PLUGIN CARRIES THE PACKAGE'S ROOT AND ITS PARSED UNIT. Activation is the repository's
// `vibeops.config` (the config is the registry), so the CLI learns a governance package by importing
// it — and one import must answer BOTH halves: the verbs (a ModulePlugin like any other) and the data
// (where the template, authoring rules and migration notes are). Stamping the root and unit here is
// what makes that one import sufficient, and it is the seam the proxy's later increments extend —
// skill snippets, hook configuration — as further keys on this same options bag, no reshaping.
//
// THE OPTIONS BAG IS DELIBERATELY OPEN-ENDED IN DESIGN, CLOSED IN CODE. New capabilities arrive as new
// optional fields; nothing here is variadic or dynamic, so a governance package that declares itself
// wrongly fails at load, the same argument defineModule already makes.

import { readFileSync } from "node:fs";
import path from "node:path";
import { createDocumentStore, defineModule } from "@entelekheia/vibe-ops-core";
import type {
  ModuleCommand,
  ModuleContext,
  ModuleFlag,
  ModulePlugin,
  ModuleResult,
} from "@entelekheia/vibe-ops-core";
import { formatResolved } from "./format.ts";
import { RecordsConfigError } from "./layout.ts";
import { resolveRecord } from "./resolve.ts";
import { parseTypeManifest } from "./type-unit.ts";
import type { TypeUnit } from "./type-unit.ts";

/** A governance module: a ModulePlugin that also answers where its data is. */
export interface GovernancePlugin extends ModulePlugin {
  /** Absolute path to the package root — the directory holding `type.json` and the facet dirs. */
  readonly root: string;
  /** The parsed `type.json`, facet paths still package-relative; resolve against `root`. */
  readonly unit: TypeUnit;
  /** Every unit the manifest declares, present only when it declares more than one — what lets one
   *  import answer for a type this module is not. */
  readonly units?: readonly TypeUnit[];
}

export interface DefineGovernanceOptions {
  /**
   * The package's own root. A caller computes it from its `import.meta.url` — one level up from
   * `src/` or `dist/`, the same depth either way — because an installed package sits wherever npm put
   * it and nothing else can know.
   */
  readonly root: string;
  readonly version: string;
  /**
   * Which unit of a multi-unit manifest this module serves — required when the manifest declares
   * `units`, refused when it declares one unit, because there would be nothing to choose. A package
   * shipping two units builds two modules from the same manifest (`knowledge` ships `log` and
   * `learning`), and the module id is still the unit's type, which is what keeps the noun, the MCP tool
   * name and the settings key stable across a change of serving package.
   */
  readonly type?: string;
  /** Overrides the derived one-liner. */
  readonly summary?: string;
  /**
   * Verbs beyond the standard set. A command sharing a standard verb's name REPLACES it — the package
   * is saying it has more to show for that verb than the base does (plan's `resolve` reports the status
   * chain and living sections on top of the layout) — and everything else is appended.
   */
  readonly commands?: readonly ModuleCommand[];
  readonly flags?: readonly ModuleFlag[];
  readonly emits?: readonly string[];
  readonly destructive?: boolean;
  readonly needsSource?: boolean;
  /**
   * The package's own dispatch, for the verbs it added. Receives `base` — the standard verbs'
   * implementation — and delegates to it for anything it does not handle, so a governance never
   * re-implements a standard verb to keep it working.
   */
  readonly run?: (
    context: ModuleContext,
    base: (context: ModuleContext) => Promise<ModuleResult>,
  ) => Promise<ModuleResult>;
}

/** The verbs every governance has, before its package adds any. */
const STANDARD_COMMANDS: readonly ModuleCommand[] = [
  { name: "resolve", summary: "directory, template and next number for this record type" },
];

/**
 * Builds a governance module from the package's own `type.json` plus whatever the package adds.
 * The module id IS the unit's type — `vibe-ops <type> …` — which is what keeps settings keys, MCP tool
 * names and skills stable when a type's serving package changes.
 */
export function defineGovernance(options: DefineGovernanceOptions): GovernancePlugin {
  const manifestFile = path.join(options.root, "type.json");
  const units = parseTypeManifest(readFileSync(manifestFile, "utf8"), manifestFile);

  // WHICH UNIT THIS MODULE IS, when the manifest ships several. Both errors below are thrown at load,
  // not at dispatch: a package that names a unit its manifest does not have, or omits the name where
  // there is a choice, is misdeclared, and `defineModule` already makes the argument that a wrong
  // self-description must fail where it is written rather than in one surface nobody checks.
  if (units.length > 1 && options.type === undefined) {
    throw new RecordsConfigError(
      `${manifestFile} declares ${units.length} units (${units.map((u) => u.type).join(", ")}) — defineGovernance needs \`type\` to say which one this module serves`,
    );
  }
  if (units.length === 1 && options.type !== undefined && options.type !== units[0]!.type) {
    throw new RecordsConfigError(`${manifestFile} declares the single unit "${units[0]!.type}", not "${options.type}"`);
  }
  const unit = options.type === undefined ? units[0]! : units.find((candidate) => candidate.type === options.type);
  if (unit === undefined) {
    throw new RecordsConfigError(
      `${manifestFile} declares no unit "${options.type}" — it has: ${units.map((u) => u.type).join(", ")}`,
    );
  }

  const base = async (context: ModuleContext): Promise<ModuleResult> => {
    if (context.command === "resolve") {
      const documents = createDocumentStore(context.repoRoot);
      try {
        const resolved = resolveRecord(unit.type, context.repoRoot, context.config, documents);
        if (context.surface === "cli" && context.flags["json"] !== true) {
          for (const line of formatResolved(resolved)) context.log(line);
        }
        return { code: 0, summary: `${unit.type} resolved`, data: resolved };
      } catch (error) {
        if (error instanceof RecordsConfigError) return { code: 2, summary: error.message };
        throw error;
      }
    }
    return { code: 2, summary: `${unit.type} has no command "${context.command ?? ""}"` };
  };

  const commands = [
    ...STANDARD_COMMANDS.filter((standard) => !(options.commands ?? []).some((own) => own.name === standard.name)),
    ...(options.commands ?? []),
  ];
  const plugin = defineModule(
    {
      id: unit.type,
      version: options.version,
      summary: options.summary ?? `The ${unit.type} record type: its layout, template and rules`,
      ...(options.flags === undefined ? {} : { flags: options.flags }),
      commands,
      ...(options.emits === undefined ? {} : { emits: options.emits }),
      ...(options.destructive === undefined ? {} : { destructive: options.destructive }),
      ...(options.needsSource === undefined ? {} : { needsSource: options.needsSource }),
    },
    async (context) => (options.run === undefined ? base(context) : options.run(context, base)),
  );

  // `units` travels beside the chosen unit so activation can pick a DIFFERENT one from the same import:
  // a package shipping two of them is imported once, and core's `activateGovernance` reads the array
  // rather than trusting whichever module happened to be the default export.
  return { ...plugin, root: options.root, unit, ...(units.length > 1 ? { units } : {}) };
}
