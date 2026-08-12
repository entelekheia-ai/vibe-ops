import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import records from "../src/index.ts";
import { formatCensus, type CensusEntry } from "../src/census.ts";

async function write(repo: string, file: string, text: string): Promise<void> {
  await mkdir(path.join(repo, path.dirname(file)), { recursive: true });
  await writeFile(path.join(repo, file), text, "utf8");
}

/** A repository with all five surfaces populated, including the two declaration forms and one absence. */
async function fixture(): Promise<string> {
  const repo = await mkdtemp(path.join(tmpdir(), "vibeops-census-"));
  await write(repo, "project/adr/0001-a.md", "---\nvibe-ops-template: adr@2\n---\n\n# A\n");
  await write(repo, "project/rfc/0001-r.md", "---\nvibe-ops-template: rfc@2\n---\n\n# R\n");
  await write(repo, "project/plans/004-old.md", "<!-- vibe-ops-template plan@0.1 -->\n\n# Old\n");
  await write(repo, "project/plans/shipped/001-done.md", "---\nvibe-ops-template: plan@3\n---\n\n# Done\n");
  await write(repo, "project/plans/009-bare.md", "# Bare\n\nNo declaration anywhere in this one.\n");
  await write(repo, "project/tasks/006-t.md", "---\nvibe-ops-template: task@3\n---\n\n# T\n");
  await write(repo, "project/log/a-trap.md", "---\nvibe-ops-template: log@2\n---\n\n# Trap\n");
  // Not records: the generated index, and a README that discusses the token in prose. A substring query
  // counts the second as declared; this one must not.
  await write(repo, "project/log/README.md", "# Log\n\nEntries carry vibe-ops-template log@2.\n");
  await write(repo, "project/adr/README.md", "# ADRs\n");
  return repo;
}

async function run(repo: string, command: string, flags: Record<string, string | boolean> = {}) {
  const lines: string[] = [];
  const result = await records.run({
    repoRoot: repo,
    flags,
    command,
    args: [],
    config: {},
    settings: undefined,
    surface: "cli",
    log: (message) => lines.push(message),
    warn: () => {},
  });
  return { result, lines };
}

test("census walks all five record surfaces, including project/log/ and plans/shipped/", async () => {
  const { result } = await run(await fixture(), "census", { json: true });
  assert.equal(result.code, 0);
  const entries = result.data as readonly CensusEntry[];
  assert.deepEqual(
    entries.map((entry) => entry.file),
    [
      "project/adr/0001-a.md",
      "project/rfc/0001-r.md",
      "project/plans/004-old.md",
      "project/plans/009-bare.md",
      "project/plans/shipped/001-done.md",
      "project/tasks/006-t.md",
      "project/log/a-trap.md",
    ],
  );
});

test("both declaration forms are read, and which form carried it is reported", async () => {
  const { result } = await run(await fixture(), "census", { json: true });
  const entries = result.data as readonly CensusEntry[];
  const comment = entries.find((entry) => entry.file === "project/plans/004-old.md");
  const frontmatter = entries.find((entry) => entry.file === "project/plans/shipped/001-done.md");
  assert.deepEqual(comment, { file: "project/plans/004-old.md", type: "plan", declared: "plan@0.1", source: "comment" });
  assert.equal(frontmatter?.declared, "plan@3");
  assert.equal(frontmatter?.source, "frontmatter");
});

test("a record declaring nothing is unknown — never resolved to the oldest known version", async () => {
  const { result, lines } = await run(await fixture(), "census");
  const entries = result.data as readonly CensusEntry[];
  const bare = entries.find((entry) => entry.file === "project/plans/009-bare.md");
  assert.equal(bare?.declared, undefined);
  assert.match(lines.join("\n"), /009-bare\.md\s+\(unknown\)/);
  assert.doesNotMatch(lines.join("\n"), /009-bare\.md\s+plan@0\.1/);
});

test("a README mentioning the token in prose is not counted as a record", async () => {
  const { result } = await run(await fixture(), "census", { json: true });
  const entries = result.data as readonly CensusEntry[];
  assert.equal(entries.filter((entry) => entry.file.endsWith("README.md")).length, 0);
});

test("the tail counts the population by declaration, with unknown printed even at zero", () => {
  const entries: readonly CensusEntry[] = [
    { file: "project/adr/0001-a.md", type: "adr", declared: "adr@2", source: "frontmatter" },
    { file: "project/adr/0002-b.md", type: "adr", declared: "adr@2", source: "frontmatter" },
  ];
  const tail = formatCensus(entries).join("\n");
  assert.match(tail, /^2 records$/m);
  assert.match(tail, /adr@2\s+2/);
  assert.match(tail, /\(unknown\)\s+0/);
  // No score, no grade: this repository reports what it saw.
  assert.doesNotMatch(tail, /score|grade|health|%/i);
});

test("the census output is byte-identical run to run", async () => {
  const repo = await fixture();
  const first = await run(repo, "census");
  const second = await run(repo, "census");
  assert.deepEqual(first.lines, second.lines);
});

test("census does not require --type, and --type still works without census", async () => {
  const repo = await fixture();
  const censused = await run(repo, "census", { json: true });
  assert.equal(censused.result.code, 0);
  const resolved = await run(repo, "resolve", { type: "adr" });
  assert.equal(resolved.result.code, 0);
  assert.equal((resolved.result.data as { type: string }).type, "adr");
});

test("a repository with no record directories reports zero rather than failing", async () => {
  const repo = await mkdtemp(path.join(tmpdir(), "vibeops-census-empty-"));
  const { result, lines } = await run(repo, "census");
  assert.equal(result.code, 0);
  assert.deepEqual(result.data, []);
  assert.match(lines.join("\n"), /no record directories/);
});
