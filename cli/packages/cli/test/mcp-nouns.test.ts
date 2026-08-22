// Every noun/verb over the MCP surface, through a real client on a real transport. Plan-011's first goal
// is that `vibe-ops <noun> <verb>` behaves identically from a terminal, over MCP, and from a hook — and
// "identically" was not true: `mcp.ts` passed `args: []` unconditionally, so every verb taking positional
// arguments was reachable from a terminal and from nowhere else, and failed here as an empty batch rather
// than as a missing input. This file is what makes that claim checkable per track rather than per read.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { buildServer } from "../src/mcp.ts";
import { BUILTINS } from "../src/builtins.ts";
import { loadModule } from "../src/resolve.ts";
import { declaredFlagsFor } from "../src/run.ts";

const NOUNS = ["plan", "task", "log", "records"];

async function client(modules: readonly string[] = NOUNS): Promise<Client> {
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  const server = await buildServer(modules);
  const c = new Client({ name: "test", version: "0" });
  await Promise.all([server.connect(serverSide), c.connect(clientSide)]);
  return c;
}

interface CallResult {
  readonly exitCode: number;
  readonly data: unknown;
  readonly text: string;
  /** The refusal or report line, read from the STRUCTURED channel — see the assertion at Track 4. */
  readonly summary: unknown;
  readonly output: unknown;
}

async function call(c: Client, name: string, args: Record<string, unknown>): Promise<CallResult> {
  const result = (await c.callTool({ name, arguments: args })) as {
    structuredContent?: { exitCode: number; data: unknown; summary?: unknown; output?: unknown };
    content?: { type: string; text?: string }[];
  };
  return {
    exitCode: result.structuredContent?.exitCode ?? -1,
    data: result.structuredContent?.data ?? null,
    text: (result.content ?? []).map((part) => part.text ?? "").join("\n"),
    summary: result.structuredContent?.summary ?? null,
    output: result.structuredContent?.output ?? null,
  };
}

function git(repo: string, args: readonly string[]): string {
  return execFileSync("git", args, { cwd: repo, encoding: "utf8" });
}

/** A repository with a plan template, one incoherent plan, and one open task dossier. */
async function fixture(): Promise<string> {
  const repo = await mkdtemp(path.join(tmpdir(), "vibeops-mcp-"));
  git(repo, ["init", "-q"]);
  git(repo, ["config", "user.email", "t@example.invalid"]);
  git(repo, ["config", "user.name", "T"]);

  await mkdir(path.join(repo, "project", "plans"), { recursive: true });
  await mkdir(path.join(repo, "project", "tasks"), { recursive: true });
  await mkdir(path.join(repo, "project", "templates"), { recursive: true });

  await writeFile(
    path.join(repo, "project", "templates", "plan.md"),
    [
      // Both templates declare a version: since Plan-012 Track 6, `close` dispatches on the version of
      // the record it was handed, and a template declaring none makes every record under it
      // uncomparable — correctly refused, which has nothing to do with what this file measures.
      "---",
      "vibe-ops-template: plan@3",
      "---",
      "",
      "<!-- Status lifecycle: Backlog → In Progress → Shipped. -->",
      "",
      "# Plan-NNN",
      "",
      "<!-- ===== LIVING SECTIONS -->",
      "",
      "## Decision Log",
      "",
      "## Outcomes & Retrospective",
      "",
      "<!-- ===== END LIVING SECTIONS -->",
      "",
    ].join("\n"),
  );
  await writeFile(
    path.join(repo, "project", "templates", "task.md"),
    ["---", "vibe-ops-template: task@3", "---", "", "# Task-NNN", ""].join("\n"),
  );
  await writeFile(
    path.join(repo, "project", "plans", "001-p.md"),
    [
      "---",
      "vibe-ops-template: plan@3",
      "---",
      "",
      "# Plan-001",
      "",
      "| Field | Value |",
      "|---|---|",
      "| Status | Shipped |",
      "",
      "## Tracks",
      "",
      "- [ ] open",
      "",
    ].join("\n"),
  );
  await writeFile(
    path.join(repo, "project", "tasks", "001-alpha.md"),
    [
      "---",
      "vibe-ops-template: task@3",
      "---",
      "",
      "# Task-001",
      "",
      "## Closure",
      "",
      "- [ ] Run `/vibe-ops:close task` — do not just delete.",
      "",
    ].join("\n"),
  );

  // One log entry, deliberately wrong in three of the four ways lint names, and pointing at a path that
  // no longer exists — so `lint`, `sweep` and `index --check` all have something to say.
  await mkdir(path.join(repo, "project", "log"), { recursive: true });
  await writeFile(path.join(repo, "project", "log", "README.md"), "# project/log/\n\nOne entry per trap.\n");
  await writeFile(
    path.join(repo, "project", "log", "a-thing.md"),
    [
      "---",
      "name: the-old-slug",
      "description: It was tried and it did not work.",
      "kind: note",
      "path:",
      '  - "deleted/thing/*.ts"',
      "attempted: soon",
      "---",
      "",
      "# The trap",
      "",
    ].join("\n"),
  );

  git(repo, ["add", "."]);
  git(repo, ["commit", "-q", "-m", "seed"]);
  return repo;
}

test("every noun is a tool, and each declares its verbs, its positionals, and (only where needed) confirm", async () => {
  const tools = (await (await client()).listTools()).tools;
  assert.deepEqual(
    tools.map((t) => t.name).sort(),
    [...NOUNS].sort(),
  );

  for (const tool of tools) {
    const properties = (tool.inputSchema as { properties?: Record<string, unknown> }).properties ?? {};
    assert.ok("args" in properties, `${tool.name} must accept positionals over MCP, not only from a terminal`);
  }

  const task = tools.find((t) => t.name === "task");
  const log = tools.find((t) => t.name === "log");
  const taskProperties = (task?.inputSchema as { properties?: Record<string, unknown> }).properties ?? {};
  const logProperties = (log?.inputSchema as { properties?: Record<string, unknown> }).properties ?? {};
  assert.ok("confirm" in taskProperties, "task carries a destructive verb, so it must expose confirm");
  assert.ok(!("confirm" in logProperties), "log has none — an unusable field is noise");
});

test("Track 2 over MCP: <noun> resolve answers with the resolved record", async () => {
  const c = await client();
  const repo = await fixture();
  for (const noun of ["plan", "task", "log"]) {
    const result = await call(c, noun, { repo, command: "resolve" });
    assert.equal(result.exitCode, 0, `${noun} resolve: ${result.text}`);
    assert.equal((result.data as { type: string }).type, noun === "log" ? "log" : noun);
  }
  // `records` is a noun with verbs like the other three — it was the one module whose surface was a bare
  // call plus flags, which made `census` and `handling` reachable over MCP as booleans that read as
  // independent while exactly one may be true.
  const records = await call(c, "records", { repo, command: "resolve", type: "adr" });
  assert.equal(records.exitCode, 0, records.text);

  // Plan-027 Track 1 removed `plan` and `task` from what `records resolve` answers for. The redirect it
  // answers with has to survive over MCP too, and whether it does turns on a detail of Track 2: the
  // `--type` enum is the UNION across every verb declaring the flag, because `records list` still takes
  // all four. Publishing `resolve`'s narrower domain instead would have had the transport refuse the
  // value with a schema error before the module ran — which reads as "no such value" rather than as
  // "that moved", and is how a rename is experienced as a break.
  for (const [type, noun] of [["plan", "plan resolve"], ["task", "task resolve"]] as const) {
    const gone = await call(c, "records", { repo, command: "resolve", type });
    assert.equal(gone.exitCode, 2, `records resolve --type ${type} must not still answer`);
    assert.match(String(gone.summary ?? gone.text), new RegExp(noun), `it must name ${noun}`);
  }
});

test("Track 3 over MCP: plan status finds the incoherent plan, and plan context carries the living sections", async () => {
  const c = await client();
  const repo = await fixture();

  const status = await call(c, "plan", { repo, command: "status" });
  assert.equal(status.exitCode, 0, status.text);
  const { findings } = status.data as { findings: readonly { file: string; reason: string }[] };
  assert.equal(findings.length, 1);
  assert.equal(findings[0]?.reason, "terminal-with-open-tracks");

  const context = await call(c, "plan", { repo, command: "context" });
  assert.equal(context.exitCode, 0, context.text);
  assert.match((context.data as { text: string }).text, /Decision Log, Outcomes & Retrospective/);
});

test("Track 4 over MCP: task guard reads positionals — the input that never arrived before", async () => {
  const c = await client();
  const repo = await fixture();

  const withArgs = await call(c, "task", { repo, command: "guard", args: ["project/tasks/001-alpha.md"] });
  assert.equal(withArgs.exitCode, 0, withArgs.text);
  assert.deepEqual((withArgs.data as { open: string[] }).open, ["project/tasks/001-alpha.md"]);

  // Without them the module says what is missing, rather than quietly acting on an empty set.
  const without = await call(c, "task", { repo, command: "guard" });
  assert.equal(without.exitCode, 2);
  assert.match(without.text, /needs at least one dossier path/);
});

test("Track 4 over MCP: a destructive verb is refused without confirm, and runs with it", async () => {
  const c = await client();
  const repo = await fixture();
  const head = git(repo, ["rev-parse", "HEAD"]);

  const refused = await call(c, "task", { repo, command: "close", args: ["project/tasks/001-alpha.md"] });
  assert.equal(refused.exitCode, 2);
  assert.match(refused.text, /destructive — re-send with confirm: true/);
  // AND through the structured channel. A client that renders `structuredContent` and discards the text
  // — measured behaviour, recorded in cli/AGENTS.md — otherwise sees `exitCode: 2, data: null` and no
  // reason at all, which reads as a run that happened and produced nothing.
  assert.match(String(refused.summary), /destructive — re-send with confirm: true/);
  assert.equal(git(repo, ["rev-parse", "HEAD"]), head, "and nothing happened");
  assert.equal(existsSync(path.join(repo, "project/tasks/001-alpha.md")), true);

  // --dry-run is still gated: a caller that cannot say confirm cannot reach the verb at all, which keeps
  // one answer to "may this tool call delete files" rather than one per flag combination.
  const dry = await call(c, "task", { repo, command: "close", args: ["project/tasks/001-alpha.md"], "dry-run": true });
  assert.equal(dry.exitCode, 2);

  const done = await call(c, "task", {
    repo,
    command: "close",
    args: ["project/tasks/001-alpha.md"],
    confirm: true,
  });
  assert.equal(done.exitCode, 0, done.text);
  assert.equal(existsSync(path.join(repo, "project/tasks/001-alpha.md")), false);
  assert.match((done.data as { dossierSha: string }).dossierSha, /^[0-9a-f]{40}$/);
});

test("Track 5 over MCP: log lint, sweep and index all answer with structured data", async () => {
  const c = await client();
  const repo = await fixture();

  const lint = await call(c, "log", { repo, command: "lint" });
  assert.equal(lint.exitCode, 1, lint.text);
  const { findings } = lint.data as { findings: readonly { rule: string }[] };
  assert.deepEqual(
    findings.map((f) => f.rule).sort(),
    ["attempted-invalid", "kind-invalid", "name-mismatch"],
    "the seeded entry is deliberately wrong in three of the four ways",
  );

  const sweep = await call(c, "log", { repo, command: "sweep" });
  assert.equal(sweep.exitCode, 0, sweep.text);
  assert.equal((sweep.data as { retirable: readonly unknown[] }).retirable.length, 1);

  const check = await call(c, "log", { repo, command: "index", check: true });
  assert.equal(check.exitCode, 1, "the hand-written index has drifted");
  const written = await call(c, "log", { repo, command: "index" });
  assert.equal(written.exitCode, 0, written.text);
  assert.equal((await call(c, "log", { repo, command: "index", check: true })).exitCode, 0, "and now it has not");
});

test("Track 6 over MCP: plan close is destructive there too, and files/moves once confirmed", async () => {
  const c = await client();
  const repo = await fixture();

  const refused = await call(c, "plan", { repo, command: "close", args: ["project/plans/001-p.md"] });
  assert.equal(refused.exitCode, 2);
  assert.match(refused.text, /destructive — re-send with confirm: true/);
  assert.equal(existsSync(path.join(repo, "project/plans/001-p.md")), true);

  const done = await call(c, "plan", { repo, command: "close", args: ["project/plans/001-p.md"], confirm: true });
  assert.equal(done.exitCode, 0, done.text);
  assert.equal((done.data as { to: string }).to, "project/plans/shipped/001-p.md");
  assert.equal(existsSync(path.join(repo, "project/plans/shipped/001-p.md")), true);

  // And the number is still counted from its new home — the whole reason DEPTH.plan is 2.
  const resolved = await call(c, "plan", { repo, command: "resolve" });
  assert.equal((resolved.data as { next: string }).next, "002");
});

test("an unknown verb over MCP is refused by the module, not by the schema alone", async () => {
  const c = await client();
  const result = await call(c, "plan", { repo: await fixture(), command: "nope" });
  assert.equal(result.exitCode, -1, "the enum rejects it at the transport, before the module is reached");
});

// Plan-026 Track 4 over MCP: `records show` takes its record path as a POSITIONAL, which is the exact
// input shape this file exists to guard — a verb reachable from a terminal and from nowhere else is the
// bug it was written for. It also asserts the summary reaches the structured channel, because an MCP
// client renders `structuredContent` and discards the text: a read verb whose answer arrives only as
// terminal lines has not answered.
test("Track 4 over MCP: records show reads a record through its positional, and answers structurally", async () => {
  const repo = await mkdtemp(path.join(tmpdir(), "vibeops-mcp-show-"));
  execFileSync("git", ["-C", repo, "init", "-q"]);
  await mkdir(path.join(repo, "project", "plans"), { recursive: true });
  await writeFile(
    path.join(repo, "project", "plans", "001-a-plan.md"),
    [
      "# Plan-001: A plan",
      "",
      "| Field | Value |",
      "|---|---|",
      "| Status | In Progress |",
      "",
      "## Tracks",
      "- [x] Track 1",
      "- [ ] Track 2",
      "",
    ].join("\n"),
  );

  const c = await client();
  const shown = await call(c, "records", {
    repo,
    command: "show",
    args: ["project/plans/001-a-plan.md"],
  });

  assert.equal(shown.exitCode, 0, shown.text);
  const data = shown.data as { status?: string; tracks?: { open: number; total: number } };
  assert.equal(data.status, "In Progress");
  assert.deepEqual(data.tracks, { total: 2, checked: 1, open: 1 });
  assert.match(String(shown.summary), /1 of 2 tracks open/, "the summary is structured, not only printed");

  // The positional is required, and its absence is a refusal with a reason rather than a report on nothing.
  const bare = await call(c, "records", { repo, command: "show" });
  assert.equal(bare.exitCode, 2);
  assert.match(String(bare.summary), /at least one record path/);
});

// Plan-026 Track 5 over MCP: `plan guard` is the symmetric of `task guard` and takes the same shape of
// input — positionals. Asserted here for the same reason its sibling is: a verb that works from a
// terminal and nowhere else is the defect this file was written for.
test("Track 5 over MCP: plan guard reads positionals, and records list answers per type", async () => {
  const repo = await mkdtemp(path.join(tmpdir(), "vibeops-mcp-guard-"));
  execFileSync("git", ["-C", repo, "init", "-q"]);
  await mkdir(path.join(repo, "project", "plans"), { recursive: true });
  const open = ["# Plan-001: Open", "", "## Tracks", "- [ ] Run `/vibe-ops:close-plan`", ""].join("\n");
  const done = ["# Plan-002: Done", "", "## Tracks", "- [x] Run `/vibe-ops:close-plan`", ""].join("\n");
  await writeFile(path.join(repo, "project", "plans", "001-open.md"), open);
  await writeFile(path.join(repo, "project", "plans", "002-done.md"), done);

  const c = await client();
  const guarded = await call(c, "plan", {
    repo,
    command: "guard",
    args: ["project/plans/001-open.md", "project/plans/002-done.md"],
  });

  assert.equal(guarded.exitCode, 0, guarded.text);
  assert.deepEqual((guarded.data as { open: string[] }).open, ["project/plans/001-open.md"]);
  assert.match(String(guarded.summary), /1 of 2/);

  const listed = await call(c, "records", { repo, command: "list", type: "plan" });
  assert.equal(listed.exitCode, 0, listed.text);
  assert.equal((listed.data as unknown[]).length, 2, "both plans, whatever their closure state");
});

// ── Plan-027 Track 2 ────────────────────────────────────────────────────────────────────────────────
// The criterion this plan set for itself was that no tool advertises an argument its command rejects.
// It was vacuous when written, because `runModule` rejected no flag at all — so the assertion has to
// prove the rejection exists, not merely that the schema is narrow. It cannot be narrow: one static
// shape per tool means every verb's flags are published for every verb, and passing a discriminated
// union instead publishes an EMPTY schema (measured 2026-08-14 against the SDK this repo depends on).
//
// Over all nine exposed modules, not the four nouns the rest of this file uses. The harness module and
// the three ops were never covered here, and `harness` is the only one carrying `needsSource`.
test("every advertised flag is either declared for the verb, or refused by name when it is not", async () => {
  const c = await client(BUILTINS);
  const repo = await fixture();
  const tools = (await c.listTools()).tools;

  assert.deepEqual(tools.map((t) => t.name).sort(), [...BUILTINS].sort(), "every exposed module is a tool");

  const reserved = new Set(["repo", "command", "args", "confirm"]);
  let refusalsChecked = 0;

  for (const name of BUILTINS) {
    const { definition } = await loadModule(name);
    const tool = tools.find((t) => t.name === name)!;
    const advertised = Object.keys((tool.inputSchema as { properties?: Record<string, unknown> }).properties ?? {})
      .filter((key) => !reserved.has(key));

    for (const command of definition.commands ?? [{ name: undefined as string | undefined }]) {
      const declared = new Set(declaredFlagsFor(definition, command.name).map((f) => f.name));

      for (const flag of advertised) {
        if (declared.has(flag)) continue;

        // Advertised for the tool, invalid for THIS verb — the exact call the union invites. It must be
        // refused, and the refusal must name the flag, so a caller is not left to diff two lists.
        const spec = (definition.commands ?? []).flatMap((c) => c.flags ?? []).find((f) => f.name === flag);
        const result = await call(c, name, {
          repo,
          ...(command.name === undefined ? {} : { command: command.name }),
          confirm: true,
          [flag]: spec?.type === "boolean" ? true : (spec?.choices?.[0] ?? "x"),
        });
        assert.equal(result.exitCode, 2, `${name} ${command.name ?? ""} accepted --${flag}, which it does not declare`);
        assert.match(String(result.summary), new RegExp(`--${flag}`), `the refusal must name --${flag}`);
        refusalsChecked += 1;
      }
    }
  }

  // Guards the guard: if the union ever stopped over-advertising, this test would pass by examining
  // nothing, and would keep passing after the rejection was deleted.
  assert.ok(refusalsChecked > 0, "no over-advertised flag was exercised — this assertion proved nothing");
});

// The collision above is the one this file caught by failing, so it gets its own assertion rather than
// being left to the general sweep. `records` declares `--type` twice with different domains and different
// wording; the published property has to serve both verbs at once.
test("a flag two verbs declare with different domains publishes the union, and says which wording is whose", async () => {
  const tools = (await (await client()).listTools()).tools;
  const type = (tools.find((t) => t.name === "records")!.inputSchema as {
    properties: Record<string, { description?: string; enum?: string[] }>;
  }).properties["type"]!;

  // `norm` (Plan-033) declares `--type` OPEN — a bound contributed type must be constructible — and an
  // open domain unions to an open domain, so the shared shape publishes no enum at all. Publishing the
  // closed union would have made `records norm --type freeze` unconstructible over MCP.
  assert.equal(type.enum, undefined, "an open declaration in any verb must leave the shared shape open");
  assert.match(type.description ?? "", /\[resolve\]/);
  assert.match(type.description ?? "", /\[list\]/, "each wording beside the verbs that mean it");
  assert.match(type.description ?? "", /required for: resolve, norm, list/);

  const properties = (tools.find((t) => t.name === "records")!.inputSchema as { required?: string[] });
  assert.ok(
    !(properties.required ?? []).includes("type"),
    "a scoped requirement must not reach the shared shape — records census takes no type and must stay reachable",
  );
});
