import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createDocumentStore } from "@entelekheia/vibe-ops-core";
import type { Document } from "@entelekheia/vibe-ops-core";
import { planStatusFindings, trackCheckboxes } from "../src/status.ts";

const HEADER = (status: string) => ["# Plan-001: Title", "", "| Field | Value |", "|---|---|", `| Status | ${status} |`, ""].join("\n");

async function scratchRepo(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), "vibeops-status-"));
}

/** `text` as a real parsed `Document` — `trackCheckboxes` reads the block tree, where
 *  `task_list_marker_checked`/`unchecked` are real node types, rather than matching raw lines. */
async function documentOf(text: string): Promise<Document> {
  const dir = await scratchRepo();
  await writeFile(path.join(dir, "x.md"), text);
  return createDocumentStore(dir).get("x.md");
}

test("trackCheckboxes: counts every checkbox under ## Tracks, including the closure line, and stops at the next heading", async () => {
  const text = [
    "## Tracks",
    "- [x] Track 1 — done",
    "- [ ] Track 2 — open",
    "- [ ] Run /vibe-ops:close plan",
    "## Success criteria",
    "- [ ] not counted — past the next heading",
  ].join("\n");
  assert.deepEqual(trackCheckboxes(await documentOf(text)), { total: 3, checked: 1 });
});

test("trackCheckboxes: no ## Tracks heading at all is zero, not an error", async () => {
  assert.deepEqual(trackCheckboxes(await documentOf("# Plan\n\nNo tracks section here.\n")), { total: 0, checked: 0 });
});

test("trackCheckboxes: a checkbox quoted inside a fenced code example is not counted — the tree already knows the difference", async () => {
  const text = ["## Tracks", "Example syntax:", "```", "- [ ] not a real track, just illustrating the format", "```", "- [x] Track 1"].join(
    "\n",
  );
  assert.deepEqual(trackCheckboxes(await documentOf(text)), { total: 1, checked: 1 });
});

test("planStatusFindings: Shipped with an unchecked track is a finding", async () => {
  const repo = await scratchRepo();
  await mkdir(path.join(repo, "project", "plans"), { recursive: true });
  const text = [HEADER("Shipped"), "## Tracks", "- [x] Track 1", "- [ ] Track 2"].join("\n");
  await writeFile(path.join(repo, "project", "plans", "001-x.md"), text);

  const findings = planStatusFindings(createDocumentStore(repo), repo, "project/plans", "In Progress", "Shipped");
  assert.equal(findings.length, 1);
  assert.equal(findings[0]?.reason, "terminal-with-open-tracks");
  assert.equal(findings[0]?.file, "project/plans/001-x.md");
});

test("planStatusFindings: In Progress with every track checked is a finding", async () => {
  const repo = await scratchRepo();
  await mkdir(path.join(repo, "project", "plans"), { recursive: true });
  const text = [HEADER("In Progress"), "## Tracks", "- [x] Track 1", "- [x] Track 2"].join("\n");
  await writeFile(path.join(repo, "project", "plans", "001-x.md"), text);

  const findings = planStatusFindings(createDocumentStore(repo), repo, "project/plans", "In Progress", "Shipped");
  assert.equal(findings.length, 1);
  assert.equal(findings[0]?.reason, "active-with-all-tracks-checked");
});

test("planStatusFindings: Shipped with every track checked is coherent — no finding", async () => {
  const repo = await scratchRepo();
  await mkdir(path.join(repo, "project", "plans"), { recursive: true });
  const text = [HEADER("Shipped"), "## Tracks", "- [x] Track 1", "- [x] Track 2"].join("\n");
  await writeFile(path.join(repo, "project", "plans", "001-x.md"), text);

  assert.deepEqual(planStatusFindings(createDocumentStore(repo), repo, "project/plans", "In Progress", "Shipped"), []);
});

test("planStatusFindings: Backlog (neither active nor terminal) is never a finding", async () => {
  const repo = await scratchRepo();
  await mkdir(path.join(repo, "project", "plans"), { recursive: true });
  const text = [HEADER("Backlog"), "## Tracks", "- [ ] Track 1"].join("\n");
  await writeFile(path.join(repo, "project", "plans", "001-x.md"), text);

  assert.deepEqual(planStatusFindings(createDocumentStore(repo), repo, "project/plans", "In Progress", "Shipped"), []);
});

test("planStatusFindings: a file with no header table (AGENTS.md) is silently skipped, not a crash", async () => {
  const repo = await scratchRepo();
  await mkdir(path.join(repo, "project", "plans"), { recursive: true });
  await writeFile(path.join(repo, "project", "plans", "AGENTS.md"), "# Plans\n\nSome prose, no header table.\n");

  assert.deepEqual(planStatusFindings(createDocumentStore(repo), repo, "project/plans", "In Progress", "Shipped"), []);
});

test("planStatusFindings: active === terminal (unresolvable chain) never fires", async () => {
  const repo = await scratchRepo();
  assert.deepEqual(planStatusFindings(createDocumentStore(repo), repo, "project/plans", "X", "X"), []);
  assert.deepEqual(planStatusFindings(createDocumentStore(repo), repo, "project/plans", undefined, "Shipped"), []);
});

test("planStatusFindings: real fixture — Plan-009's own shape (Shipped, closure box unchecked)", async () => {
  const repo = await scratchRepo();
  await mkdir(path.join(repo, "project", "plans"), { recursive: true });
  const text = [
    HEADER("Shipped"),
    "## Tracks",
    "- [x] **Track 1 — foo.**",
    "- [x] **Track 2 — bar.**",
    "- [ ] Run `/vibe-ops:close plan` — retrospective against the goals, the demotion check, the tracking",
    "      issue closed. The plan file itself is kept.",
  ].join("\n");
  await writeFile(path.join(repo, "project", "plans", "009-x.md"), text);

  const findings = planStatusFindings(createDocumentStore(repo), repo, "project/plans", "In Progress", "Shipped");
  assert.equal(findings.length, 1);
  assert.equal(findings[0]?.tracksTotal, 3);
  assert.equal(findings[0]?.tracksChecked, 2);
});
