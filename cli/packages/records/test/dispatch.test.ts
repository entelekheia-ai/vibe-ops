// The dispatch is Plan-012's flowchart, so the tests are its terminal boxes — one per branch, plus the
// two properties the design leans on hardest: a current record says NOTHING about versions, and an
// undeclared one is never resolved to the oldest known shape.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { documentFromText } from "@entelekheia/vibe-ops-core";
import { blocks, compareVersions, describe, dispatchRecord, readMigrationNotes } from "../src/dispatch.ts";

const CURRENT = { type: "plan", version: "3", source: "frontmatter" } as const;

const record = (text: string) => documentFromText("plan.md", text);
const declaring = (version: string) =>
  record(["---", `vibe-ops-template: plan@${version}`, "---", "", "# Plan-012: Title"].join("\n"));

/** A migrations directory holding exactly the given `<type>-<from>-to-<to>.md` names. */
async function migrations(names: readonly string[]): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "vibeops-migrations-"));
  for (const name of names) await writeFile(path.join(dir, name), "# note\n");
  return dir;
}

// --------------------------------------------------------------------------- the comparator

test("versions compare component-wise, so 0.x orders below the integers that replaced it", () => {
  assert.ok(compareVersions("0.2", "3") < 0);
  assert.ok(compareVersions("0.1", "0.2") < 0);
  assert.ok(compareVersions("3", "0.2") > 0);
  assert.equal(compareVersions("3", "3"), 0);
  // Trailing components are absent, not zero-padded differently: 3 and 3.0 are the same version.
  assert.equal(compareVersions("3", "3.0"), 0);
});

// --------------------------------------------------------------------------- the notes

test("a migration note declares its own jump through its filename", async () => {
  const dir = await migrations(["plan-0.2-to-3.md", "task-0.1-to-0.2.md", "README.md", "not-a-note.md"]);
  const notes = readMigrationNotes(dir);
  assert.deepEqual(
    notes.map((note) => `${note.type} ${note.from}->${note.to}`).sort(),
    ["plan 0.2->3", "task 0.1->0.2"],
  );
});

test("a migrations directory that does not exist yields no notes rather than throwing", () => {
  assert.deepEqual(readMigrationNotes(path.join(tmpdir(), "vibeops-no-such-dir-ever")), []);
});

// --------------------------------------------------------------------------- the branches

test("a record written against the current template is current, and describes nothing at all", () => {
  const dispatch = dispatchRecord({ record: declaring("3"), current: CURRENT });
  assert.equal(dispatch.kind, "current");
  assert.equal(blocks(dispatch), false);
  // The transparency constraint: an ordinary verb on an ordinary record acquires no version vocabulary.
  assert.equal(describe(dispatch, "project/plans/012-x.md"), undefined);
});

test("an older record with a contiguous chain of notes is handled, and the line routes somewhere", async () => {
  const migrationsDir = await migrations(["plan-0.1-to-0.2.md", "plan-0.2-to-3.md"]);
  const dispatch = dispatchRecord({ record: declaring("0.1"), current: CURRENT, migrationsDir });
  assert.equal(dispatch.kind, "behind");
  assert.equal(blocks(dispatch), false);
  assert.equal(dispatch.kind === "behind" && dispatch.notes.length, 2);

  const line = describe(dispatch, "project/plans/009-x.md");
  assert.match(line ?? "", /009-x\.md/);
  assert.match(line ?? "", /plan@0\.1/);
  // The documents, not the arrows: naming `0.1→0.2` said the record was old and left the reader to work
  // out what that meant about it. Naming the notes is the routing the dispatch exists to perform.
  assert.match(line ?? "", /plan-0\.1-to-0\.2\.md, plan-0\.2-to-3\.md/);
  assert.match(line ?? "", /records handling project\/plans\/009-x\.md/);
});

test("an older record whose chain breaks stops, naming the jump nobody wrote down", async () => {
  // 0.2 → 3 exists; nothing leaves 0.1, so a record at 0.1 is stuck there.
  const migrationsDir = await migrations(["plan-0.2-to-3.md"]);
  const dispatch = dispatchRecord({ record: declaring("0.1"), current: CURRENT, migrationsDir });
  assert.equal(dispatch.kind, "unhandled");
  assert.equal(blocks(dispatch), true);
  assert.equal(dispatch.kind === "unhandled" && dispatch.stuckAt, "0.1");
  // The report names the note that would unblock it, not just the fact that something is missing.
  assert.match(describe(dispatch, "p.md") ?? "", /plan-0\.1-to-<next>\.md/);
});

test("with no migrations directory at all, every older record is unhandled rather than assumed", () => {
  const dispatch = dispatchRecord({ record: declaring("0.2"), current: CURRENT });
  assert.equal(dispatch.kind, "unhandled");
  assert.equal(blocks(dispatch), true);
});

test("a record ahead of the template stops — the tooling is behind, not the record", () => {
  const dispatch = dispatchRecord({ record: declaring("4"), current: CURRENT });
  assert.equal(dispatch.kind, "ahead");
  assert.equal(blocks(dispatch), true);
  assert.match(describe(dispatch, "p.md") ?? "", /ahead of the template/);
});

test("a record declaring another type's token is a mismatch, not a version comparison", () => {
  const dispatch = dispatchRecord({
    record: record(["---", "vibe-ops-template: task@3", "---", "", "# Title"].join("\n")),
    current: CURRENT,
  });
  assert.equal(dispatch.kind, "mismatch");
  assert.equal(blocks(dispatch), true);
});

// The branch the whole plan rests on. An absent declaration is a fact about what nobody wrote down, and
// resolving it to the oldest known shape is wrong in both directions.
test("an undeclared record is unknown and stops — it is NOT resolved to the oldest known version", async () => {
  const migrationsDir = await migrations(["plan-0.1-to-0.2.md", "plan-0.2-to-3.md"]);
  const dispatch = dispatchRecord({
    record: record("# Plan-005: Title\n\nA plan with no declaration.\n"),
    current: CURRENT,
    migrationsDir,
  });
  assert.equal(dispatch.kind, "unknown");
  assert.equal(blocks(dispatch), true);
  // Notes leaving 0.1 exist, so a dispatch that had guessed would have reported `behind` and proceeded.
  const line = describe(dispatch, "project/plans/005-x.md") ?? "";
  assert.match(line, /declares no template version/);
  assert.match(line, /plan@<version>/);
});

test("a template declaring no version makes every record under it uncomparable, and says so", () => {
  const dispatch = dispatchRecord({ record: declaring("3"), current: undefined });
  assert.equal(dispatch.kind, "uncomparable");
  assert.equal(blocks(dispatch), true);
  assert.match(describe(dispatch, "p.md") ?? "", /template declares no version/);
});

// --------------------------------------------------------------------------- the shared property

test("only a current record describes nothing; every other branch produces exactly one line", async () => {
  const migrationsDir = await migrations(["plan-0.2-to-3.md"]);
  const cases = [
    dispatchRecord({ record: declaring("0.2"), current: CURRENT, migrationsDir }),
    dispatchRecord({ record: declaring("0.1"), current: CURRENT, migrationsDir }),
    dispatchRecord({ record: declaring("9"), current: CURRENT }),
    dispatchRecord({ record: record("# No declaration"), current: CURRENT }),
    dispatchRecord({ record: declaring("3"), current: undefined }),
  ];
  for (const dispatch of cases) {
    const line = describe(dispatch, "p.md");
    assert.notEqual(line, undefined, `${dispatch.kind} produced no line`);
    assert.equal(line?.includes("\n"), false, `${dispatch.kind} produced more than one line`);
  }
});
