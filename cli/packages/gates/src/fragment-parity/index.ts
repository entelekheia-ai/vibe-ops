// New gate — no shell precedent, because its subject IS the shell suite. RFC-0001 removes a fragment
// only once its port is shown to agree with it, and until this gate nothing crossed the two lists:
// task 003 nearly shipped exactly the failure this exists to catch — without the supplement queries
// `markdown-link` would have seen 83 fewer links, and because the repository was clean at the time,
// both sides would have printed zero findings. Apparent agreement over a hole.
//
// Detection only, and asymmetric on purpose: only the direction "the shell fragment flagged a file the
// port did not" is reported, as `port-regression`. The port flagging something the shell fragment
// missed is the expected, desired direction — the whole reason a port exists — and is not a finding.
//
// Holds no repository knowledge of its own; the composing ops passes in which fragment, which runner,
// and which port to compare against. This is what lets the same gate generalize to every other
// fragment eventually ported, by changing `options` rather than writing a new gate — and it is what
// lets this gate leave the repository the day its `fragment` does, with nothing else to update.

import { defineGate, loadGate } from "@entelekheia/vibe-ops-core";
import type { GateFinding } from "@entelekheia/vibe-ops-core";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

interface FragmentParityOptions {
  /** Repository-relative path to the shell runner, e.g. `cli/packages/module-check/sh/check-agents-md.sh`. */
  readonly runner?: string;
  /** The fragment's own id, as it names itself in `FAIL  [<id>] <file>: ...` — see `fail()` in the runner. */
  readonly fragment?: string;
  /** The gate id the fragment was ported to. Resolved and run fresh, over this entry's own population. */
  readonly against?: string;
}

/**
 * The fragment's declared version, from the runner's own `--list` — `  <id>@<version>  <path>`.
 *
 * Read from the runner rather than from the fragment file, deliberately: this gate is handed an id and a
 * runner and holds no knowledge of where fragments live, which is what lets it leave the repository the
 * day its `fragment` does. `--list` composes and prints without running a single check, so the second
 * spawn costs almost nothing.
 */
function fragmentVersion(runner: string, fragment: string): string | undefined {
  const listed = spawnSync(runner, ["--list"], { encoding: "utf8", maxBuffer: 4 * 1024 * 1024 });
  const pattern = new RegExp(`^\\s+${fragment}@([0-9]+)\\s`, "m");
  return pattern.exec(listed.stdout ?? "")?.[1];
}

/** `FAIL  [<fragment>] <file>: message` — the runner's own `fail()` format; the file is everything up to the first `:`. */
function failedFilesFor(output: string, fragment: string): Set<string> {
  const pattern = new RegExp(`^FAIL {2}\\[${fragment}\\] ([^:]+):`);
  const files = new Set<string>();
  for (const line of output.split("\n")) {
    const match = pattern.exec(line);
    if (match !== null) files.add(match[1]!.trim());
  }
  return files;
}

export default defineGate(
  {
    id: "fragment-parity",
    version: 1,
    summary: "A shell fragment and the gate that ported it agree on every file the fragment flags",
  },
  async ({ repoRoot, pluginDir, files, options, documents }) => {
    const { runner, fragment, against } = options as FragmentParityOptions;
    if (runner === undefined || fragment === undefined || against === undefined) {
      throw new Error("fragment-parity requires options.runner, options.fragment and options.against");
    }

    const runnerPath = path.resolve(repoRoot, runner);
    // A repository without the runner cannot be compared, and that is a legitimate state rather than a
    // finding — but it was silent until 2026-08-12: spawning a path that does not exist returned no
    // output, which read as "the fragment flagged nothing", which read as parity. Apparent agreement
    // over a hole, in the gate whose own header warns about exactly that.
    if (!existsSync(runnerPath)) {
      return { findings: [], examined: 0, skipped: `no runner at ${runner} — nothing to compare against` };
    }

    const spawned = spawnSync(runnerPath, [repoRoot], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
    const shellFailures = failedFilesFor(spawned.stdout ?? "", fragment);

    // BEFORE the comparison, because a parity result whose sides cannot be named is not evidence — and
    // the run that most needs naming is the clean one, which has no finding to carry it. Refusing is the
    // only honest outcome: reporting agreement between two unidentified things is the shape of answer
    // this whole plan exists to remove.
    const fragmentAt = fragmentVersion(runnerPath, fragment);
    if (fragmentAt === undefined) {
      throw new Error(`fragment-parity cannot read a version for "${fragment}" from ${runner} --list`);
    }

    const gate = await loadGate(against);
    const outcome = await gate.run({ repoRoot, pluginDir, files, options: {}, documents });
    const portFailures = new Set(outcome.findings.map((finding) => finding.file).filter((file): file is string => file !== undefined));

    const findings: GateFinding[] = [];
    for (const file of shellFailures) {
      if (!portFailures.has(file)) {
        findings.push({
          rule: "port-regression",
          file,
          evidence:
            `${fragment}@${fragmentAt} (shell) flagged this file; ` +
            `${against}@${gate.definition.version} (the port) did not — the two have diverged`,
        });
      }
    }

    return {
      findings,
      examined: files.length,
      instrument: `${fragment}@${fragmentAt} vs ${against}@${gate.definition.version}`,
    };
  },
);
