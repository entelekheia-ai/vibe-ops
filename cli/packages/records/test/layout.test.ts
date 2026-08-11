import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { computeNumbering, findAuthority, findDir, findTemplate, listMarkdownBasenames } from "../src/layout.ts";
import { RecordsConfigError } from "../src/layout.ts";

async function scratchRepo(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), "vibeops-records-"));
}

test("findDir: the built-in search order, first candidate that exists", async () => {
  const repo = await scratchRepo();
  await mkdir(path.join(repo, "project", "plans"), { recursive: true });
  assert.deepEqual(findDir(repo, "plan", undefined), { dir: "project/plans" });
});

test("findDir: no candidate exists reports no directory, not an error", async () => {
  const repo = await scratchRepo();
  assert.deepEqual(findDir(repo, "plan", undefined), {});
});

test("findDir: a declared config override wins over the search order, when it resolves", async () => {
  const repo = await scratchRepo();
  await mkdir(path.join(repo, "project", "plans"), { recursive: true });
  await mkdir(path.join(repo, "custom-plans"), { recursive: true });
  assert.deepEqual(findDir(repo, "plan", { dirs: { plan: "custom-plans" } }), { dir: "custom-plans" });
});

test("findDir: a declared override that does not exist fails, naming it — never falls back to the search order", () => {
  assert.throws(
    () => findDir("/does/not/matter", "plan", { dirs: { plan: "nowhere" } }),
    (error: unknown) => error instanceof RecordsConfigError && /records\.dirs\.plan = "nowhere"/.test((error as Error).message),
  );
});

test("findTemplate: reports its provenance — config vs search", async () => {
  const repo = await scratchRepo();
  await mkdir(path.join(repo, "project", "templates"), { recursive: true });
  await writeFile(path.join(repo, "project", "templates", "plan.md"), "# x");
  assert.deepEqual(findTemplate(repo, "plan", undefined), { template: "project/templates/plan.md", source: "search" });

  await mkdir(path.join(repo, "plugin", "templates"), { recursive: true });
  await writeFile(path.join(repo, "plugin", "templates", "plan.md"), "# y");
  assert.deepEqual(findTemplate(repo, "plan", { templates: { plan: "plugin/templates/plan.md" } }), {
    template: "plugin/templates/plan.md",
    source: "config",
  });
});

test("findTemplate: a declared override that does not exist fails naming the config, not the search order", () => {
  assert.throws(
    () => findTemplate("/does/not/matter", "plan", { templates: { plan: "nowhere.md" } }),
    /records\.templates\.plan = "nowhere\.md"/,
  );
});

test("findAuthority: the record directory's own AGENTS.md wins over the governance rule", async () => {
  const repo = await scratchRepo();
  await mkdir(path.join(repo, "project", "plans"), { recursive: true });
  await writeFile(path.join(repo, "project", "plans", "AGENTS.md"), "# x");
  await mkdir(path.join(repo, ".agents", "rules"), { recursive: true });
  await writeFile(path.join(repo, ".agents", "rules", "governance.md"), "# y");
  assert.equal(findAuthority(repo, "project/plans"), "project/plans/AGENTS.md");
});

test("findAuthority: falls back to the governance rule when the directory has no AGENTS.md", async () => {
  const repo = await scratchRepo();
  await mkdir(path.join(repo, ".agents", "rules"), { recursive: true });
  await writeFile(path.join(repo, ".agents", "rules", "governance.md"), "# y");
  assert.equal(findAuthority(repo, undefined), ".agents/rules/governance.md");
});

test("findAuthority: (default) — undefined — when neither exists", async () => {
  const repo = await scratchRepo();
  assert.equal(findAuthority(repo, undefined), undefined);
});

test("listMarkdownBasenames: depth 1 sees only the directory's own files", async () => {
  const repo = await scratchRepo();
  await mkdir(path.join(repo, "rfc", "implemented"), { recursive: true });
  await writeFile(path.join(repo, "rfc", "001-a.md"), "");
  await writeFile(path.join(repo, "rfc", "implemented", "000-old.md"), "");
  assert.deepEqual(listMarkdownBasenames(path.join(repo, "rfc"), 1), ["001-a.md"]);
});

test("listMarkdownBasenames: depth 2 also sees one level of subdirectory — this is what an rfc's own subfolder needs", async () => {
  const repo = await scratchRepo();
  await mkdir(path.join(repo, "rfc", "implemented"), { recursive: true });
  await writeFile(path.join(repo, "rfc", "001-a.md"), "");
  await writeFile(path.join(repo, "rfc", "implemented", "000-old.md"), "");
  const found = listMarkdownBasenames(path.join(repo, "rfc"), 2).sort();
  assert.deepEqual(found, ["000-old.md", "001-a.md"]);
});

test("computeNumbering: an empty directory numbers from 1, at the default pad", () => {
  assert.deepEqual(computeNumbering([], 3), { pad: 3, existing: 0, next: "001" });
});

test("computeNumbering: AGENTS/README/INDEX/CONTRIBUTING are never counted as records", () => {
  assert.deepEqual(computeNumbering(["AGENTS.md", "README.md", "INDEX.md", "CONTRIBUTING.md"], 3), {
    pad: 3,
    existing: 0,
    next: "001",
  });
});

test("computeNumbering: the next number, and the pad width, come from the highest numbered record", () => {
  assert.deepEqual(computeNumbering(["001-a.md", "009-b.md"], 3), { pad: 3, existing: 2, next: "010" });
});

test("computeNumbering: a wider existing number widens the pad for the next one too", () => {
  assert.deepEqual(computeNumbering(["0009-a.md"], 3), { pad: 4, existing: 1, next: "0010" });
});

test("computeNumbering: records exist but none matches NNN-slug.md — unknown, not a confidently wrong guess", () => {
  assert.deepEqual(computeNumbering(["DA01-02-slug.md"], 3), { pad: 3, existing: 1, next: { unknown: true } });
});
