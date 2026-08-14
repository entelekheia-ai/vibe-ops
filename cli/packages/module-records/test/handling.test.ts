// `handling` is what a skill asks before it asserts a record's shape. The case that produced it is the
// first test: a plan at `plan@0.1` must come back naming the notes that describe that shape, because
// `/vibe-ops:close-plan` once asserted the current shape at a plan holding sixteen entries in a section
// it had just said did not exist.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import records from "../src/index.ts";
import type { Handling } from "../src/handling.ts";

async function write(repo: string, file: string, text: string): Promise<void> {
  await mkdir(path.join(repo, path.dirname(file)), { recursive: true });
  await writeFile(path.join(repo, file), text, "utf8");
}

/**
 * A repository shaped like a target one: templates under `plugin/templates/`, migration notes beside the
 * migrate skill, and records at three different versions.
 */
async function fixture(): Promise<string> {
  const repo = await mkdtemp(path.join(tmpdir(), "vibeops-handling-"));
  // The manifest is what makes `resolvePluginDir` answer `plugin/` rather than the root, and the plugin
  // dir is where the migration notes are looked for. Without it the fixture is a flat repository and the
  // notes below are unreachable — the same failure a real flat target repo would have.
  await write(repo, "plugin/.claude-plugin/plugin.json", '{ "name": "vibe-ops" }\n');
  await write(repo, "project/templates/plan.md", "---\nvibe-ops-template: plan@3\n---\n\n# Plan\n");
  await write(repo, "plugin/skills/migrate/migrations/plan-0.1-to-0.2.md", "# 0.1 -> 0.2\n");
  await write(repo, "plugin/skills/migrate/migrations/plan-0.2-to-3.md", "# 0.2 -> 3\n");

  await write(repo, "project/plans/012-current.md", "---\nvibe-ops-template: plan@3\n---\n\n# Current\n");
  await write(repo, "project/plans/shipped/001-old.md", "<!-- vibe-ops-template plan@0.1 -->\n\n# Old\n");
  await write(repo, "project/plans/009-bare.md", "# Bare\n\nNo declaration.\n");
  return repo;
}

async function run(repo: string, args: readonly string[]) {
  const lines: string[] = [];
  const result = await records.run({
    repoRoot: repo,
    flags: {},
    command: "handling",
    args: [...args],
    config: {},
    settings: undefined,
    surface: "cli",
    log: (message) => lines.push(message),
    warn: () => {},
  });
  return { result, lines, data: result.data as readonly Handling[] | undefined };
}

test("a record behind the current template names the documents that describe its shape", async () => {
  const repo = await fixture();
  const { result, lines, data } = await run(repo, ["project/plans/shipped/001-old.md"]);

  assert.equal(result.code, 0);
  assert.equal(data?.[0]?.dispatch?.kind, "behind");
  assert.deepEqual(data?.[0]?.handling, [
    "plugin/skills/migrate/migrations/plan-0.1-to-0.2.md",
    "plugin/skills/migrate/migrations/plan-0.2-to-3.md",
  ]);
  // Both notes, in the order they apply — a single combined jump would lose the 0.1 shape entirely.
  assert.match(lines.join("\n"), /plan@0\.1, current is 3/);
  assert.match(lines.join("\n"), /plan-0\.1-to-0\.2\.md[\s\S]*plan-0\.2-to-3\.md/);
});

test("a current record is told to be handled as written, and names no document to read", async () => {
  const repo = await fixture();
  const { lines, data } = await run(repo, ["project/plans/012-current.md"]);

  assert.equal(data?.[0]?.dispatch?.kind, "current");
  assert.deepEqual(data?.[0]?.handling, []);
  assert.match(lines.join("\n"), /current shape, handle it as written/);
});

test("an undeclared record is unknown — never resolved to the oldest shape, even though notes exist for it", async () => {
  const repo = await fixture();
  const { data, lines } = await run(repo, ["project/plans/009-bare.md"]);

  assert.equal(data?.[0]?.dispatch?.kind, "unknown");
  assert.deepEqual(data?.[0]?.handling, []);
  assert.match(lines.join("\n"), /declares no template version/);
});

// The type comes from where the file lives, not from what it declares — otherwise the mismatch branch
// would be unreachable, because every record would be compared against the type it named.
test("the type is resolved from the directory, so a record declaring another type's token is a mismatch", async () => {
  const repo = await fixture();
  await write(repo, "project/plans/013-wrong.md", "---\nvibe-ops-template: task@3\n---\n\n# Wrong\n");
  const { data } = await run(repo, ["project/plans/013-wrong.md"]);

  assert.equal(data?.[0]?.dispatch?.kind, "mismatch");
});

test("a path under no record directory says so, rather than being dispatched against a guessed type", async () => {
  const repo = await fixture();
  await write(repo, "docs/how-to/something.md", "# Something\n");
  const { data, lines } = await run(repo, ["docs/how-to/something.md"]);

  assert.equal(data?.[0]?.dispatch, undefined);
  assert.match(lines.join("\n"), /not under any record directory/);
});

test("several records are answered in one call, each on its own terms", async () => {
  const repo = await fixture();
  const { data } = await run(repo, ["project/plans/012-current.md", "project/plans/shipped/001-old.md"]);

  assert.equal(data?.length, 2);
  assert.equal(data?.[0]?.dispatch?.kind, "current");
  assert.equal(data?.[1]?.dispatch?.kind, "behind");
});

// Was an error until Plan-026 Track 5, on the grounds that no path must not be an EMPTY SUCCESS. That
// concern stands and is asserted below — what changed is the answer, not the standard: `census` is this
// same reading over the whole repository, so no path now means every record rather than a refusal.
// An empty array with exit 0 would still be the defect the original test was written against.
test("handling with no path is the census — a full answer, never an empty success", async () => {
  const repo = await fixture();
  const { result } = await run(repo, []);

  assert.equal(result.code, 0);
  assert.ok(Array.isArray(result.data), "the whole-repository reading, not a refusal");
  assert.ok((result.data as unknown[]).length > 0, "and never an empty array reported as success");
  assert.match(result.summary, /censused/);
});

// The listing projection. `list` first shipped returning `show`'s whole shape per record, which over this
// repository's 28 plans was 43,761 bytes of JSON against 2,711 bytes of printed lines — `sections` alone
// 78.7% of it, answering a question about ONE record for every record in the directory. The assertion
// below is the one that would have caught it: what `list` carries per row is what its own line prints.
test("list carries the listing shape, and only --full carries show's", async () => {
  const repo = await fixture();
  await write(repo, "project/plans/001-a.md", [
    "# Plan-001: A", "", "| Field | Value |", "|---|---|", "| Status | Backlog |", "",
    "## Tracks", "- [ ] one", "", "## Surprises & Discoveries", "- Observation: x", "",
  ].join("\n"));

  // Not the `run` helper above — that one is bound to `command: "handling"` and passes no flags.
  const list = async (flags: Record<string, string | boolean>) =>
    records.run({
      repoRoot: repo,
      flags,
      command: "list",
      args: [],
      config: {},
      settings: undefined,
      surface: "cli",
      log: () => {},
      warn: () => {},
    });

  const result = await list({ type: "plan" });
  assert.equal(result.code, 0);
  const [row] = result.data as Record<string, unknown>[];
  assert.ok(row, "the listing produced a row");

  assert.deepEqual(Object.keys(row).sort(), ["file", "status", "tracks", "type"]);
  assert.equal("sections" in row, false, "a listing must not carry every record's headings");
  assert.equal("entries" in row, false);
  assert.equal(row.status, "Backlog", "and it still carries what its printed line shows");

  const all = await list({ type: "plan", fields: "all" });
  const [allRow] = all.data as Record<string, unknown>[];
  assert.ok(allRow, "the listing produced a row");
  assert.ok(Array.isArray(allRow.sections), `"all" is how the whole shape stays reachable`);

  // The cross-record question the projection exists to make cheap: which plans carry a Surprises
  // section, without paying for seven other fields to ask it.
  const picked = await list({ type: "plan", fields: "file,sections" });
  const [pickedRow] = picked.data as Record<string, unknown>[];
  assert.ok(pickedRow, "the listing produced a row");
  assert.deepEqual(Object.keys(pickedRow).sort(), ["file", "sections"]);

  // Order comes from LISTABLE, not from how the caller spelled the selection, so two calls asking for
  // the same set produce identical rows.
  const reversed = await list({ type: "plan", fields: "sections,file" });
  assert.deepEqual(reversed.data, picked.data);

  // A typo is the caller's, and it is named rather than silently dropped — a listing missing a field
  // nobody notices is the same defect class as an empty string reported as success.
  const typo = await list({ type: "plan", fields: "file,setcions" });
  assert.equal(typo.code, 2);
  assert.match(typo.summary, /unknown field\(s\) setcions/);
});
