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
