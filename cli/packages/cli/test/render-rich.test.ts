// Plan-041 Track 5, unit-level: how a rich run writes the lines it held, the status line it draws while a
// module works, and the sentence the report block opens with. The same claims through the real binary,
// and the frozen plain path beside them, are in rich-run.test.ts.

import { test } from "node:test";
import assert from "node:assert/strict";
import { styleText } from "node:util";
import { createOut } from "../src/render.ts";
import type { HeldLine } from "../src/render.ts";
import { renderReport } from "../src/report-view.ts";
import type { Paint } from "../src/report-view.ts";

type Style = Parameters<typeof styleText>[0];
const paint = (style: Style, text: string): string => styleText(style, text, { validateStream: false });
const stripSgr = (text: string): string => text.replace(/\x1b\[[0-9;]*m/g, "");

/** Every write, in the order it happened, with the stream it went to. */
function capture(options: { rich: boolean; colour?: boolean; statusLine?: boolean }) {
  const writes: { stream: "out" | "err"; text: string }[] = [];
  const out = createOut({
    ...options,
    stdout: (text) => void writes.push({ stream: "out", text }),
    stderr: (text) => void writes.push({ stream: "err", text }),
  });
  const joined = (stream: "out" | "err"): string => writes.filter((w) => w.stream === stream).map((w) => w.text).join("");
  return { out, writes, stdout: () => joined("out"), stderr: () => joined("err") };
}

const outLine = (text: string): HeldLine => ({ text, stream: "out" });

// --- flush: styling a held `out` line by the runners' shapes -------------------------------------------

test("flush, rich: each verdict word takes its colour and the [id] is bold; the text itself is unchanged", () => {
  const lines = [
    "ok    [first-publish] 24 examined",
    "FAIL  [budget] no AGENTS.md at the repository root",
    "WARN  [template-version-behind] project/plans/008.md:1: declares plan@0.1",
    "SKIP  [bridge] no .claude/ directory — nothing to bridge",
  ];
  const c = capture({ rich: true });
  c.out.flush(lines.map(outLine));
  const written = c.stdout();
  // Each verdict is checked on its own: a painter that styles only `ok` fails the other three. No glyph:
  // render-plain.test.ts pins a `--ui --verbose` line as starting with its verdict word.
  assert.ok(written.includes(paint("green", "ok")), `ok is not green: ${JSON.stringify(written)}`);
  assert.ok(written.includes(paint("red", "FAIL")), `FAIL is not red: ${JSON.stringify(written)}`);
  assert.ok(written.includes(paint("yellow", "WARN")), `WARN is not yellow: ${JSON.stringify(written)}`);
  assert.ok(written.includes(paint("dim", "SKIP")), `SKIP is not dim: ${JSON.stringify(written)}`);
  for (const id of ["[first-publish]", "[budget]", "[template-version-behind]", "[bridge]"]) {
    assert.ok(written.includes(paint("bold", id)), `${id} is not bold: ${JSON.stringify(written)}`);
  }
  // Styling adds colour and nothing else to a verdict line: stripped, the bytes are what the runner wrote.
  assert.equal(stripSgr(written), lines.map((line) => `${line}\n`).join(""));
});

test("flush, rich: the composition preamble — header name bold, Composed capitalised, id@N bold", () => {
  const c = capture({ rich: true });
  c.out.flush([
    outLine("check-agents-md — /path/to/repo"),
    outLine("composed 7 checks:"),
    outLine("  manifest-sync@1    sh/unported/checks/15-manifest-sync.sh"),
    outLine("composed deny-list: 3 names, expanded to 9 patterns"),
  ]);
  const written = c.stdout();
  assert.ok(written.includes(`${paint("bold", "check-agents-md")} — /path/to/repo\n`), JSON.stringify(written));
  assert.ok(written.includes(`  ${paint("bold", "manifest-sync@1")}    sh/unported/checks/15-manifest-sync.sh\n`), JSON.stringify(written));
  assert.equal(
    stripSgr(written),
    "check-agents-md — /path/to/repo\n" +
      "Composed 7 checks:\n" +
      "  manifest-sync@1    sh/unported/checks/15-manifest-sync.sh\n" +
      "Composed deny-list: 3 names, expanded to 9 patterns\n",
  );
});

test("flush, rich: a line of no known shape is written exactly as held", () => {
  const lines = ["hint: run with --verbose", "  detail: the fix is to rename docs/x.md", "FIXED [links] docs/a.md: rewrote 2 links", ""];
  const c = capture({ rich: true });
  c.out.flush(lines.map(outLine));
  assert.equal(c.stdout(), lines.map((line) => `${line}\n`).join(""));
});

test("flush, rich: a held entry carrying several lines is styled line by line", () => {
  const c = capture({ rich: true });
  c.out.flush([outLine("ok    [a] one\nFAIL  [b] two\n  detail under b")]);
  const written = c.stdout();
  assert.ok(written.includes(paint("green", "ok")) && written.includes(paint("red", "FAIL")), JSON.stringify(written));
  assert.ok(written.includes(paint("bold", "[a]")) && written.includes(paint("bold", "[b]")), JSON.stringify(written));
  assert.equal(stripSgr(written), "ok    [a] one\nFAIL  [b] two\n  detail under b\n");
});

test("flush, rich with colour off: no escape byte, and Composed still capitalised", () => {
  const c = capture({ rich: true, colour: false });
  c.out.flush([outLine("composed 2 checks:"), outLine("FAIL  [budget] no AGENTS.md")]);
  assert.equal(c.stdout(), "Composed 2 checks:\nFAIL  [budget] no AGENTS.md\n");
});

test("flush: every held line goes to its own stream, in the order it was held", () => {
  const c = capture({ rich: true });
  c.out.flush([outLine("one"), { text: "warning: careful", stream: "err" }, outLine("two")]);
  assert.deepEqual(
    c.writes.map((w) => `${w.stream}:${stripSgr(w.text)}`),
    ["out:one\n", "err:warning: careful\n", "out:two\n"],
  );
});

test("flush, rich: an err line is never styled, whatever its shape", () => {
  const c = capture({ rich: true });
  c.out.flush([{ text: "FAIL  [x] written to stderr", stream: "err" }]);
  assert.equal(c.stderr(), "FAIL  [x] written to stderr\n");
  assert.equal(c.stdout(), "");
});

test("flush, plain: every line is written as held, lowercase preamble included, on its own stream", () => {
  const c = capture({ rich: false });
  c.out.flush([outLine("composed 7 checks:"), outLine("ok    [a] one"), { text: "warning: w", stream: "err" }, outLine("FAIL  [b] two")]);
  assert.equal(c.stdout(), "composed 7 checks:\nok    [a] one\nFAIL  [b] two\n");
  assert.equal(c.stderr(), "warning: w\n");
});

// --- the block standing in for finding lines ----------------------------------------------------------

test("a warning held between a finding and its detail keeps the finding whole, the warning in its place", () => {
  // Rich, with a report block: a finding carrying indented detail is printed with it (dossier 014), and a
  // warning the module raised in between neither drops the finding nor orphans the detail.
  const c = capture({ rich: true, colour: false });
  const report = { findings: [{ level: "fail", check: "x", evidence: "thing" }], skipped: [] };
  c.out.result(
    { code: 1, summary: "1 checks, 1 failed", data: report },
    {
      json: false,
      title: "vibe-ops check",
      where: "repo",
      held: [outLine("FAIL  [x] thing"), { text: "warning: careful", stream: "err" }, outLine("  detail under x")],
    },
  );
  const order = c.writes.map((w) => `${w.stream}:${w.text}`);
  const finding = order.findIndex((w) => w.startsWith("out:") && w.includes("[x] thing"));
  const warning = order.indexOf("err:warning: careful\n");
  const detail = order.indexOf("out:  detail under x\n");
  assert.ok(finding !== -1 && warning !== -1 && detail !== -1, JSON.stringify(order));
  assert.ok(finding < warning && warning < detail, `out of order: ${JSON.stringify(order)}`);
});

// --- progress: the status line --------------------------------------------------------------------------

test("progress, rich with a terminal on stderr: the status line has no newline, and stop() erases it once", () => {
  const c = capture({ rich: true, statusLine: true });
  const stop = c.out.progress("vibe-ops check");
  assert.equal(stripSgr(c.stderr()), "◌ vibe-ops check · running…");
  stop();
  assert.equal(stripSgr(c.stderr()), "◌ vibe-ops check · running…\r\x1b[2K");
  stop();
  assert.equal(stripSgr(c.stderr()), "◌ vibe-ops check · running…\r\x1b[2K", "a second stop() wrote again");
  assert.equal(c.stdout(), "");
});

test("progress draws nothing when stderr is not a terminal, or when the run is plain", () => {
  for (const options of [{ rich: true }, { rich: true, statusLine: false }, { rich: false, statusLine: true }]) {
    const c = capture(options);
    const stop = c.out.progress("vibe-ops check");
    stop();
    assert.deepEqual(c.writes, [], `wrote under ${JSON.stringify(options)}`);
  }
});

// --- the block's title ----------------------------------------------------------------------------------

test("the report block opens with the sentence `result of <what ran> – <anchor>`", () => {
  const plain: Paint = (_style, text) => text;
  const lines = renderReport({ findings: [], skipped: [] }, { title: "vibe-ops check", where: "vibe-ops", summary: "3 checks, 0 failed", code: 0 }, plain);
  assert.ok(
    lines.some((line) => line.trim() === "result of vibe-ops check – vibe-ops"),
    `no title sentence in ${JSON.stringify(lines)}`,
  );
});
