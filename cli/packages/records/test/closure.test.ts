import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createDocumentStore } from "@entelekheia/vibe-ops-core";
import type { Document } from "@entelekheia/vibe-ops-core";
import { closureBoxOpen, tickClosureBox, tickPlanClosureBox } from "../src/closure.ts";

async function documentOf(text: string): Promise<Document> {
  const dir = await mkdtemp(path.join(tmpdir(), "vibeops-closure-"));
  await writeFile(path.join(dir, "x.md"), text);
  return createDocumentStore(dir).get("x.md");
}

const OPEN = "## Closure\n\n- [ ] Run `/vibe-ops:close task` — do not just delete this file.\n";

test("an unchecked box naming the closure command is open", async () => {
  assert.equal(closureBoxOpen(await documentOf(OPEN)), true);
});

test("a ticked box is not open", async () => {
  assert.equal(closureBoxOpen(await documentOf(OPEN.replace("[ ]", "[x]"))), false);
});

test("both the current skill name and the split form Track 7 introduces are recognised", async () => {
  assert.equal(closureBoxOpen(await documentOf("- [ ] Run `/vibe-ops:close-task` now\n")), true);
});

test("a dossier from a repository that never adopted the convention is not open — absence is not a refusal", async () => {
  assert.equal(closureBoxOpen(await documentOf("# Task\n\n- [ ] some unrelated work\n")), false);
});

test("a closure line quoted inside a fenced example does not hold a real dossier hostage", async () => {
  // A task dossier is the file most likely to contain a shell transcript or a template excerpt, so this
  // is the case a raw-line grep gets wrong — and it gets it wrong in the blocking direction.
  const text = ["# Task", "", "The template ships:", "", "```", "- [ ] Run `/vibe-ops:close task`", "```", ""].join("\n");
  assert.equal(closureBoxOpen(await documentOf(text)), false);
});

test("tickClosureBox replaces exactly the three characters of the marker", async () => {
  const document = await documentOf(OPEN);
  assert.equal(tickClosureBox(document), OPEN.replace("- [ ] Run", "- [x] Run"));
});

test("tickClosureBox leaves another bracketed pair on the same line alone", async () => {
  // The shell's sed anchored on `close task` appearing after the box on the same line, so a line
  // carrying a link or a second bracket pair was a substitution waiting to go wrong.
  const text = "- [ ] Run `/vibe-ops:close task` — see [the guide](g.md) and [x] not this\n";
  assert.equal(tickClosureBox(await documentOf(text)), text.replace("- [ ]", "- [x]"));
});

test("tickClosureBox is undefined when there is nothing to tick, rather than returning the text unchanged", async () => {
  assert.equal(tickClosureBox(await documentOf(OPEN.replace("[ ]", "[x]"))), undefined);
  assert.equal(tickClosureBox(await documentOf("# Task\n")), undefined);
});

test("a plan's own close-plan box is ticked, in both the current and the pre-split wording", async () => {
  // The plan's box lives in its `## Tracks` list, not in a `## Closure` section — the same splice with a
  // different anchor. Left open, `plan status` reports the plan as terminal-with-an-unchecked-track for
  // the rest of its life, which is how it was found: every plan shipped before 2026-08-12 carried it.
  for (const wording of ["/vibe-ops:close-plan", "/vibe-ops:close plan"]) {
    const document = await documentOf(
      `# Plan-001\n\n## Tracks\n\n- [x] **Track 1 — done.**\n- [ ] Run \`${wording}\` — retrospective against the goals.\n`,
    );
    const ticked = tickPlanClosureBox(document);
    assert.match(ticked ?? "", /- \[x\] Run/);
    assert.match(ticked ?? "", /- \[x\] \*\*Track 1/);
  }
});

test("a plan whose box is already ticked yields undefined rather than a second write", async () => {
  const document = await documentOf("# Plan-001\n\n## Tracks\n\n- [x] Run `/vibe-ops:close-plan` — done.\n");
  assert.equal(tickPlanClosureBox(document), undefined);
});

test("a task's closure box is not mistaken for a plan's", async () => {
  const document = await documentOf("# Task\n\n## Closure\n\n- [ ] Run `/vibe-ops:close-task` — do not just delete this file.\n");
  assert.equal(tickPlanClosureBox(document), undefined);
});
