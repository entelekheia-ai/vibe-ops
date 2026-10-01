// The root test script preloads cli/test-env.mjs, so a test process started inside a git hook never sees GIT_*.

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

const PRELOAD = new URL("../../../test-env.mjs", import.meta.url).pathname;

test("the preload removes every GIT_* variable from a process started with GIT_DIR set", () => {
  const r = spawnSync(
    process.execPath,
    ["--import", PRELOAD, "-e", "console.log(JSON.stringify(Object.keys(process.env).filter((k) => k.startsWith('GIT_'))))"],
    { encoding: "utf8", env: { ...process.env, GIT_DIR: "/nonexistent", GIT_INDEX_FILE: "/nonexistent/index", GIT_AUTHOR_NAME: "x" } },
  );
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout.trim(), "[]");
});

test("the root test script preloads it", async () => {
  const { readFileSync } = await import("node:fs");
  const pkg = JSON.parse(readFileSync(new URL("../../../../package.json", import.meta.url), "utf8")) as { scripts: { test: string } };
  assert.match(pkg.scripts.test, /--import \.\/cli\/test-env\.mjs/);
});
