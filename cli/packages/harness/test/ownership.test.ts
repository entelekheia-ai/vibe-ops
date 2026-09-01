// Plan-031 Track 2: the composition keeps origin, reports double claims, and applies the repository's
// narrowings last.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { classOf, composedOwnership, entryFor } from "../src/index.ts";
import type { OwnershipClass } from "../src/index.ts";
import type { VibeOpsConfig } from "@entelekheia/vibe-ops-core";

/**
 * A minimal activatable governance package: a fresh mkdtemp root (activation caches per package path
 * for the process lifetime, so every fixture MUST get its own directory) with an `ownership.json`
 * fragment and an `index.mjs` whose default export is exactly what `activateGovernance` requires —
 * `unit.type` matching the local `types` key, everything else the smallest shape `isActivated` accepts.
 */
async function fixturePackage(
  type: string,
  paths: readonly { match: string; class: OwnershipClass; why: string }[],
): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), `vibeops-ownership-${type}-`));
  await writeFile(path.join(root, "ownership.json"), JSON.stringify({ version: 1, paths }));
  await writeFile(
    path.join(root, "index.mjs"),
    `export default { root: ${JSON.stringify(root)}, unit: { type: ${JSON.stringify(type)}, ` +
      `template: "./templates/${type}.md", authoring: "./authoring.md", migrations: "./migrations", ` +
      `schema: { carrier: "table", required: ["Status"] }, numbered: false, pad: 0, depth: 1, dirs: ["project/${type}"] } };`,
  );
  return path.join(root, "index.mjs");
}

test("two fragments claiming one path with different classes is a conflict naming both claimants", async () => {
  const nota = await fixturePackage("nota", [{ match: "project/shared/**", class: "seed", why: "nota keeps its notes" }]);
  const memo = await fixturePackage("memo", [{ match: "project/shared/**", class: "norm", why: "memo overwrites its memos" }]);

  const config: VibeOpsConfig = { types: { nota, memo } };
  const boundary = await composedOwnership(config);
  assert.ok(boundary !== undefined);

  const conflict = boundary!.conflicts.find((c) => c.match === "project/shared/**");
  assert.ok(conflict !== undefined, JSON.stringify(boundary!.conflicts));
  assert.deepEqual(
    new Set(conflict!.claimants.map((c) => `${c.origin}:${c.class}`)),
    new Set([`${nota}:seed`, `${memo}:norm`]),
  );
  assert.equal(boundary!.refusedNarrowings.length, 0, JSON.stringify(boundary!.refusedNarrowings));
});

test("a repository entry on the conflicted match resolves it, and the narrowing is the effective class", async () => {
  const nota = await fixturePackage("nota2", [{ match: "project/shared/**", class: "seed", why: "nota keeps its notes" }]);
  const memo = await fixturePackage("memo2", [{ match: "project/shared/**", class: "norm", why: "memo overwrites its memos" }]);

  const config: VibeOpsConfig = {
    types: { nota2: nota, memo2: memo },
    ownership: [{ match: "project/shared/**", class: "seed", reason: "the repository keeps these" }],
  };
  const boundary = await composedOwnership(config);
  assert.ok(boundary !== undefined);

  assert.ok(
    boundary!.conflicts.every((c) => c.match !== "project/shared/**"),
    JSON.stringify(boundary!.conflicts),
  );
  assert.equal(classOf(boundary!, "project/shared/x.md"), "seed");
  const entry = entryFor(boundary!, "project/shared/x.md");
  assert.equal(entry?.origin, "repository");
});

test("a narrowing that would widen is refused naming the fragment that declared the narrower class", async () => {
  const nota = await fixturePackage("nota3", [{ match: "project/notes/**", class: "shaped", why: "nota structures its notes" }]);

  const config: VibeOpsConfig = {
    types: { nota3: nota },
    ownership: [{ match: "project/notes/**", class: "norm", reason: "take it over" }],
  };
  const boundary = await composedOwnership(config);
  assert.ok(boundary !== undefined);

  const refusal = boundary!.refusedNarrowings.find((r) => r.match === "project/notes/**");
  assert.ok(refusal !== undefined, JSON.stringify(boundary!.refusedNarrowings));
  assert.match(refusal!.why, new RegExp(escapeForRegExp(nota)));
  assert.match(refusal!.why, /shaped/);

  // Refused — the fragment's class stands, never the repository's.
  assert.equal(classOf(boundary!, "project/notes/x.md"), "shaped");
});

test("a narrowing without a reason, or with an unknown class, is refused", async () => {
  const config: VibeOpsConfig = {
    ownership: [
      { match: "docs/**", class: "seed", reason: "" },
      { match: "docs/**", class: "frozen", reason: "x" },
    ],
  };
  const boundary = await composedOwnership(config);
  assert.ok(boundary !== undefined);

  const refusals = boundary!.refusedNarrowings.filter((r) => r.match === "docs/**");
  assert.equal(refusals.length, 2, JSON.stringify(refusals));
  assert.notEqual(refusals[0]!.why, refusals[1]!.why);

  // Neither refusal was applied — no repository entry landed on this match.
  assert.ok(!boundary!.paths.some((p) => p.match === "docs/**" && p.origin === "repository"));
});

function escapeForRegExp(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
