// The two governance documents, rendered from what a repository ACTIVATES — Plan-040 Track 6, RFC-0005 §4.
//
// WHY THEY ARE RENDERED AND NOT COPIED. Both describe every governed type's lifecycle, and both were
// static files a scaffold wrote once. A repository that later bound a sixth type therefore had two
// documents confidently describing five, and `agents/rules/governance.md` is `norm` — promulgation
// overwrites it — so the divergence was measured in three of three repositories before the ownership
// boundary existed. A document about the activated types has to be a function of the activated types.
//
// WHAT IS DATA AND WHAT STAYS PROSE. The chain, where the records live, what is immutable from when,
// which sections are living, where a terminal record is archived — all of that is `lifecycle` in the
// type's own manifest, and rendering it is mechanical. Everything else about a type's lifecycle is a
// paragraph: why a plan is permanent, what the closure ceremony does, why a gap in the log's numbering
// is expected. That half is a markdown fragment the owning package ships (`lifecycle.notes`), included
// verbatim. Encoding a paragraph as fields would make the renderer the author, and it is not.
//
// THE TWO DOCUMENTS DIFFER IN WHO OWNS THE REST OF THE FILE. The rule is `norm`: rendered whole, and a
// local edit to it is drift. `GOVERNANCE.md` is `shaped`: the rendered lifecycles sit between two
// markers and everything outside them is the repository's, permanently — which is what lets one file be
// both current with the activated types and a place someone can write.

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { TypeUnit } from "./type-unit.ts";

/**
 * One activated type, with the root its `notes` fragment resolves against.
 *
 * The unit is described STRUCTURALLY rather than as a `TypeUnit`, because the thing callers actually
 * hold is core's activated view — which carries what core reads and not the parser's full shape. Naming
 * the fields this renderer needs is both the honest contract and what lets an activation reach it
 * without a cast that would hide a field going missing.
 */
export interface RenderableType {
  readonly unit: {
    readonly type: string;
    readonly title?: string;
    readonly answers?: string;
    readonly dirs?: readonly string[];
    readonly numbered?: boolean;
    readonly pad?: number;
    readonly notes?: string;
    readonly lifecycle?: TypeUnit["lifecycle"];
  };
  /** Absolute path to the package root. */
  readonly root: string;
}

/** The markers `GOVERNANCE.md` keeps its rendered half between. Chosen as HTML comments so they render
 *  as nothing, and matched literally — a reader may move the block, and must be able to. */
export const GOVERNANCE_BEGIN = "<!-- vibe-ops:lifecycles begin -->";
export const GOVERNANCE_END = "<!-- vibe-ops:lifecycles end -->";

/** How a type is written in a heading. A package may declare `title` — `adr` presents itself as `ADR`,
 *  `log` as `Log` — because whether a type name is an acronym or a word is a fact about that type, not a
 *  rule a renderer can infer: a length test made the log `LOG`. Title-case is the default. */
function titleOf(unit: RenderableType["unit"]): string {
  return unit.title ?? unit.type.charAt(0).toUpperCase() + unit.type.slice(1);
}

/**
 * The `notes` fragment a package ships, or nothing — and WHICH KIND of nothing.
 *
 * The distinction is the finding, not pedantry. A type that declares no `notes` has none; a type that
 * declares one whose file is missing has a packaging fault, and reading both as "absent" made a
 * notes-only type — the log, which has prose and no chain — lose its whole section from both governance
 * documents of every consuming repository, with no output from any gate. `facet-completeness@3` now
 * reports the missing file; this reports it in the document itself, because the gate runs where the
 * package is developed and the document is read where it is installed.
 *
 * A renderer still never throws: one package's packaging mistake must not take down every other type's
 * section.
 */
function notesFor(entry: RenderableType): { readonly body?: string; readonly problem?: string } {
  const relative = entry.unit.notes;
  if (relative === undefined) return {};
  const file = path.resolve(entry.root, relative);
  // CONTAINMENT IS CHECKED HERE BECAUSE HERE IS WHERE THE ROOT IS KNOWN. The parser cannot: a unit a
  // repository declares under `.agents/` reaches its own templates through `../../`, legitimately. This
  // reader's root is the package, and the content it returns is inlined verbatim into a document written
  // into somebody else's repository — `notes: "../../../../etc/hosts"` parsed and was served.
  if (path.relative(entry.root, file).startsWith("..")) {
    return { problem: `declares \`notes: ${relative}\`, which leaves the package — nothing was read` };
  }
  if (!existsSync(file)) return { problem: `declares \`notes: ${relative}\` and does not ship it, so its prose is missing here` };
  const body = readFileSync(file, "utf8").replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "").trim();
  return body === "" ? { problem: `declares \`notes: ${relative}\` and ships it empty` } : { body };
}

/** The branch line under a chain — `└ from Accepted: Deprecated · Superseded (→ `superseded/`)`. One line
 *  per origin, so a type branching from two statuses says so rather than collapsing them. */
function branchLines(lifecycle: NonNullable<TypeUnit["lifecycle"]>): readonly string[] {
  const branches = lifecycle.branches ?? [];
  if (branches.length === 0) return [];
  const byOrigin = new Map<string, string[]>();
  for (const branch of branches) {
    const label = branch.archive === undefined ? branch.status : `${branch.status} → ${branch.archive}/`;
    byOrigin.set(branch.from, [...(byOrigin.get(branch.from) ?? []), label]);
  }
  return [...byOrigin].map(([from, labels]) => `└ from ${from}: ${labels.join(" · ")}`);
}

/**
 * One type's section: the chain, the facts that follow from it, and the package's own paragraphs.
 * A type with no `lifecycle` is skipped by the callers below rather than rendered empty — a heading with
 * nothing under it reads as a type that has no lifecycle, which is a different claim from "this type's
 * package has not declared one yet".
 */
export function renderTypeSection(entry: RenderableType): string | undefined {
  const { unit } = entry;
  const lifecycle = unit.lifecycle;
  const notes = notesFor(entry);

  // A TYPE MAY HAVE PROSE AND NO CHAIN, and the log is the reason this is not an oversight: it is
  // write-once, so it has no status to be at. Requiring a chain here would have made its section vanish
  // from a document that has always carried it — or, worse, invited a status word to be invented for it,
  // which is the one thing this repository's own rule tells every reader not to do.
  //
  // A DECLARED-BUT-MISSING FRAGMENT STILL RENDERS ITS HEADING, saying what is missing. Silence there is
  // the failure mode this whole plan keeps finding: the section simply stopped existing, in every
  // consuming repository, and every output stayed green.
  if (lifecycle === undefined && notes.body === undefined && notes.problem === undefined) return undefined;

  const where = unit.dirs?.[0];
  const heading = where === undefined ? `### ${titleOf(unit)}` : `### ${titleOf(unit)} (\`${where}/\`)`;
  const gap = notes.problem === undefined ? undefined : `*This type's package ${notes.problem}.*`;

  const lines: string[] = [heading, ""];
  if (lifecycle === undefined) {
    if (notes.body !== undefined) lines.push(notes.body, "");
    if (gap !== undefined) lines.push(gap, "");
    return lines.join("\n");
  }
  lines.push("```", [lifecycle.chain.join(" → "), ...branchLines(lifecycle)].join("\n"), "```", "");

  // The chain printed above stops at `terminal`, so this sentence no longer contradicts it. It used to:
  // `adr` declared `[Proposed, Accepted, Superseded]` with `terminal: "Accepted"`, and the section said
  // "Accepted is terminal" two lines under a chain visibly continuing past it.
  const facts: string[] = [
    `Worked at **${lifecycle.active}**; **${lifecycle.terminal}** is terminal.`,
  ];
  if (lifecycle.immutableFrom !== undefined) {
    facts.push(`Immutable from **${lifecycle.immutableFrom}** on — a change after that is a new record that supersedes this one, never an edit.`);
  }
  if (lifecycle.archive !== undefined) {
    facts.push(`A terminal record moves into \`${lifecycle.archive}/\`.`);
  }
  if (lifecycle.living !== undefined && lifecycle.living.length > 0) {
    facts.push(
      `Living sections — maintained while the work happens, never reconstructed at the end: ${lifecycle.living.map((s) => `**${s}**`).join(", ")}.`,
    );
  }
  facts.push(unit.numbered === false ? "Not numbered." : `Numbered, ${unit.pad ?? 3} digits, monotonic and never renumbered.`);
  lines.push(facts.join(" "), "");

  if (notes.body !== undefined) lines.push(notes.body, "");
  if (gap !== undefined) lines.push(gap, "");

  return lines.join("\n");
}

/** Every activated type that declares a lifecycle, in the order given. */
function sections(types: readonly RenderableType[]): readonly string[] {
  return types.map(renderTypeSection).filter((section): section is string => section !== undefined);
}

/**
 * The map table — which record answers which question, and where it lives.
 *
 * IT IS RENDERED FOR THE SAME REASON THE LIFECYCLES ARE. This was a static five-row block in a
 * scaffolded `GOVERNANCE.md`, so a repository binding a sixth type carried a map confidently describing
 * five; it was then lost entirely when the template moved into the packages, which is the loss this
 * restores. A type declaring no `answers` contributes no row rather than an invented one — an empty
 * table renders as nothing at all.
 */
export function renderMapTable(types: readonly RenderableType[]): string | undefined {
  const rows = types
    .filter((entry) => entry.unit.answers !== undefined)
    .map((entry) => {
      const where = entry.unit.dirs?.[0];
      // The chain, compactly — the successor to the old table's `Ratified?` column. It is the ONE
      // lifecycle fact this document keeps: enough for a reader to see whether a type is ratified or
      // write-once without opening the rule, and short enough that the rule stays the place the
      // mechanics live rather than a second copy of them.
      const chain = entry.unit.lifecycle === undefined ? "write-once" : entry.unit.lifecycle.chain.join(" → ");
      return `| **${titleOf(entry.unit)}** | ${entry.unit.answers!} | ${where === undefined ? "—" : `\`${where}/\``} | ${chain} |`;
    });
  if (rows.length === 0) return undefined;
  return ["| Artifact | Question | Lives in | Lifecycle |", "|---|---|---|---|", ...rows].join("\n");
}

/**
 * `agents/rules/governance.md` — `norm`, rendered whole.
 *
 * `preamble` is the type-agnostic half (numbering, where the version lives, when a record migrates),
 * shipped by `governance-base` rather than written here: it is prose, and this module renders.
 */
export function renderGovernanceRule(types: readonly RenderableType[], preamble: string): string {
  const rendered = sections(types);
  // Named from what actually rendered, not from what declares a lifecycle: a type may have prose and no
  // chain, and a description that omits it describes a document it is part of.
  const names = types.filter((t) => renderTypeSection(t) !== undefined).map((t) => t.unit.type);
  const frontmatter = [
    "---",
    `description: Lifecycles for this repository's governance records (${names.join(" / ")}) — when each is immutable, permanent, or ephemeral, and where it lives.`,
    'paths: ["project/**"]',
    "---",
    "",
  ].join("\n");

  return `${frontmatter}${preamble.trim()}\n\n${rendered.join("\n")}`.trimEnd() + "\n";
}

/**
 * `GOVERNANCE.md` — `shaped`. The rendered block replaces whatever stands between the markers, and every
 * other line of the file survives untouched. A file with NEITHER marker gets them appended once, which is
 * what makes the first promulgation into an existing repository additive rather than a replacement of a
 * document somebody wrote. Any other marker count is a damaged document and is refused.
 *
 * The block carries two things: the map table — which record answers which question, where it lives and
 * what its chain is — and `map`, the type-agnostic prose `governance-base` ships about how the records
 * relate. The first is a function of what is activated; the second is a paragraph, and the same argument
 * that keeps `lifecycle.notes` prose keeps this one.
 */
export type GovernanceDocResult =
  | { readonly ok: true; readonly content: string }
  | { readonly ok: false; readonly refusal: string };

function count(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

export function renderGovernanceDoc(
  types: readonly RenderableType[],
  existing: string | undefined,
  map?: string,
): GovernanceDocResult {
  // THE LIFECYCLE SECTIONS ARE DELIBERATELY NOT HERE. Both documents carried them, so `GOVERNANCE.md`
  // was a strict subset of the rule while each pointed at the other for what it did not have — the rule's
  // preamble sending readers here "for the what and why", at a document that had none. This is the map:
  // which record answers which question, where it lives, and its chain in one cell. The mechanics are the
  // rule's, which is what both pointers now truthfully say.
  const body = [renderMapTable(types), map?.trim()].filter((part): part is string => part !== undefined && part !== "");
  const block = [GOVERNANCE_BEGIN, "", body.join("\n\n"), "", GOVERNANCE_END].join("\n");

  if (existing === undefined || existing.trim() === "") {
    return { ok: true, content: `# Governance\n\nHow decisions and work are recorded in this repository.\n\n${block}\n` };
  }

  // EXACTLY ONE WELL-ORDERED PAIR, OR NOTHING TO REPLACE. `indexOf` on each marker independently was the
  // whole defect: a document that had lost its END — one deleted line — took the append path, and the
  // orphan BEGIN then paired with the appended one across the repository's own prose, which the NEXT
  // render silently deleted. So the append path is reachable only from a document carrying neither
  // marker, and every other count is a damaged document this refuses to write over.
  const begins = count(existing, GOVERNANCE_BEGIN);
  const ends = count(existing, GOVERNANCE_END);
  if (begins === 0 && ends === 0) {
    return { ok: true, content: `${existing.trimEnd()}\n\n${block}\n` };
  }
  if (begins !== 1 || ends !== 1) {
    return {
      ok: false,
      refusal:
        `GOVERNANCE.md carries ${begins} \`lifecycles begin\` marker(s) and ${ends} \`lifecycles end\` — exactly one of each is` +
        ` the shape this can render into. Repair the markers by hand; rendering over this would take the prose between them.`,
    };
  }
  const begin = existing.indexOf(GOVERNANCE_BEGIN);
  const end = existing.indexOf(GOVERNANCE_END);
  if (end < begin) {
    return {
      ok: false,
      refusal: "GOVERNANCE.md carries its `lifecycles end` marker before its `lifecycles begin` — repair the order by hand.",
    };
  }
  return { ok: true, content: `${existing.slice(0, begin)}${block}${existing.slice(end + GOVERNANCE_END.length)}` };
}
