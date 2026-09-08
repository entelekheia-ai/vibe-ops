// `vibe-ops check` — the governance gate, and since Plan-038 track 6 the WHOLE of it.
//
// Two halves, reported as one `N checks, M failed` line: the shell fragments still under this package's
// own sh/unported/checks/ — eight, after track 7 retired the nine whose ports met Plan-022's bar — and the ops
// this repository declares in `config.ops`. Before track 6 this module was a wrapper around the runner
// and nothing else, so a commit gate ran the fragments and none of the gates written to replace them.
//
// sh/ ships in `files`, so the surviving fragments travel with an install and are resolved relative to
// this module — never from PATH and never by searching upward for a checkout.

import { defineModule, defineOps, effectiveOps, loadOpsPlugin, opsSpecifier, parseOpsDefinition, settingsFor } from "@entelekheia/vibe-ops-core";
import { PARITY_FIXTURE } from "./fixture.ts";
import type { ModuleContext, ModulePlugin, ModuleResult, OpsFinding, OpsPopulation, OpsSkip } from "@entelekheia/vibe-ops-core";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
// dist/index.js -> ../sh
const RUNNER = path.join(here, "..", "sh", "unported", "check-agents-md.sh");

/** One ops's self-test, as its own exit code and its own text. An ops that cannot be loaded is a failure,
 *  never a silent pass — an absent suite and a clean one are the same output otherwise. */
async function runOpsSelfTest(
  id: string,
  packageName: string,
  context: ModuleContext,
): Promise<{ id: string; code: number; output: string }> {
  const lines: string[] = [];
  try {
    const plugin = await loadOpsPlugin(opsSpecifier(packageName, context.repoRoot));
    const result = await plugin.run({
      ...context,
      flags: { "self-test": true },
      log: (line: string) => lines.push(line),
    });
    return { id, code: result.code, output: [...lines, result.summary].join("\n") };
  } catch (error) {
    const why = error instanceof Error ? error.message : String(error);
    return { id, code: 2, output: `FAIL  [${id}] self-test could not run: ${why}` };
  }
}

/**
 * The nine rule ids that must still fail on the SAME fixture the shell runner's own `--self-test` breaks
 * — one per fragment retired in track 7, and which ops composes each is `OPS_FOR_PARITY` below.
 *
 * THIS LIST IS NOW THE ONLY THING HOLDING THOSE NINE CHECKS. Their fragments are deleted and the
 * `fragment-parity` gate that compared them is deleted, so nothing else in this repository asserts that
 * the ports which replaced them still detect anything. That is why `build_fixture` keeps every defect the
 * retired fragments used to catch: the fixture stopped being their evidence and became the ports'.
 */
const PARITY_RULE_IDS = [
  "links",
  "budget",
  "bridge",
  "frontmatter",
  "skill-frontmatter",
  "memory-slug",
  "file-path",
  "template-attribution",
  "dogfooding-drift",
] as const;

/** Which ops composes each id above — read once, so a reader can check the claim against the table in
 *  cli/AGENTS.md rather than trusting this list. */
const OPS_FOR_PARITY = ["governance", "agents-md", "exposure", "mirror"] as const;

/**
 * The port side of the parity fixture: build the SAME broken repository the shell runner's own
 * --self-test uses (via `--emit-fixture`, plan-038 track 3), run the four ops that compose the nine
 * proved-comparable fragments against it in-process, and assert every one of them still fails there.
 *
 * `config: {}` is load-bearing, not a placeholder — `loadConfig` searches upward to the operator's
 * home directory, and whether this fixture fails must never depend on whichever machine runs it.
 *
 * This does not assert an exit code or the absence of other findings. Two kinds of extra noise are
 * expected and accepted here rather than suppressed: `dogfooding-drift` reports six pairs (the
 * `governance-*` template pairs) as "named but not there" because the fixture carries only the
 * GOVERNANCE.md pair, and every `fragment-parity-*` entry these same ops also carry reports itself
 * skipped, because the fixture has no `sh/check-agents-md.sh` runner of its own to compare against.
 */
async function runPortsAgainstFixture(): Promise<{ id: string; code: number; output: string }> {
  const tmp = mkdtempSync(path.join(tmpdir(), "vibeops-check-parity-"));
  try {
    // Written from `PARITY_FIXTURE` rather than spawned out of the shell runner's `--emit-fixture`
    // (Plan-038 track 7). The evidence for nine retired fragments' ports may not depend on a script that
    // is itself being retired — a fixture reached through the thing it outlives is a fixture that leaves
    // with it.
    try {
      for (const [relative, content] of Object.entries(PARITY_FIXTURE)) {
        const destination = path.join(tmp, relative);
        mkdirSync(path.dirname(destination), { recursive: true });
        writeFileSync(destination, content);
      }
      spawnSync("git", ["-C", tmp, "init", "-q"], { encoding: "utf8" });
      spawnSync("git", ["-C", tmp, "add", "-A"], { encoding: "utf8" });
    } catch (error) {
      const why = error instanceof Error ? error.message : String(error);
      return { id: "ports", code: 2, output: `FAIL  [ports] could not build the parity fixture: ${why}` };
    }

    const lines: string[] = [];
    const seen = new Set<string>();
    let hadError = false;
    for (const opsId of OPS_FOR_PARITY) {
      const opsLines: string[] = [];
      const context: ModuleContext = {
        repoRoot: tmp,
        flags: {},
        args: [],
        config: {},
        settings: settingsFor({}, opsId),
        surface: "cli",
        log: (line: string) => opsLines.push(line),
        warn: (line: string) => opsLines.push(`warning: ${line}`),
      };
      try {
        const loaded = (await import(`@entelekheia/vibe-ops-${opsId}`)) as { default: ModulePlugin };
        const result = await loaded.default.run({ ...context, flags: { verbose: true } });
        opsLines.push(result.summary);
      } catch (error) {
        hadError = true;
        const why = error instanceof Error ? error.message : String(error);
        opsLines.push(`FAIL  [ports] ${opsId} self-test could not run: ${why}`);
      }
      for (const line of opsLines) {
        const match = REPORT_LINE.exec(line);
        if (match && match[1] === "FAIL") seen.add(match[2]!);
      }
      lines.push(...opsLines);
    }

    const missing = PARITY_RULE_IDS.filter((id) => !seen.has(id));
    const code = hadError || missing.length > 0 ? 1 : 0;
    const summary =
      missing.length > 0
        ? `ports: did not fail on the shared fixture: ${missing.join(", ")}`
        : `ports: all ${String(PARITY_RULE_IDS.length)} proved-comparable fragments failed on the shared fixture`;
    return { id: "ports", code, output: [...lines, summary].join("\n") };
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

/**
 * The ops half of the gate (Plan-038 track 3 → 6). `check` used to be a wrapper around the shell runner
 * and nothing else, so this repository's own commit gate ran seventeen fragments and not one of the
 * twenty-one gates that had been written to replace them — they were reachable only through their own
 * nouns and their tests. This function is what makes `vibe-ops check` mean the whole composition.
 *
 * BOTH HALVES RUN HERE, AND THAT IS THE POINT UNTIL TRACK 7. Adding the ops beside the fragments only
 * ever grows what the gate catches; removing the fragments is a separate act, gated on Plan-022's bar
 * per fragment. A version of this that swapped one half for the other would retire seventeen checks
 * without anyone judging a single one of them.
 *
 * WHICH OPS IS THE REPOSITORY'S ANSWER, not this file's: `effectiveOps` reads the shipped defaults
 * overlaid by `config.ops`. A declared ops that does not resolve is REPORTED BY NAME rather than skipped
 * — the same rule `TypesConfig` states for a governance binding that resolves to nothing, and for the
 * same reason: examining nothing under the name the repository chose is attributable, and quietly
 * composing less than was declared is not.
 */
async function runComposedOps(context: ModuleContext): Promise<readonly OpsRun[]> {
  const runs: OpsRun[] = [];
  for (const [id, packageName] of Object.entries(effectiveOps(context.config))) {
    const lines: string[] = [];
    let plugin: ModulePlugin;
    try {
      // A DECLARED `.json` IS AN OPS COLLECTION, NOT A MODULE. `ops.json` is already the canonical form
      // an ops package carries (`parseOpsDefinition`; each `src/index.ts` is typing sugar over it), and
      // reading one directly is what lets a repository compose detectors of its own **today**: the gates
      // it names resolve through `loadGate` out of the installed core, so nothing has to be imported from
      // the repository's side and nothing has to be published first. Writing a NEW gate still does — see
      // the blocker in the `new-signal` skill.
      if (packageName.endsWith(".json")) {
        const file = path.resolve(context.repoRoot, packageName);
        plugin = defineOps(parseOpsDefinition(readFileSync(file, "utf8"), file));
      } else {
        plugin = ((await import(opsSpecifier(packageName, context.repoRoot))) as { default: ModulePlugin }).default;
      }
    } catch (error) {
      const why = error instanceof Error ? error.message : String(error);
      runs.push({
        id,
        code: 2,
        lines: [`FAIL  [${id}] declared as ${packageName}, which did not resolve — install it, or remove it from config.ops (${why})`],
        gates: 0,
        findings: [
          {
            level: "fail",
            check: id,
            evidence: `declared as ${packageName}, which did not resolve — install it, or remove it from config.ops`,
          },
        ],
        skipped: [],
      });
      continue;
    }

    const result = await plugin.run({
      ...context,
      settings: settingsFor(context.config, id),
      // `--file` and `--fix` are deliberately not forwarded: this verb is the repository sweep, and an
      // ops scoped to one file is a different signal (RFC-0001) that must not arrive under this id.
      flags: {
        ...(context.flags["verbose"] === true ? { verbose: true } : {}),
        ...(context.flags["audit"] === true ? { audit: true } : {}),
      },
      log: (line: string) => lines.push(line),
      warn: (line: string) => lines.push(`warning: ${line}`),
    });

    const data = result.data as
      | { findings?: readonly OpsFinding[]; skipped?: readonly OpsSkip[]; population?: readonly OpsPopulation[] }
      | undefined;
    const findings = data?.findings ?? [];
    const skips = data?.skipped ?? [];
    // Counted from the structured payload rather than from the summary line: a gate that skipped and a
    // gate that ran are both composed, and a Set is what keeps one appearing in both from counting twice.
    const composed = new Set<string>([
      ...(data?.population ?? []).map((entry) => entry.gate),
      ...skips.map((entry) => entry.gate),
    ]);

    runs.push({
      id,
      code: result.code,
      lines,
      gates: composed.size,
      findings: findings.map((finding) => ({
        level: finding.level === "warn" ? "warn" : "fail",
        check: finding.gate,
        evidence: finding.file === undefined ? finding.evidence : `${finding.file}: ${finding.evidence}`,
      })),
      skipped: skips.map((entry) => ({ check: entry.gate, reason: entry.reason })),
    });
  }
  return runs;
}

interface OpsRun {
  readonly id: string;
  readonly code: number;
  readonly lines: readonly string[];
  readonly gates: number;
  readonly findings: readonly { level: string; check: string; evidence: string }[];
  readonly skipped: readonly { check: string; reason: string }[];
}

const SUMMARY_PATTERN = /^(\d+) checks, (\d+) failed$/m;
// The runner's own line shapes: `FAIL  [id] evidence`, `SKIP  [id] reason`, and, under --list,
// two columns of id and source. Parsed rather than passed through as a blob, because the MCP client
// renders `structuredContent` and discards the text — a raw blob there is a string nobody can index.
const REPORT_LINE = /^(FAIL|WARN|SKIP)\s+\[([^\]]+)\]\s*(.*)$/;
const LIST_LINE = /^ {2}(\S+)\s+(\S+)$/;

/**
 * A fragment's own prose, taken from the comment block above its first line of code — the paragraph
 * after the licence header, which is where every fragment already states what it looks for. Read rather
 * than duplicated into a table here: a description kept beside the id would be the copy that goes stale
 * while the check it names changes.
 */
function describeFragment(source: string): readonly string[] {
  let text: string;
  try {
    text = readFileSync(source, "utf8");
  } catch {
    return [];
  }
  const prose: string[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trimEnd();
    if (line.startsWith("#!")) continue;
    if (!line.startsWith("#")) {
      // The comment block ended. Anything after the first line of code is implementation, not intent.
      if (prose.length > 0) break;
      continue;
    }
    const body = line.replace(/^#\s?/, "");
    // The licence header is boilerplate on every fragment and says nothing about this one.
    if (/^(Copyright|Licensed under)/.test(body)) continue;
    if (body.trim() === "") {
      if (prose.length > 0) break;
      continue;
    }
    prose.push(body);
  }
  return prose;
}

/**
 * This module's slice of `settings`, and the one key it honors. The shape is `disabled` from
 * `GovernedSettings` deliberately — an ops declares a gate off as `{ id: "reason" }` and a repository
 * should not have to learn a second spelling for the same act because the detector behind it happens
 * to be shell.
 */
interface CheckSettings {
  readonly disabled?: Readonly<Record<string, string>>;
}

/**
 * The runner reads declared disablements from the environment and from nowhere else, which made a
 * repository's declaration live in the one file that sets that variable — its own `scripts/checks/_run.sh`.
 * Every other caller of the same gate — a `Stop` hook, `vibe-ops check <path>` from a sibling directory,
 * an editor — ran an undeclared configuration and reported the repository's whole known backlog as
 * failures. Measured 2026-08-14: 38.
 *
 * So the declaration moves to where the repository's other declarations already are, and the variable
 * stays what it was: an override at the point of invocation. Environment entries are emitted first
 * because `disabled_reason_for` matches the first line carrying an id, which makes the nearer
 * declaration win without the runner needing to know two sources exist.
 */
function disabledChecksEnv(settings: CheckSettings | undefined): string | undefined {
  const declared = Object.entries(settings?.disabled ?? {});
  const inherited = process.env["VIBE_OPS_DISABLED_CHECKS"] ?? "";
  if (declared.length === 0) return inherited === "" ? undefined : inherited;
  const lines = declared.map(([id, reason]) => `${id}:${reason}`);
  return [inherited, ...lines].filter((line) => line.trim() !== "").join("\n");
}

function parseList(output: string): { readonly id: string; readonly source: string }[] {
  const checks: { id: string; source: string }[] = [];
  for (const line of output.split("\n")) {
    const match = LIST_LINE.exec(line);
    if (match) checks.push({ id: match[1]!, source: match[2]! });
  }
  return checks;
}

export default defineModule(
  {
    id: "check",
    version: "0.0.1",
    summary: "Run the mechanical governance checks against a repository — budget, links, the rules bridge, licence texts",
    flags: [
      { name: "list", type: "boolean", description: "Print the checks that would run and their source files" },
      { name: "self-test", type: "boolean", description: "Assert every check still fires on a deliberately broken fixture" },
      { name: "verbose", type: "boolean", description: "Print the full run rather than only failures" },
      // `check` is the most-invoked verb by a wide margin, and its output is the noisiest — which is why
      // sessions reformulate the same call three and four times adding `tail`, `grep` and `sed`. The flag
      // exists on the nouns and was missing exactly where the volume is.
      { name: "json", type: "boolean", description: "Return the findings as JSON on stdout instead of lines" },
      { name: "audit", type: "boolean", description: "Report exactly as a run would, and always exit 0" },
      {
        name: "explain",
        type: "string",
        description: "Print what one check looks for, by id, instead of running anything",
      },
    ],
    // `vibe-ops check <path>` now checks that repository instead of silently checking the working
    // directory's. `check .` meant the right thing by accident and every other value meant nothing.
    repoFromFirstArg: true,
  },
  async (context: ModuleContext): Promise<ModuleResult> => {
    // Answered before anything is spawned: the question is what a check looks for, which is in its own
    // source and needs no run. Sessions answered it by opening the fragment's `.sh` by hand — twice in
    // the measured corpus — because the only other thing `check` would say about an id was its filename.
    const explain = context.flags["explain"];
    if (typeof explain === "string" && explain !== "") {
      const listed = spawnSync(RUNNER, ["--list"], { encoding: "utf8" });
      const entry = parseList(`${listed.stdout ?? ""}${listed.stderr ?? ""}`).find(
        (check) => check.id === explain || check.id.split("@")[0] === explain,
      );
      if (entry === undefined) {
        return { code: 2, summary: `no check called "${explain}" — run vibe-ops check --list for the ids` };
      }
      const source = path.join(here, "..", "sh", entry.source.replace(/^sh\//, ""));
      const prose = describeFragment(source);
      if (context.surface === "cli" && context.flags["json"] !== true) {
        context.log(`${entry.id}  ${entry.source}`);
        for (const line of prose) context.log(`  ${line}`);
      }
      return {
        code: 0,
        summary:
          prose.length === 0
            ? `${entry.id} is defined in ${entry.source} and carries no description`
            : `${entry.id}: ${prose[0]}`,
        data: { id: entry.id, source: entry.source, description: prose },
      };
    }

    const argv: string[] = [];
    if (context.flags["list"] === true) argv.push("--list");
    else if (context.flags["self-test"] === true) argv.push("--self-test");
    else argv.push(context.repoRoot);

    const settings = context.settings as CheckSettings | undefined;
    const disabled = disabledChecksEnv(settings);

    const result = spawnSync(RUNNER, argv, {
      encoding: "utf8",
      env: {
        ...process.env,
        ...(context.flags["verbose"] === true ? { GATE_VERBOSE: "1" } : {}),
        ...(disabled === undefined ? {} : { VIBE_OPS_DISABLED_CHECKS: disabled }),
      },
    });

    if (result.error) {
      return { code: 2, summary: `could not run the check runner at ${RUNNER}: ${result.error.message}` };
    }

    const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
    const code = result.status ?? 1;
    const match = SUMMARY_PATTERN.exec(output);

    // Only the failing and warning lines reach the caller by default. The expensive reader is an
    // agent, not a terminal, and a clean run of seventeen `ok` lines says nothing that the summary
    // does not.
    // `--json` suppresses the lines entirely: they and the payload share stdout, so a preamble printed
    // beside the JSON is a preamble printed INSIDE it, and the whole point of the flag is a stream `jq`
    // can read. The three nouns already gate their own logging on the same flag; this module had no
    // `--json` to gate on until now.
    if (context.surface === "cli" && context.flags["json"] !== true) {
      // The runner's own `N checks, M failed` is dropped from every mode: since Plan-038 track 6 it counts
      // one half of the composition, and a consumer's check.sh greps that exact shape. Two count lines
      // would both match, and the partial one would be read as the answer. The whole-run line is printed
      // once, after both halves have reported.
      const shown = output.split("\n").filter((line) => !/^\d+ checks, \d+ failed$/.test(line));
      const interesting = context.flags["verbose"] === true || context.flags["list"] === true
        ? shown.join("\n")
        : shown.filter((line) => /^(FAIL|WARN|SELF-TEST|composed|\s{2})/.test(line)).join("\n");
      if (interesting.trim() !== "") context.log(interesting.trimEnd());
    }

    // No emitter: this module declares no `emits`. "checks-run"/"checks-failed" counted CHECKS, the
    // taxonomy references/harness-pair.md forbids because it grows with the tooling instead of with
    // the phenomena (RFC-0001, Rationale). agents-md's memory-slug gate is the replacement signal.

    // Exit 2 has two unrelated causes and used to print the same six words for both: the runner refusing
    // the target (`not a git working tree: <root>`, written to stderr) and the runner failing to start
    // at all, handled above. The refusal already names itself — it was the wrapper's own output filter
    // that dropped it, so the last thing the runner said is carried into the summary rather than
    // re-derived here.
    const lastSaid = output
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line !== "")
      .pop();
    const summary = match
      ? `${match[1]} checks, ${match[2]} failed`
      : lastSaid === undefined
        ? `check exited ${code} and said nothing — the runner at ${RUNNER} produced no output`
        : `check exited ${code}: ${lastSaid}`;

    if (context.flags["list"] === true) {
      return { code, summary, data: { checks: parseList(output) } };
    }
    // --self-test asserts a fixture behaves; its report is a narrative, not a finding list, so it is
    // the one mode where the runner's own text is the answer.
    //
    // IT CHAINS THE OPS SUITES HERE, NOT IN THE SHELL SCRIPT. One command has to mean "prove every
    // detector still fires", and the two halves have different dependency footprints: the runner is what
    // a consumer installs as a `pre-commit` and what continuous integration executes on a bare checkout,
    // with no Node and no install step. Making it invoke built TypeScript would couple a dependency-free
    // gate to a build artifact. Chaining above it costs the shell side nothing — it still passes alone.
    if (context.flags["self-test"] === true) {
      const suites = [{ id: "check", code, output }];
      // The same composition a run uses, not a second list — a self-test that proved fixtures for a
      // different set of ops than `check` actually runs is the shape of green this plan exists to remove.
      for (const [id, packageName] of Object.entries(effectiveOps(context.config))) {
        const ops = await runOpsSelfTest(id, packageName, context);
        suites.push(ops);
        if (context.surface === "cli" && context.flags["json"] !== true) context.log(ops.output);
      }
      // Plan-038 track 3: each ops's own fixture above proves it fires on ITS OWN broken input. This
      // suite proves the shell fragment and its port fire on the SAME one — the comparison that gives
      // the nine `fragment-parity` entries in ops-mirror/ops.json meaning, none of which has ever run
      // over an input where either side actually fails.
      const ports = await runPortsAgainstFixture();
      suites.push(ports);
      if (context.surface === "cli" && context.flags["json"] !== true) context.log(ports.output);
      const failed = suites.filter((suite) => suite.code !== 0).map((suite) => suite.id);
      return {
        code: failed.length > 0 ? 1 : 0,
        summary:
          failed.length > 0
            ? `self-test: ${failed.join(", ")} did not fire on its own fixture`
            : `self-test: ${suites.map((suite) => suite.id).join(", ")} each fired on their own fixtures`,
        data: { suites },
      };
    }

    const findings: { level: string; check: string; evidence: string }[] = [];
    const skipped: { check: string; reason: string }[] = [];
    for (const line of output.split("\n")) {
      const parsed = REPORT_LINE.exec(line);
      if (!parsed) continue;
      const [, kind, id, rest] = parsed;
      if (kind === "SKIP") skipped.push({ check: id!, reason: rest! });
      else findings.push({ level: kind === "WARN" ? "warn" : "fail", check: id!, evidence: rest! });
    }

    // The other half of the gate. Merged from each ops's structured `data` rather than by re-parsing its
    // printed lines — the shell half has to be read from stdout because a process boundary leaves nothing
    // else, and that constraint does not apply here.
    const opsRuns = await runComposedOps(context);
    for (const run of opsRuns) {
      findings.push(...run.findings);
      skipped.push(...run.skipped);
    }
    if (context.surface === "cli" && context.flags["json"] !== true) {
      for (const run of opsRuns) {
        const interesting =
          context.flags["verbose"] === true
            ? run.lines
            : run.lines.filter((line) => /^(FAIL|WARN|warning:)/.test(line));
        if (interesting.length > 0) context.log(interesting.join("\n"));
      }
    }

    // A declared disablement that names no composed check is a ledger entry pointing at nothing — a
    // renamed or removed fragment leaves one behind, and the config keeps reading as though something
    // were switched off. The run itself is unaffected, which is exactly why it needs saying.
    const undeclared = Object.keys(settings?.disabled ?? {}).filter(
      (id) => !skipped.some((skip) => skip.check === id || skip.check.split("@")[0] === id),
    );
    if (undeclared.length > 0) {
      context.warn(
        `settings.check.disabled names ${undeclared.join(", ")}, which no composed check answers to — run vibe-ops check --list for the ids`,
      );
    }

    // The gate reads `git ls-files`, so a file that has never been staged is not in its population — and
    // a clean run over a population that silently excludes the file you just wrote is indistinguishable
    // from a clean run over one that includes it. Three separate sessions discovered this by watching a
    // green run lie and then reaching for `git add -A`. Counted, never repaired: staging someone's work
    // to make a gate see it is not a gate's decision.
    const untracked = spawnSync("git", ["-C", context.repoRoot, "ls-files", "--others", "--exclude-standard", "*.md"], {
      encoding: "utf8",
    });
    const unseen = (untracked.stdout ?? "").split("\n").filter((line) => line.trim() !== "");

    // `--audit` reports exactly as a run would and always exits 0, the same contract the three ops give
    // the flag. Nothing about the reading changes — only whether it blocks.
    const audited = context.flags["audit"] === true;
    const staging =
      unseen.length === 0 ? "" : `; ${unseen.length} untracked .md file(s) were not examined — the gate reads tracked files`;

    // ONE `N checks, M failed` LINE OVER BOTH HALVES, AND THE SHAPE IS A CONTRACT. Every consumer's
    // `scripts/check.sh` and `.githooks/pre-commit` greps exactly `^[0-9]+ checks, [0-9]+ failed` for the
    // count a reader needs to notice a composition that stopped composing (Plan-038 track 5). Changing
    // this line to the ops' own `N gates, M failed` wording would blank the gate's only output in eight
    // repositories while every one of them still exited 0.
    const shellChecks = match ? Number(match[1]) : 0;
    const composedGates = opsRuns.reduce((total, run) => total + run.gates, 0);
    const failedChecks = new Set(findings.filter((finding) => finding.level === "fail").map((finding) => finding.check));
    const totals = `${String(shellChecks + composedGates)} checks, ${String(failedChecks.size)} failed`;
    const opsFailed = opsRuns.some((run) => run.code !== 0);
    // Exit 2 is the runner refusing the target and outranks a finding — it means the reading never
    // happened, where 1 means it happened and something failed.
    const merged = code === 2 ? 2 : code !== 0 || opsFailed ? 1 : 0;

    if (context.surface === "cli" && context.flags["json"] !== true && context.flags["verbose"] === true) {
      context.log(totals);
    }

    return {
      code: audited ? 0 : merged,
      summary: `${totals}${staging}${audited && merged !== 0 ? " (audit: not blocking)" : ""}`,
      data: { findings, skipped, undeclared, untracked: unseen, ops: opsRuns.map(({ id, code: opsCode, gates }) => ({ id, code: opsCode, gates })) },
    };
  },
);
