// The plan-progress nudge, read across a sequence of firings that share one state file. What makes a
// firing right or wrong is partly what the PREVIOUS firing said, so the subject here is a session, never
// a single call: the hook is executed for real, against fixture repositories, with a synthesized Stop
// payload on stdin.
//
// Fixtures rather than this repository: the hook resolves each repository's own plan taxonomy, so a
// fixture with a known template and known modification times is the only way to assert WHICH plan gets
// named rather than merely that one did.

import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { execFileSync, spawnSync } from "node:child_process";

const REPO = path.resolve(import.meta.dirname, "..", "..", "..", "..");
// CLAUDE_PLUGIN_ROOT is what an *installed* plugin presents, which is `plugin/` here — not the
// repository root, which is the npm workspace.
const PLUGIN = path.join(REPO, "plugin");
const HOOK = path.join(PLUGIN, "hooks", "plan-progress-nudge.sh");
const HELPER = path.join(PLUGIN, "scripts", "session-touched-repos.sh");

function onPath(binary: string): boolean {
  return spawnSync("sh", ["-c", `command -v ${binary}`], { stdio: "ignore" }).status === 0;
}

/** The reason this suite cannot read the hook's behaviour, or false when it can. A missing dependency
 *  makes several assertions fail at once, each describing a silence whose cause is not in its own
 *  message — so it is named here instead. */
function unreadable(): string | false {
  if (!existsSync(HOOK)) return "no plugin/hooks/plan-progress-nudge.sh — this tree ships no plan-progress nudge";
  if (!existsSync(HELPER)) return "the hook's runtime scripts are absent from this tree";
  if (!onPath("vibe-ops")) {
    return "vibe-ops is not on PATH — the hook resolves each repository's taxonomy through it (npm link -w @entelekheia/vibe-ops-cli)";
  }
  if (!onPath("git")) return "git is not on PATH — the fixture repositories cannot be created";
  return false;
}

// The arrow is U+2192, not "->": the resolver derives the active status word by splitting the lifecycle
// comment on it, and an ASCII fixture yields the whole line as the status word, which then matches no
// status row at all. The failure looks exactly like the hook staying silent.
const TEMPLATE = [
  "# Plan-NNN: Title",
  "",
  "| Field | Value |",
  "|---|---|",
  "| Status | Backlog |",
  "",
  "<!-- Status lifecycle: Backlog → In Progress → Shipped. -->",
  "",
  "## Summary",
  "",
  "<!-- ===== LIVING SECTIONS ===== -->",
  "",
  "## Progress",
  "",
  "## Surprises & Discoveries",
  "",
  "## Decision Log",
  "",
  "## Outcomes & Retrospective",
  "",
  "<!-- ===== END LIVING SECTIONS ===== -->",
  "",
].join("\n");

// Distinct, pinned modification times, so "the newest plan is named" is an assertion about the hook
// rather than about tie-breaking: files created in a loop share a second, and the order `ls -t` gives
// them then is unspecified.
const PLANS: readonly (readonly [string, Date])[] = [
  ["001", new Date("2026-01-01T00:00:00Z")],
  ["002", new Date("2026-01-02T00:00:00Z")],
  ["003", new Date("2026-01-03T00:00:00Z")],
];

/** A git repository with three active plans, its own plan template, and one non-plan file to write. */
function fixtureRepo(root: string, name: string): void {
  const repo = path.join(root, name);
  mkdirSync(path.join(repo, "project", "plans"), { recursive: true });
  mkdirSync(path.join(repo, "project", "templates"), { recursive: true });
  execFileSync("git", ["init", "-q"], { cwd: repo });
  writeFileSync(path.join(repo, "project", "templates", "plan.md"), TEMPLATE);
  for (const [number, when] of PLANS) {
    const file = path.join(repo, "project", "plans", `${number}-thing.md`);
    writeFileSync(file, `# Plan-${number}\n\n| Field | Value |\n|---|---|\n| Status | In Progress |\n\n## Progress\n`);
    utimesSync(file, when, when);
  }
  writeFileSync(path.join(repo, "code.txt"), "x\n");
}

/** The fixture root, realpath-ed before anything is written into it. On macOS TMPDIR is reached through
 *  a symlink and `git rev-parse --show-toplevel` answers with the physical path, while the transcript
 *  would record the logical one. The hook compares those two strings to decide whether the turn wrote a
 *  plan itself, so an unresolved root makes that suppression pass for the wrong reason — the paths would
 *  simply never match. */
function fixture(): string {
  const root = path.join(realpathSync(mkdtempSync(path.join(tmpdir(), "vibeops-nudge-"))), "nudge");
  mkdirSync(path.join(root, "state"), { recursive: true });
  writeFileSync(path.join(root, "transcript.jsonl"), "");
  fixtureRepo(root, "repo");
  fixtureRepo(root, "repo2");
  return root;
}

/** Append one assistant turn that wrote `file`, in the shape the transcript reader scans for. */
function wrote(fx: string, file: string): void {
  const turn = { type: "assistant", message: { content: [{ type: "tool_use", name: "Edit", input: { file_path: file } }] } };
  appendFileSync(path.join(fx, "transcript.jsonl"), `${JSON.stringify(turn)}\n`);
}

/** One Stop, returning whatever the hook wrote to stdout. */
function fire(fx: string, session: string): string {
  const payload = JSON.stringify({
    session_id: session,
    transcript_path: path.join(fx, "transcript.jsonl"),
    stop_hook_active: false,
  });
  const result = spawnSync("sh", [HOOK], {
    input: payload,
    encoding: "utf8",
    env: { ...process.env, CLAUDE_PLUGIN_ROOT: PLUGIN, CLAUDE_PLUGIN_DATA: path.join(fx, "state") },
  });
  return result.stdout ?? "";
}

/** Every fixture plan a firing named, in the order the output mentions them. */
function named(output: string): string[] {
  return output.match(/\/repo2?\/project\/plans\/\d{3}-thing\.md/g) ?? [];
}

function logLines(fx: string): string[] {
  const dir = path.join(fx, "state");
  return readdirSync(dir)
    .filter((name) => /^vibe-ops-nudge-log-.*\.tsv$/.test(name))
    .flatMap((name) => readFileSync(path.join(dir, name), "utf8").split("\n"))
    .filter((line) => line.length > 0);
}

test("the nudge names at most one plan per firing, newest first, and never re-names one the session already wrote or was already asked about", { skip: unreadable() }, async (t) => {
  const fx = fixture();
  const session = "NUDGEFIX";
  const plan = (repo: string, number: string) => path.join(fx, repo, "project", "plans", `${number}-thing.md`);

  // The first Stop of a session seeds the byte offset from the transcript's current size, so the
  // transcript has to be empty for it — otherwise the whole file counts as "this turn".
  await t.test("the first Stop of a session only seeds the transcript offset", () => {
    assert.equal(fire(fx, session), "", "the first Stop of a session spoke; it must only seed the transcript offset");
  });

  // Firing 1 — a turn that wrote code in repo. Three plans are eligible; one may be named, the newest.
  await t.test("one plan per firing, and it is the most recently modified one", () => {
    wrote(fx, path.join(fx, "repo", "code.txt"));
    const plans = named(fire(fx, session));
    assert.equal(plans.length, 1, `a firing named ${plans.length} plans; at most one may be named per firing`);
    assert.equal(
      plans[0],
      "/repo/project/plans/003-thing.md",
      `the firing named ${plans[0] ?? "nothing"} rather than the most recently modified plan`,
    );
  });

  // Firing 2 — the turn wrote the plan it was just asked about. It must not come back; a different
  // eligible plan may.
  await t.test("the plan the turn just wrote is not named in the same firing", () => {
    wrote(fx, plan("repo", "003"));
    const plans = named(fire(fx, session));
    assert.ok(
      !plans.some((p) => p.endsWith("/003-thing.md")),
      "the plan the turn had just written was named again in the same firing",
    );
  });

  // Firing 3 — an ordinary turn in the same repository, immediately after. The step stays inside one
  // repository, so only writing the plan can explain the plan being settled: nothing has erased the memo
  // except obeying it.
  await t.test("nor a turn later — complying does not re-arm the nudge", () => {
    wrote(fx, path.join(fx, "repo", "code.txt"));
    const plans = named(fire(fx, session));
    assert.ok(
      !plans.some((p) => p.endsWith("/003-thing.md")),
      "a plan written after being named was named again a turn later — complying re-arms the nudge",
    );
  });

  // Firing 4 — the turn wrote only in the sibling repository, whose plans are all still outstanding. It
  // gets nudged about that repository: silence here would mean a repository reached only on a detour is
  // never nudged at all, which is why the count is asserted alongside the origin.
  await t.test("a turn spent only in a sibling repository is nudged about that repository", () => {
    wrote(fx, path.join(fx, "repo2", "code.txt"));
    const plans = named(fire(fx, session));
    assert.equal(plans.length, 1, `a turn in the sibling repository named ${plans.length} plans: ${plans.join(", ")}`);
    assert.ok(
      plans[0]?.startsWith("/repo2/"),
      `a turn that wrote only in a sibling repository was nudged about the other one: ${plans[0]}`,
    );
  });

  // Firing 5 — back in repo, where every plan has now been named or written. The memo carries across the
  // detour, so the correct output is nothing at all. This is the half a single-repository fixture cannot
  // see: a set rebuilt from the repositories the turn touched would have erased everything known about
  // the ones it did not.
  await t.test("coming back from that detour, everything already settled stays settled", () => {
    wrote(fx, path.join(fx, "repo", "code.txt"));
    const plans = named(fire(fx, session));
    assert.deepEqual(
      plans,
      [],
      "after a turn spent in another repository, plans already settled this session were named again",
    );
  });

  // A firing that spoke asks for a turn it can no longer observe, and the branch it most wants to count
  // is the one required to stay silent — so the firing itself is recoverable from disk instead.
  await t.test("every firing that named a plan appended one four-field line to the log", () => {
    const lines = logLines(fx);
    assert.ok(lines.length >= 4, `the firing log holds ${lines.length} lines; every firing that named a plan must append one`);
    for (const line of lines) {
      assert.equal(
        line.split("\t").length,
        4,
        `the firing log has a line that is not four tab-separated fields (when, session, plan, mtime): ${line}`,
      );
    }
  });
});
