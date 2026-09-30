// Through the real binary, because the claim is a byte count on a pipe: no escape bytes and no framing
// characters reach a consumer that cannot ask for less.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

const BIN = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "dist", "bin.js");

async function emptyRepo(): Promise<string> {
  const repoRoot = await mkdtemp(path.join(tmpdir(), "vibeops-plain-"));
  spawnSync("git", ["-C", repoRoot, "init", "-q"]);
  return repoRoot;
}

function run(repoRoot: string, argv: readonly string[]): { out: string; status: number } {
  // The environment is cleaned of the variables that steer the layout, so the run is what a bare pipe gets.
  const env = { ...process.env };
  delete env["CI"];
  delete env["NO_COLOR"];
  const r = spawnSync("node", [BIN, ...argv], { cwd: repoRoot, encoding: "utf8", env });
  return { out: `${r.stdout ?? ""}${r.stderr ?? ""}`, status: r.status ?? -1 };
}

test("check in a pipe emits no framing characters and no escape bytes", async () => {
  const { out } = run(await emptyRepo(), ["check"]);
  assert.notEqual(out.trim(), "");
  assert.equal(/[│◆]/.test(out), false, `framing reached the pipe: ${JSON.stringify(out)}`);
  assert.equal(out.includes("\x1b"), false, "an escape byte reached the pipe");
});

test("check --ui in a pipe draws the rich summary glyph", async () => {
  const { out } = run(await emptyRepo(), ["check", "--ui"]);
  assert.match(out, /[✔✖]/);
});

test("check --no-ui is accepted, and --ui may come before the command", async () => {
  const repo = await emptyRepo();
  assert.notEqual(run(repo, ["check", "--no-ui"]).status, 2);
  const before = run(repo, ["--ui", "check"]);
  assert.notEqual(before.status, 2);
  // Without extraction `--ui` is read as a module name and exits 1 with no count line.
  assert.match(before.out, /\d+ checks, \d+ failed/);
});

const COUNT = /^[0-9]+ checks, [0-9]+ failed/;
const countLines = (out: string): number => out.split("\n").filter((line) => COUNT.test(line)).length;

test("the `N checks, M failed` line is printed exactly once: default, --verbose and --audit", async () => {
  const repo = await emptyRepo();
  for (const argv of [["check"], ["check", "--verbose"], ["check", "--audit"]]) {
    const { out } = run(repo, argv);
    assert.equal(countLines(out), 1, `${argv.join(" ")}: ${out.split("\n").filter((l) => /checks,/.test(l)).join(" | ")}`);
  }
});

test("an unknown flag still exits 2, with a line beginning error: ", async () => {
  const { out, status } = run(await emptyRepo(), ["check", "--definitely-not-a-flag"]);
  assert.equal(status, 2);
  assert.match(out, /^error: /m);
});

test("--help lists the global flags, plain", async () => {
  const { out } = run(await emptyRepo(), ["--help"]);
  assert.match(out, /flags on every command:/);
  assert.match(out, /--no-ui/);
  assert.equal(/[│◆]/.test(out), false);
});

// The report block (Plan-041 Track 3). An empty repository fails exactly one check — no AGENTS.md — which
// is enough to see a finding drawn, and not drawn twice.
const stripAnsi = (text: string): string => text.replace(/\x1b\[[0-9;]*m/g, "");
const COUNTS = /\d+ fail\s+⚠ \d+ warn\s+⊘ \d+ skip/;

test("check --ui draws the report block in place of the module's own finding lines", async () => {
  const out = stripAnsi(run(await emptyRepo(), ["check", "--ui"]).out);
  assert.match(out, COUNTS);
  assert.match(out, /✖ budget/);
  assert.equal(/^FAIL {2}\[budget\]/m.test(out), false, "the raw finding line was printed beside the block");
  const lines = out.split("\n").filter((line) => line.trim() !== "");
  assert.match(lines.at(-1)!, /✖ \d+ checks, \d+ failed$/);
});

test("check --ui --verbose keeps the module's own lines above the block", async () => {
  const out = stripAnsi(run(await emptyRepo(), ["check", "--ui", "--verbose"]).out);
  assert.match(out, /^FAIL {2}\[budget\]/m);
  assert.match(out, COUNTS);
});

test("plain check draws no block", async () => {
  const { out } = run(await emptyRepo(), ["check"]);
  assert.equal(COUNTS.test(out), false);
  assert.match(out, /^FAIL {2}\[budget\]/m);
});

test("check --ui --json prints the payload alone on stdout", async () => {
  const env = { ...process.env };
  delete env["CI"];
  delete env["NO_COLOR"];
  const r = spawnSync("node", [BIN, "check", "--ui", "--json"], { cwd: await emptyRepo(), encoding: "utf8", env });
  assert.doesNotThrow(() => JSON.parse(r.stdout));
  assert.equal(COUNTS.test(r.stdout), false);
});

// Local fixture modules, loaded by path, for the three shapes a rich run must not swallow a line from: a
// module that throws after logging, one whose report sits beside lines that are not findings, and one whose
// data is not a report at all.
const CORE = pathToFileURL(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "core", "dist", "index.js")).href;

async function fixtureModule(repoRoot: string, name: string, body: string): Promise<string> {
  const file = path.join(repoRoot, `${name}.mjs`);
  await writeFile(
    file,
    `import { defineModule } from ${JSON.stringify(CORE)};\n` +
      `export default defineModule({ id: ${JSON.stringify(name)}, version: "0.0.0", summary: "fixture" }, async (context) => {\n${body}\n});\n`,
  );
  return file;
}

test("a module that throws after logging keeps its lines under --ui", async () => {
  const repo = await emptyRepo();
  const mod = await fixtureModule(repo, "throws", `context.log("PROGRESS wrote a.md"); context.log("FAIL  [step] could not write b.md"); throw new Error("boom");`);
  const out = stripAnsi(run(repo, [mod, "--ui"]).out);
  assert.match(out, /PROGRESS wrote a\.md/);
  assert.match(out, /FAIL {2}\[step\] could not write b\.md/);
  assert.match(out, /boom/);
});

test("the block stands in for finding lines only; every other line a module wrote is printed", async () => {
  const repo = await emptyRepo();
  const mod = await fixtureModule(
    repo,
    "fixer",
    `context.log("FIXED [links] docs/a.md: rewrote 2 links"); context.log("hint: run with --verbose");` +
      ` context.log("FAIL  [links] docs/b.md:7: dead link");` +
      ` return { code: 1, summary: "1 gates, 1 failed, 1 repaired", data: { findings: [{ gate: "links", level: "fail", file: "docs/b.md", line: 7, evidence: "dead link" }], skipped: [] } };`,
  );
  const out = stripAnsi(run(repo, [mod, "--ui"]).out);
  assert.match(out, /FIXED \[links\] docs\/a\.md: rewrote 2 links/);
  assert.match(out, /hint: run with --verbose/);
  assert.equal(/^FAIL {2}\[links\]/m.test(out), false, "the finding line was printed beside the block");
  assert.match(out, /docs\/b\.md:7/);
  assert.match(out, COUNTS);
});

test("a rich run whose data is not a report prints every line the module wrote", async () => {
  const repo = await emptyRepo();
  const mod = await fixtureModule(repo, "plain-data", `context.log("PROGRESS one"); context.log("PROGRESS two"); return { code: 0, summary: "done", data: { rows: [] } };`);
  const out = stripAnsi(run(repo, [mod, "--ui"]).out);
  assert.match(out, /PROGRESS one\nPROGRESS two\n/);
  assert.match(out, /✔ done/);
});

// `check` passes each half of its run to the sink as one joined string, so a finding and the indented
// detail under it arrive together. The block must not swallow the detail with the finding.
test("check --ui keeps a finding's indented detail, which the block does not redraw", async () => {
  const repo = await emptyRepo();
  const fragments = await mkdtemp(path.join(tmpdir(), "vibeops-frag-"));
  await writeFile(
    path.join(fragments, "90-probe-detail.sh"),
    'CHECK_VERSION=1\ncheck_probe_detail() {\n  fail probe-detail "docs/x.md: something is wrong"\n  echo "  detail: the fix is to rename docs/x.md"\n}\n',
  );
  const env: NodeJS.ProcessEnv = { ...process.env, VIBE_OPS_CHECK_DIRS: fragments };
  delete env["CI"];
  delete env["NO_COLOR"];
  const r = spawnSync("node", [BIN, "check", "--ui"], { cwd: repo, encoding: "utf8", env });
  const out = stripAnsi(`${r.stdout ?? ""}${r.stderr ?? ""}`);
  assert.match(out, /detail: the fix is to rename docs\/x\.md/);
  assert.match(out, /✖ probe-detail/);
});
