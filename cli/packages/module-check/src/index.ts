// `vibe-ops check` — the governance gate.
//
// The seventeen checks are still shell fragments under this package's own sh/checks/, unchanged from
// what every repository's .githooks/pre-commit runs. This module is their front door, not a rewrite:
// porting them to TypeScript is a separate act, and doing it as part of packaging would have meant
// shipping seventeen freshly-written checks with no history of having caught anything.
//
// sh/ ships in `files`, so the fragments travel with an install and are resolved relative to this
// module — never from PATH and never by searching upward for a checkout.

import { defineModule } from "@entelekheia/vibe-ops-core";
import type { ModuleContext, ModulePlugin, ModuleResult } from "@entelekheia/vibe-ops-core";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
// dist/index.js -> ../sh
const RUNNER = path.join(here, "..", "sh", "check-agents-md.sh");

/**
 * The ops whose self-tests `--self-test` chains, by module name.
 *
 * Named rather than discovered, and resolved through the same `@entelekheia/vibe-ops-<name>` convention
 * the CLI uses, so this stays a list a reader can check against the composition. An ops that carries no
 * fixture still reports what it skipped, which is the point: a self-test covering four of fourteen gates
 * reads exactly like one covering all fourteen unless it says so.
 */
const OPS_WITH_FIXTURES = ["governance", "for-vibe-ops", "agents-md", "mirror", "exposure"] as const;

/** One ops's self-test, as its own exit code and its own text. An ops that cannot be loaded is a failure,
 *  never a silent pass — an absent suite and a clean one are the same output otherwise. */
async function runOpsSelfTest(
  id: string,
  context: ModuleContext,
): Promise<{ id: string; code: number; output: string }> {
  const lines: string[] = [];
  try {
    const loaded = (await import(`@entelekheia/vibe-ops-${id}`)) as { default: ModulePlugin };
    const result = await loaded.default.run({
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
      const interesting = context.flags["verbose"] === true || context.flags["list"] === true
        ? output
        : output.split("\n").filter((line) => /^(FAIL|WARN|SELF-TEST|composed|\s{2})/.test(line)).join("\n");
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
      for (const id of OPS_WITH_FIXTURES) {
        const ops = await runOpsSelfTest(id, context);
        suites.push(ops);
        if (context.surface === "cli" && context.flags["json"] !== true) context.log(ops.output);
      }
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

    return {
      code: audited ? 0 : code,
      summary: `${summary}${staging}${audited && code !== 0 ? " (audit: not blocking)" : ""}`,
      data: { findings, skipped, undeclared, untracked: unseen },
    };
  },
);
