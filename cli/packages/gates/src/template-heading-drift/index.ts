// A template is machine-comparable and the sentences ABOUT it are not. When a template loses a section,
// every sentence elsewhere describing that template's shape becomes false in the same commit and stays
// readable as authority until somebody looks. Plan-014; the trap is project/log/dropping-a-section-from-
// a-template.md, which recorded that no mechanical guard was known.
//
// THE HARD PART IS NOT FINDING THE STRING. It is knowing which strings are forbidden, and where.
//
//   - WHICH: from the migration notes, never from git history. History records that lines moved and
//     cannot tell a rename from a drop plus an addition, which would make this demand that documents
//     stop naming sections that still exist. `droppedSections` in the records package reads the notes.
//
//   - WHERE: from the ops population, never from a filter in here (ADR-0011). A record written against
//     an older template legitimately carries the old heading as its own structure; a document describing
//     the shape of records must not name it. That separation is a declared path policy in the repository's
//     own config, wrong in a way a reader can see, where a content heuristic would be wrong in a way that
//     looks like a clean tree.
//
// THE DROPPED SET IS PER TYPE, AND SO IS EVERY VERDICT. `Surprises & Discoveries` left the plan template
// at 0.2 and is still a live heading in task@3, so a flat sweep for the string accuses correct sentences
// about dossiers. Attribution decides which type a sentence is about before anything is judged, and an
// occurrence it cannot attribute is reported as a warning rather than guessed at.
//
// TWO TEXTS, DELIBERATELY. The signal is read from `describedText`, which KEEPS the interior of a code
// span, because a claim about a section is conventionally written as `Progress` and masking it would
// blank the very thing being detected. Attribution reads `proseText`, which MASKS code spans, because
// `Decision Log` is a quoted name rather than a mention of the log record type — reading attribution off
// the same buffer as the signal sends every such paragraph to the wrong type. Both masks are the same
// length as the source, so offsets are interchangeable between them.

import {
  defineGate,
  describedText,
  expandPluginToken,
  lineAt,
  proseText,
  walkLayersWithHostPositions,
} from "@entelekheia/vibe-ops-core";
import type { Document, GateFinding } from "@entelekheia/vibe-ops-core";
import { droppedSections, livingSectionsFromTemplate, readMigrationNotes } from "@entelekheia/governance-base";
import path from "node:path";
import type Parser from "tree-sitter";

interface TemplateHeadingDriftOptions {
  /** Where the migration notes live, `<plugin>/`-tokenised. */
  readonly migrations?: string;
  /** Record type → its template, `<plugin>/`-tokenised. The authority on the shape as it is today. */
  readonly templates?: Readonly<Record<string, string>>;
}

/** Words a sentence uses to name a record type, mapped to the type. `dossier` is how a task is named in
 *  prose more often than "task" is, and missing it attributes a correct sentence to the wrong type. */
const TYPE_WORDS: readonly (readonly [RegExp, string])[] = [
  [/\bplans?\b/gi, "plan"],
  [/\b(?:tasks?|dossiers?)\b/gi, "task"],
  [/\badrs?\b/gi, "adr"],
  [/\brfcs?\b/gi, "rfc"],
  [/\blogs?\b/gi, "log"],
];

const NUMBER_WORDS: Readonly<Record<string, number>> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
};

/**
 * A number word that MODIFIES `section(s)` — at most one word between them, which is the slot "living"
 * occupies in every phrasing this has to catch: "four living sections", "four sections kept current",
 * "Four sections are living".
 *
 * A wider window was tried and reported the wrong number: in "the one with a measurement behind it: the
 * plan-mode hook named the four living sections", it matched `one` twenty words early and told the reader
 * the document claimed one section when it claims four. Right file, wrong evidence — and evidence a
 * reader cannot find in the line is indistinguishable from a false positive.
 */
const COUNT = /\b(one|two|three|four|five|six|seven|eight|nine|ten)\b(?:\s+\S+)?\s+sections?\b/gi;

/** What makes a count of sections a claim about the LIVING ones rather than about sections in general. */
const LIVING = /\bliving\b|\bkept current\b|\bstay current\b|\bmaintained\b/i;

/** Blocks small enough to be one claim, tried smallest-first. */
const CLAIM_BLOCKS = ["pipe_table_row", "pipe_table_header", "paragraph", "list_item", "atx_heading"];

/** A sentence end: a full stop that is not an abbreviation's, followed by space or newline. */
const SENTENCE_END = /(?<![A-Z])\.[\s]/g;

/**
 * The span of the sentence containing `offset` within `[start, end)`.
 *
 * Finer than a block on purpose. A paragraph that CONTRASTS two record types names both, and resolving
 * it by counting hands the occurrence to whichever type the paragraph mentions more — a confident wrong
 * answer of exactly the kind this gate exists to prevent. "every entry under `Surprises & Discoveries`
 * **in the dossier**" sits in a paragraph that goes on to say "a plan carries no such section": the
 * sentence is unambiguous where the paragraph is not.
 */
function sentenceAround(text: string, start: number, end: number, offset: number): readonly [number, number] {
  let from = start;
  let to = end;
  const pattern = new RegExp(SENTENCE_END.source, "g");
  pattern.lastIndex = start;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null && match.index < end) {
    const boundary = match.index + match[0].length;
    if (boundary <= offset) from = boundary;
    else {
      to = boundary;
      break;
    }
  }
  return [from, to];
}

/** How many times each record type is named in `text`, read from prose with code spans already masked. */
function typesNamed(text: string): ReadonlyMap<string, number> {
  const found = new Map<string, number>();
  for (const [pattern, type] of TYPE_WORDS) {
    const hits = text.match(new RegExp(pattern.source, "gi"))?.length ?? 0;
    if (hits > 0) found.set(type, (found.get(type) ?? 0) + hits);
  }
  return found;
}

/**
 * The one type named, or nothing.
 *
 * NEVER BY PLURALITY. Counting mentions was tried and produced a confidently wrong answer on this
 * repository's own `GOVERNANCE.md`: a list item introducing the plan record and closing with "that is
 * what separates it from a task dossier" names task three times to plan's two — "task dossier" matching
 * the alternation twice on its own — so the paragraph about plans was attributed to tasks and the
 * occurrence went unreported. A prose count measures what a passage mentions, never what it is about.
 */
function soleType(named: ReadonlyMap<string, number>): string | undefined {
  return named.size === 1 ? [...named.keys()][0] : undefined;
}

/**
 * Which record type the sentence at `offset` is about, or `undefined` when that cannot be decided.
 *
 * Structural, not semantic — every step reads the document's own tree or its path, never what a sentence
 * means. Four sources, strongest first:
 *
 *   1. THE NEAREST ENCLOSING HEADING. A document that sections itself by record type has made that
 *      declaration explicitly and structurally, which outranks any word count inside one sentence —
 *      the prose under `### Task` spawns ADRs and contrasts itself with plans without being about
 *      either.
 *   2. THE SENTENCE. Where headings name no type, the narrowest context that can still carry a
 *      subject, and the only one that separates a claim from the contrast it sits inside.
 *   3. THE ENCLOSING CLAIM BLOCK, then 4. THE FILE PATH.
 *      `references/records/plan.md` is about plans in a way no sentence in it needs to restate, and a
 *      reference file that never names its own type is the common case rather than the odd one.
 *
 * At every step the rule is the same: exactly one type named is the answer, and two is no answer, so the
 * walk continues. Nothing is ever decided by which type a passage mentions more often.
 *
 * Running out of sources is a reported warning, never a guess. Which of the two verdicts blocks a commit
 * is the repository's to set through `level`, not this gate's: a repository that has just finished a
 * sweep wants an unattributed occurrence to stop the run, and one midway through a migration does not.
 */
function attribute(
  root: Parser.SyntaxNode,
  prose: string,
  offset: number,
  file: string,
): string | undefined {
  const containing = root
    .descendantsOfType(CLAIM_BLOCKS)
    .filter((node) => node.startIndex <= offset && offset < node.endIndex)
    .sort((a, b) => a.endIndex - a.startIndex - (b.endIndex - b.startIndex));

  let nearest: Parser.SyntaxNode | undefined;
  for (const heading of root.descendantsOfType("atx_heading")) {
    if (heading.startIndex > offset) break;
    nearest = heading;
  }
  if (nearest !== undefined) {
    const named = typesNamed(prose.slice(nearest.startIndex, nearest.endIndex));
    if (named.size === 1) return [...named.keys()][0];
  }

  const innermost = containing[0];
  if (innermost !== undefined) {
    const [from, to] = sentenceAround(prose, innermost.startIndex, innermost.endIndex, offset);
    const decided = soleType(typesNamed(prose.slice(from, to)));
    if (decided !== undefined) return decided;
  }

  for (const node of containing) {
    const decided = soleType(typesNamed(prose.slice(node.startIndex, node.endIndex)));
    if (decided !== undefined) return decided;
  }

  const fromPath = typesNamed(file.replace(/[/\\]/g, " "));
  return fromPath.size === 1 ? [...fromPath.keys()][0] : undefined;
}

/** Every index at which `needle` occurs in `haystack`. */
function occurrences(haystack: string, needle: string): readonly number[] {
  const found: number[] = [];
  let from = 0;
  for (;;) {
    const at = haystack.indexOf(needle, from);
    if (at === -1) return found;
    found.push(at);
    from = at + needle.length;
  }
}

/** Every inline code span in the document, as `[start, end)` host offsets with its interior text. */
function codeSpans(document: Document): readonly { start: number; end: number; interior: string }[] {
  const spans: { start: number; end: number; interior: string }[] = [];
  for (const { layer, hostStart } of walkLayersWithHostPositions(document.layers)) {
    if (layer.languageId !== "text.markdown_inline") continue;
    for (const span of layer.tree.rootNode.descendantsOfType("code_span")) {
      spans.push({
        start: hostStart + span.startIndex,
        end: hostStart + span.endIndex,
        interior: span.text.replace(/^`+|`+$/g, "").trim(),
      });
    }
  }
  return spans;
}

/**
 * Whether the match at `[at, at + section.length)` NAMES the section rather than merely containing its
 * letters.
 *
 * Inside a code span the whole span must be the section: `` `Progress` `` names it, and
 * `` `Backlog → In Progress → Shipped` `` is a status value that happens to contain the word. That one
 * cost a false finding on this repository's own plan reference before the rule existed, and it is the
 * shape every substring detector fails on — plausible, in the right file, and wrong.
 *
 * Outside a code span, ordinary word boundaries decide, because a document may name a section in plain
 * prose and several in this repository do.
 */
function namesSection(
  text: string,
  spans: readonly { start: number; end: number; interior: string }[],
  at: number,
  section: string,
): boolean {
  const enclosing = spans.find((span) => span.start <= at && at + section.length <= span.end);
  if (enclosing !== undefined) return enclosing.interior === section;
  const before = text[at - 1];
  const after = text[at + section.length];
  return !/[\w`]/.test(before ?? " ") && !/[\w`]/.test(after ?? " ");
}

export default defineGate(
  {
    id: "template-heading-drift",
    version: 1,
    summary: "No document claims a record carries a section its template no longer has",
    defaultPaths: ["**/*.md"],
  },
  async ({ files, documents, options, repoRoot, pluginDir }) => {
    const { migrations, templates } = options as TemplateHeadingDriftOptions;
    if (migrations === undefined) {
      throw new Error(
        "template-heading-drift requires options.migrations — the directory holding the migration notes, " +
          "which is the only declaration of what a template no longer has",
      );
    }

    // TWO PATH FORMS, AND THEY ARE NOT INTERCHANGEABLE. `readMigrationNotes` reads the directory itself
    // and needs an absolute path; `documents.get` joins what it is handed onto `repoRoot` and needs a
    // repo-relative one. Handing either the other's form fails quietly — an absolute path reaches the
    // store as `<repoRoot><repoRoot>/…`, the document comes back unparsed, and the dropped set is empty,
    // so the gate reports a clean tree. Only a fixture laid out flat, with its plugin surface somewhere
    // other than `plugin/`, ever shows it.
    const relative = (file: string) => path.relative(repoRoot, path.resolve(repoRoot, file));

    // What each type stopped having. A note that dropped nothing contributes nothing, which is the
    // ordinary case rather than a failure to parse.
    const dropped = new Map<string, Set<string>>();
    const notesDir = path.resolve(repoRoot, expandPluginToken(migrations, repoRoot, pluginDir));
    for (const note of readMigrationNotes(notesDir)) {
      const sections = droppedSections(documents.get(relative(note.file)));
      if (sections.length === 0) continue;
      const forType = dropped.get(note.type) ?? new Set<string>();
      for (const section of sections) forType.add(section);
      dropped.set(note.type, forType);
    }

    // The template is the authority on the shape as it is today: a section a note recorded as dropped
    // and which the template carries again was RESTORED, and a document naming it is correct. Reading
    // the note alone would report every such document forever.
    const livingCount = new Map<string, number>();
    for (const [type, file] of Object.entries(templates ?? {})) {
      const template = documents.get(relative(expandPluginToken(file, repoRoot, pluginDir)));
      if (template.tree === undefined) continue;
      const living = livingSectionsFromTemplate(template);
      if (living !== undefined) livingCount.set(type, living.length);
      const present = new Set(headingsOf(template));
      const forType = dropped.get(type);
      if (forType !== undefined) for (const section of present) forType.delete(section);
    }

    if ([...dropped.values()].every((set) => set.size === 0) && livingCount.size === 0) {
      return {
        findings: [],
        skipped: "no migration note records a dropped section and no template declares living sections",
      };
    }

    const findings: GateFinding[] = [];
    let examined = 0;

    for (const file of files) {
      const document = documents.get(file);
      if (document.tree === undefined) continue;
      examined += 1;

      const root = document.tree.rootNode;
      const described = describedText(document);
      const prose = proseText(document);
      const spans = codeSpans(document);
      const reported = new Set<string>();

      for (const [type, sections] of dropped) {
        for (const section of sections) {
          for (const at of occurrences(described, section)) {
            if (!namesSection(described, spans, at, section)) continue;
            const about = attribute(root, prose, at, file);
            if (about !== undefined && about !== type) continue;
            const line = lineAt(document.text, at);
            const rule =
              about === type ? "template-heading-drift-named" : "template-heading-drift-unattributed";
            const key = `${rule}:${line}:${section}`;
            if (reported.has(key)) continue;
            reported.add(key);
            findings.push(
              about === type
                ? {
                    rule,
                    file,
                    line,
                    evidence: `names \`${section}\`, which the ${type} template no longer has — this sentence describes ${type} records, so it is a claim about their shape`,
                  }
                : {
                    rule,
                    level: "warn",
                    file,
                    line,
                    evidence: `names \`${section}\`, dropped from the ${type} template, and no record type could be attributed to this sentence — read it and either scope it or correct it`,
                  },
            );
          }
        }
      }

      for (const [type, living] of livingCount) {
        let match: RegExpExecArray | null;
        const pattern = new RegExp(COUNT.source, "gi");
        while ((match = pattern.exec(prose)) !== null) {
          const claimed = NUMBER_WORDS[match[1]!.toLowerCase()];
          if (claimed === undefined || claimed === living) continue;
          if (!LIVING.test(prose.slice(match.index, match.index + 160))) continue;
          if (attribute(root, prose, match.index, file) !== type) continue;
          const line = lineAt(document.text, match.index);
          const key = `count:${line}:${type}`;
          if (reported.has(key)) continue;
          reported.add(key);
          findings.push({
            rule: "template-heading-drift-count",
            file,
            line,
            evidence: `claims ${match[1]} living sections for a ${type}; the ${type} template declares ${living}. A count shares no token with the sections it counts, so nothing else finds this one`,
          });
        }
      }
    }

    return { findings, examined };
  },
);

/** Every level-2 heading in a template, which is what a record's sections are written as. */
function headingsOf(template: Document): readonly string[] {
  const root = template.tree?.rootNode;
  if (root === undefined) return [];
  const headings: string[] = [];
  for (const heading of root.descendantsOfType("atx_heading")) {
    if (!heading.children.some((child) => child.type === "atx_h2_marker")) continue;
    const inline = heading.children.find((child) => child.type === "inline");
    if (inline !== undefined) headings.push(inline.text.trim());
  }
  return headings;
}
