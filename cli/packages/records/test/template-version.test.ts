// The reason this reader exists is a wrong measurement, so the case that produced it is the first test:
// a plan whose PROSE mentions a version and whose header declares none must read as undeclared. The
// other assertions are the two forms, their precedence, and the refusal to infer.

import { test } from "node:test";
import assert from "node:assert/strict";
import { documentFromText } from "@entelekheia/vibe-ops-core";
import { readTemplateVersion } from "../src/template-version.ts";

const read = (text: string) => readTemplateVersion(documentFromText("plan.md", text));

test("reads the frontmatter declaration", () => {
  const declared = read(["---", "vibe-ops-template: plan@3", "---", "", "# Plan-012: Title"].join("\n"));
  assert.deepEqual(declared, { type: "plan", version: "3", source: "frontmatter" });
});

test("reads the pre-frontmatter comment, and says which form carried it", () => {
  const declared = read(
    ["<!-- vibe-ops-template plan@0.2 — KEEP THIS LINE. -->", "", "# Plan-009: Title"].join("\n"),
  );
  assert.deepEqual(declared, { type: "plan", version: "0.2", source: "comment" });
});

test("frontmatter wins over a comment left behind mid-migration", () => {
  const declared = read(
    [
      "---",
      "vibe-ops-template: plan@3",
      "---",
      "",
      "<!-- vibe-ops-template plan@0.2 — KEEP THIS LINE. -->",
      "",
      "# Plan-012: Title",
    ].join("\n"),
  );
  assert.equal(declared?.version, "3");
  assert.equal(declared?.source, "frontmatter");
});

// The measured false positive: `grep`-shaped detection over the whole file counted this as declared, and
// the repository's undeclared population came back smaller than it is.
test("a version mentioned in prose is NOT a declaration", () => {
  const declared = read(
    [
      "# Plan-008: Quiet the nudge",
      "",
      "## Design",
      "",
      "Every plan written against `plan@0.2` carries a Progress section, and",
      "`<!-- vibe-ops-template plan@0.2 -->` is what declares it.",
    ].join("\n"),
  );
  assert.equal(declared, undefined);
});

test("a record declaring nothing is undefined — never resolved to the oldest known version", () => {
  assert.equal(read(["# ADR-0001: Something", "", "A decision."].join("\n")), undefined);
});

test("a malformed declaration is undefined rather than half-parsed", () => {
  assert.equal(read(["---", "vibe-ops-template: plan", "---", "", "# Plan: Title"].join("\n")), undefined);
  assert.equal(read(["---", "vibe-ops-template: '@3'", "---", "", "# Plan: Title"].join("\n")), undefined);
});

test("an unparseable document cannot be anchored, so it reads as undeclared", () => {
  // No grammar for the extension → no tree → no header region to anchor the comment form against.
  const declared = readTemplateVersion(
    documentFromText("plan.bin", "<!-- vibe-ops-template plan@0.2 -->\n\n# Plan: Title"),
  );
  assert.equal(declared, undefined);
});

test("every record type's own token is read, not just plan's", () => {
  for (const [type, version] of [
    ["adr", "2"],
    ["rfc", "2"],
    ["task", "3"],
    ["log", "2"],
  ] as const) {
    const declared = readTemplateVersion(
      documentFromText(`${type}.md`, `---\nvibe-ops-template: ${type}@${version}\n---\n\n# Title`),
    );
    assert.deepEqual(declared, { type, version, source: "frontmatter" });
  }
});
