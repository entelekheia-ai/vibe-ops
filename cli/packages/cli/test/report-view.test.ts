// The report block is drawn for a person, so its tests pin what a person relies on — the worst group
// first, nothing dropped, and the module's own summary last and untouched — rather than its exact look.

import { test } from "node:test";
import assert from "node:assert/strict";
import type { Report } from "@entelekheia/vibe-ops-core";
import { renderReport } from "../src/report-view.ts";
import type { Paint } from "../src/report-view.ts";

const plain: Paint = (_style, text) => text;

const report: Report = {
  findings: [
    { id: "template-version-behind", level: "warn", evidence: "project/plans/008.md:1: declares plan@0.1" },
    { id: "memory-slugs", level: "fail", evidence: "names a memory slug", file: "docs/guide.md", line: 14 },
    { id: "template-version-behind", level: "warn", evidence: "project/tasks/003.md:1: declares task@0.1" },
  ],
  skipped: [{ id: "file-path", reason: "the private layer" }],
};

const header = { title: "vibe-ops check", where: "vibe-ops", summary: "70 checks, 1 failed", code: 1 };

test("counts every state, including the skips it does not list", () => {
  const lines = renderReport(report, header, plain);
  assert.ok(lines.some((line) => line.includes("1 fail") && line.includes("2 warn") && line.includes("1 skip")));
  assert.equal(lines.some((line) => line.includes("the private layer")), false);
});

test("failures come before warnings, and a group of several says how many", () => {
  const text = renderReport(report, header, plain).join("\n");
  assert.ok(text.indexOf("memory-slugs") < text.indexOf("template-version-behind"));
  assert.match(text, /template-version-behind \(2\)/);
  assert.match(text, /docs\/guide\.md:14/);
  assert.ok(text.includes("project/tasks/003.md:1: declares task@0.1"));
});

test("a group with one failing entry is drawn as a failure", () => {
  const mixed: Report = {
    findings: [
      { id: "g", level: "warn", evidence: "first" },
      { id: "g", level: "fail", evidence: "second" },
    ],
    skipped: [],
  };
  const lines = renderReport(mixed, header, plain);
  assert.ok(lines.some((line) => /✖ g \(2\)/.test(line)));
});

test("the last line is the module's summary, verbatim, behind one glyph", () => {
  const lines = renderReport(report, header, plain).filter((line) => line.trim() !== "");
  assert.equal(lines.at(-1), `  ✖ ${header.summary}`);
  const clean = renderReport({ findings: [], skipped: [] }, { ...header, summary: "70 checks, 0 failed", code: 0 }, plain);
  assert.equal(clean.filter((line) => line.trim() !== "").at(-1), "  ✔ 70 checks, 0 failed");
});

test("with a painter that does not paint, no escape byte reaches the lines", () => {
  assert.equal(renderReport(report, header, plain).join("\n").includes("\x1b"), false);
});
