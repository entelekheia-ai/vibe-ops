import { test } from "node:test";
import assert from "node:assert/strict";
import { planModeGuidance } from "../src/context-text.ts";
import type { ResolvedRecord } from "@entelekheia/governance-base";

function baseResolved(overrides: Partial<ResolvedRecord> = {}): ResolvedRecord {
  return {
    type: "plan",
    root: "/repo",
    dir: "project/plans",
    template: "project/templates/plan.md",
    templateSource: "search",
    authority: undefined,
    pad: 3,
    existing: 10,
    next: "011",
    plan: { active: "In Progress", terminal: "Shipped", living: ["Decision Log", "Outcomes & Retrospective"] },
    ...overrides,
  };
}

test("empty string when there is no directory or no template — the caller's cue not to fire", () => {
  assert.equal(planModeGuidance(baseResolved({ dir: undefined })), "");
  assert.equal(planModeGuidance(baseResolved({ template: undefined })), "");
});

test("names the resolved LIVING sections — this is defect 1's fix: the shell never read them at all", () => {
  const text = planModeGuidance(baseResolved());
  assert.match(text, /the living sections \(Decision Log, Outcomes & Retrospective\)/);
  assert.doesNotMatch(text, /Progress, Surprises & Discoveries/, "the old hardcoded plan@0.1 prose must not survive");
});

test("no LIVING resolved points at the template instead of guessing a list", () => {
  const text = planModeGuidance(baseResolved({ plan: { active: "In Progress", terminal: "Shipped", living: undefined } }));
  assert.match(text, /check the template's own LIVING SECTIONS divider/);
});

test("names the next plan number", () => {
  assert.match(planModeGuidance(baseResolved()), /next plan number in this repository is 011/);
});

test("an unknown NEXT (unnumbered records) says so instead of inventing one", () => {
  const text = planModeGuidance(baseResolved({ next: { unknown: true } }));
  assert.match(text, /\(unknown — see AUTHORITY\)/);
});

test("no Repository row when the project dir matches the resolved root", () => {
  const text = planModeGuidance(baseResolved(), "/repo");
  assert.doesNotMatch(text, /Repository/);
});

test("the Repository row appears only when the session's project dir differs from the resolved root", () => {
  const text = planModeGuidance(baseResolved(), "/workspace-root");
  assert.match(text, /\| Repository \| \/repo \|/);
  assert.match(text, /routing metadata, not part of the record/);
});

test("no projectDir given at all — single-repo session — never mentions Repository", () => {
  assert.doesNotMatch(planModeGuidance(baseResolved()), /Repository/);
});
