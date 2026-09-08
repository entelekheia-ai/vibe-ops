// Every shape `mirror` serves, each proven agreeing and diverging.
//
// One block per composed check. Together they are the claim that one gate covers all of them: two copies
// that are not byte-identical, a file against a digest column, a field read from two documents, a
// declared set against a directory, and a name that must resolve to a path.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import path from "node:path";
import { createDocumentStore } from "@entelekheia/vibe-ops-core";
import type { GateRunContext } from "@entelekheia/vibe-ops-core";
import mirror from "../src/mirror/index.ts";

async function repo(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), "vibeops-mirror-"));
}

function ctx(repoRoot: string, options: Record<string, unknown>, files: readonly string[] = []): GateRunContext {
  // `files` stays empty unless a source asks for a population by glob; subjects are read off disk by name.
  return { repoRoot, pluginDir: repoRoot, files, options, documents: createDocumentStore(repoRoot) };
}

const OWN = `<!--\n Copyright (c) 2026 Someone\n-->\n\n# Title\n\nbody\n`;
const SHIPPED = `# Title\n\nbody\n`;

test("a comparison naming no mode is refused at run time, not reported as clean", async () => {
  const repoRoot = await repo();
  await assert.rejects(() => mirror.run(ctx(repoRoot, {})), /options\.compare/);
});

test("zero comparisons is skipped, never a vacuous pass", async () => {
  const repoRoot = await repo();
  const outcome = await mirror.run(ctx(repoRoot, { compare: "text", pairs: [], subject: "the copies" }));
  assert.deepEqual(outcome.findings, []);
  assert.equal(outcome.examined, 0);
  assert.match(outcome.skipped ?? "", /zero comparisons is not a reading/);
});

// ── dogfooding-drift: two copies, treated text, not byte-identical ──────────────────────────────────

async function copies(repoRoot: string, own: string, shipped: string): Promise<void> {
  await mkdir(path.join(repoRoot, "ship"), { recursive: true });
  await writeFile(path.join(repoRoot, "own.md"), own);
  await writeFile(path.join(repoRoot, "ship", "own.md"), shipped);
}

const DOGFOOD = { compare: "text", pairs: [["own.md", "ship/own.md"]], ignore: ["copyright"], subject: "the dogfooded copies" };

test("dogfooding: the copies agree once the copyright block is out of the comparison", async () => {
  const repoRoot = await repo();
  await copies(repoRoot, OWN, SHIPPED);
  const outcome = await mirror.run(ctx(repoRoot, DOGFOOD));
  assert.deepEqual(outcome.findings, [], "a header the shipped copy must not carry is not drift");
  assert.equal(outcome.examined, 1);
});

test("dogfooding: without `ignore` that same pair diverges", async () => {
  const repoRoot = await repo();
  await copies(repoRoot, OWN, SHIPPED);
  const outcome = await mirror.run(ctx(repoRoot, { ...DOGFOOD, ignore: [] }));
  assert.equal(outcome.findings.length, 1);
});

test("dogfooding: a real edit to one copy and not the other is drift", async () => {
  const repoRoot = await repo();
  await copies(repoRoot, OWN, `# Title\n\nbody, edited here only\n`);
  const outcome = await mirror.run(ctx(repoRoot, DOGFOOD));
  assert.equal(outcome.findings.length, 1);
  assert.match(outcome.findings[0]!.evidence, /have diverged/);
});

// Frontmatter does not hide the block behind it.
test("dogfooding: frontmatter ahead of the block does not stop it being found", async () => {
  const repoRoot = await repo();
  await copies(repoRoot, `---\nv: 3\n---\n\n<!--\n Copyright (c) 2026 X\n-->\n\n# T\n`, `---\nv: 3\n---\n\n# T\n`);
  const outcome = await mirror.run(ctx(repoRoot, DOGFOOD));
  assert.deepEqual(outcome.findings, []);
});

test("dogfooding: the version inside frontmatter must still agree — that gap is real drift", async () => {
  const repoRoot = await repo();
  await copies(repoRoot, `---\nv: 3\n---\n\n# T\n`, `---\nv: 2\n---\n\n# T\n`);
  const outcome = await mirror.run(ctx(repoRoot, DOGFOOD));
  assert.equal(outcome.findings.length, 1, "frontmatter is emitted, so a version gap is drift");
});

// ── license-text: the list is discovered, and one side is a column ──────────────────────────────────

const LICENCE = "Apache License\nVersion 2.0\n";
const LICENSED = {
  compare: "sha",
  rows: { file: "licenses/SOURCES.tsv", format: "tsv" },
  left: { file: "licenses/${0}.txt" },
  right: { column: 2 },
  rule: "license-drift",
  subject: "the shipped licence",
};

async function registry(repoRoot: string, text: string, pin: string): Promise<void> {
  await mkdir(path.join(repoRoot, "licenses"), { recursive: true });
  await writeFile(path.join(repoRoot, "licenses", "apache-2.0.txt"), text);
  await writeFile(path.join(repoRoot, "licenses", "SOURCES.tsv"), `# id\turl\tsha256\napache-2.0\thttps://x.invalid\t${pin}\n`);
}

test("licence: a shipped text matching its pin passes, and the pair came from the registry", async () => {
  const repoRoot = await repo();
  await registry(repoRoot, LICENCE, createHash("sha256").update(LICENCE).digest("hex"));
  const outcome = await mirror.run(ctx(repoRoot, LICENSED));
  assert.deepEqual(outcome.findings, []);
  assert.equal(outcome.examined, 1, "the comment row must not be counted");
});

// `sha` hashes the file side and takes the column as the digest it already is.
test("licence: a paraphrased text fails against its pin", async () => {
  const repoRoot = await repo();
  await registry(repoRoot, "Apache License\nVersion 2.0, but reworded\n", createHash("sha256").update(LICENCE).digest("hex"));
  const outcome = await mirror.run(ctx(repoRoot, LICENSED));
  assert.equal(outcome.findings.length, 1);
  assert.equal(outcome.findings[0]!.rule, "license-drift");
});

test("licence: a row pinning a text that is not there says so, rather than reporting a difference", async () => {
  const repoRoot = await repo();
  await mkdir(path.join(repoRoot, "licenses"), { recursive: true });
  await writeFile(path.join(repoRoot, "licenses", "SOURCES.tsv"), `apache-2.0\thttps://x.invalid\tdeadbeef\n`);
  const outcome = await mirror.run(ctx(repoRoot, LICENSED));
  assert.equal(outcome.findings.length, 1);
  assert.match(outcome.findings[0]!.evidence, /named but not there/);
});

test("licence: an absent registry is skipped, not passed — nothing names what to compare", async () => {
  const repoRoot = await repo();
  const outcome = await mirror.run(ctx(repoRoot, LICENSED));
  assert.equal(outcome.examined, 0);
  assert.match(outcome.skipped ?? "", /nothing names what to compare/);
});

// ── manifest-sync: the same field, read from two documents ──────────────────────────────────────────

const MANIFEST = {
  compare: "text",
  left: { json: "version", in: "plugin.json" },
  right: { json: "version", in: "marketplace.json" },
  rule: "manifest-version-drift",
  subject: "the plugin version",
};

test("manifest: the same field agreeing in both documents passes", async () => {
  const repoRoot = await repo();
  await writeFile(path.join(repoRoot, "plugin.json"), JSON.stringify({ version: "0.9.0" }));
  await writeFile(path.join(repoRoot, "marketplace.json"), JSON.stringify({ version: "0.9.0" }));
  const outcome = await mirror.run(ctx(repoRoot, MANIFEST));
  assert.deepEqual(outcome.findings, []);
  assert.equal(outcome.examined, 1);
});

test("manifest: one bumped without the other is drift, named as the field rather than the file", async () => {
  const repoRoot = await repo();
  await writeFile(path.join(repoRoot, "plugin.json"), JSON.stringify({ version: "0.9.0" }));
  await writeFile(path.join(repoRoot, "marketplace.json"), JSON.stringify({ version: "0.8.0" }));
  const outcome = await mirror.run(ctx(repoRoot, MANIFEST));
  assert.equal(outcome.findings.length, 1);
  assert.equal(outcome.findings[0]!.rule, "manifest-version-drift");
  assert.match(outcome.findings[0]!.evidence, /the plugin version/);
});

test("manifest: a version captured from prose compares with one read from JSON", async () => {
  const repoRoot = await repo();
  await writeFile(path.join(repoRoot, "plugin.json"), JSON.stringify({ version: "0.9.0" }));
  await writeFile(path.join(repoRoot, "CHANGELOG.md"), `# Changelog\n\n## [Unreleased]\n\n## [0.8.0] — 2026-01-01\n`);
  const outcome = await mirror.run(
    ctx(repoRoot, {
      compare: "text",
      left: { json: "version", in: "plugin.json" },
      right: { capture: "^## \\[(?!Unreleased)([^\\]]+)\\]", in: "CHANGELOG.md" },
      subject: "the released version",
    }),
  );
  assert.equal(outcome.findings.length, 1, "0.9.0 shipped with no changelog entry naming it");
});

test("manifest: a CHANGELOG holding only Unreleased has not diverged from anything, and is not compared", async () => {
  const repoRoot = await repo();
  await writeFile(path.join(repoRoot, "plugin.json"), JSON.stringify({ version: "0.9.0" }));
  await writeFile(path.join(repoRoot, "CHANGELOG.md"), `# Changelog\n\n## [Unreleased]\n\nnothing shipped yet\n`);
  const outcome = await mirror.run(
    ctx(repoRoot, {
      compare: "text",
      left: { json: "version", in: "plugin.json" },
      right: { capture: "^## \\[(?!Unreleased)([^\\]]+)\\]", in: "CHANGELOG.md", optional: true },
      subject: "the released version",
    }),
  );
  assert.deepEqual(outcome.findings, [], "a repository that has never cut a release must not fail this comparison forever");
});

test("manifest: an optional side missing its file entirely is also not a finding", async () => {
  const repoRoot = await repo();
  await writeFile(path.join(repoRoot, "plugin.json"), JSON.stringify({ version: "0.9.0" }));
  const outcome = await mirror.run(
    ctx(repoRoot, {
      compare: "text",
      left: { json: "version", in: "plugin.json" },
      right: { capture: "^## \\[(?!Unreleased)([^\\]]+)\\]", in: "CHANGELOG.md", optional: true },
      subject: "the released version",
    }),
  );
  assert.deepEqual(outcome.findings, []);
});

// ── manifest-sync: a field selected from the ONE entry of an array that names this plugin ───────────

const MANIFEST_SELECT = {
  compare: "text",
  left: { json: "version", in: "plugin.json" },
  right: {
    jsonSelect: {
      array: "plugins",
      match: { field: "name", from: "plugin.json", json: "name" },
      field: "version",
    },
    in: "marketplace.json",
  },
  rule: "manifest-version-drift",
  subject: "the plugin version",
};

test("manifest: a field read from the marketplace entry this plugin's own name selects agrees", async () => {
  const repoRoot = await repo();
  await writeFile(path.join(repoRoot, "plugin.json"), JSON.stringify({ name: "vibe-ops", version: "0.9.0" }));
  await writeFile(
    path.join(repoRoot, "marketplace.json"),
    JSON.stringify({ plugins: [{ name: "other-plugin", version: "1.0.0" }, { name: "vibe-ops", version: "0.9.0" }] }),
  );
  const outcome = await mirror.run(ctx(repoRoot, MANIFEST_SELECT));
  assert.deepEqual(outcome.findings, []);
});

test("manifest: the marketplace entry this plugin's name selects has drifted", async () => {
  const repoRoot = await repo();
  await writeFile(path.join(repoRoot, "plugin.json"), JSON.stringify({ name: "vibe-ops", version: "0.9.0" }));
  await writeFile(
    path.join(repoRoot, "marketplace.json"),
    JSON.stringify({ plugins: [{ name: "vibe-ops", version: "0.8.0" }] }),
  );
  const outcome = await mirror.run(ctx(repoRoot, MANIFEST_SELECT));
  assert.equal(outcome.findings.length, 1);
  assert.match(outcome.findings[0]!.evidence, /the plugin version/);
});

test("manifest: a name that selects no entry is reported as absent, not compared against nothing", async () => {
  const repoRoot = await repo();
  await writeFile(path.join(repoRoot, "plugin.json"), JSON.stringify({ name: "vibe-ops", version: "0.9.0" }));
  await writeFile(path.join(repoRoot, "marketplace.json"), JSON.stringify({ plugins: [{ name: "other-plugin", version: "1.0.0" }] }));
  const outcome = await mirror.run(ctx(repoRoot, MANIFEST_SELECT));
  assert.equal(outcome.findings.length, 1);
  assert.match(outcome.findings[0]!.evidence, /is named but not there/);
});

test("manifest: renaming the plugin moves which entry is selected, rather than passing silently against a stale index", async () => {
  const repoRoot = await repo();
  await writeFile(path.join(repoRoot, "plugin.json"), JSON.stringify({ name: "renamed-plugin", version: "0.9.0" }));
  await writeFile(
    path.join(repoRoot, "marketplace.json"),
    JSON.stringify({
      plugins: [
        { name: "renamed-plugin", version: "0.9.0" },
        { name: "unrelated-plugin", version: "9.9.9" },
      ],
    }),
  );
  const outcome = await mirror.run(ctx(repoRoot, MANIFEST_SELECT));
  assert.deepEqual(outcome.findings, [], "the entry selected followed the rename, not a fixed position");
});

// ── hooks-registration: a declared set against the scripts on disk, both ways ───────────────────────

const HOOKS = {
  compare: "group",
  left: { json: "hooks", in: "hooks/hooks.json" },
  right: { entries: "hooks", kind: "file" },
  bothWays: true,
  rule: "hooks-registration",
  subject: "the hook registration",
};

test("hooks: a registration matching the scripts on disk passes", async () => {
  const repoRoot = await repo();
  await mkdir(path.join(repoRoot, "hooks"), { recursive: true });
  await writeFile(path.join(repoRoot, "hooks", "a.sh"), "#\n");
  await writeFile(path.join(repoRoot, "hooks", "hooks.json"), JSON.stringify({ hooks: ["a.sh", "hooks.json"] }));
  const outcome = await mirror.run(ctx(repoRoot, HOOKS));
  assert.deepEqual(outcome.findings, []);
});

test("hooks: a registered script that is not there, and a script nobody registered, are both reported", async () => {
  const repoRoot = await repo();
  await mkdir(path.join(repoRoot, "hooks"), { recursive: true });
  await writeFile(path.join(repoRoot, "hooks", "orphan.sh"), "#\n");
  await writeFile(path.join(repoRoot, "hooks", "hooks.json"), JSON.stringify({ hooks: ["ghost.sh"] }));
  const outcome = await mirror.run(ctx(repoRoot, HOOKS));
  const evidence = outcome.findings.map((finding) => finding.evidence).join("\n");
  assert.match(evidence, /ghost\.sh/, "a registration naming nothing on disk is a dead entry");
  assert.match(evidence, /orphan\.sh/, "a script no event fires is dead code that looks live");
});

test("hooks: one direction only, when the ops does not ask for both", async () => {
  const repoRoot = await repo();
  await mkdir(path.join(repoRoot, "hooks"), { recursive: true });
  await writeFile(path.join(repoRoot, "hooks", "orphan.sh"), "#\n");
  await writeFile(path.join(repoRoot, "hooks", "hooks.json"), JSON.stringify({ hooks: [] }));
  const outcome = await mirror.run(ctx(repoRoot, { ...HOOKS, bothWays: false }));
  assert.deepEqual(outcome.findings, [], "left is empty, so left-minus-right is empty");
});

// ── authoring-completeness and the reference checks: named, then resolved ───────────────────────────

test("authoring: a package whose authoring file is missing is reported by name", async () => {
  const repoRoot = await repo();
  await mkdir(path.join(repoRoot, "packages", "governance-adr"), { recursive: true });
  await mkdir(path.join(repoRoot, "packages", "governance-rfc"), { recursive: true });
  await writeFile(path.join(repoRoot, "packages", "governance-adr", "authoring.md"), "rules\n");

  const outcome = await mirror.run(
    ctx(repoRoot, {
      compare: "group",
      left: { entries: "packages", kind: "dir" },
      right: { resolving: "packages/${0}/authoring.md" },
      rule: "authoring-missing",
      subject: "the authoring rules",
    }),
  );
  assert.equal(outcome.findings.length, 1);
  assert.match(outcome.findings[0]!.evidence, /governance-rfc/);
});

test("reference: a path named in prose that does not resolve is reported; one that does is not", async () => {
  const repoRoot = await repo();
  await mkdir(path.join(repoRoot, "templates"), { recursive: true });
  await writeFile(path.join(repoRoot, "templates", "real.md"), "x\n");
  await writeFile(
    path.join(repoRoot, "SKILL.md"),
    "Copy `${CLAUDE_PLUGIN_ROOT}/templates/real.md` and `${CLAUDE_PLUGIN_ROOT}/templates/ghost.md`.\n",
  );

  const outcome = await mirror.run(
    ctx(
      repoRoot,
      {
        compare: "group",
        left: { scan: "\\$\\{CLAUDE_PLUGIN_ROOT\\}/([A-Za-z0-9_./-]+)", in: ["**/*.md"] },
        right: { resolving: "${0}" },
        rule: "plugin-root-path",
        subject: "a path this plugin ships",
      },
      ["SKILL.md"],
    ),
  );
  assert.equal(outcome.findings.length, 1);
  assert.match(outcome.findings[0]!.evidence, /templates\/ghost\.md/);
  assert.doesNotMatch(outcome.findings[0]!.evidence, /real\.md/);
});

test("reference: a population with no occurrence of the pattern reports nothing rather than failing", async () => {
  const repoRoot = await repo();
  await writeFile(path.join(repoRoot, "SKILL.md"), "no references here\n");
  const outcome = await mirror.run(
    ctx(
      repoRoot,
      {
        compare: "group",
        left: { scan: "\\$\\{CLAUDE_PLUGIN_ROOT\\}/([A-Za-z0-9_./-]+)", in: ["**/*.md"] },
        right: { resolving: "${0}" },
        subject: "a path this plugin ships",
      },
      ["SKILL.md"],
    ),
  );
  assert.deepEqual(outcome.findings, []);
});
