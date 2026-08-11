// An ops: a named composition of gates over declared paths, deciding which of them emit.
//
// It is a MODULE. defineOps returns the same ModulePlugin defineModule does, so dispatch, flag
// parsing, the MCP tool schema and the config cascade learn no second concept — an ops is invoked,
// described and exposed exactly like anything else the CLI runs.
//
// THE OPS OWNS EMISSION, NEVER THE GATE. The two things only the producing side can know both belong
// to the composition: the POPULATION (how many files this entry decided were in scope) and the
// MOMENT. A gate handed a file list cannot know either, and references/harness-pair.md's rule that
// ZERO EXAMINED IS NOT A READING is therefore one only an ops can enforce.
//
// THE EMITTER IS BUILT HERE, NOT INJECTED. Emission is an ops concern and "if applicable" is decided
// by the entries, not by the dispatch layer that happens to run them. createEmitter stays in core for
// the same reason defineModule does — it is the layer's shared implementation, not a second owner.
// The path it writes to is named by vibeops.config.ts, which the CLI resolves: nothing here knows it.
//
// OVERLAPPING OPS DOUBLE-COUNT, DELIBERATELY (RFC-0001, Q2). Two ops running the same gate over
// intersecting paths produce the same finding twice, and that is correct: they are different signals,
// because a signal's identity includes the population it was read over. The `ops:<id>` tag on every
// observation is what carries that identity, and is why nothing here deduplicates.
//
// POPULATION VS BEHAVIOUR, AS TWO DIFFERENT SETTINGS SHAPES. `ignore` and `disabled` (below) change
// WHAT WAS READ and are therefore typed and owned here, declared per repository under
// `settings.<ops id>` in vibeops.config.ts; `options` on an OpsGateEntry changes HOW A GATE JUDGES and
// stays free-form, validated by the gate itself. Before this existed, the one population exclusion this
// repository needed (`**/templates/**`, a template's links resolve in the *target* repo, not this one)
// existed as three divergent copies — the shell runner's own `tracked_md()`, a hardcoded filter inside
// `memory-slug`, and no filter at all in `markdown-link`, which is why an unfiltered run of the ops
// reported 13 false findings the day this was measured. A gate must never filter its own population by
// a repository-specific rule; that rule belongs here, where every entry in an ops can share it.
//
// `level` IS THE THIRD MEMBER OF THAT FAMILY, for the same reason. A finding's level is not detection:
// `GateFinding.level` is stripped before anything reaches the emitter, precisely because a producer that
// records a verdict has already done the consuming product's job. Whether a rule BLOCKS is therefore the
// repository's call, alongside "these files do not count" (`ignore`) and "this rule does not apply here"
// (`disabled`). A gate still declares a level, and that declaration is the DEFAULT — what the detector
// thinks its finding is worth, overridden by the repository that has to live with it.
//
// Without this, a gate hardcoding `warn` is unfixable from outside it: `template-version-behind` warns
// because a template bump leaves every record behind at once, which is right while a migration is in
// flight and wrong for a repository that has finished one and wants the gate to hold the line.

import { createEmitter } from "./emit.ts";
import { excludeByGlobs, expandPluginToken, filterByGlobs, resolvePluginDir, trackedFiles } from "./files.ts";
import { createDocumentStore } from "./document.ts";
import { defineModule } from "./module.ts";
import { loadGate } from "./gate.ts";
import type { GateFinding, GatePlugin } from "./gate.ts";
import type { ModulePlugin, ModuleResult } from "./module.ts";
import type { ModuleContext } from "./context.ts";
import path from "node:path";
import { realpathSync } from "node:fs";

export interface OpsGateEntry {
  /** A gate name, resolved by the convention in gate.ts. */
  readonly gate: string;
  /** Overrides the gate's `defaultPaths`. `<plugin>/` expands to the target's plugin surface. */
  readonly paths?: readonly string[];
  /** Whether THIS composition of this gate is worth recording. Per entry, never per gate. */
  readonly emits?: boolean;
  /** Passed to the gate verbatim. How one detector serves two schemas without becoming two gates. */
  readonly options?: Readonly<Record<string, unknown>>;
  /** Distinguishes two entries that use the same gate. Required when `emits` and the name is not bare. */
  readonly label?: string;
}

/** One finding as the caller receives it — the gate that produced it, plus the finding itself. */
export interface OpsFinding {
  readonly gate: string;
  readonly rule: string;
  readonly file?: string;
  readonly line?: number;
  readonly evidence: string;
  readonly level: "fail" | "warn";
}

export interface OpsSkip {
  readonly gate: string;
  readonly reason: string;
}

/** How many files an entry's population held, and how many `ignore` removed from it before the gate ran. */
export interface OpsPopulation {
  readonly gate: string;
  readonly examined: number;
  readonly ignored: number;
}

/**
 * The population contract: `settings.<ops id>` in vibeops.config.ts, read by every entry in this ops.
 * `"*"` applies to every entry; a gate's own label narrows further, additively with `"*"`, never
 * replacing it. Neither key is validated by a gate — see the header comment.
 */
export interface GovernedSettings {
  readonly ignore?: Readonly<Record<string, readonly string[]>>;
  /** A reason a gate does not run at all here, never a boolean — a disablement is a ledger entry. */
  readonly disabled?: Readonly<Record<string, string>>;
  /**
   * Whether a finding blocks, decided by the repository rather than by the detector that raised it.
   * Keyed by a finding's `rule`, by an entry's `label`, or by `"*"` for every finding this ops produces
   * — **most specific wins**, unlike `ignore`, which is additive. A gate's own declared level is the
   * default underneath all three.
   */
  readonly level?: Readonly<Record<string, "fail" | "warn">>;
}

/** One repair, as the caller receives it — which entry made it, and what it did. */
export interface OpsRepair {
  readonly gate: string;
  readonly file: string;
  readonly action: string;
}

export interface OpsDefinition {
  readonly id: string;
  readonly version: string;
  readonly summary: string;
  readonly gates: readonly OpsGateEntry[];
}

const BARE = /^[a-z][a-z0-9-]*$/;

/** What an emitting entry records under. Static, because `emits` is read before anything runs. */
function emitIdFor(entry: OpsGateEntry): string {
  return entry.label ?? entry.gate;
}

function labelFor(entry: OpsGateEntry): string {
  return entry.label ?? entry.gate;
}

export function defineOps(definition: OpsDefinition): ModulePlugin {
  if (definition.gates.length === 0) {
    throw new Error(`ops "${definition.id}" composes no gates — it would report a vacuous pass`);
  }
  const emits: string[] = [];
  for (const entry of definition.gates) {
    if (entry.emits !== true) continue;
    if (entry.label === undefined && !BARE.test(entry.gate)) {
      throw new Error(
        `ops "${definition.id}" declares emits on "${entry.gate}", whose id is not knowable before it ` +
          `loads — give the entry a label, which is what it will record under`,
      );
    }
    const id = emitIdFor(entry);
    if (emits.includes(id)) {
      throw new Error(`ops "${definition.id}" would record two different entries under "${id}" — label one of them`);
    }
    emits.push(id);
  }

  return defineModule(
    {
      id: definition.id,
      version: definition.version,
      summary: definition.summary,
      flags: [
        { name: "list", type: "boolean", description: "Print the gates composed, and the paths each runs over" },
        { name: "audit", type: "boolean", description: "Report exactly as a run would, and always exit 0" },
        { name: "verbose", type: "boolean", description: "Print the full run rather than only what failed" },
        { name: "file", type: "string", description: "Scope to one file instead of every tracked file" },
        {
          name: "fix",
          type: "string",
          implicit: "all",
          description: "Repair what's fixable: bare for every fixable gate, or a comma list of labels",
        },
      ],
      ...(emits.length > 0 ? { emits } : {}),
    },
    async (context: ModuleContext): Promise<ModuleResult> => run(definition, emits, context),
  );
}

/** Best-effort realpath: a file that does not exist yet (or a dangling symlink) resolves to itself. */
function tryRealpath(p: string): string {
  try {
    return realpathSync(p);
  } catch {
    return p;
  }
}

/**
 * `--file` is not required to be tracked — a just-written file is not in `git ls-files` yet.
 *
 * Both sides are realpath-ed before comparing, and deliberately not just the file: `repoRoot` from
 * `repoRootFrom` already went through `git rev-parse --show-toplevel`, which resolves symlinks, but a
 * caller's own path usually has not — a hook payload's `tool_input.file_path` is Claude Code's own
 * bookkeeping, unresolved, and on macOS `/tmp` is itself a symlink to `/private/tmp`. Resolving only
 * `file` fixed the hook and broke a unit test that hands `toRepoRelative` a raw `mkdtemp` path as
 * `repoRoot` — `/var` is exactly the same kind of symlink on the same platform. Resolving both sides
 * is correct either way: realpath-ing an already-resolved path is a no-op.
 */
function toRepoRelative(file: string, repoRoot: string): string {
  const abs = path.isAbsolute(file) ? file : path.resolve(repoRoot, file);
  return path.relative(tryRealpath(repoRoot), tryRealpath(abs));
}

/**
 * What `--fix` selects. `"all"` for the bare flag (every fixable gate); a `Set` of labels for a named
 * list, validated against the composition before anything runs — the same "fail before, not partway
 * through" discipline `resolveAll` already applies to an unresolvable gate.
 */
function fixSpecFrom(flag: unknown, resolved: readonly Resolved[], opsId: string): "all" | Set<string> | undefined {
  if (typeof flag !== "string") return undefined;
  if (flag === "all") return "all";
  const targets = new Set(flag.split(",").map((s) => s.trim()).filter((s) => s !== ""));
  const labels = new Set(resolved.map(({ entry }) => labelFor(entry)));
  for (const target of targets) {
    if (!labels.has(target)) {
      throw new Error(
        `ops "${opsId}" has no gate named "${target}" to --fix (composed: ${[...labels].join(", ") || "none"})`,
      );
    }
  }
  return targets;
}

interface Resolved {
  readonly entry: OpsGateEntry;
  readonly gate: GatePlugin;
  readonly patterns: readonly string[];
}

/**
 * Every gate resolves before any of them runs. A composition naming a gate that does not exist is a
 * broken composition, and it must fail as one — halfway through a run, with three gates already
 * reported, it reads as the repository being broken instead.
 */
async function resolveAll(definition: OpsDefinition, repoRoot: string, pluginDir: string): Promise<Resolved[]> {
  const resolved: Resolved[] = [];
  for (const entry of definition.gates) {
    const gate = await loadGate(entry.gate);
    if (BARE.test(entry.gate) && gate.definition.id !== entry.gate) {
      throw new Error(
        `ops "${definition.id}" composes "${entry.gate}", which loaded a gate whose id is ` +
          `"${gate.definition.id}" — the folder and the definition disagree`,
      );
    }
    const declared = entry.paths ?? gate.definition.defaultPaths ?? ["**/*"];
    resolved.push({
      entry,
      gate,
      patterns: declared.map((pattern) => expandPluginToken(pattern, repoRoot, pluginDir)),
    });
  }
  return resolved;
}

async function run(
  definition: OpsDefinition,
  emits: readonly string[],
  context: ModuleContext,
): Promise<ModuleResult> {
  const pluginDir = resolvePluginDir(context.repoRoot);
  // One store per run, beside pluginDir — lazy, so it costs nothing on a run that never calls .get()
  // (--list, --help). No gate in this track reads it yet; Track 3 is the first consumer.
  const documents = createDocumentStore(context.repoRoot);
  const resolved = await resolveAll(definition, context.repoRoot, pluginDir);

  if (context.flags["list"] === true) {
    const gates = resolved.map(({ entry, gate, patterns }) => ({
      label: labelFor(entry),
      gate: entry.gate,
      paths: patterns,
      summary: gate.definition.summary,
      emits: entry.emits === true,
    }));
    if (context.surface === "cli") {
      for (const { entry, gate, patterns } of resolved) {
        const marks = entry.emits === true ? "  (emits)" : "";
        context.log(`  ${labelFor(entry).padEnd(18)} ${patterns.join(" ")}${marks}`);
        context.log(`  ${" ".repeat(18)} ${gate.definition.summary}`);
      }
    }
    return { code: 0, summary: `${resolved.length} gates composed`, data: { gates } };
  }

  // The emitter is doubly opt-in, unchanged: an entry declares `emits` AND the config names a
  // destination. Either alone produces nothing, so an observation is never written somewhere nobody
  // chose. Built here rather than taken from context.emit — see the header.
  const emit =
    emits.length > 0 && context.config.artifactDir !== undefined
      ? createEmitter({
          artifactDir: path.resolve(context.repoRoot, context.config.artifactDir),
          moduleId: definition.id,
          moduleVersion: definition.version,
          repoRoot: context.repoRoot,
          declared: emits,
          now: () => new Date().toISOString(),
        })
      : undefined;

  // `--file` scopes to one path instead of the tracked-file sweep — a hook reacting to a single write
  // must not touch, or even read, everything else in the repository.
  const fileFlag = context.flags["file"];
  const files = typeof fileFlag === "string" ? [toRepoRelative(fileFlag, context.repoRoot)] : trackedFiles(context.repoRoot);
  const verbose = context.flags["verbose"] === true;
  const cli = context.surface === "cli";
  const fixSpec = fixSpecFrom(context.flags["fix"], resolved, definition.id);
  const governed = context.settings as GovernedSettings | undefined;
  // Every finding, structured. The MCP client shows `structuredContent` and drops the text lines, so
  // a report that lives only in context.log arrives there as a count with nothing behind it.
  const findings: OpsFinding[] = [];
  const skipped: OpsSkip[] = [];
  const repaired: OpsRepair[] = [];
  const population: OpsPopulation[] = [];
  let failures = 0;
  let warnings = 0;

  for (const { entry, gate, patterns } of resolved) {
    const label = labelFor(entry);

    // `disabled` is checked before the gate ever runs — the ledger entry this is meant to be would be
    // pointless if the gate ran anyway and its findings were merely hidden afterward.
    const disabledReason = governed?.disabled?.[label];
    if (disabledReason !== undefined) {
      skipped.push({ gate: label, reason: disabledReason });
      if (cli && verbose) context.log(`SKIP  [${label}] ${disabledReason}`);
      continue;
    }

    const declared = filterByGlobs(files, patterns);
    const ignorePatterns = [...(governed?.ignore?.["*"] ?? []), ...(governed?.ignore?.[label] ?? [])];
    const scoped = excludeByGlobs(declared, ignorePatterns);
    const ignoredCount = declared.length - scoped.length;
    const gateContext = {
      repoRoot: context.repoRoot,
      pluginDir,
      files: scoped,
      options: entry.options ?? {},
      documents,
    };
    let outcome = await gate.run(gateContext);

    // Repair before reporting, so a fixed finding is reported as fixed rather than as still failing.
    const shouldFix = fixSpec !== undefined && (fixSpec === "all" || fixSpec.has(label));
    if (shouldFix && outcome.skipped === undefined && outcome.findings.length > 0) {
      if (gate.fix === undefined) {
        // "all" asks for every FIXABLE gate, so a non-fixable one is silently out of scope for it —
        // only an explicit, specific ask that cannot be honoured is worth a word.
        if (fixSpec !== "all") context.warn(`--fix named "${label}", which is not fixable`);
      } else {
        const fixes = await gate.fix(gateContext, outcome.findings);
        for (const applied of fixes) {
          repaired.push({ gate: label, file: applied.file, action: applied.action });
          if (cli) context.log(`FIXED [${label}] ${applied.file}: ${applied.action}`);
        }
        // Re-run to confirm rather than assume: a fix() that changed something other than what it
        // claimed, or a finding it declined to act on, must still show up below as still failing.
        if (fixes.length > 0) outcome = await gate.run(gateContext);
      }
    }

    const examined = outcome.examined ?? scoped.length;

    if (outcome.skipped !== undefined) {
      skipped.push({ gate: label, reason: outcome.skipped });
      if (cli && verbose) context.log(`SKIP  [${label}] ${outcome.skipped}`);
      continue;
    }

    population.push({ gate: label, examined, ignored: ignoredCount });

    for (const finding of outcome.findings) {
      // Most specific wins: the rule this finding names, else the entry it came from, else every finding
      // in this ops, else what the gate itself declared, else fail.
      const level =
        governed?.level?.[finding.rule] ??
        governed?.level?.[label] ??
        governed?.level?.["*"] ??
        finding.level ??
        "fail";
      if (level === "warn") warnings += 1;
      else failures += 1;
      findings.push({
        gate: label,
        rule: finding.rule,
        ...(finding.file === undefined ? {} : { file: finding.file }),
        ...(finding.line === undefined ? {} : { line: finding.line }),
        evidence: finding.evidence,
        level,
      });
      if (cli) context.log(`${level === "warn" ? "WARN" : "FAIL"}  [${finding.rule}] ${locate(finding)}${finding.evidence}`);
    }
    if (cli && outcome.findings.length === 0 && verbose) {
      const ignoredSuffix = ignoredCount > 0 ? `, ${ignoredCount} ignored` : "";
      context.log(`ok    [${label}] ${examined} examined${ignoredSuffix}`);
    }

    // Zero examined writes nothing at all: a record of nothing examined is indistinguishable from a
    // record of nothing wrong, and only the second is a reading. Zero findings over a non-empty
    // population is a perfectly good reading and is written.
    if (emit && entry.emits === true && examined > 0) {
      // Counts per RULE, not one entry per finding: the receiving side aggregates by rule and refuses a
      // zero, so "this rule found nothing" is written by the line's ABSENCE. A gate reporting several
      // rules under one label — template-version does — therefore records each separately, which is the
      // whole reason those rules are distinct in the first place.
      const counts: Record<string, number> = {};
      for (const finding of outcome.findings) {
        counts[finding.rule] = (counts[finding.rule] ?? 0) + 1;
      }
      await emit({
        id: emitIdFor(entry),
        // The GATE and its own version — the detector that produced these findings, never the
        // composition that ran it. See the header comment on emit.ts.
        tool: `${gate.definition.id}@${gate.definition.version}`,
        examined,
        unit: "file",
        counts,
        moment: "sweep",
        tags: [`ops:${definition.id}`, ...patterns],
      });
    }
  }

  const summary =
    `${resolved.length} gates, ${failures} failed` +
    (warnings > 0 ? `, ${warnings} warned` : "") +
    (repaired.length > 0 ? `, ${repaired.length} repaired` : "");
  const audit = context.flags["audit"] === true;
  // No counts: the arrays carry them, and a count beside the array it summarises is a second thing
  // to keep in step with the first. `population` is the exception the header comment explains: a
  // population that shrank in silence is indistinguishable from a clean run, and only one of them is.
  return { code: audit || failures === 0 ? 0 : 1, summary, data: { findings, skipped, repaired, population } };
}

function locate(finding: GateFinding): string {
  if (finding.file === undefined) return "";
  return finding.line === undefined ? `${finding.file}: ` : `${finding.file}:${finding.line}: `;
}
