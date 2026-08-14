import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import records from "../src/index.ts";

test("records is a noun with verbs, like plan/task/log — and none of them is destructive", () => {
  // It was flat until 2026-08-12, with `census` and `handling` as booleans. Three flags of which exactly
  // one may be true is a union encoded as booleans, and the exclusivity lived in the order the `if`s were
  // written rather than in any type — `--census --handling` resolved silently to census. As verbs it
  // cannot be constructed, and the MCP schema is an enum with a summary each instead of three flags that
  // read as independent.
  assert.deepEqual(
    records.definition.commands?.map((c) => c.name),
    ["resolve", "census", "handling", "show", "list"],
  );
  assert.deepEqual(
    records.definition.commands?.filter((c) => c.destructive === true),
    [],
    "every verb here reads; nothing under records mutates anything",
  );
});

function resolving(type: string) {
  return records.run({
    repoRoot: "/does/not/matter",
    flags: { type },
    command: "resolve",
    args: [],
    config: {},
    settings: undefined,
    surface: "cli",
    log: () => {},
    warn: () => {},
  });
}

test("an unknown --type fails naming the valid set", async () => {
  const result = await resolving("wat");
  assert.equal(result.code, 2);
  assert.match(result.summary ?? "", /adr, rfc/);
});

// Plan-027 Track 1: the noun is the spelling. `plan` and `task` were reachable here AND under their own
// nouns, which is the duplication that track exists to remove — so the criterion is not merely that this
// verb refuses them, but that it says where they went. A removal that does not name its replacement is a
// break; one that does is a rename.
test("resolve no longer answers for a type that has a noun, and names the noun instead", async () => {
  for (const [type, noun] of [
    ["plan", "vibe-ops plan resolve"],
    ["task", "vibe-ops task resolve"],
  ] as const) {
    const result = await resolving(type);
    assert.equal(result.code, 2, `records resolve --type ${type} must not still answer`);
    assert.match(result.summary ?? "", new RegExp(noun.replace(/ /g, "\\s")), `it must name ${noun}`);
  }
});

// The narrowing is `resolve`'s alone. Nothing on a noun answers what `list` answers, so narrowing it too
// would have removed the only way to ask — which is the failure mode of converging by symmetry rather
// than by what each verb is for.
test("list still answers for all four types, including the two that have a noun", async () => {
  const result = await records.run({
    repoRoot: "/does/not/matter",
    flags: { type: "plan" },
    command: "list",
    args: [],
    config: {},
    settings: undefined,
    surface: "cli",
    log: () => {},
    warn: () => {},
  });
  assert.notEqual(result.code, 2, "list --type plan is not a rejected flag value");
});

test("resolve --type adr resolves the same way module-plan resolves plan — one library underneath both", async () => {
  const repo = await mkdtemp(path.join(tmpdir(), "vibeops-records-module-"));
  const result = await records.run({
    repoRoot: repo,
    flags: { type: "adr" },
    command: "resolve",
    args: [],
    config: {},
    settings: undefined,
    surface: "cli",
    log: () => {},
    warn: () => {},
  });
  assert.equal(result.code, 0);
  assert.equal((result.data as { type: string }).type, "adr");
});

// `show` — the read verb. Its whole reason for existing is that these questions were being answered by
// grep against raw text, so the assertions that matter are the ones a grep gets wrong.
test("show reads a plan's status, its open track count and the sections it actually has", async () => {
  const repo = await mkdtemp(path.join(tmpdir(), "vibeops-records-show-"));
  await mkdir(path.join(repo, "project", "plans"), { recursive: true });
  await writeFile(
    path.join(repo, "project", "plans", "001-a-plan.md"),
    [
      "# Plan-001: A plan",
      "",
      "| Field | Value |",
      "|---|---|",
      "| Status | In Progress |",
      "",
      "## Tracks",
      "- [x] Track 1 — done",
      "- [ ] Track 2 — open",
      "```markdown",
      "## Not a section — a template being quoted",
      "```",
      "## Decision Log",
      "- Decision: one",
      "",
    ].join("\n"),
  );

  const result = await records.run({
    repoRoot: repo,
    flags: {},
    command: "show",
    args: ["project/plans/001-a-plan.md"],
    config: {},
    settings: undefined,
    surface: "cli",
    log: () => {},
    warn: () => {},
  });

  const shown = result.data as {
    status?: string;
    tracks?: { total: number; checked: number; open: number };
    sections: readonly { level: number; text: string }[];
    entries: { decisions?: number; surprises?: number };
  };

  assert.equal(result.code, 0);
  assert.equal(shown.status, "In Progress");
  assert.deepEqual(shown.tracks, { total: 2, checked: 1, open: 1 });
  assert.deepEqual(
    shown.sections.map((s) => s.text),
    ["Tracks", "Decision Log"],
    "the heading inside the fence is structurally not a heading — a grep for '^## ' would have counted it",
  );
  assert.equal(shown.entries.decisions, 1);
  assert.equal(shown.entries.surprises, undefined, "absent section, not an empty one");
});

test("show refuses with a reason rather than reporting on nothing", async () => {
  const repo = await mkdtemp(path.join(tmpdir(), "vibeops-records-show-bare-"));
  const result = await records.run({
    repoRoot: repo,
    flags: {},
    command: "show",
    args: [],
    config: {},
    settings: undefined,
    surface: "cli",
    log: () => {},
    warn: () => {},
  });
  assert.equal(result.code, 2);
  assert.match(result.summary, /at least one record path/);
});
