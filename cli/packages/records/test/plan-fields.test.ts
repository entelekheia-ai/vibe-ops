import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createDocumentStore } from "@entelekheia/vibe-ops-core";
import type { Document } from "@entelekheia/vibe-ops-core";
import {
  extractLastArrow,
  extractMidArrow,
  livingSectionsFromTemplate,
  planActiveFromAuthority,
  planActiveFromTemplate,
  planTerminalFromAuthority,
  planTerminalFromTemplate,
} from "../src/plan-fields.ts";

/**
 * `text` as a real parsed markdown `Document`, the way every reader in this package receives one. The
 * functions under test read block-tree nodes — an `html_block`, an `atx_heading`, a `fenced_code_block`
 * — so a fixture has to be parsed rather than handed over as a string.
 */
async function documentOf(text: string): Promise<Document> {
  const dir = await mkdtemp(path.join(tmpdir(), "vibeops-plan-fields-"));
  await writeFile(path.join(dir, "x.md"), text);
  return createDocumentStore(dir).get("x.md");
}

test("extractMidArrow: the middle-of-N term, not literally index 2 — a 3-chain and a 4-chain both get a plausible answer", () => {
  assert.equal(extractMidArrow("Backlog → In Progress → Shipped"), "In Progress");
  assert.equal(extractMidArrow("A → B → C → D"), "B");
  assert.equal(extractMidArrow("Solo"), "Solo");
});

test("extractLastArrow: the terminal term of a chain, for plan status's coherence read", () => {
  assert.equal(extractLastArrow("Backlog → In Progress → Shipped"), "Shipped");
  assert.equal(extractLastArrow("Solo"), "Solo");
});

test("extractLastArrow: a trailing parenthetical gloss is not part of the term", () => {
  // .agents/rules/governance.md writes exactly this. Without the strip, `plan status` compares a plan's
  // `Status` against "Shipped   (the file is never deleted)" and never matches anything.
  assert.equal(extractLastArrow("Backlog → In Progress → Shipped   (the file is never deleted)"), "Shipped");
});

test("planActiveFromTemplate: the plan@0.2 chain — two states either side of the cut", async () => {
  const document = await documentOf("<!-- Status lifecycle: Backlog → In Progress → Shipped. The file is never deleted. -->\n");
  assert.equal(planActiveFromTemplate(document), "In Progress");
});

test("planActiveFromTemplate: no marker at all is undefined, not a guess", async () => {
  assert.equal(planActiveFromTemplate(await documentOf("# Plan\n\nNo lifecycle line here.\n")), undefined);
});

test("planTerminalFromTemplate: the plan@0.2 chain's last term", async () => {
  const document = await documentOf("<!-- Status lifecycle: Backlog → In Progress → Shipped. The file is never deleted. -->\n");
  assert.equal(planTerminalFromTemplate(document), "Shipped");
});

test("planActiveFromTemplate: the marker is read as an html_block, so a copy quoted in a code example cannot win", async () => {
  // The real risk this removes: a template that documents its own marker syntax in a fenced example.
  // A raw-text scan takes whichever copy comes first in the file; only one of the two is an html_block.
  const document = await documentOf(
    [
      "# Plan template",
      "",
      "Declare the lifecycle like this:",
      "",
      "```",
      "<!-- Status lifecycle: Draft → Wrong → Example. -->",
      "```",
      "",
      "<!-- Status lifecycle: Backlog → In Progress → Shipped. -->",
      "",
    ].join("\n"),
  );
  assert.equal(planActiveFromTemplate(document), "In Progress");
  assert.equal(planTerminalFromTemplate(document), "Shipped");
});

test("planActiveFromAuthority: the fenced chain under the heading naming Plan — where governance.md actually keeps it", async () => {
  const document = await documentOf(
    ["## Plan (`project/plans/`)", "", "```", "Backlog → In Progress → Shipped   (the file is never deleted)", "```", ""].join("\n"),
  );
  assert.equal(planActiveFromAuthority(document), "In Progress");
});

test("planTerminalFromAuthority: the gloss governance.md writes beside the chain is not part of the terminal status", async () => {
  const document = await documentOf(
    ["## Plan (`project/plans/`)", "", "```", "Backlog → In Progress → Shipped   (the file is never deleted)", "```", ""].join("\n"),
  );
  assert.equal(planTerminalFromAuthority(document), "Shipped");
});

test("planTerminalFromAuthority: a chain written as prose, with no fenced block, still resolves", async () => {
  assert.equal(planTerminalFromAuthority(await documentOf("## Plan\n\nBacklog → In Progress → Shipped\n")), "Shipped");
});

test("planActiveFromAuthority: the heading line itself is never checked for an arrow", async () => {
  const document = await documentOf("## Plan → not the answer\n\nBacklog → In Progress → Shipped\n");
  assert.equal(planActiveFromAuthority(document), "In Progress");
});

test("planActiveFromAuthority: an arrow under a LATER heading is not the plan's chain — the section is the boundary", async () => {
  // The shell searched a fixed eight lines after the heading, which is right only by luck. The section
  // node is what the document itself declares, so a chain belonging to the next record type stays there.
  const document = await documentOf(
    ["## Plan", "", "No chain written here.", "", "## Task", "", "Planned → In Progress → Done", ""].join("\n"),
  );
  assert.equal(planActiveFromAuthority(document), undefined);
});

test("planActiveFromAuthority: no heading naming Plan at all is undefined", async () => {
  assert.equal(planActiveFromAuthority(await documentOf("## ADR\n\nProposed → Accepted\n")), undefined);
});

test("livingSectionsFromTemplate: every H2 strictly between the two markers, in order", async () => {
  const document = await documentOf(
    [
      "## Progress",
      "",
      "<!-- ===== LIVING SECTIONS -->",
      "",
      "## Decision Log",
      "",
      "## Outcomes & Retrospective",
      "",
      "<!-- ===== END LIVING SECTIONS -->",
      "",
      "## Related",
      "",
    ].join("\n"),
  );
  assert.deepEqual(livingSectionsFromTemplate(document), ["Decision Log", "Outcomes & Retrospective"]);
});

test("livingSectionsFromTemplate: one marker without the other is treated as neither", async () => {
  const document = await documentOf("<!-- ===== LIVING SECTIONS -->\n\n## Decision Log\n");
  assert.equal(livingSectionsFromTemplate(document), undefined);
});

test("livingSectionsFromTemplate: both markers present but no H2 between them is undefined, not an empty list", async () => {
  const document = await documentOf("<!-- ===== LIVING SECTIONS -->\n\nprose only\n\n<!-- ===== END LIVING SECTIONS -->\n");
  assert.equal(livingSectionsFromTemplate(document), undefined);
});
