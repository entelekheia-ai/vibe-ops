import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { installHarness, HARNESS_FILES, HARNESS_OPTIONS } from "../src/install.ts";

async function target(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), "vibeops-harness-install-"));
}

const ALWAYS = HARNESS_FILES.filter((f) => f.option === undefined).map((f) => f.to);
const EVERYTHING = new Set<string>(HARNESS_OPTIONS);

test("a fresh repository gets the gate, and the scripts are executable", async () => {
  const repo = await target();
  const result = installHarness(repo);

  assert.deepEqual([...result.written].sort(), [...ALWAYS].sort());
  assert.equal(result.kept.length, 0);
  for (const file of HARNESS_FILES.filter((f) => f.executable && f.option === undefined)) {
    const mode = (await stat(path.join(repo, file.to))).mode & 0o111;
    assert.notEqual(mode, 0, `${file.to} is not executable`);
  }
});

// CONSENT, NOT CONVENIENCE. A commit hook changes what every `git commit` in somebody's clone does and a
// CI workflow is a snapshot that goes stale; the skill said "offer, do not assume" about both, and this
// verb installed them with no prompt, no flag and no way to decline.
test("the hook and the CI workflow are offered by name, never installed unasked", async () => {
  const repo = await target();
  const result = installHarness(repo);

  assert.deepEqual(
    [...result.offered].map((entry) => entry.option).sort(),
    [...HARNESS_OPTIONS].sort(),
  );
  assert.equal(existsSync(path.join(repo, ".githooks", "pre-commit")), false);
  assert.equal(existsSync(path.join(repo, ".github", "workflows", "check.yml")), false);
});

test("what --include names is written, and nothing else is", async () => {
  const repo = await target();
  const result = installHarness(repo, { include: new Set(["hook"]) });

  assert.ok(result.written.includes(".githooks/pre-commit"));
  assert.deepEqual([...result.offered].map((entry) => entry.to), [".github/workflows/check.yml"]);
});

// THE CI WORKFLOW MUST CALL SOMETHING THIS VERB WRITES. It ran `./scripts/check-agents-md.sh`, which no
// verb installs, so a repository provisioned by this apparatus had CI red on its first push.
test("every path the CI workflow runs is a path this verb installs", async () => {
  const repo = await target();
  installHarness(repo, { include: EVERYTHING });
  const workflow = await readFile(path.join(repo, ".github", "workflows", "check.yml"), "utf8");

  for (const [, script] of workflow.matchAll(/run: (\.\/scripts\/\S+)/g)) {
    assert.ok(existsSync(path.join(repo, script!)), `${script} is run by CI and installed by nothing`);
  }
});

test("a second install keeps everything and writes nothing", async () => {
  const repo = await target();
  installHarness(repo, { include: EVERYTHING });
  const second = installHarness(repo, { include: EVERYTHING });
  assert.equal(second.written.length, 0);
  assert.equal(second.kept.length, HARNESS_FILES.length);
});

// THE CASE THAT COSTS SOMEBODY THEIR HOOK. A repository with a pre-commit of its own must not have it
// replaced — and must not have it silently kept either, because then the gate is not installed and the
// run said nothing about it.
test("a pre-commit that is not the gate is kept AND reported as needing the gate appended", async () => {
  const repo = await target();
  await mkdir(path.join(repo, ".githooks"), { recursive: true });
  await writeFile(path.join(repo, ".githooks", "pre-commit"), "#!/bin/sh\nnpm run lint\n");

  const result = installHarness(repo, { include: EVERYTHING });
  assert.ok(result.kept.includes(".githooks/pre-commit"));
  assert.deepEqual(result.needsAppend, [".githooks/pre-commit"]);
  assert.equal(await readFile(path.join(repo, ".githooks", "pre-commit"), "utf8"), "#!/bin/sh\nnpm run lint\n");
});

test("a pre-commit that already calls the gate is kept and needs nothing", async () => {
  const repo = await target();
  await mkdir(path.join(repo, ".githooks"), { recursive: true });
  await writeFile(path.join(repo, ".githooks", "pre-commit"), '#!/bin/sh\nvibe-ops check "$ROOT"\n');

  const result = installHarness(repo, { include: EVERYTHING });
  assert.ok(result.kept.includes(".githooks/pre-commit"));
  assert.deepEqual(result.needsAppend, []);
});

// A MENTION IS NOT A CALL, and reading one as the other left the repository with no gate while the run
// reported success. The opposite direction — a hook calling the entrypoint this verb itself writes —
// was told to append the gate to itself.
test("the gate is detected by what runs it, not by what mentions it", async () => {
  const cases: readonly { readonly body: string; readonly calls: boolean }[] = [
    { body: "#!/bin/sh\n# TODO: some day run vibe-ops check here\nexec npm run lint\n", calls: false },
    { body: "#!/bin/sh\nexec ./scripts/check.sh\n", calls: true },
    { body: "#!/bin/sh\n. scripts/checks/_run.sh\n", calls: true },
    { body: "#!/bin/sh\nnpx --no-install vibe-ops    check || exit 1\n", calls: true },
    { body: "#!/bin/sh\nexec npx vibe-ops-check\n", calls: false },
    { body: "#!/bin/sh\nexec npx vibe-ops records --check\n", calls: false },
  ];

  for (const { body, calls } of cases) {
    const repo = await target();
    await mkdir(path.join(repo, ".githooks"), { recursive: true });
    await writeFile(path.join(repo, ".githooks", "pre-commit"), body);
    const result = installHarness(repo, { include: EVERYTHING });
    assert.equal(result.needsAppend.length === 0, calls, JSON.stringify(body));
  }
});

test("force overwrites only the destination it names", async () => {
  const repo = await target();
  installHarness(repo, { include: EVERYTHING });
  await writeFile(path.join(repo, "scripts", "check.sh"), "# mine\n");
  await writeFile(path.join(repo, ".githooks", "pre-commit"), "# also mine\n");

  const result = installHarness(repo, { include: EVERYTHING, force: new Set(["scripts/check.sh"]) });
  assert.deepEqual(result.written, ["scripts/check.sh"]);
  assert.equal(await readFile(path.join(repo, ".githooks", "pre-commit"), "utf8"), "# also mine\n");
});
