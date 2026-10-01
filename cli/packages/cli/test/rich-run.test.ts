// Plan-041 Track 5, through the real binary: a rich run's status line, its styled held lines, its
// warnings kept in place, and the anchor its title names — and, beside each, what a pipe still gets.
// The status line exists only when stderr is a terminal, so those claims run under `script`, which gives
// the binary a real pseudo-terminal; they are skipped where no `script` is installed.

import { test } from "node:test";
import assert from "node:assert/strict";
import { closeSync, existsSync, openSync, readFileSync } from "node:fs";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawn, spawnSync } from "node:child_process";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BIN = path.join(HERE, "..", "dist", "bin.js");
const CORE = pathToFileURL(path.join(HERE, "..", "..", "core", "dist", "index.js")).href;
const stripSgr = (text: string): string => text.replace(/\x1b\[[0-9;]*m/g, "");

/** The environment a bare invocation gets: nothing that steers the layout. */
function cleanEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  delete env["CI"];
  delete env["NO_COLOR"];
  return env;
}

async function emptyRepo(): Promise<string> {
  const repoRoot = await mkdtemp(path.join(tmpdir(), "vibeops-rich-"));
  spawnSync("git", ["-C", repoRoot, "init", "-q"]);
  return repoRoot;
}

/** stdout and stderr as two pipes. */
function run(cwd: string, argv: readonly string[]): { stdout: string; stderr: string; status: number } {
  const r = spawnSync("node", [BIN, ...argv], { cwd, encoding: "utf8", env: cleanEnv() });
  return { stdout: r.stdout ?? "", stderr: r.stderr ?? "", status: r.status ?? -1 };
}

/** stdout and stderr into one file, so the order between the two streams is observable. */
async function runMerged(cwd: string, argv: readonly string[]): Promise<string> {
  const file = path.join(await mkdtemp(path.join(tmpdir(), "vibeops-merged-")), "out.txt");
  const fd = openSync(file, "w");
  try {
    spawnSync("node", [BIN, ...argv], { cwd, env: cleanEnv(), stdio: ["ignore", fd, fd] });
  } finally {
    closeSync(fd);
  }
  return readFileSync(file, "utf8");
}

const quote = (arg: string): string => `'${arg.replace(/'/g, `'\\''`)}'`;
const HAS_SCRIPT =
  (process.platform === "darwin" || process.platform === "linux") && spawnSync("sh", ["-c", "command -v script"]).status === 0;

/** Both streams through one real pseudo-terminal, as a person at a terminal would see the bytes. */
function runInPty(cwd: string, argv: readonly string[]): string {
  const command = ["node", BIN, ...argv];
  const args = process.platform === "darwin" ? ["-q", "/dev/null", ...command] : ["-qec", command.map(quote).join(" "), "/dev/null"];
  const r = spawnSync("script", args, { cwd, encoding: "utf8", env: cleanEnv(), stdio: ["ignore", "pipe", "pipe"] });
  return `${r.stdout ?? ""}${r.stderr ?? ""}`;
}

async function fixtureModule(repoRoot: string, name: string, body: string): Promise<string> {
  const file = path.join(repoRoot, `${name}.mjs`);
  await writeFile(
    file,
    `import { defineModule } from ${JSON.stringify(CORE)};\n` +
      `export default defineModule({ id: ${JSON.stringify(name)}, version: "0.0.0", summary: "fixture" }, async (context) => {\n${body}\n});\n`,
  );
  return file;
}

const WARNS_BETWEEN = `context.log("PROGRESS one"); context.warn("careful"); context.log("PROGRESS two");`;

const STATUS = "◌ vibe-ops check · running…";
const ERASE = "\r\x1b[2K";

// --- the status line ------------------------------------------------------------------------------------

test("check --ui into a pipe draws no status line on stderr", async () => {
  // A guard, not a red test: the status line needs stderr to be a terminal, and a pipe never is.
  const { stderr } = run(await emptyRepo(), ["check", "--ui"]);
  assert.equal(stderr.includes("running…"), false, JSON.stringify(stderr));
  assert.equal(stderr.includes("\r"), false, JSON.stringify(stderr));
});

test("at a terminal, check shows the status line and erases it before anything else is drawn", { skip: !HAS_SCRIPT }, async () => {
  const text = stripSgr(runInPty(await emptyRepo(), ["check"]));
  const at = text.indexOf(STATUS);
  assert.notEqual(at, -1, `no status line: ${JSON.stringify(text)}`);
  // Nothing between the status line and its erase: a flush before stop() would have drawn onto it.
  assert.equal(text.slice(at + STATUS.length, at + STATUS.length + ERASE.length), ERASE, JSON.stringify(text));
  assert.equal(text.indexOf(STATUS, at + 1), -1, "the status line was drawn twice");
  assert.ok(text.indexOf("fail") > at, "the block was drawn before the status line");
  assert.match(text.slice(at), /[✔✖] \d+ checks, \d+ failed/);
});

test("at a terminal, a module's warning is printed after the status line is erased, never onto it", { skip: !HAS_SCRIPT }, async () => {
  const repo = await emptyRepo();
  const mod = await fixtureModule(repo, "warns", `${WARNS_BETWEEN} return { code: 0, summary: "done" };`);
  const text = stripSgr(runInPty(repo, [mod]));
  const erased = text.indexOf(ERASE);
  assert.notEqual(erased, -1, `no erase: ${JSON.stringify(text)}`);
  assert.ok(text.indexOf("warning: careful") > erased, `the warning came before the erase: ${JSON.stringify(text)}`);
});

/** Where a fixture module's status line ends, asserting it is followed at once by its erase. */
function erasedAt(text: string, id: string): number {
  const status = `◌ vibe-ops ${id} · running…`;
  const at = text.indexOf(status);
  assert.notEqual(at, -1, `no status line: ${JSON.stringify(text)}`);
  assert.equal(text.slice(at + status.length, at + status.length + ERASE.length), ERASE, `not erased at once: ${JSON.stringify(text)}`);
  assert.equal(text.indexOf(status, at + 1), -1, `the status line was drawn again: ${JSON.stringify(text)}`);
  return at + status.length + ERASE.length;
}

test("at a terminal, a module that throws has its status line erased before its lines and the error", { skip: !HAS_SCRIPT }, async () => {
  const repo = await emptyRepo();
  const mod = await fixtureModule(repo, "throws", `context.log("PROGRESS one"); throw new Error("boom");`);
  const text = stripSgr(runInPty(repo, [mod]));
  const after = erasedAt(text, "throws");
  assert.ok(text.indexOf("PROGRESS one") >= after && text.indexOf("boom") > after, JSON.stringify(text));
});

test("at a terminal, an interrupted run has its status line erased before its held lines", { skip: !HAS_SCRIPT }, async () => {
  const repo = await emptyRepo();
  const mod = await fixtureModule(
    repo,
    "interrupted",
    `context.log("PROGRESS one"); process.kill(process.pid, "SIGINT"); await new Promise((resolve) => setTimeout(resolve, 5000)); return { code: 0, summary: "done" };`,
  );
  const text = stripSgr(runInPty(repo, [mod]));
  const after = erasedAt(text, "interrupted");
  assert.ok(text.indexOf("PROGRESS one") >= after, JSON.stringify(text));
  assert.equal(text.includes("done"), false, "the run was not interrupted");
});

/**
 * Runs the binary in a pseudo-terminal and, once `marker` exists, sends SIGINT to the binary's whole
 * process group — what Ctrl-C at a terminal does, so a child the module is waiting on is interrupted too.
 * Resolves with the bytes the terminal saw and the exit status `script` passed on.
 */
async function interruptInPty(cwd: string, argv: readonly string[], marker: string): Promise<{ text: string; status: number | null }> {
  const command = ["node", BIN, ...argv];
  const args = process.platform === "darwin" ? ["-q", "/dev/null", ...command] : ["-qec", command.map(quote).join(" "), "/dev/null"];
  const child = spawn("script", args, { cwd, env: cleanEnv(), detached: true, stdio: ["ignore", "pipe", "pipe"] });
  let text = "";
  child.stdout.on("data", (chunk) => (text += chunk));
  child.stderr.on("data", (chunk) => (text += chunk));
  const exited = new Promise<number | null>((resolve) => child.on("exit", (code) => resolve(code)));
  const deadline = Date.now() + 15_000;
  try {
    while (!existsSync(marker)) {
      if (Date.now() > deadline) throw new Error(`the module never reached its marker: ${JSON.stringify(text)}`);
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    // The binary is the child of `script` (on Linux, of the shell `script` starts); its group is the
    // terminal's foreground group.
    const descendants = (pid: number): number[] => {
      const r = spawnSync("pgrep", ["-P", String(pid)], { encoding: "utf8" });
      return (r.stdout ?? "").split("\n").filter(Boolean).map(Number);
    };
    const node = [...descendants(child.pid!), ...descendants(child.pid!).flatMap(descendants)].find((pid) => {
      const r = spawnSync("ps", ["-o", "command=", "-p", String(pid)], { encoding: "utf8" });
      return (r.stdout ?? "").includes(BIN);
    });
    assert.notEqual(node, undefined, "the binary's process was not found");
    const group = Number(spawnSync("ps", ["-o", "pgid=", "-p", String(node)], { encoding: "utf8" }).stdout.trim());
    process.kill(-group, "SIGINT");
    const timer = setTimeout(() => process.kill(-child.pid!, "SIGKILL"), Math.max(deadline - Date.now(), 1));
    const status = await exited;
    clearTimeout(timer);
    await new Promise((resolve) => setImmediate(resolve));
    return { text, status };
  } catch (error) {
    try {
      process.kill(-child.pid!, "SIGKILL");
    } catch {}
    throw error;
  }
}

const SYNC_CHILD = (marker: string): string =>
  `const { spawnSync } = await import("node:child_process"); ` +
  `spawnSync("sh", ["-c", ${JSON.stringify(`: > ${quote(marker)}; sleep 5`)}]);`;

test("at a terminal, Ctrl-C while the module waits on a synchronous child ends the run with 130 and its held lines", { skip: !HAS_SCRIPT }, async () => {
  const repo = await emptyRepo();
  const marker = path.join(repo, "in-child");
  const mod = await fixtureModule(
    repo,
    "syncchild",
    `context.log("PROGRESS one"); context.warn("careful"); ${SYNC_CHILD(marker)} context.log("PROGRESS two"); return { code: 0, summary: "done" };`,
  );
  const { text: raw, status } = await interruptInPty(repo, [mod], marker);
  const text = stripSgr(raw);
  assert.equal(status, 130, `exit status ${status}: ${JSON.stringify(text)}`);
  const after = erasedAt(text, "syncchild");
  const order = ["PROGRESS one", "warning: careful", "PROGRESS two"].map((needle) => text.indexOf(needle));
  assert.ok(order.every((at) => at >= after), `a held line is missing or before the erase: ${JSON.stringify(text)}`);
  assert.deepEqual([...order].sort((a, b) => a - b), order, `out of order: ${JSON.stringify(text)}`);
  assert.equal(text.includes("done"), false, `the result was drawn: ${JSON.stringify(text)}`);
});

test("at a terminal, Ctrl-C during an await that follows a synchronous child ends the run with 130", { skip: !HAS_SCRIPT }, async () => {
  const repo = await emptyRepo();
  const marker = path.join(repo, "awaiting");
  const mod = await fixtureModule(
    repo,
    "childthenawait",
    `const { spawnSync } = await import("node:child_process"); const { writeFileSync } = await import("node:fs"); ` +
      `spawnSync("sh", ["-c", "exit 0"]); context.log("PROGRESS one"); writeFileSync(${JSON.stringify(marker)}, ""); ` +
      `await new Promise((resolve) => setTimeout(resolve, 5000)); return { code: 0, summary: "done" };`,
  );
  const { text: raw, status } = await interruptInPty(repo, [mod], marker);
  const text = stripSgr(raw);
  assert.equal(status, 130, `exit status ${status}: ${JSON.stringify(text)}`);
  assert.ok(text.indexOf("PROGRESS one") >= erasedAt(text, "childthenawait"), JSON.stringify(text));
  assert.equal(text.includes("done"), false, `the result was drawn: ${JSON.stringify(text)}`);
});

test("at a terminal, a run with a synchronous child and no Ctrl-C still draws its result and exits 0", { skip: !HAS_SCRIPT }, async () => {
  // A guard: waiting out a signal that never came must not change an uninterrupted run.
  const repo = await emptyRepo();
  const mod = await fixtureModule(
    repo,
    "syncquiet",
    `const { spawnSync } = await import("node:child_process"); spawnSync("sh", ["-c", "exit 0"]); context.log("PROGRESS one"); return { code: 0, summary: "done" };`,
  );
  const text = stripSgr(runInPty(repo, [mod]));
  assert.ok(text.indexOf("done") > erasedAt(text, "syncquiet"), JSON.stringify(text));
});

test("at a terminal, a direct write to stdout during the run erases the status line first", { skip: !HAS_SCRIPT }, async () => {
  const repo = await emptyRepo();
  const mod = await fixtureModule(repo, "direct", `console.log("DIRECT-OUT line"); context.log("PROGRESS one"); return { code: 0, summary: "done" };`);
  const text = stripSgr(runInPty(repo, [mod]));
  const after = erasedAt(text, "direct");
  assert.ok(text.indexOf("DIRECT-OUT line") >= after, JSON.stringify(text));
});

test("at a terminal, a process warning during the run erases the status line first", { skip: !HAS_SCRIPT }, async () => {
  const repo = await emptyRepo();
  const mod = await fixtureModule(
    repo,
    "nodewarn",
    `process.emitWarning("a runtime warning"); await new Promise((resolve) => setTimeout(resolve, 50)); context.log("PROGRESS one"); return { code: 0, summary: "done" };`,
  );
  const text = stripSgr(runInPty(repo, [mod]));
  const after = erasedAt(text, "nodewarn");
  assert.ok(text.indexOf("a runtime warning") >= after, JSON.stringify(text));
  assert.ok(text.indexOf("PROGRESS one") > after, JSON.stringify(text));
});

// --- styled held lines ----------------------------------------------------------------------------------

test("check --ui --verbose styles the runner's lines and keeps their text", async () => {
  const { stdout } = run(await emptyRepo(), ["check", "--ui", "--verbose"]);
  assert.ok(stdout.includes("\x1b[1m[budget]\x1b[22m"), `[budget] is not bold: ${JSON.stringify(stdout.slice(0, 400))}`);
  assert.ok(stdout.includes("\x1b[31m✖ FAIL\x1b[39m"), "FAIL is not red with its glyph");
  const text = stripSgr(stdout);
  assert.match(text, /^Composed \d+ checks:$/m);
  assert.match(text, /^✖ FAIL {2}\[budget\] no AGENTS\.md/m);
  assert.match(text, /^⊘ SKIP {2}\[bridge\]/m);
});

test("check --ui, without --verbose, prints no finding line beside the block, styled or not", async () => {
  // render-plain.test.ts anchors this at `^FAIL`; a styled line starts with its glyph, so the claim is
  // repeated here unanchored.
  const text = stripSgr(run(await emptyRepo(), ["check", "--ui"]).stdout);
  assert.equal(/FAIL {2}\[budget\]/.test(text), false, JSON.stringify(text.slice(0, 600)));
});

test("check --verbose into a pipe prints the runner's lines exactly as written", async () => {
  // A guard: the plain path is frozen, lowercase preamble and all.
  const { stdout } = run(await emptyRepo(), ["check", "--verbose"]);
  assert.equal(stdout.includes("\x1b"), false);
  assert.match(stdout, /^composed \d+ checks:$/m);
  assert.match(stdout, /^FAIL {2}\[budget\] no AGENTS\.md/m);
  assert.equal(/Composed/.test(stdout), false);
});

// --- warnings held in place -----------------------------------------------------------------------------

test("a rich run keeps a module's warning in its place among the lines, on stderr", async () => {
  const repo = await emptyRepo();
  const mod = await fixtureModule(repo, "warns", `${WARNS_BETWEEN} return { code: 0, summary: "done" };`);
  const merged = stripSgr(await runMerged(repo, [mod, "--ui"]));
  const one = merged.indexOf("PROGRESS one");
  const warning = merged.indexOf("warning: careful");
  const two = merged.indexOf("PROGRESS two");
  assert.ok(one !== -1 && warning !== -1 && two !== -1, JSON.stringify(merged));
  assert.ok(one < warning && warning < two, `out of order: ${JSON.stringify(merged)}`);
  const split = run(repo, [mod, "--ui"]);
  assert.match(split.stderr, /^warning: careful$/m);
  assert.equal(split.stdout.includes("warning:"), false);
});

test("a rich run that throws writes its held lines and warnings in order before the error", async () => {
  const repo = await emptyRepo();
  const mod = await fixtureModule(repo, "warns-then-throws", `${WARNS_BETWEEN} throw new Error("boom");`);
  const merged = stripSgr(await runMerged(repo, [mod, "--ui"]));
  const order = ["PROGRESS one", "warning: careful", "PROGRESS two", "boom"].map((needle) => merged.indexOf(needle));
  assert.ok(order.every((at) => at !== -1), JSON.stringify(merged));
  assert.deepEqual([...order].sort((a, b) => a - b), order, `out of order: ${JSON.stringify(merged)}`);
});

test("a plain run still writes a warning as it happens, between the lines around it", async () => {
  // A guard: plain mode streams, and holds nothing.
  const repo = await emptyRepo();
  const mod = await fixtureModule(repo, "warns", `${WARNS_BETWEEN} return { code: 0, summary: "done" };`);
  const merged = await runMerged(repo, [mod]);
  assert.equal(merged, "PROGRESS one\nwarning: careful\nPROGRESS two\ndone\n");
});

// --- the title's anchor ---------------------------------------------------------------------------------

test("check --ui titles its block with the sentence naming the repository", async () => {
  const repo = await emptyRepo();
  const text = stripSgr(run(repo, ["check", "--ui"]).stdout);
  assert.ok(text.includes(`result of vibe-ops check – ${path.basename(repo)}`), JSON.stringify(text.slice(0, 600)));
});

test("check --ui from a linked working tree names the repository, not the working tree's folder", async () => {
  const repo = await emptyRepo();
  const commit = spawnSync("git", ["-C", repo, "-c", "user.name=t", "-c", "user.email=t@example.invalid", "commit", "-q", "--allow-empty", "-m", "first"]);
  assert.equal(commit.status, 0);
  const worktree = path.join(await mkdtemp(path.join(tmpdir(), "vibeops-rich-wt-")), "a-branch-folder");
  assert.equal(spawnSync("git", ["-C", repo, "worktree", "add", "-q", worktree]).status, 0);
  const text = stripSgr(run(worktree, ["check", "--ui"]).stdout);
  assert.ok(text.includes(`result of vibe-ops check – ${path.basename(repo)}`), JSON.stringify(text.slice(0, 600)));
  assert.equal(text.includes("a-branch-folder"), false);
});
