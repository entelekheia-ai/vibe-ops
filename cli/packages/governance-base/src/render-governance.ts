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

/** The `notes` fragment a package ships, or nothing. A declared-but-missing fragment is reported by the
 *  `facet-completeness` gate; here it is simply absent, because a renderer that throws would make one
 *  package's packaging mistake take down every other type's section too. */
function notesFor(entry: RenderableType): string | undefined {
  const relative = entry.unit.notes;
  if (relative === undefined) return undefined;
  const file = path.resolve(entry.root, relative);
  if (!existsSync(file)) return undefined;
  const body = readFileSync(file, "utf8").replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "").trim();
  return body === "" ? undefined : body;
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
  if (lifecycle === undefined && notes === undefined) return undefined;

  const where = unit.dirs?.[0];
  const heading = where === undefined ? `### ${titleOf(unit)}` : `### ${titleOf(unit)} (\`${where}/\`)`;

  const lines: string[] = [heading, ""];
  if (lifecycle === undefined) {
    if (notes !== undefined) lines.push(notes, "");
    return lines.join("\n");
  }
  lines.push("```", lifecycle.chain.join(" → "), "```", "");

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

  if (notes !== undefined) lines.push(notes, "");

  return lines.join("\n");
}

/** Every activated type that declares a lifecycle, in the order given. */
function sections(types: readonly RenderableType[]): readonly string[] {
  return types.map(renderTypeSection).filter((section): section is string => section !== undefined);
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
 * `GOVERNANCE.md` — `shaped`. The rendered lifecycles replace whatever stands between the markers, and
 * every other line of the file survives untouched. A file with no markers yet gets them appended once,
 * which is what makes the first promulgation into an existing repository additive rather than a
 * replacement of a document somebody wrote.
 */
export function renderGovernanceDoc(types: readonly RenderableType[], existing: string | undefined): string {
  const block = [GOVERNANCE_BEGIN, "", sections(types).join("\n").trimEnd(), "", GOVERNANCE_END].join("\n");

  if (existing === undefined || existing.trim() === "") {
    return `# Governance\n\nWhich record answers which question, and how each one's life goes.\n\n${block}\n`;
  }

  const begin = existing.indexOf(GOVERNANCE_BEGIN);
  const end = existing.indexOf(GOVERNANCE_END);
  if (begin === -1 || end === -1 || end < begin) {
    return `${existing.trimEnd()}\n\n${block}\n`;
  }
  return `${existing.slice(0, begin)}${block}${existing.slice(end + GOVERNANCE_END.length)}`;
}
