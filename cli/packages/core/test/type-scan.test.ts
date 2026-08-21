import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { resolveTypeName, scanTypePackages, typesDeclaredBy } from "../src/type-scan.ts";

async function scratch(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), "vibeops-type-scan-"));
}

/** An installed package declaring `types`, with one directory per type name it claims. */
async function installPackage(
  root: string,
  name: string,
  types: readonly string[],
  options: { declares?: boolean } = {},
): Promise<void> {
  const dir = path.join(root, "node_modules", ...name.split("/"));
  await mkdir(dir, { recursive: true });
  const manifest: Record<string, unknown> = { name, version: "0.0.1" };
  if (options.declares !== false) manifest["vibeOps"] = { types: "types" };
  await writeFile(path.join(dir, "package.json"), JSON.stringify(manifest));
  for (const type of types) {
    await mkdir(path.join(dir, "types", type), { recursive: true });
    await writeFile(path.join(dir, "types", type, "type.json"), "{}");
  }
}

test("a package declaring no vibeOps.types is invisible to the scan", async () => {
  const root = await scratch();
  await installPackage(root, "@x/ordinary", ["adr"], { declares: false });
  assert.deepEqual(scanTypePackages(root), []);
});

test("a scoped and an unscoped package are both found, and each reports what it declares", async () => {
  const root = await scratch();
  await installPackage(root, "@scope/governance-policies", ["policy", "plan"]);
  await installPackage(root, "dot-agent-freeze", ["freeze-policy"]);
  const found = scanTypePackages(root);
  assert.deepEqual(found.map((c) => c.packageName).sort(), ["@scope/governance-policies", "dot-agent-freeze"]);
  const policies = found.find((c) => c.packageName === "@scope/governance-policies")!;
  assert.deepEqual(typesDeclaredBy(policies), ["plan", "policy"]);
});

// npm hoists: in a workspace every package's dependencies resolve from the ROOT node_modules, so a scan
// anchored at one package would find nothing.
test("the scan walks upward, so a package hoisted to the root is found from a nested directory", async () => {
  const root = await scratch();
  await installPackage(root, "@scope/governance-plan", ["plan"]);
  const nested = path.join(root, "cli", "packages", "records");
  await mkdir(nested, { recursive: true });
  assert.deepEqual(scanTypePackages(nested).map((c) => c.packageName), ["@scope/governance-plan"]);
});

test("one claimant resolves silently", async () => {
  const root = await scratch();
  await installPackage(root, "@scope/governance-plan", ["plan"]);
  const resolution = resolveTypeName("plan", scanTypePackages(root));
  assert.equal(resolution.resolved?.packageName, "@scope/governance-plan");
  assert.equal(resolution.unresolved, undefined);
});

// Absence is not an error: a repository may keep an artifact nothing installed knows about, and the
// generic `project/<type>` convention still answers for it.
test("no claimant reports absence rather than failing", async () => {
  const root = await scratch();
  await installPackage(root, "@scope/governance-plan", ["plan"]);
  const resolution = resolveTypeName("policy", scanTypePackages(root));
  assert.equal(resolution.resolved, undefined);
  assert.match(resolution.unresolved!, /no installed package declares the type "policy"/);
});

// THE CASE THE RULE EXISTS FOR. Two packages claiming one name is not a name clash — it is two
// governance regimes over one kind of artifact, each correct on its own terms.
test("two claimants resolve to nothing, and the report names every one of them", async () => {
  const root = await scratch();
  await installPackage(root, "@a/governance-policies", ["policy"]);
  await installPackage(root, "@b/policies", ["policy"]);
  const resolution = resolveTypeName("policy", scanTypePackages(root));
  assert.equal(resolution.resolved, undefined);
  assert.equal(resolution.claimants.length, 2);
  assert.match(resolution.unresolved!, /@a\/governance-policies/);
  assert.match(resolution.unresolved!, /@b\/policies/);
  assert.match(resolution.unresolved!, /types: \{ "policy"/, "it says how to break the tie");
});

test("the repository's binding breaks the tie", async () => {
  const root = await scratch();
  await installPackage(root, "@a/governance-policies", ["policy"]);
  await installPackage(root, "@b/policies", ["policy"]);
  const resolution = resolveTypeName("policy", scanTypePackages(root), "@b/policies");
  assert.equal(resolution.resolved?.packageName, "@b/policies");
  assert.equal(resolution.declared, "@b/policies");
});

// A declared binding is USED even when it does not resolve — the caller then examines zero files against
// the name the repository chose, which is attributable, where a quiet fallback to the other claimant is
// not. Same decision the <records:<type>> token already implements for a missing declared directory.
test("a binding naming a package that declares nothing does not fall back to a claimant", async () => {
  const root = await scratch();
  await installPackage(root, "@a/governance-policies", ["policy"]);
  const resolution = resolveTypeName("policy", scanTypePackages(root), "@b/typo");
  assert.equal(resolution.resolved, undefined);
  assert.equal(resolution.declared, "@b/typo");
  assert.match(resolution.unresolved!, /binds "policy" to @b\/typo/);
  assert.match(resolution.unresolved!, /@a\/governance-policies do/);
});
