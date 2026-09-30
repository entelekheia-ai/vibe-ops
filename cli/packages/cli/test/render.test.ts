// The render layer's decisions, unit-level: rich or plain, which flags are the CLI's, and what each
// writer emits. The byte-level claim on a real pipe is in render-plain.test.ts.

import { test } from "node:test";
import assert from "node:assert/strict";
import { createOut, extractGlobalFlags, wantsRich } from "../src/render.ts";

const tty = { isTTY: true, env: {} };

test("wantsRich: --ui wins over a non-TTY", () => {
  assert.equal(wantsRich("on", { isTTY: false, env: {} }), true);
});

test("wantsRich: --no-ui wins over a TTY", () => {
  assert.equal(wantsRich("off", tty), false);
});

test("wantsRich: a TTY with CI or NO_COLOR is plain, a bare TTY is rich, a pipe is plain", () => {
  assert.equal(wantsRich(undefined, { isTTY: true, env: { CI: "1" } }), false);
  assert.equal(wantsRich(undefined, { isTTY: true, env: { NO_COLOR: "1" } }), false);
  assert.equal(wantsRich(undefined, tty), true);
  assert.equal(wantsRich(undefined, { isTTY: false, env: {} }), false);
});

test("extractGlobalFlags: removes both flags from anywhere, and the last one wins", () => {
  assert.deepEqual(extractGlobalFlags(["--ui", "check", "--verbose"]), { rest: ["check", "--verbose"], ui: "on" });
  assert.deepEqual(extractGlobalFlags(["check", "--no-ui", "."]), { rest: ["check", "."], ui: "off" });
  assert.equal(extractGlobalFlags(["--ui", "check", "--no-ui"]).ui, "off");
  assert.equal(extractGlobalFlags(["--no-ui", "check", "--ui"]).ui, "on");
  assert.equal(extractGlobalFlags(["check"]).ui, undefined);
});

test("extractGlobalFlags: anything after -- is kept", () => {
  assert.deepEqual(extractGlobalFlags(["x", "--", "--ui", "--no-ui"]), { rest: ["x", "--", "--ui", "--no-ui"], ui: undefined });
});

function capture(options: { rich: boolean; colour?: boolean }) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const out = createOut({ ...options, stdout: (t) => void stdout.push(t), stderr: (t) => void stderr.push(t) });
  return { out, stdout: () => stdout.join(""), stderr: () => stderr.join("") };
}

test("createOut plain: result writes the summary alone", () => {
  const c = capture({ rich: false });
  c.out.result({ code: 0, summary: "3 checks, 0 failed" }, { json: false });
  assert.equal(c.stdout(), "3 checks, 0 failed\n");
  assert.equal(c.stderr(), "");
  assert.equal(c.stdout().includes("\x1b"), false);
});

test("createOut plain: error is prefixed, on stdout, and unframed", () => {
  const c = capture({ rich: false });
  c.out.error("boom");
  assert.equal(c.stdout(), "error: boom\n");
});

test("createOut rich with colour off: no escape bytes, glyph kept", () => {
  const c = capture({ rich: true, colour: false });
  c.out.result({ code: 1, summary: "1 checks, 1 failed" }, { json: false });
  c.out.help("title", ["a", "", "b"]);
  c.out.error("boom");
  assert.equal(c.stdout().includes("\x1b"), false);
  assert.match(c.stdout(), /^✖ 1 checks, 1 failed\n/);
});

test("createOut rich with colour on: escape bytes are present", () => {
  const c = capture({ rich: true });
  c.out.result({ code: 0, summary: "ok" }, { json: false });
  assert.equal(c.stdout().includes("\x1b"), true);
});

test("createOut json: payload on stdout, summary on stderr, both raw", () => {
  const c = capture({ rich: true });
  c.out.result({ code: 0, summary: "done", data: { a: 1 } }, { json: true });
  assert.deepEqual(JSON.parse(c.stdout()), { a: 1 });
  assert.equal(c.stderr(), "done\n");
});
