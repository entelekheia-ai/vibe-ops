import { test } from "node:test";
import assert from "node:assert/strict";
import {
  extractMidArrow,
  livingSectionsFromTemplate,
  planActiveFromAuthority,
  planActiveFromTemplate,
} from "../src/plan-fields.ts";

test("extractMidArrow: the middle-of-N term, not literally index 2 — a 3-chain and a 4-chain both get a plausible answer", () => {
  assert.equal(extractMidArrow("Backlog → In Progress → Shipped"), "In Progress");
  assert.equal(extractMidArrow("A → B → C → D"), "B");
  assert.equal(extractMidArrow("Solo"), "Solo");
});

test("planActiveFromTemplate: the plan@0.2 chain — two states either side of the cut", () => {
  const text = "<!-- Status lifecycle: Backlog → In Progress → Shipped. The file is never deleted. -->";
  assert.equal(planActiveFromTemplate(text), "In Progress");
});

test("planActiveFromTemplate: no marker at all is undefined, not a guess", () => {
  assert.equal(planActiveFromTemplate("# Plan\n\nNo lifecycle line here.\n"), undefined);
});

test("planActiveFromAuthority: an arrow line within 8 lines of a heading naming Plan", () => {
  const text = [
    "## Plan (`project/plans/`)",
    "",
    "```",
    "Backlog → In Progress → Shipped   (the file is never deleted)",
    "```",
  ].join("\n");
  assert.equal(planActiveFromAuthority(text), "In Progress");
});

test("planActiveFromAuthority: the heading line itself is never checked for an arrow", () => {
  // A heading that itself contains an arrow must not be mistaken for the answer — the shell's awk
  // state machine consumes the heading line with `next`, skipping the arrow-check rule for that cycle.
  const text = "## Plan → not the answer\nBacklog → In Progress → Shipped";
  assert.equal(planActiveFromAuthority(text), "In Progress");
});

test("planActiveFromAuthority: past 8 lines with no arrow, undefined", () => {
  const text = ["## Plan", ...Array.from({ length: 8 }, () => "prose"), "Backlog → Shipped"].join("\n");
  assert.equal(planActiveFromAuthority(text), undefined);
});

test("livingSectionsFromTemplate: every H2 strictly between the two markers, in order", () => {
  const text = [
    "## Progress",
    "<!-- ===== LIVING SECTIONS -->",
    "## Decision Log",
    "## Outcomes & Retrospective",
    "<!-- ===== END LIVING SECTIONS -->",
    "## Related",
  ].join("\n");
  assert.deepEqual(livingSectionsFromTemplate(text), ["Decision Log", "Outcomes & Retrospective"]);
});

test("livingSectionsFromTemplate: one marker without the other is treated as neither", () => {
  const text = "<!-- ===== LIVING SECTIONS -->\n## Decision Log\n";
  assert.equal(livingSectionsFromTemplate(text), undefined);
});

test("livingSectionsFromTemplate: both markers present but no H2 between them is undefined, not an empty list", () => {
  const text = "<!-- ===== LIVING SECTIONS -->\nprose only\n<!-- ===== END LIVING SECTIONS -->\n";
  assert.equal(livingSectionsFromTemplate(text), undefined);
});
