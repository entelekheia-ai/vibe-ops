// `vibe-ops check` is a composition of two halves since Plan-038 track 6 — the shell fragments and the
// ops — and these assert the two properties that are invisible from a green run.
//
// The first is a CONTRACT WITH EIGHT REPOSITORIES, not a formatting preference. Track 5 moved every
// consumer's `scripts/check.sh` and `.githooks/pre-commit` onto this verb, and both grep exactly
// `^[0-9]+ checks, [0-9]+ failed` for the count a reader needs in order to notice a composition that
// stopped composing. The ops summary shape is `N gates, M failed`; adopting it here would have blanked
// the only output those gates produce while every one of them still exited 0.

import { test } from "node:test";
import assert from "node:assert/strict";
import { loadConfig, settingsFor } from "@entelekheia/vibe-ops-core";
import type { ModuleContext } from "@entelekheia/vibe-ops-core";
import check from "../src/index.ts";

const repoRoot = new URL("../../../..", import.meta.url).pathname.replace(/\/$/, "");

async function contextFor(overrides: Partial<ModuleContext> = {}): Promise<{ context: ModuleContext; logs: string[] }> {
  const { config } = await loadConfig(repoRoot);
  const logs: string[] = [];
  return {
    logs,
    context: {
      repoRoot,
      flags: {},
      args: [],
      config,
      settings: settingsFor(config, "check"),
      surface: "cli",
      log: (line: string) => logs.push(line),
      warn: (line: string) => logs.push(`warning: ${line}`),
      ...overrides,
    },
  };
}

test("the summary keeps the `N checks, M failed` shape every consumer's gate greps for", async () => {
  const { context } = await contextFor();
  const result = await check.run(context);
  assert.match(result.summary, /^\d+ checks, \d+ failed/, result.summary);
});

test("the count covers BOTH halves — the shell fragments and the composed gates", async () => {
  const { context } = await contextFor();
  const result = await check.run(context);
  const total = Number(/^(\d+) checks/.exec(result.summary)?.[1]);
  const listed = await check.run({ ...context, flags: { list: true } });
  const fragments = (listed.data as { checks?: readonly unknown[] }).checks?.length ?? 0;
  // A count equal to the fragment count alone is the regression this exists to catch: it reads exactly
  // like a working gate while every gate written to replace those fragments went unrun.
  assert.ok(total > fragments, `${String(total)} total vs ${String(fragments)} fragments`);
  const ops = (result.data as { ops?: readonly { id: string; gates: number }[] }).ops ?? [];
  assert.equal(
    total,
    fragments + ops.reduce((sum, entry) => sum + entry.gates, 0),
    JSON.stringify({ total, fragments, ops }),
  );
});

test("only one count line is printed — a partial count would be read as the answer", async () => {
  const { context, logs } = await contextFor({ flags: { verbose: true } });
  await check.run(context);
  const counts = logs.join("\n").split("\n").filter((line) => /^\d+ checks, \d+ failed$/.test(line));
  assert.equal(counts.length, 1, counts.join(" | "));
});

test("a declared ops that does not resolve is named, never quietly composed out of the run", async () => {
  const { config } = await loadConfig(repoRoot);
  const { context } = await contextFor({
    config: { ...config, ops: { ...config.ops, "not-installed": "@entelekheia/vibe-ops-not-installed" } },
  });
  const result = await check.run(context);
  const findings = (result.data as { findings: readonly { check: string; evidence: string }[] }).findings;
  const named = findings.find((finding) => finding.check === "not-installed");
  assert.ok(named !== undefined, JSON.stringify(findings.slice(0, 5)));
  assert.match(named.evidence, /did not resolve/);
  assert.notEqual(result.code, 0, "an unresolvable declared ops must fail the run, not warn");
});

// THE SELF-TEST'S OWN BLIND SPOT. `config.ops` takes a package name OR a path to a repository's own
// collection, and only the first was ever loaded as a module. A `.json` collection is not importable at
// all without an import attribute, and a `.mjs` one default-exports the definition rather than the
// plugin — so both answered "self-test could not run", which reads as a broken ops rather than as the
// loader having no branch for the form. Found by eita, whose `.vibe-ops/ops.json` is exactly this shape.
//
// The fixture tree lives INSIDE this repository, not in the system temp directory: a gate imports
// `defineGate` by package name, and a file under /tmp resolves no `node_modules` by walking up.
test("an ops declared by path is self-tested like any other — both file forms, not only a package name", async () => {
  const { mkdtempSync, writeFileSync, rmSync } = await import("node:fs");
  const nodePath = await import("node:path");
  const dir = mkdtempSync(nodePath.join(repoRoot, "vibe-ops-ops-by-path-"));
  const rel = (name: string) => `./${nodePath.basename(dir)}/${name}`;
  writeFileSync(
    nodePath.join(dir, "gate.mjs"),
    `import { defineGate } from "@entelekheia/vibe-ops-core";
export default defineGate(
  { id: "path-declared", version: 1, summary: "every .txt is a finding, so the fixture cannot pass by accident",
    defaultPaths: ["**/*.txt"] },
  async ({ files }) => ({ findings: files.map((f) => ({ file: f, line: 1, evidence: "seen" })), examined: files.length }),
);`,
  );
  const definition = {
    id: "by-path",
    version: "0.0.1",
    summary: "declared by path, not by package name",
    gates: [
      {
        gate: rel("gate.mjs"),
        label: "path-declared",
        paths: ["*.txt"],
        fixture: { files: { "a.txt": "x\n" }, expect: ["path-declared"] },
      },
    ],
  };
  writeFileSync(nodePath.join(dir, "ops.json"), JSON.stringify(definition));
  writeFileSync(nodePath.join(dir, "ops.mjs"), `export default ${JSON.stringify(definition)};`);

  try {
    for (const form of ["ops.json", "ops.mjs"]) {
      const { config } = await loadConfig(repoRoot);
      const { context } = await contextFor({
        config: { ...config, ops: { "by-path": rel(form) } },
        flags: { "self-test": true },
      });
      const result = await check.run(context);
      const suites = (result.data as { suites?: readonly { id: string; output: string }[] }).suites ?? [];
      const mine = suites.find((suite) => suite.id === "by-path");
      assert.ok(mine !== undefined, `${form}: the ops was not self-tested at all`);
      // The regression is the branch, so this asserts the collection was READ and COMPOSED — not that
      // its gate passes. "could not run" is what both forms answered before; the count line is only
      // reachable once the ops became a plugin and its fixtures were walked.
      assert.doesNotMatch(mine.output, /could not run/, `${form}: the loader has no branch for this form`);
      assert.match(mine.output, /1 of 1 gates carry a fixture/, `${form}: loaded, but no fixture was walked`);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
