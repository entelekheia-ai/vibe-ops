import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { createDocumentStore } from "@entelekheia/vibe-ops-core";
import { groupOf, logIndex, logLint, logSweep, preambleOf, readLogEntries } from "../src/log.ts";
import { readFrontmatter } from "@entelekheia/governance-base";

const ENTRY = (over: Partial<Record<string, string>> = {}) =>
  [
    "---",
    `name: ${over.name ?? "a-thing-that-was-tried"}`,
    `description: ${over.description ?? "One line."}`,
    `kind: ${over.kind ?? "trap"}`,
    "path:",
    `  - "${over.path ?? "cli/packages/core/package.json"}"`,
    `attempted: ${over.attempted ?? "2026-08-10"}`,
    "source: project/tasks/001-x.md",
    "---",
    "",
    "# The trap",
    "",
  ].join("\n");

async function repoWith(files: Record<string, string>): Promise<string> {
  const repo = await mkdtemp(path.join(tmpdir(), "vibeops-log-"));
  execFileSync("git", ["init", "-q"], { cwd: repo });
  execFileSync("git", ["config", "user.email", "t@example.invalid"], { cwd: repo });
  execFileSync("git", ["config", "user.name", "T"], { cwd: repo });
  for (const [file, content] of Object.entries(files)) {
    await mkdir(path.join(repo, path.dirname(file)), { recursive: true });
    await writeFile(path.join(repo, file), content);
  }
  execFileSync("git", ["add", "."], { cwd: repo });
  execFileSync("git", ["commit", "-q", "-m", "seed"], { cwd: repo });
  return repo;
}

function entriesOf(repo: string) {
  return readLogEntries(createDocumentStore(repo), repo, "project/log");
}

test("frontmatter: a folded description is one value, not its first line", async () => {
  // The failure a line reader has here is silent: a truncated sentence still reads like a sentence, and
  // it becomes the index row and the text a hook injects.
  const repo = await repoWith({
    "project/log/x.md": [
      "---",
      "name: x",
      "description: Two tree-sitter grammar packages declare peer ranges that do not",
      "             intersect; npm install ERESOLVEs until the runtime is pinned.",
      "kind: debt",
      "path:",
      '  - "a/b/package.json"',
      '  - "a/b/npm-shrinkwrap.json"',
      "attempted: 2026-08-10",
      "---",
      "",
      "# T",
      "",
    ].join("\n"),
  });
  const frontmatter = readFrontmatter(createDocumentStore(repo).get("project/log/x.md"));
  assert.equal(
    frontmatter?.scalars.get("description"),
    "Two tree-sitter grammar packages declare peer ranges that do not intersect; npm install ERESOLVEs until the runtime is pinned.",
  );
  assert.deepEqual(frontmatter?.lists.get("path"), ["a/b/package.json", "a/b/npm-shrinkwrap.json"]);
});

test("frontmatter: a fenced yaml block further down the file is not the document's metadata", async () => {
  const repo = await repoWith({
    "project/log/x.md": ["# No frontmatter here", "", "```yaml", "name: not-the-metadata", "```", ""].join("\n"),
  });
  assert.equal(readFrontmatter(createDocumentStore(repo).get("project/log/x.md")), undefined);
});

test("lint: the four shapes new-log's checklist names", async () => {
  const repo = await repoWith({
    "project/log/right.md": ENTRY({ name: "right" }),
    "project/log/renamed.md": ENTRY({ name: "the-old-slug" }),
    "project/log/bad-kind.md": ENTRY({ name: "bad-kind", kind: "note" }),
    "project/log/guessed.md": ENTRY({ name: "guessed", attempted: "soon" }),
    "project/log/stateful.md": ENTRY({ name: "stateful" }).replace("kind: trap", "kind: trap\nstatus: open"),
    "project/log/README.md": "# project/log/\n",
  });

  const byRule = new Map(logLint(entriesOf(repo)).map((f) => [f.rule, f.file]));
  assert.equal(byRule.get("name-mismatch"), "project/log/renamed.md");
  assert.equal(byRule.get("kind-invalid"), "project/log/bad-kind.md");
  assert.equal(byRule.get("attempted-invalid"), "project/log/guessed.md");
  assert.equal(byRule.get("status-present"), "project/log/stateful.md");
  assert.ok(!logLint(entriesOf(repo)).some((f) => f.file === "project/log/right.md"));
});

test("lint: an entry with neither path nor relatedTo fails the admission test", async () => {
  const repo = await repoWith({
    "project/log/nowhere.md": ["---", "name: nowhere", "description: d", "kind: trap", "attempted: 2026-08-10", "---", "", "# T", ""].join("\n"),
  });
  const findings = logLint(entriesOf(repo));
  assert.equal(findings.length, 1);
  assert.equal(findings[0]?.rule, "no-recurrence-surface");
});

test("lint: README.md and RETIRED.md are not entries and are never linted", async () => {
  const repo = await repoWith({
    "project/log/README.md": "# project/log/\n",
    "project/log/RETIRED.md": "# retired\n",
  });
  assert.deepEqual(entriesOf(repo), []);
  assert.deepEqual(logLint(entriesOf(repo)), []);
});

test("sweep: an entry whose every path stopped resolving is a candidate; one that still resolves is not", async () => {
  const repo = await repoWith({
    "a/b/package.json": "{}\n",
    "project/log/alive.md": ENTRY({ name: "alive", path: "a/b/package.json" }),
    "project/log/gone.md": ENTRY({ name: "gone", path: "deleted/thing/*.ts" }),
  });
  const retirable = logSweep(repo, entriesOf(repo));
  assert.equal(retirable.length, 1);
  assert.equal(retirable[0]?.file, "project/log/gone.md");
  assert.deepEqual(retirable[0]?.unresolved, ["deleted/thing/*.ts"]);
});

test("sweep: an entry with only relatedTo is never swept — it names no path that could go missing", async () => {
  const repo = await repoWith({
    "project/log/tool.md": ["---", "name: tool", "description: d", "kind: trap", "relatedTo: some-cli", "attempted: 2026-08-10", "---", "", "# T", ""].join("\n"),
  });
  assert.deepEqual(logSweep(repo, entriesOf(repo)), []);
});

test("sweep: an entry keeping one live path among several is not retirable", async () => {
  const repo = await repoWith({
    "a/b/package.json": "{}\n",
    "project/log/half.md": [
      "---",
      "name: half",
      "description: d",
      "kind: trap",
      "path:",
      '  - "a/b/package.json"',
      '  - "gone/thing.json"',
      "attempted: 2026-08-10",
      "---",
      "",
      "# T",
      "",
    ].join("\n"),
  });
  assert.deepEqual(logSweep(repo, entriesOf(repo)), []);
});

test("groupOf: the group is derived from the path, up to its first globbed segment", async () => {
  const repo = await repoWith({
    "project/log/file.md": ENTRY({ name: "file", path: "cli/packages/core/package.json" }),
    "project/log/glob.md": ENTRY({ name: "glob", path: "cli/packages/**" }),
    "project/log/root.md": ENTRY({ name: "root", path: "*.md" }),
  });
  const byName = new Map(entriesOf(repo).map((e) => [e.name, groupOf(e)]));
  assert.equal(byName.get("file"), "cli/packages/core/");
  assert.equal(byName.get("glob"), "cli/packages/");
  assert.equal(byName.get("root"), "(repository root)");
});

test("index: the author's preamble is copied through, and everything from the first H2 down is generated", async () => {
  const preamble = "# project/log/\n\nOne entry per trap, addressed by the path where someone meets it again.\n";
  const repo = await repoWith({
    "project/log/README.md": `${preamble}\n## \`stale/group/\`\n\n- [\`gone.md\`](gone.md) — a row for an entry that no longer exists\n`,
    "project/log/a-thing.md": ENTRY({ name: "a-thing", description: "It was tried and it did not work." }),
  });
  const store = createDocumentStore(repo);
  const generated = logIndex(entriesOf(repo), preambleOf(store.get("project/log/README.md")));

  assert.ok(generated.startsWith(preamble.trimEnd()), "the prose above the first H2 is the author's");
  assert.match(generated, /## `cli\/packages\/core\/`/);
  assert.match(generated, /- \[`a-thing\.md`\]\(a-thing\.md\) — It was tried and it did not work\./);
  assert.doesNotMatch(generated, /stale\/group/, "and the stale group is gone, which is the point of generating it");
});

test("index: the row carries the entry's own description, wrapped, not a paraphrase of it", async () => {
  const long =
    "Two tree-sitter grammar packages in cli/packages/core/ declare peer ranges for the tree-sitter runtime that do not intersect; npm install ERESOLVEs until the runtime is pinned exactly.";
  const repo = await repoWith({
    "project/log/README.md": "# project/log/\n",
    "project/log/a-thing.md": ENTRY({ name: "a-thing", description: long }),
  });
  const store = createDocumentStore(repo);
  const generated = logIndex(entriesOf(repo), preambleOf(store.get("project/log/README.md")));

  // Reassembling the wrapped row must give back the description exactly — this is the property that
  // makes the index derived rather than a second, drifting copy of it.
  const row = generated.slice(generated.indexOf("- [`a-thing.md`]"));
  const text = row.replace("- [`a-thing.md`](a-thing.md) — ", "").split(/\s+/).join(" ").trim();
  assert.equal(text, long);
  for (const line of row.split("\n")) assert.ok(line.length <= 110, `line too long: ${line}`);
});

// Plan-030 Track 2. A block scalar's header is syntax, not value: without stripping it the description
// travels as `>- the actual sentence` into the generated index and into every hook that injects one.
// Found by `project/log/README.md` rendering exactly that, on a real entry.
test("readFrontmatter strips a block scalar's header rather than folding it into the value", async () => {
  const repo = await mkdtemp(path.join(tmpdir(), "vibeops-frontmatter-"));
  const file = "entry.md";
  await writeFile(
    path.join(repo, file),
    ["---", "name: x", "description: >-", "  first line", "  second line", "kind: trap", "---", "", "# x", ""].join("\n"),
  );
  const frontmatter = readFrontmatter(createDocumentStore(repo).get(file));
  assert.equal(frontmatter?.scalars.get("description"), "first line second line");
  assert.deepEqual(frontmatter?.keys, ["name", "description", "kind"]);
});

// A leading backtick is a RESERVED INDICATOR in YAML — a plain scalar may not start with one, so the
// parse dies at that line and every key below it is silently dropped. That is what took four keys off a
// real log entry and kept it out of the index entirely.
test("a plain scalar opening with a backtick breaks the parse — the block form is what carries it", async () => {
  const repo = await mkdtemp(path.join(tmpdir(), "vibeops-frontmatter-"));
  await writeFile(
    path.join(repo, "broken.md"),
    ["---", "name: x", "description: `code` leads", "kind: trap", "---", "", "# x", ""].join("\n"),
  );
  await writeFile(
    path.join(repo, "fixed.md"),
    ["---", "name: x", "description: >-", "  `code` leads", "kind: trap", "---", "", "# x", ""].join("\n"),
  );
  const store = createDocumentStore(repo);
  assert.ok(!readFrontmatter(store.get("broken.md"))!.keys.includes("kind"), "the parse stops at the backtick");
  assert.ok(readFrontmatter(store.get("fixed.md"))!.keys.includes("kind"), "the block form parses through");
});
