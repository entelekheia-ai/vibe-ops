import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { parseTypeUnit, resolveTypeUnit } from "../src/type-unit.ts";
import { RecordsConfigError } from "../src/layout.ts";

async function scratchRepo(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), "vibeops-type-unit-"));
}

const VALID_MANIFEST = JSON.stringify({
  type: "policy",
  template: "../../templates/policy.md",
  authoring: "../../references/records/policy.md",
  migrations: "../../skills/migrate/migrations",
  schema: { carrier: "table", required: ["Status"] },
});

/** Writes `<root>/types/<type>/type.json` plus, optionally, the template it points at. */
async function withUnit(root: string, type: string, manifest: string, withTemplate = false): Promise<void> {
  const dir = path.join(root, "types", type);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "type.json"), manifest);
  if (withTemplate) {
    await mkdir(path.join(root, "templates"), { recursive: true });
    await writeFile(path.join(root, "templates", `${type}.md`), "# template\n");
  }
}

test("parseTypeUnit: applies defaults for numbered/pad/depth/dirs when absent", () => {
  const unit = parseTypeUnit(VALID_MANIFEST, "/x/type.json");
  assert.equal(unit.numbered, true);
  assert.equal(unit.pad, 3);
  assert.equal(unit.depth, 1);
  assert.deepEqual(unit.dirs, ["project/policy", "policy", "docs/policy"]);
});

test("parseTypeUnit: a required field missing throws RecordsConfigError naming the file and field", () => {
  const broken = JSON.stringify({ type: "policy", template: "x.md" });
  assert.throws(
    () => parseTypeUnit(broken, "/x/type.json"),
    (error: unknown) => error instanceof RecordsConfigError && /\/x\/type\.json declares no authoring/.test((error as Error).message),
  );
});

test("parseTypeUnit: invalid JSON throws RecordsConfigError", () => {
  assert.throws(() => parseTypeUnit("{ not json", "/x/type.json"), RecordsConfigError);
});

test("resolveTypeUnit: repo declares a unit — it wins, source is repo", async () => {
  const repo = await scratchRepo();
  await withUnit(repo, "adr", VALID_MANIFEST, true);
  const resolved = resolveTypeUnit(repo, undefined, "adr");
  assert.ok(resolved !== undefined);
  assert.equal(resolved.source, "repo");
  assert.equal(resolved.unit.type, "policy");
});

test("resolveTypeUnit: repo has none, sourceRoot does — falls through, source is norm", async () => {
  const repo = await scratchRepo();
  const sourceRoot = await scratchRepo();
  await withUnit(sourceRoot, "adr", VALID_MANIFEST, true);
  const resolved = resolveTypeUnit(repo, sourceRoot, "adr");
  assert.ok(resolved !== undefined);
  assert.equal(resolved.source, "norm");
});

test("resolveTypeUnit: neither root declares the type — undefined, never a throw", async () => {
  const repo = await scratchRepo();
  const sourceRoot = await scratchRepo();
  assert.equal(resolveTypeUnit(repo, sourceRoot, "adr"), undefined);
  assert.equal(resolveTypeUnit(repo, undefined, "adr"), undefined);
});

test("resolveTypeUnit: repo wins over sourceRoot when both declare the type", async () => {
  const repo = await scratchRepo();
  const sourceRoot = await scratchRepo();
  const repoManifest = JSON.stringify({ ...JSON.parse(VALID_MANIFEST), type: "from-repo" });
  await withUnit(repo, "adr", repoManifest, true);
  await withUnit(sourceRoot, "adr", VALID_MANIFEST, true);
  const resolved = resolveTypeUnit(repo, sourceRoot, "adr");
  assert.equal(resolved?.source, "repo");
  assert.equal(resolved?.unit.type, "from-repo");
});

test("resolveTypeUnit: a declared authoring path that does not exist resolves anyway, visibly — log's real case", async () => {
  const repo = await scratchRepo();
  // No template written: both facets the manifest declares are absent, exactly like `log` today.
  await withUnit(repo, "log", VALID_MANIFEST, false);
  const resolved = resolveTypeUnit(repo, undefined, "log");
  assert.ok(resolved !== undefined);
  assert.equal(resolved.authoringExists, false);
  assert.equal(resolved.templateExists, false);
  assert.ok(resolved.authoringPath.endsWith("references/records/policy.md"));
});

test("resolveTypeUnit: a manifest that fails to parse throws rather than being skipped", async () => {
  const repo = await scratchRepo();
  await withUnit(repo, "adr", "{ not json", false);
  assert.throws(() => resolveTypeUnit(repo, undefined, "adr"), RecordsConfigError);
});
