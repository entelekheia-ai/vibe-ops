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
    // The nine `fragment-parity-*` entries left with the fragments they compared (Plan-038 track 7),
    // and the `fragment-parity` gate left with them — it held no repository knowledge, which is what
    // its own header said would let it leave the day its subject did. `fragment-parity-completeness`
    // stays while eight fragments do: its left side is now those eight and its right side is the eight
    // declared exemptions, so it still fails if either list loses a name.
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

// The nine parity comparisons are gone with the fragments they compared (Plan-038 track 7). What they
// were FOR now lives in `check --self-test`'s `ports` phase, which makes all nine ports fail on the same
// deliberately-broken fixture the retired fragments used to be measured against.
//
// What still has a job here is the completeness entry, and its job got harder rather than easier: with
// no parity entry left, EVERY remaining fragment is covered by a declared exemption, so the only thing
// standing between this repository and an uncovered fragment is that one comparison. It must be seen to
// run against a real population — an entry examining nothing reports the same clean line.
test("the completeness entry still covers every remaining fragment, and examined something to say so", async () => {
  const { config } = await loadConfig(REPO);
  const { context, logs } = contextFor(REPO, config, { verbose: true });
  const result = await ops.run(context);
  assert.equal(result.code, 0, logs.join("\n"));
  assert.ok(
    logs.some((line) => /ok +\[fragment-parity-completeness\] [1-9]\d* examined/.test(line)),
    `the completeness entry did not examine anything:\n${logs.join("\n")}`,
  );
  assert.ok(!logs.some((line) => line.includes("fragment-uncovered")), logs.join("\n"));
  // No parity entry may come back without its fragment: a label matching `fragment-parity-<something>`
  // other than the completeness entry means one was added while its subject is being deleted.
  const stray = logs.filter((line) => /\[fragment-parity-(?!completeness)/.test(line));
  assert.deepEqual(stray, [], stray.join("\n"));
});

test("every entry that declares a fixture still fires on it", async () => {
  const { config } = await loadConfig(REPO);
  const { context, logs } = contextFor(REPO, config, { "self-test": true });
  const result = await ops.run(context);
  assert.equal(result.code, 0, logs.join("\n"));
});
