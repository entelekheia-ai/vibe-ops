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
const OPS_WITH_FIXTURES = ["governance", "self", "agents-md"] as const;

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
    ],
  },
  async (context: ModuleContext): Promise<ModuleResult> => {
    const argv: string[] = [];
    if (context.flags["list"] === true) argv.push("--list");
    else if (context.flags["self-test"] === true) argv.push("--self-test");
    else argv.push(context.repoRoot);

    const result = spawnSync(RUNNER, argv, {
      encoding: "utf8",
      env: {
        ...process.env,
        ...(context.flags["verbose"] === true ? { GATE_VERBOSE: "1" } : {}),
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

    const summary = match ? `${match[1]} checks, ${match[2]} failed` : `check exited ${code}`;

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

    return { code, summary, data: { findings, skipped } };
  },
);
