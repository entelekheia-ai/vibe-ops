import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { parseTypeUnit } from "../src/type-unit.ts";
import { renderGovernanceRule, renderGovernanceDoc, GOVERNANCE_BEGIN, GOVERNANCE_END } from "../src/render-governance.ts";
import type { RenderableType } from "../src/render-governance.ts";

function unitWith(manifest: Record<string, unknown>): RenderableType {
  return { unit: parseTypeUnit(JSON.stringify(manifest), "/x/type.json"), root: "/x" };
}

const PLAN = unitWith({
  type: "plan",
  template: "./t.md",
  authoring: "./a.md",
  migrations: "./m",
  dirs: ["project/plans"],
  lifecycle: {
    chain: ["Backlog", "In Progress", "Shipped"],
    living: ["Decision Log", "Outcomes & Retrospective"],
    archive: "shipped",
  },
});

const ADR = unitWith({
  type: "adr",
  title: "ADR",
  template: "./t.md",
  authoring: "./a.md",
  migrations: "./m",
  pad: 4,
  dirs: ["project/adr"],
  lifecycle: { chain: ["Proposed", "Accepted", "Superseded"], terminal: "Superseded", immutableFrom: "Accepted" },
});

/** A type whose package declares no lifecycle at all — the shape every type had before Track 2. */
const UNDECLARED = unitWith({ type: "rfc", template: "./t.md", authoring: "./a.md", migrations: "./m" });

test("a type's section renders its chain and the facts that follow from it", () => {
  const rendered = renderGovernanceRule([PLAN], "Preamble.");
  assert.match(rendered, /### Plan \(`project\/plans\/`\)/);
  assert.match(rendered, /Backlog → In Progress → Shipped/);
  assert.match(rendered, /Worked at \*\*In Progress\*\*; \*\*Shipped\*\* is terminal\./);
  assert.match(rendered, /moves into `shipped\/`/);
  assert.match(rendered, /\*\*Decision Log\*\*, \*\*Outcomes & Retrospective\*\*/);
  assert.match(rendered, /Numbered, 3 digits/);
});

test("immutability is rendered only when the type declares it", () => {
  assert.match(renderGovernanceRule([ADR], "P."), /Immutable from \*\*Accepted\*\* on/);
  assert.doesNotMatch(renderGovernanceRule([PLAN], "P."), /Immutable from/);
});

// THE DOCUMENT IS A FUNCTION OF WHAT IS ACTIVATED — the whole reason for rendering. A repository binding
// a sixth type sees its section appear with no edit anywhere, which is what the copied file could not do.
test("the rule describes exactly the types given to it, and names them in its own frontmatter", () => {
  const one = renderGovernanceRule([PLAN], "P.");
  assert.doesNotMatch(one, /### Adr/i);
  const two = renderGovernanceRule([PLAN, ADR], "P.");
  assert.match(two, /### ADR/);
  assert.match(two, /description: .*\(plan \/ adr\)/);
});

test("a type whose package declares no lifecycle is left out, not rendered as a heading with nothing under it", () => {
  const rendered = renderGovernanceRule([PLAN, UNDECLARED], "P.");
  assert.doesNotMatch(rendered, /### Rfc/i);
  assert.match(rendered, /description: .*\(plan\)/);
});

test("a package's own prose is included verbatim, and its frontmatter is not", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "vibeops-notes-"));
  await writeFile(path.join(root, "notes.md"), "---\nkey: value\n---\n\nThe closure ceremony is what makes it permanent.\n");
  const withNotes: RenderableType = {
    root,
    unit: parseTypeUnit(
      JSON.stringify({
        type: "plan",
        template: "./t.md",
        authoring: "./a.md",
        migrations: "./m",
        notes: "./notes.md",
        lifecycle: { chain: ["Backlog", "In Progress", "Shipped"] },
      }),
      path.join(root, "type.json"),
    ),
  };
  const rendered = renderGovernanceRule([withNotes], "P.");
  assert.match(rendered, /The closure ceremony is what makes it permanent\./);
  assert.doesNotMatch(rendered, /key: value/);
});

test("a declared notes fragment that does not exist costs its own paragraph, never the whole document", () => {
  const missing = unitWith({
    type: "plan",
    template: "./t.md",
    authoring: "./a.md",
    migrations: "./m",
    notes: "./nowhere.md",
    lifecycle: { chain: ["Backlog", "Shipped"] },
  });
  const rendered = renderGovernanceRule([missing, ADR], "P.");
  assert.match(rendered, /### Plan/);
  assert.match(rendered, /### ADR/);
});

// ---- GOVERNANCE.md is `shaped`: the repository owns everything outside the markers ----------------

test("the repository's own prose survives a re-render, before and after the block", () => {
  const first = renderGovernanceDoc([PLAN], undefined);
  const edited = `${first.replace("# Governance", "# Governance\n\nWe keep records because a decision nobody wrote down was never made.")}\n## Our own section\n\nKeep this.\n`;
  const second = renderGovernanceDoc([PLAN, ADR], edited);

  assert.match(second, /a decision nobody wrote down was never made/);
  assert.match(second, /## Our own section/);
  assert.match(second, /Keep this\./);
  assert.match(second, /### ADR/);
  assert.equal(second.split(GOVERNANCE_BEGIN).length - 1, 1, "exactly one rendered block");
});

test("a re-render replaces the previous lifecycles rather than appending a second set", () => {
  const first = renderGovernanceDoc([PLAN, ADR], undefined);
  const second = renderGovernanceDoc([PLAN], first);
  assert.match(second, /### Plan/);
  assert.doesNotMatch(second, /### ADR/);
  assert.equal(second.split(GOVERNANCE_END).length - 1, 1);
});

// A document somebody wrote before this mechanism existed must not be replaced by one this renderer
// authored — the markers are appended and everything already there is kept.
test("an existing document with no markers keeps all of itself and gains the block", () => {
  const rendered = renderGovernanceDoc([PLAN], "# Governance\n\nEverything here predates the renderer.\n");
  assert.match(rendered, /Everything here predates the renderer\./);
  assert.match(rendered, /### Plan/);
  assert.ok(rendered.indexOf("predates") < rendered.indexOf(GOVERNANCE_BEGIN));
});
