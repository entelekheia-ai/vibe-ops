import { test } from "node:test";
import assert from "node:assert/strict";
import { findingLines } from "../src/check-global.ts";

const warn = (check: string, evidence: string) => ({ level: "warn", check, evidence });

test("warnings of one check collapse into a count and two examples; a lone warning keeps its line", () => {
  const lines = findingLines([
    warn("template-version-plan", "a.md: behind"),
    warn("template-version-plan", "b.md: behind"),
    warn("template-version-plan", "c.md: behind"),
    warn("breadcrumb", "x.md: still in the tree"),
  ]);
  assert.deepEqual(lines, [
    "WARN  [template-version-plan] ×3 — run `vibe-ops check` for the full list; e.g.",
    "        a.md: behind",
    "        b.md: behind",
    "WARN  [breadcrumb] x.md: still in the tree",
  ]);
});

test("a failure is listed whole, however many there are, and before the grouped warnings", () => {
  const lines = findingLines([
    warn("links", "w.md: dangling"),
    { level: "fail", check: "links", evidence: "a.md: broken" },
    { level: "fail", check: "links", evidence: "b.md: broken" },
    { level: "fail", check: "links", evidence: "c.md: broken" },
  ]);
  assert.deepEqual(lines, [
    "FAIL  [links] a.md: broken",
    "FAIL  [links] b.md: broken",
    "FAIL  [links] c.md: broken",
    "WARN  [links] w.md: dangling",
  ]);
});
