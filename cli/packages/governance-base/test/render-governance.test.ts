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

/** The rendered document, asserting the render was not refused. Every test below that says `doc(...)`
 *  is also asserting `ok` — the refusal cases call `renderGovernanceDoc` directly. */
function doc(...args: Parameters<typeof renderGovernanceDoc>): string {
  const result = renderGovernanceDoc(...args);
  assert.ok(result.ok, `render refused: ${result.ok ? "" : result.refusal}`);
  return result.content;
}

const PLAN = unitWith({
  type: "plan",
  answers: "How do we build X?",
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
  answers: "We decided X, because Y",
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
  const first = doc([PLAN], undefined);
  const edited = `${first.replace("# Governance", "# Governance\n\nWe keep records because a decision nobody wrote down was never made.")}\n## Our own section\n\nKeep this.\n`;
  const second = doc([PLAN, ADR], edited);

  assert.match(second, /a decision nobody wrote down was never made/);
  assert.match(second, /## Our own section/);
  assert.match(second, /Keep this\./);
  assert.match(second, /\| \*\*ADR\*\* \|/);
  assert.equal(second.split(GOVERNANCE_BEGIN).length - 1, 1, "exactly one rendered block");
});

test("a re-render replaces the previous lifecycles rather than appending a second set", () => {
  const first = doc([PLAN, ADR], undefined);
  const second = doc([PLAN], first);
  assert.match(second, /\| \*\*Plan\*\* \|/);
  assert.doesNotMatch(second, /\| \*\*ADR\*\* \|/);
  assert.equal(second.split(GOVERNANCE_END).length - 1, 1);
});

// A document somebody wrote before this mechanism existed must not be replaced by one this renderer
// authored — the markers are appended and everything already there is kept.
test("an existing document with no markers keeps all of itself and gains the block", () => {
  const rendered = doc([PLAN], "# Governance\n\nEverything here predates the renderer.\n");
  assert.match(rendered, /Everything here predates the renderer\./);
  assert.match(rendered, /\| \*\*Plan\*\* \|/);
  assert.ok(rendered.indexOf("predates") < rendered.indexOf(GOVERNANCE_BEGIN));
});

// A DELETED MARKER IS A DAMAGED DOCUMENT, and the fix is refusing rather than appending. `indexOf` on
// each marker independently took the append path here, and the orphan BEGIN then paired with the
// appended one ACROSS the repository's own prose — which the next render deleted, silently.
test("a document carrying an unpaired marker is refused rather than appended to", () => {
  const damaged = `# Governance\n\nMINE-TOP\n\n${GOVERNANCE_BEGIN}\n\n### Old\n\nMINE-BOTTOM\n`;
  const result = renderGovernanceDoc([PLAN], damaged);
  assert.equal(result.ok, false);
  assert.match(result.ok ? "" : result.refusal, /marker/);
});

test("markers in the wrong order are refused, and repeated pairs too", () => {
  const reversed = `# G\n\n${GOVERNANCE_END}\n\n${GOVERNANCE_BEGIN}\n`;
  assert.equal(renderGovernanceDoc([PLAN], reversed).ok, false);

  const twice = `${doc([PLAN], undefined)}\n${doc([PLAN], undefined)}`;
  assert.equal(renderGovernanceDoc([PLAN], twice).ok, false);
});

// ---- what the chain says, and what leaves it ------------------------------------------------------

test("a branch renders under the chain and never inside it, so the terminal sentence stops contradicting the diagram", () => {
  const adr = unitWith({
    type: "adr",
    title: "ADR",
    template: "./t.md",
    authoring: "./a.md",
    migrations: "./m",
    dirs: ["project/adr"],
    lifecycle: {
      chain: ["Proposed", "Accepted"],
      active: "Proposed",
      terminal: "Accepted",
      branches: [
        { from: "Accepted", status: "Deprecated" },
        { from: "Accepted", status: "Superseded", archive: "superseded" },
      ],
    },
  });
  const rendered = renderGovernanceRule([adr], "P.");
  assert.match(rendered, /Proposed → Accepted\n└ from Accepted: Deprecated · Superseded → superseded\//);
  assert.match(rendered, /\*\*Accepted\*\* is terminal/);
  assert.doesNotMatch(rendered, /Proposed → Accepted → /);
});

test("a chain that continues past its own declared terminal is refused at parse time", () => {
  assert.throws(
    () =>
      unitWith({
        type: "adr",
        template: "./t.md",
        authoring: "./a.md",
        migrations: "./m",
        lifecycle: { chain: ["Proposed", "Accepted", "Superseded"], terminal: "Accepted" },
      }),
    /continuing past it/,
  );
});

// ---- the map: what the old GOVERNANCE.md carried and the renderer lost ---------------------------

test("the map table is rendered from each type's own `answers`, and a type declaring none contributes no row", () => {
  const withAnswer = unitWith({
    type: "plan",
    answers: "How do we build X?",
    template: "./t.md",
    authoring: "./a.md",
    migrations: "./m",
    dirs: ["project/plans"],
    lifecycle: { chain: ["Backlog", "Shipped"] },
  });
  const rendered = doc([withAnswer, UNDECLARED], undefined, "Map prose.");
  assert.match(rendered, /\| Artifact \| Question \| Lives in \| Lifecycle \|/);
  assert.match(rendered, /\| \*\*Plan\*\* \| How do we build X\? \| `project\/plans\/` \|/);
  assert.doesNotMatch(rendered, /\| \*\*Rfc\*\* \|/, "the type with no `answers` contributes no row");
  assert.match(rendered, /Map prose\./);
});

test("the map prose sits inside the block, so a re-render refreshes it rather than leaving a stale copy", () => {
  const first = doc([PLAN], undefined, "First map.");
  const second = doc([PLAN], first, "Second map.");
  assert.match(second, /Second map\./);
  assert.doesNotMatch(second, /First map\./);
});

// ---- a packaging fault is visible in the document, not only in a gate ----------------------------

test("a notes-only type whose fragment is missing keeps its heading and says what is missing", () => {
  const notesOnly = unitWith({ type: "log", title: "Log", template: "./t.md", authoring: "./a.md", migrations: "./m", notes: "./gone.md", dirs: ["project/log"] });
  const rendered = renderGovernanceRule([notesOnly], "P.");
  assert.match(rendered, /### Log \(`project\/log\/`\)/);
  assert.match(rendered, /declares `notes: \.\/gone\.md` and does not ship it/);
  assert.match(rendered, /description: .*\(log\)/);
});

// ---- a manifest is data a third party ships ------------------------------------------------------

// A MANIFEST IS DATA A THIRD PARTY SHIPS. An absolute path is refused where it is parsed; a relative one
// that escapes is refused where the root is known, because a unit a repository declares under `.agents/`
// legitimately reaches its own templates through `../../`.
test("an absolute path is refused at parse time, and a title that spans two lines with it", () => {
  const base = { type: "x", template: "./t.md", authoring: "./a.md", migrations: "./m" };
  assert.throws(() => unitWith({ ...base, notes: "/etc/hosts" }), /an absolute path/);
  assert.throws(() => unitWith({ ...base, facets: { p: "/etc/hosts" } }), /an absolute path/);
  assert.throws(() => unitWith({ ...base, title: "Y\n\n## Injected" }), /more than one line/);
});

test("a relative notes path that escapes the package reads nothing and says so in the document", () => {
  const escaping = unitWith({ ...{ type: "x", template: "./t.md", authoring: "./a.md", migrations: "./m" }, notes: "../../../../etc/hosts" });
  const rendered = renderGovernanceRule([escaping], "P.");
  assert.match(rendered, /which leaves the package — nothing was read/);
  assert.doesNotMatch(rendered, /localhost/);
});

test("immutableFrom is validated and kept whether or not the type declares a terminal", () => {
  const base = { type: "x", template: "./t.md", authoring: "./a.md", migrations: "./m" };
  assert.throws(
    () => unitWith({ ...base, lifecycle: { chain: ["A", "B", "C"], immutableFrom: "NotInChain" } }),
    /not one of its own chain/,
  );
  const kept = unitWith({ ...base, lifecycle: { chain: ["A", "B", "C"], immutableFrom: "B" } });
  assert.equal(kept.unit.lifecycle?.immutableFrom, "B");
});

// THE TWO DOCUMENTS ARE NOT COPIES OF EACH OTHER, and they were: both carried the same `###` sections,
// so `GOVERNANCE.md` was a strict subset of the rule while each pointed at the other for what it did not
// have. The map says which record answers which question; the mechanics are the rule's.
test("the map does not restate the rule's lifecycle sections", () => {
  const rendered = doc([PLAN, ADR], undefined, "Map prose.");
  assert.doesNotMatch(rendered, /### Plan/);
  assert.doesNotMatch(rendered, /### ADR/);
  assert.match(rendered, /\| \*\*Plan\*\* \| How do we build X\? \| `project\/plans\/` \| Backlog → In Progress → Shipped \|/);

  const rule = renderGovernanceRule([PLAN, ADR], "P.");
  assert.match(rule, /### Plan/);
  assert.doesNotMatch(rule, /\| Artifact \| Question \|/);
});

test("a type with no chain says so in the map rather than leaving the cell blank", () => {
  const log = unitWith({ type: "log", title: "Log", answers: "How we got here", template: "./t.md", authoring: "./a.md", migrations: "./m", dirs: ["project/log"] });
  assert.match(doc([log], undefined, "M."), /\| \*\*Log\*\* \| How we got here \| `project\/log\/` \| write-once \|/);
});
