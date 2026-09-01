// parseOpsDefinition — the `.json` collection's parser (Plan-034 Track 2). The tests mirror the
// defineModule precedent it follows: a definition that describes itself wrongly fails at load, naming
// the file and the field, and a typoed optional key is refused rather than composing silently.

import { test } from "node:test";
import assert from "node:assert/strict";
import { parseOpsDefinition } from "../src/ops-load.ts";

const VALID = {
  id: "sample",
  version: "0.0.1",
  summary: "A sample collection",
  derives: ["record-schema"],
  gates: [
    { gate: "markdown-link", emits: true },
    {
      gate: "fragment-parity",
      label: "fragment-parity-links",
      paths: ["**/*.md"],
      options: { runner: "sh/run.sh", fragment: "links", against: "markdown-link" },
      fixture: { expect: ["fragment-parity"], files: { "a.md": "# a\n" } },
    },
  ],
};

test("a valid collection parses into the definition defineOps takes, fields intact", () => {
  const definition = parseOpsDefinition(JSON.stringify(VALID), "ops.json");
  assert.equal(definition.id, "sample");
  assert.deepEqual(definition.derives, ["record-schema"]);
  assert.equal(definition.gates.length, 2);
  assert.equal(definition.gates[1]!.label, "fragment-parity-links");
  assert.deepEqual(definition.gates[1]!.fixture?.files, { "a.md": "# a\n" });
});

test("an unknown key is refused, naming it — a typo must not compose silently", () => {
  const typoed = { ...VALID, gates: [{ gate: "markdown-link", emit: true }] };
  assert.throws(() => parseOpsDefinition(JSON.stringify(typoed), "ops.json"), /unknown key "emit"/);
});

test("a derive rule the runtime does not know is refused at load, not at the first run", () => {
  const unknown = { ...VALID, derives: ["record-schema", "no-such-rule"] };
  assert.throws(() => parseOpsDefinition(JSON.stringify(unknown), "ops.json"), /derives may name only/);
});

test("a missing required field names the file and the field", () => {
  const { summary: _dropped, ...noSummary } = VALID;
  assert.throws(() => parseOpsDefinition(JSON.stringify(noSummary), "the/ops.json"), /the\/ops\.json.*summary/);
});

test("invalid JSON fails as a parse error, never as a half-read definition", () => {
  assert.throws(() => parseOpsDefinition("{ not json", "ops.json"), /not valid JSON/);
});

test("a fixture with empty files, or empty expect, is refused — it could prove nothing", () => {
  const emptyFiles = {
    ...VALID,
    gates: [{ gate: "markdown-link", fixture: { expect: ["x"], files: {} } }],
  };
  assert.throws(() => parseOpsDefinition(JSON.stringify(emptyFiles), "ops.json"), /files must map at least one path/);
  const emptyExpect = {
    ...VALID,
    gates: [{ gate: "markdown-link", fixture: { expect: [], files: { "a.md": "x" } } }],
  };
  assert.throws(() => parseOpsDefinition(JSON.stringify(emptyExpect), "ops.json"), /expect must be a non-empty array/);
});
