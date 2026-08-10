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
import type { ModuleContext, ModuleResult } from "@entelekheia/vibe-ops-core";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
// dist/index.js -> ../sh
const RUNNER = path.join(here, "..", "sh", "check-agents-md.sh");

const SUMMARY_PATTERN = /^(\d+) checks, (\d+) failed$/m;

export default defineModule(
  {
    id: "check",
    version: "0.0.1",
    summary: "Run the mechanical governance checks against a repository — budget, links, the rules bridge, licence texts",
    flags: [
      { name: "list", type: "boolean", description: "Print the checks that would run and their source files" },
      { name: "self-test", type: "boolean", description: "Assert every check still fires on a deliberately broken fixture" },
      { name: "verbose", type: "boolean", description: "Print the full run rather than only failures" },
    ],
    emits: ["checks-run", "checks-failed"],
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
    const interesting = context.flags["verbose"] === true || context.flags["list"] === true
      ? output
      : output.split("\n").filter((line) => /^(FAIL|WARN|SELF-TEST|composed|\s{2})/.test(line)).join("\n");
    if (interesting.trim() !== "") context.log(interesting.trimEnd());

    if (context.emit && match) {
      await context.emit({ id: "checks-run", value: Number(match[1]) });
      await context.emit({ id: "checks-failed", value: Number(match[2]) });
    }

    return {
      code,
      summary: match ? `${match[1]} checks, ${match[2]} failed` : `check exited ${code}`,
      data: { exitCode: code, output },
    };
  },
);
