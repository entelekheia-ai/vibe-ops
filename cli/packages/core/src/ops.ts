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

import { createEmitter, UndeclaredObservationError } from "./emit.ts";
import {
  excludeByGlobs,
  expandOptionTokens,
  expandTokens,
  filterByGlobs,
  resolveArtifactDir,
  resolvePluginDir,
  trackedFiles,
} from "./files.ts";
import { createDocumentStore } from "./document.ts";
import { defineModule } from "./module.ts";
import { loadGate } from "./gate.ts";
import type { GateFinding, GatePlugin } from "./gate.ts";
import type { ModulePlugin, ModuleResult } from "./module.ts";
import type { ModuleContext } from "./context.ts";
import type { RecordsConfig } from "./config.ts";
import path from "node:path";
import { realpathSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";

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
  /** A tree built to make this entry fire, and what it must report. See `OpsFixture`. */
  readonly fixture?: OpsFixture;
}

/**
 * A deliberately broken tree, declared beside the entry it proves.
 *
 * A guard nobody has watched fail is not evidence of anything, and this repository has shipped that
 * mistake before — which is why the shell suite has carried `--self-test` since it had four fragments.
 * Gates had no equivalent: a detector that silently stopped detecting reported a clean tree, and a clean
 * tree is what a working one reports too.
 *
 * The fixture is inline rather than a directory because it must travel with the composition. A fixture in
 * a folder somewhere is one nobody notices has stopped matching the entry it was written for.
 */
export interface OpsFixture {
  /** Repo-relative path → contents. Written into a fresh temp repository, which is also its plugin dir. */
  readonly files: Readonly<Record<string, string>>;
  /** The `rule` names this entry MUST produce against that tree. Every one of them, or the self-test fails. */
  readonly expect: readonly string[];
  /** Options for the fixture run. Defaults to the entry's own — override when they name real paths. */
  readonly options?: Readonly<Record<string, unknown>>;
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
        // The four governance nouns have had `--json` since they existed; the ops did not, so the only way
        // to read an ops report from a terminal was to parse its rendered lines back. `runModule` already
        // suppresses logging under the flag, and `bin.ts` already renders `data` — this declares the flag
        // the plumbing was waiting for.
        { name: "json", type: "boolean", description: "Return the report as JSON on stdout instead of lines" },
        { name: "verbose", type: "boolean", description: "Print the full run rather than only what failed" },
        { name: "file", type: "string", description: "Scope to one file instead of every tracked file" },
        {
          name: "self-test",
          type: "boolean",
          description: "Assert every gate that declares a fixture still fires on it",
        },
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
async function resolveAll(
  definition: OpsDefinition,
  repoRoot: string,
  pluginDir: string,
  records: RecordsConfig | undefined,
): Promise<Resolved[]> {
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
      patterns: declared.map((pattern) => expandTokens(pattern, repoRoot, pluginDir, records)),
    });
  }
  return resolved;
}

/**
 * Every entry that declares a fixture, run against it, asserting each declared rule fired.
 *
 * THE POPULATION IS THE FIXTURE, NOT THE REPOSITORY. The temp tree is its own `repoRoot` **and** its own
 * `pluginDir`, so `<plugin>/` expands inside it — a fixture addressed through the real plugin surface
 * would pass while the entry was pointed at nothing. It is laid out flat for the same reason the
 * end-to-end fixtures are: a fixture shaped like this repository never exercises the expansion at all.
 *
 * AN ENTRY WITHOUT A FIXTURE REPORTS `SKIP`, NEVER NOTHING. A self-test that silently covers four of
 * fourteen gates reads exactly like one that covers all fourteen, which is the failure this whole verb
 * exists to prevent one level down.
 */
async function selfTest(
  definition: OpsDefinition,
  resolved: readonly Resolved[],
  context: ModuleContext,
): Promise<ModuleResult> {
  const cases: { label: string; fired: boolean; missing: readonly string[]; skipped?: string }[] = [];

  for (const { entry, gate } of resolved) {
    const label = labelFor(entry);
    if (entry.fixture === undefined) {
      cases.push({ label, fired: false, missing: [], skipped: "no fixture declared" });
      if (context.surface === "cli" && context.flags["json"] !== true) context.log(`SKIP  [${label}] no fixture declared`);
      continue;
    }
    const { files, expect, options } = entry.fixture;
    const root = await mkdtemp(path.join(tmpdir(), `vibeops-selftest-${label}-`));
    // realpath: on macOS the temp root is a symlink, and the document store resolves what it is handed.
    const repoRoot = tryRealpath(root);
    try {
      for (const [name, body] of Object.entries(files)) {
        await mkdir(path.dirname(path.join(repoRoot, name)), { recursive: true });
        await writeFile(path.join(repoRoot, name), body);
      }
      const outcome = await gate.run({
        repoRoot,
        pluginDir: repoRoot,
        files: Object.keys(files),
        options: options ?? entry.options ?? {},
        documents: createDocumentStore(repoRoot),
      });
      const produced = new Set(outcome.findings.map((finding) => finding.rule));
      const missing = expect.filter((rule) => !produced.has(rule));
      cases.push({ label, fired: missing.length === 0, missing });
      if (context.surface === "cli" && context.flags["json"] !== true) {
        context.log(
          missing.length === 0
            ? `ok    [${label}] fired on its fixture: ${expect.join(", ")}`
            : `FAIL  [${label}] declared fixture did not fire: ${missing.join(", ")}`,
        );
      }
    } finally {
      await rm(repoRoot, { recursive: true, force: true });
    }
  }

  const failed = cases.filter((one) => one.skipped === undefined && !one.fired);
  const covered = cases.filter((one) => one.skipped === undefined);
  return {
    code: failed.length > 0 ? 1 : 0,
    summary:
      `${definition.id} self-test: ${covered.length} of ${cases.length} gates carry a fixture, ` +
      `${failed.length} did not fire`,
    data: { cases },
  };
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
  const resolved = await resolveAll(definition, context.repoRoot, pluginDir, context.config.records);

  if (context.flags["list"] === true) {
    const gates = resolved.map(({ entry, gate, patterns }) => ({
      label: labelFor(entry),
      gate: entry.gate,
      paths: patterns,
      summary: gate.definition.summary,
      emits: entry.emits === true,
    }));
    if (context.surface === "cli" && context.flags["json"] !== true) {
      for (const { entry, gate, patterns } of resolved) {
        const marks = entry.emits === true ? "  (emits)" : "";
        context.log(`  ${labelFor(entry).padEnd(18)} ${patterns.join(" ")}${marks}`);
        context.log(`  ${" ".repeat(18)} ${gate.definition.summary}`);
      }
    }
    return { code: 0, summary: `${resolved.length} gates composed`, data: { gates } };
  }

  if (context.flags["self-test"] === true) return selfTest(definition, resolved, context);

  // The emitter is doubly opt-in, unchanged: an entry declares `emits` AND the config names a
  // destination. Either alone produces nothing, so an observation is never written somewhere nobody
  // chose. Built here rather than taken from context.emit — see the header.
  /**
   * Whether one finding blocks. Most specific wins: the rule it names, else the entry it came from,
   * else every finding in this ops, else the caller's default — the gate's own declared level for a
   * real finding, `warn` for the emission failure below. One cascade, because two would drift and a
   * drift here is invisible from either side: both answers look like a level.
   */
  const levelOf = (rule: string, label: string, fallback: "fail" | "warn"): "fail" | "warn" =>
    governed?.level?.[rule] ?? governed?.level?.[label] ?? governed?.level?.["*"] ?? fallback;

  const emit =
    emits.length > 0 && context.config.artifactDir !== undefined
      ? createEmitter({
          artifactDir: resolveArtifactDir(context.repoRoot, context.config.artifactDir),
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
  // `--json` puts the payload on stdout, which is the same stream these lines use — so a line printed
  // beside the JSON is a line printed inside it. Folding the flag into `cli` silences every log site at
  // once rather than leaving each one to remember, which is how `module-check` lost its own preamble
  // into the payload the first time this flag was added there.
  const cli = context.surface === "cli" && context.flags["json"] !== true;
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
      // Expanded here, not left to each gate: `<plugin>/` and `<template:<type>>` are facts about the
      // target's layout, which is the ops's half of the split, never the detector's.
      options: expandOptionTokens(entry.options ?? {}, context.repoRoot, pluginDir, context.config.records),
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
      const level = levelOf(finding.rule, label, finding.level ?? "fail");
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
      const compared = outcome.instrument === undefined ? "" : ` (compared ${outcome.instrument})`;
      context.log(`ok    [${label}] ${examined} examined${ignoredSuffix}${compared}`);
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
      const observation = {
        id: emitIdFor(entry),
        // The GATE and its own version — the detector that produced these findings, never the
        // composition that ran it. See the header comment on emit.ts.
        tool: `${gate.definition.id}@${gate.definition.version}`,
        examined,
        unit: "file",
        counts,
        moment: "sweep",
        // `compared:` rather than a second `tool`: the observation's instrument stays the detector that
        // produced it, or fragment-parity's own series would re-identify itself every time either side
        // it compares moves. What it compared is a property of the reading, which is what a tag is.
        tags: [
          `ops:${definition.id}`,
          ...(outcome.instrument === undefined ? [] : [`compared:${outcome.instrument}`]),
          ...patterns,
        ],
      };

      try {
        await emit(observation);
      } catch (error) {
        // The two ways an emitter throws mean opposite things, and until they were told apart every
        // emission failure aborted the whole ops — so a sensor that could not WRITE refused a commit
        // whose content was clean. That is what made `harness sync` read as the target's gate rejecting
        // a promulgation: `.git/gate-artifacts` under a linked working tree, where `.git` is a file.
        //
        // An undeclared id is not that. It is this repository's own composition disagreeing with its own
        // definition, and no target may declare it away.
        if (error instanceof UndeclaredObservationError) throw error;

        // Everything else is the DESTINATION failing, not the reading: a read-only mount, a full disk, a
        // path that is not a directory. Declared `warn`, and that word is the default rather than the
        // verdict — `settings.<ops>.level` raises `emit-failed` to `fail` for a repository whose series
        // matters more than its commits. Reported as a finding rather than swallowed, because the
        // objection to not blocking is that a reading goes missing in silence, and a named finding in
        // the run's own output and `data` is the answer to the silence, not to the blocking.
        const level = levelOf("emit-failed", label, "warn");
        if (level === "warn") warnings += 1;
        else failures += 1;
        const why = error instanceof Error ? error.message : String(error);
        findings.push({ gate: label, rule: "emit-failed", evidence: `${observation.id} was not recorded: ${why}`, level });
        if (cli) context.log(`${level === "warn" ? "WARN" : "FAIL"}  [emit-failed] ${observation.id} was not recorded: ${why}`);
      }
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
