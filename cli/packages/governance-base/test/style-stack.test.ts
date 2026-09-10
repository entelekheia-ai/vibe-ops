import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { composeStylePolicy, formatStyleCollisions, formatStyleExplain } from "../src/style-stack.ts";

// Every layer in these tests is a real npm-shaped package (a `package.json` plus an ESM entry file) under
// a scratch directory, resolved by absolute path — the same path `activateGovernancePackage`'s `import()`
// takes untouched (`resolveFromHost` passes a `/`-leading specifier through). This is what lets a test
// stack two ad hoc packages without a real `@scope/name` on a real registry.

async function scratch(prefix: string): Promise<string> {
  return mkdtemp(path.join(tmpdir(), prefix));
}

/** Writes one style package: a resolvable ESM package plus `style/general.md` and, per entry in
 *  `targets`, a `style/<target>.md`. Returns its absolute directory, usable directly as a `types.style`
 *  layer's `use`. `extraRootFiles` writes files BESIDE `style/` — what a real package's own metadata and
 *  README are, and what must never be mistaken for a fragment. */
async function writeStylePackage(
  prefix: string,
  options: {
    readonly general?: string;
    readonly targets?: Readonly<Record<string, string>>;
    readonly declaredTargets?: readonly string[];
    readonly extraRootFiles?: Readonly<Record<string, string>>;
  },
): Promise<string> {
  const dir = await scratch(prefix);
  await writeFile(path.join(dir, "package.json"), JSON.stringify({ name: prefix, type: "module", main: "index.mjs" }));
  await writeFile(
    path.join(dir, "index.mjs"),
    [
      "import path from 'node:path';",
      "import { fileURLToPath } from 'node:url';",
      "const root = path.dirname(fileURLToPath(import.meta.url));",
      `export default { root, unit: { type: "style", targets: ${JSON.stringify(options.declaredTargets ?? Object.keys(options.targets ?? {}))} } };`,
    ].join("\n"),
  );
  const fragments = path.join(dir, "style");
  await mkdir(fragments, { recursive: true });
  if (options.general !== undefined) await writeFile(path.join(fragments, "general.md"), options.general);
  for (const [target, content] of Object.entries(options.targets ?? {})) {
    await writeFile(path.join(fragments, `${target}.md`), content);
  }
  for (const [name, content] of Object.entries(options.extraRootFiles ?? {})) {
    await writeFile(path.join(dir, name), content);
  }
  // A bare directory path fails `import()` with ERR_UNSUPPORTED_DIR_IMPORT under plain ESM resolution —
  // real npm resolution (a bare specifier through node_modules) tolerates it because `package.json`'s
  // `main`/`exports` names the entry file, but a filesystem path handed to `import()` is resolved as a
  // file URL, not as a package. Naming the entry file directly is what `resolveFromHost` passes through
  // untouched (any `/`-leading specifier), and `style/general.md`/`style/<target>.md` still resolve
  // against the `root` the entry file itself reports, independent of which path imported it.
  return path.join(dir, "index.mjs");
}

test("a package of one general.md is valid, and serves unscoped", async () => {
  const only = await writeStylePackage("style-solo-", { general: "## Voice\n\nWrite it plainly.\n" });
  const result = await composeStylePolicy(undefined, { types: { style: [only] } });
  assert.equal(result.ok, true);
  assert.equal(result.collisions.length, 0);
  assert.match(result.text, /Write it plainly\./);
});

test("two layers merge by section: a shared key replaces, a distinct key from each survives", async () => {
  const base = await writeStylePackage("style-base-", {
    general: "## Voice\n\nBase voice.\n\n## Budget\n\nBase budget.\n",
  });
  const overlay = await writeStylePackage("style-overlay-", {
    general: "## Voice\n\nOverlay voice.\n\n## Extra\n\nOverlay-only section.\n",
  });
  const result = await composeStylePolicy(undefined, { types: { style: [base, overlay] } });
  // "Voice" is shared: the later layer's replaces the earlier one's (a real, unresolved collision).
  assert.match(result.text, /Overlay voice\./);
  assert.doesNotMatch(result.text, /Base voice\./);
  // "Budget" (base-only) and "Extra" (overlay-only) both survive — a new key is appended, never dropped.
  assert.match(result.text, /Base budget\./);
  assert.match(result.text, /Overlay-only section\./);
  assert.equal(result.collisions.length, 1);
  assert.equal(result.collisions[0]?.key, "voice");
  assert.equal(result.collisions[0]?.previous.use, base);
  assert.equal(result.collisions[0]?.incoming.use, overlay);
});

test("a scoped layer applies to a target it names and sits out one it does not", async () => {
  const generic = await writeStylePackage("style-generic-", { general: "## Voice\n\nGeneric.\n" });
  const scoped = await writeStylePackage("style-scoped-", { general: "## Extra\n\nOnly for plan and task.\n" });
  const forPlan = await composeStylePolicy("plan", { types: { style: [generic, `${scoped}/{plan,task}`] } });
  assert.match(forPlan.text, /Only for plan and task\./);
  const forReadme = await composeStylePolicy("readme", { types: { style: [generic, `${scoped}/{plan,task}`] } });
  assert.doesNotMatch(forReadme.text, /Only for plan and task\./);
  assert.match(forReadme.text, /Generic\./);
});

test("an exclude scope ({^x}) applies to everything except the named target", async () => {
  const generic = await writeStylePackage("style-generic2-", { general: "## Voice\n\nGeneric.\n" });
  const everyoneButRfc = await writeStylePackage("style-notrfc-", { general: "## Extra\n\nNot for rfc.\n" });
  const forPlan = await composeStylePolicy("plan", { types: { style: [generic, `${everyoneButRfc}{^rfc}`] } });
  assert.match(forPlan.text, /Not for rfc\./);
  const forRfc = await composeStylePolicy("rfc", { types: { style: [generic, `${everyoneButRfc}{^rfc}`] } });
  assert.doesNotMatch(forRfc.text, /Not for rfc\./);
});

test("no --for serves the unscoped layers alone", async () => {
  const unscoped = await writeStylePackage("style-unscoped-", { general: "## Voice\n\nAlways here.\n" });
  const scoped = await writeStylePackage("style-scoped2-", { general: "## Extra\n\nOnly scoped.\n" });
  const result = await composeStylePolicy(undefined, { types: { style: [unscoped, `${scoped}/{plan}`] } });
  assert.match(result.text, /Always here\./);
  assert.doesNotMatch(result.text, /Only scoped\./);
});

test('"on: append" sums a colliding section instead of replacing it', async () => {
  const base = await writeStylePackage("style-append-base-", { general: "## Voice\n\nBase voice.\n" });
  const overlay = await writeStylePackage("style-append-overlay-", { general: "## Voice\n\nOverlay voice.\n" });
  const result = await composeStylePolicy(undefined, {
    types: { style: { layers: [base, { use: overlay, on: "append" }] } },
  });
  assert.match(result.text, /Base voice\./);
  assert.match(result.text, /Overlay voice\./);
  // Resolved by `on` — never reported as an unresolved collision.
  assert.equal(result.collisions.length, 0);
});

test("a per-key rules entry overrides the layer's own default, silently", async () => {
  const base = await writeStylePackage("style-rules-base-", {
    general: "## Voice\n\nBase voice.\n\n## Budget\n\nBase budget.\n",
  });
  const overlay = await writeStylePackage("style-rules-overlay-", {
    general: "## Voice\n\nOverlay voice.\n\n## Budget\n\nOverlay budget.\n",
  });
  const result = await composeStylePolicy(undefined, {
    types: { style: { layers: [base, { use: overlay, rules: { voice: "append" } }] } },
  });
  // "voice" was ruled to append: both survive.
  assert.match(result.text, /Base voice\./);
  assert.match(result.text, /Overlay voice\./);
  // "budget" carried no rule, and the layer's own default (on absent) is replace.
  assert.doesNotMatch(result.text, /Base budget\./);
  assert.match(result.text, /Overlay budget\./);
  // Both were collisions on the same two packages; only "budget" is unresolved.
  assert.deepEqual(
    result.collisions.map((c) => c.key),
    ["budget"],
  );
});

test('a package\'s own <target>.md overriding its own general.md is never a collision', async () => {
  const solo = await writeStylePackage("style-selfoverride-", {
    general: "## Voice\n\nGeneral voice.\n",
    targets: { plan: "## Voice\n\nPlan-specific voice.\n" },
  });
  const result = await composeStylePolicy("plan", { types: { style: [solo] } });
  assert.match(result.text, /Plan-specific voice\./);
  assert.doesNotMatch(result.text, /General voice\./);
  assert.equal(result.collisions.length, 0);
});

// Issue #31. On a case-insensitive filesystem (APFS, NTFS) `readme.md` and `README.md` are ONE file, so
// while fragments lived at the package root a style package targeting `readme` could not document
// itself — and the `existsSync` that resolved fragments answered true for either spelling, which served
// a package's own README as its `readme` fragment. Both halves are asserted: the directory, and the
// case-exact read that keeps the two names distinct even inside it.
test("a package targeting readme can hold its own README.md, and the README is never served", async () => {
  const pkg = await writeStylePackage("style-readme-", {
    targets: { readme: "## Voice\n\nThe readme fragment.\n" },
    extraRootFiles: { "README.md": "# The package\n\nProse about the package itself.\n" },
  });
  const result = await composeStylePolicy("readme", { types: { style: [pkg] } });
  assert.match(result.text, /The readme fragment\./);
  assert.doesNotMatch(result.text, /Prose about the package itself\./);
});

// NOTE ON WHAT THIS PROVES WHERE. The assertion below separates the case-exact read from `existsSync`
// only on a case-FOLDING volume (APFS, NTFS). On a case-sensitive filesystem — CI on Linux, ext4 —
// `existsSync(style/readme.md)` already answers false, so a green run there is not evidence that the
// case-exact read works; it is evidence that the bug does not exist on that filesystem.
test("a README.md inside style/ is not the readme fragment — the read is case-exact", async () => {
  const dir = await scratch("style-caseexact-");
  await writeFile(path.join(dir, "package.json"), JSON.stringify({ name: "style-caseexact", type: "module", main: "index.mjs" }));
  await writeFile(
    path.join(dir, "index.mjs"),
    [
      "import path from 'node:path';",
      "import { fileURLToPath } from 'node:url';",
      "const root = path.dirname(fileURLToPath(import.meta.url));",
      'export default { root, unit: { type: "style", targets: ["readme"] } };',
    ].join("\n"),
  );
  await mkdir(path.join(dir, "style"), { recursive: true });
  await writeFile(path.join(dir, "style", "README.md"), "## Voice\n\nWrong case, not a fragment.\n");
  const result = await composeStylePolicy("readme", { types: { style: [path.join(dir, "index.mjs")] } });
  assert.equal(result.sections.length, 0);
  assert.doesNotMatch(result.text, /Wrong case, not a fragment\./);
});

// The clean break the directory move chose: a package still shipping fragments at its root contributes
// nothing, rather than contributing from a layout whose `readme.md` may be a README.
test("the pre-#31 flat layout contributes nothing — fragments are read only from style/", async () => {
  const dir = await scratch("style-flat-");
  await writeFile(path.join(dir, "package.json"), JSON.stringify({ name: "style-flat", type: "module", main: "index.mjs" }));
  await writeFile(
    path.join(dir, "index.mjs"),
    [
      "import path from 'node:path';",
      "import { fileURLToPath } from 'node:url';",
      "const root = path.dirname(fileURLToPath(import.meta.url));",
      'export default { root, unit: { type: "style", targets: ["plan"] } };',
    ].join("\n"),
  );
  await writeFile(path.join(dir, "general.md"), "## Voice\n\nLegacy flat voice.\n");
  await writeFile(path.join(dir, "plan.md"), "## Budget\n\nLegacy flat budget.\n");
  const result = await composeStylePolicy("plan", { types: { style: [path.join(dir, "index.mjs")] } });
  assert.equal(result.sections.length, 0);
  assert.equal(result.text, "");
  // Nothing served, but the layer does not vanish quietly: an unmigrated package is the failure mode the
  // clean break creates, and it is the one a reader must be able to tell from "had nothing to say".
  assert.equal(result.ok, true);
  assert.ok(result.warnings.some((w) => w.includes("ships no readable style/ directory")));
});

test("onCollision: warn (the default) reports the collision and still succeeds", async () => {
  const base = await writeStylePackage("style-warn-base-", { general: "## Voice\n\nBase.\n" });
  const overlay = await writeStylePackage("style-warn-overlay-", { general: "## Voice\n\nOverlay.\n" });
  const result = await composeStylePolicy(undefined, { types: { style: [base, overlay] } });
  assert.equal(result.onCollision, "warn");
  assert.equal(result.collisions.length, 1);
  assert.equal(result.ok, true);
  assert.match(formatStyleCollisions(result)[0]!, /collision on "voice"/);
});

test("onCollision: off still detects the collision but the caller reports nothing", async () => {
  const base = await writeStylePackage("style-off-base-", { general: "## Voice\n\nBase.\n" });
  const overlay = await writeStylePackage("style-off-overlay-", { general: "## Voice\n\nOverlay.\n" });
  const result = await composeStylePolicy(undefined, {
    types: { style: { layers: [base, overlay], onCollision: "off" } },
  });
  assert.equal(result.collisions.length, 1);
  assert.equal(result.ok, true);
});

test("onCollision: error is the only severity that fails the run, and names both claimants", async () => {
  const base = await writeStylePackage("style-error-base-", { general: "## Voice\n\nBase.\n" });
  const overlay = await writeStylePackage("style-error-overlay-", { general: "## Voice\n\nOverlay.\n" });
  const result = await composeStylePolicy(undefined, {
    types: { style: { layers: [base, overlay], onCollision: "error" } },
  });
  assert.equal(result.ok, false);
  assert.equal(result.collisions.length, 1);
  const line = formatStyleCollisions(result)[0]!;
  assert.match(line, new RegExp(base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(line, new RegExp(overlay.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("--explain names each section's origin package and file", async () => {
  const base = await writeStylePackage("style-explain-base-", { general: "## Voice\n\nBase.\n" });
  const result = await composeStylePolicy(undefined, { types: { style: [base] } });
  const lines = formatStyleExplain(result);
  assert.equal(lines.length, 1);
  assert.match(lines[0]!, new RegExp(`voice: ${base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/general\\.md`));
});

test("an explicit key survives a heading rename across layers", async () => {
  const base = await writeStylePackage("style-key-base-", {
    general: "## Voice and tone\n\n<!-- key: voice -->\n\nBase phrasing.\n",
  });
  const overlay = await writeStylePackage("style-key-overlay-", {
    general: "## How it sounds\n\n<!-- key: voice -->\n\nOverlay phrasing.\n",
  });
  const result = await composeStylePolicy(undefined, { types: { style: [base, overlay] } });
  assert.equal(result.sections.length, 1);
  assert.equal(result.sections[0]?.key, "voice");
  assert.match(result.text, /Overlay phrasing\./);
  assert.doesNotMatch(result.text, /key: voice/);
});

test("a target no activated layer declares is served with a warning, never refused", async () => {
  const base = await writeStylePackage("style-advisory-", { general: "## Voice\n\nBase.\n" }, );
  const result = await composeStylePolicy("some-undeclared-target", { types: { style: [base] } });
  assert.equal(result.ok, true);
  assert.ok(result.warnings.some((w) => w.includes("some-undeclared-target")));
});

test("a layer naming a package that is not installed is skipped with a warning, not a throw", async () => {
  const result = await composeStylePolicy(undefined, { types: { style: ["@nobody/not-installed-style"] } });
  assert.equal(result.ok, true);
  assert.equal(result.text, "");
  assert.ok(result.warnings.some((w) => w.includes("not-installed")));
});

test("with no types.style declared at all, the default single-layer stack still composes", async () => {
  const result = await composeStylePolicy(undefined, undefined);
  assert.equal(result.ok, true);
  assert.ok(result.text.length > 0, "the shipped @entelekheia/governance-style package should have served something");
});
