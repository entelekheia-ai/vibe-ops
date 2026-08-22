// `vibe-ops records handling <file>` — for ONE record: which template version it declares, and which
// document describes the difference between that version and the current one.
//
// WHY THIS EXISTS AT ALL. A skill's body is instructions the agent follows, and until now those bodies
// asserted one shape as universal fact. `/vibe-ops:close-plan` Step 3 stated *"A plan carries no
// `Surprises & Discoveries` section"* and was run on 2026-08-10 against a plan holding sixteen entries in
// exactly that section; it said something false about the file in front of it and continued. The CLI can
// dispatch correctly and that failure still happens, because the skill never asked.
//
// THE HANDLING DOCUMENT IS THE MIGRATION NOTE, not a new artifact. `plugin/skills/migrate/migrations/
// <type>-<from>-to-<to>.md` already records exactly what a reader of an older record needs — which
// sections that version carried, which were dropped, and where their content goes. Measured against
// `plan-0.1-to-0.2.md` on 2026-08-11: it states that `Surprises & Discoveries` was a living section at
// 0.1, that it is never deleted in place, and it carries the four routing questions per entry. That is
// the whole of what closure needed and never asked for.
//
// So there is ONE artifact per version, written by one ritual (`/new-migration`) and read by both the
// migration and the closure. A second per-version document written by a second ritual would drift from
// the first silently, and telling which had drifted would mean reading both.
//
// THE TYPE IS RESOLVED FROM WHERE THE FILE LIVES, never from its own declaration. A record declaring
// another type's token is the `mismatch` branch — a real finding — and inferring the type from the token
// would make that branch unreachable by construction.

import { existsSync } from "node:fs";
import path from "node:path";
import { classOf } from "@entelekheia/vibe-ops-harness";
import type { Ownership, OwnershipClass } from "@entelekheia/vibe-ops-harness";
import type { Document, DocumentStore, RecordType, VibeOpsConfig } from "@entelekheia/vibe-ops-core";
import { migrationsDirFor } from "@entelekheia/governance-base";
import {
  dispatchRecord,
  findLogDir,
  readTemplateVersion,
  resolveRecord,
  type DeclaredVersion,
  type Dispatch,
} from "@entelekheia/governance-base";
import type { CensusType } from "./census.ts";

export interface Handling {
  /** Repository-relative, as given. */
  readonly file: string;
  /** Which record directory it was found under, or absent when it is under none. */
  readonly type?: CensusType;
  readonly dispatch?: Dispatch;
  /**
   * The documents describing the difference between what this record declares and the current shape, in
   * the order they apply. Empty for a current record — there is no difference to describe.
   */
  readonly handling: readonly string[];
  /** Present only when no dispatch could be made, saying why rather than defaulting to one. */
  readonly reason?: string;
  /**
   * The effective ownership class of this path in the composed declaration (Plan-031), when the caller
   * handed one in. `"undeclared"` when the declaration matches nothing — which is NOT permission: the
   * actor consulting this (migration refuses `repo` and `seed`, proceeds on `shaped` and `norm`)
   * treats an undeclared path as a refusal too, the same rule promulgation applies.
   */
  readonly ownership?: OwnershipClass | "undeclared";
}

const TYPES: readonly RecordType[] = ["adr", "rfc", "plan", "task"];

/**
 * `log` is not a `RecordType`, so `resolveRecord` cannot locate its template. It is read through the
 * same reader every other template is read with, from the places a template is kept; an absent one
 * yields `undefined`, which the dispatch reports as uncomparable rather than resolving to anything.
 */
function logTemplateVersion(documents: DocumentStore): DeclaredVersion | undefined {
  for (const candidate of ["project/templates/log.md", "plugin/templates/log.md", "templates/log.md"]) {
    const document: Document = documents.get(candidate);
    if (document.tree === undefined) continue;
    const declared = readTemplateVersion(document);
    if (declared !== undefined) return declared;
  }
  return undefined;
}

interface Located {
  readonly type: CensusType;
  readonly dir: string;
  readonly current: DeclaredVersion | undefined;
}

/**
 * Which record directory `file` sits under, and the current version for that type. The longest matching
 * directory wins, so a repository nesting one record directory inside another resolves to the inner one
 * rather than to whichever happened to be checked first.
 */
function locate(
  file: string,
  repoRoot: string,
  config: VibeOpsConfig | undefined,
  documents: DocumentStore,
): Located | undefined {
  const candidates: Located[] = [];

  for (const type of TYPES) {
    const resolved = resolveRecord(type, repoRoot, config, documents);
    if (resolved.dir !== undefined && file.startsWith(`${resolved.dir}/`)) {
      candidates.push({ type, dir: resolved.dir, current: resolved.templateVersion });
    }
  }

  const logDir = findLogDir(repoRoot);
  if (logDir !== undefined && file.startsWith(`${logDir}/`)) {
    candidates.push({ type: "log", dir: logDir, current: logTemplateVersion(documents) });
  }

  candidates.sort((a, b) => b.dir.length - a.dir.length);
  return candidates[0];
}

/**
 * What handles `file`. Reads only; decides nothing about what the caller does with the answer.
 *
 * A file under no record directory is reported as such rather than dispatched against a guessed type —
 * the same refusal as the undeclared branch, one level up.
 */
export async function handlingFor(
  file: string,
  repoRoot: string,
  pluginDir: string,
  config: VibeOpsConfig | undefined,
  documents: DocumentStore,
  sourceRoot?: string,
  boundary?: Ownership,
): Promise<Handling> {
  // Composed once by the caller, not per file: one handling run may cover a whole census.
  const ownership = boundary === undefined ? {} : { ownership: classOf(boundary, file) ?? ("undeclared" as const) };
  const document = documents.get(file);
  if (document.tree === undefined) {
    return { file, handling: [], reason: "no such file in this repository, or no grammar covers it", ...ownership };
  }

  const located = locate(file, repoRoot, config, documents);
  if (located === undefined) {
    return { file, handling: [], reason: "not under any record directory this repository declares", ...ownership };
  }

  const dispatch = dispatchRecord({
    record: document,
    current: located.current,
    // Per the located TYPE, not one shared directory: since Plan-033 each type's notes travel in its
    // own governance package, and the pinned tree keeps answering for older installs.
    migrationsDir: await migrationsDirFor(located.type, repoRoot, config, sourceRoot),
  });
  const handling =
    dispatch.kind === "behind" ? dispatch.notes.map((note) => path.relative(repoRoot, note.file)) : [];

  return { file, type: located.type, dispatch, handling, ...ownership };
}

/** The terminal rendering: the answer first, then what to read, and nothing else. */
export function formatHandling(handling: Handling): readonly string[] {
  const lines = formatDispatch(handling);
  if (handling.ownership === undefined) return lines;
  // One line, because the consulting actor needs the class, not the essay: migration proceeds on
  // `shaped` and `norm`, refuses `repo`, `seed` and `undeclared` — absence is not permission.
  return [...lines, `  ownership: ${handling.ownership}`];
}

function formatDispatch(handling: Handling): readonly string[] {
  if (handling.reason !== undefined) return [`${handling.file}: ${handling.reason}`];

  const dispatch = handling.dispatch;
  if (dispatch === undefined) return [`${handling.file}: nothing to dispatch on`];

  switch (dispatch.kind) {
    case "current":
      return [
        `${handling.file}: ${dispatch.declared.type}@${dispatch.declared.version} — current shape, handle it as written`,
      ];
    case "behind":
      return [
        `${handling.file}: ${dispatch.declared.type}@${dispatch.declared.version}, current is ${dispatch.current.version}`,
        "",
        "Read these before acting on it — they say what this version's shape actually is:",
        ...handling.handling.map((note) => `  ${note}`),
      ];
    // Every remaining branch is one the closing verbs stop on, and the wording is theirs, so an operator
    // meeting the state here and there meets the same sentence.
    case "ahead":
      return [
        `${handling.file}: declares ${dispatch.declared.type}@${dispatch.declared.version}, ahead of the template's ${dispatch.current.version} — the tooling is behind this record`,
      ];
    case "mismatch":
      return [
        `${handling.file}: declares ${dispatch.declared.type}@${dispatch.declared.version} but sits under ${dispatch.current.type}`,
      ];
    case "unknown":
      return [
        `${handling.file}: declares no template version — it is not assumed to be the oldest shape. Declare \`${dispatch.current.type}@<version>\` in its frontmatter first`,
      ];
    case "unhandled":
      return [
        `${handling.file}: written against ${dispatch.declared.type}@${dispatch.declared.version} and nothing describes that shape — no migration note leaves ${dispatch.declared.type}@${dispatch.stuckAt}`,
      ];
    case "uncomparable":
      return [`${handling.file}: ${dispatch.reason}`];
  }
}
