// End-to-end: the real composition, against this repository's own checkout under its own config, and
// against the fixture each entry declares — the same shape ops-governance/test/ops.test.ts uses.
//
// Four entries compare a shell fragment against the gate that ports it and are not asserted one by one:
// what matters is that parity ran and reported no regression. `template-heading-drift` carries its own
// assertions because the population question it answers is why it lives in an ops with no
// `**/templates/**` exclusion.

import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import ops from "../src/index.ts";
import { loadConfig, settingsFor } from "@entelekheia/vibe-ops-core";
import type { ModuleContext, VibeOpsConfig } from "@entelekheia/vibe-ops-core";

function contextFor(
  repoRoot: string,
  config: VibeOpsConfig,
  flags: Record<string, string | boolean> = {},
): { context: ModuleContext; logs: string[] } {
  const logs: string[] = [];
  return {
    logs,
    context: {
      repoRoot,
      flags,
      args: [],
      config,
      settings: settingsFor(config, "mirror"),
      surface: "cli",
      log: (message) => logs.push(message),
      warn: (message) => logs.push(`warning: ${message}`),
    },
  };
}

const REPO = path.resolve(import.meta.dirname, "..", "..", "..", "..");

test("--list composes the entries this ops owns", async () => {
  const { context } = contextFor(REPO, {}, { list: true });
  const result = await ops.run(context);
  const data = result.data as { gates: readonly { label: string }[] };
  assert.deepEqual(data.gates.map((gate) => gate.label), [
    "template-heading-drift",
    "fragment-parity",
    "fragment-parity-frontmatter",
    "fragment-parity-skill-frontmatter",
    "fragment-parity-memory-slug",
    "fragment-parity-machine-paths",
    "fragment-parity-template-attribution",
    "fragment-parity-bridge",
    "fragment-parity-budget",
    "fragment-parity-dogfooding-drift",
    "fragment-parity-completeness",
    "manifest-version",
    "manifest-description",
    "manifest-keywords",
    "manifest-changelog-version",
    "dogfooding-drift",
    "license-text",
    "hooks-registration",
    "authoring-completeness",
    "plugin-root-path",
    "command-reference",
  ]);
});

// `.agents/` is asserted explicitly because `**/*.md` does not reach a dot-directory: the rule governing
// work inside project/ is one of the documents this entry exists to check, and left implicit the run would
// report a clean sweep over everything except the file that matters most.
test("the population reaches .agents/, which a bare **/*.md glob does not", async () => {
  const { context } = contextFor(REPO, {}, { list: true });
  const result = await ops.run(context);
  const data = result.data as { gates: readonly { paths: readonly string[] }[] };
  assert.ok(data.gates[0]!.paths.includes(".agents/**/*.md"), JSON.stringify(data.gates[0]!.paths));
});

// The shipped templates are NOT excluded here, and that is why `template-heading-drift` may not live in
// `governance`, whose blanket `**/templates/**` would hide the very copies it reads. This ops declares no
// such exclusion, which is the property the move from `ops-for-vibe-ops` had to preserve.
test("against this repository's own checkout, under its own config — nothing fails", async () => {
  const { config } = await loadConfig(REPO);
  const { context, logs } = contextFor(REPO, config, { verbose: true });
  const result = await ops.run(context);
  assert.equal(result.code, 0, logs.join("\n"));
  assert.ok(
    logs.some((line) => line.includes("ok    [template-heading-drift]") && line.includes("examined")),
    logs.join("\n"),
  );
});

test("the scaffolding copies are IN the population — excluding them is the bug this entry avoids", async () => {
  const { config } = await loadConfig(REPO);
  const { context } = contextFor(REPO, config, {});
  const result = await ops.run(context);
  const data = result.data as { population: readonly { gate: string; examined: number }[] };
  // Two shipped twins live under plugin/skills/setup/templates/; a run that examined none of them would
  // report exactly this ops's clean result while looking at nothing it was built for.
  const drift = data.population.find((entry) => entry.gate === "template-heading-drift");
  assert.ok((drift?.examined ?? 0) > 40, JSON.stringify(data.population));
});

// Parity is the point of the other four entries, and the assertion is that it RAN, not merely that the
// composition was green: a parity entry whose runner is unreachable skips, and a skip and a clean
// comparison read the same way in an exit code.
test("every fragment-parity entry actually compared, and none reported a regression", async () => {
  const { config } = await loadConfig(REPO);
  const { context, logs } = contextFor(REPO, config, { verbose: true });
  const result = await ops.run(context);
  assert.equal(result.code, 0, logs.join("\n"));
  // All four, by label, each having reported WHICH two things it compared. Asserting a count would pass
  // on any four lines; asserting the label plus `compared` is what distinguishes a comparison that ran
  // from an entry that skipped because its runner was unreachable — and a skip and a clean comparison are
  // the same exit code.
  for (const label of [
    "fragment-parity",
    "fragment-parity-frontmatter",
    "fragment-parity-skill-frontmatter",
    "fragment-parity-memory-slug",
    "fragment-parity-machine-paths",
    "fragment-parity-template-attribution",
    "fragment-parity-bridge",
    "fragment-parity-budget",
    "fragment-parity-dogfooding-drift",
  ]) {
    assert.ok(
      logs.some((line) => line.includes(`[${label}]`) && line.includes("(compared ")),
      `${label} did not report a comparison:\n${logs.join("\n")}`,
    );
  }
  assert.ok(!logs.some((line) => line.includes("port-regression")), logs.join("\n"));
});

test("every entry that declares a fixture still fires on it", async () => {
  const { config } = await loadConfig(REPO);
  const { context, logs } = contextFor(REPO, config, { "self-test": true });
  const result = await ops.run(context);
  assert.equal(result.code, 0, logs.join("\n"));
});
