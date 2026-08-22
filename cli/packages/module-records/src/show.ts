// `vibe-ops records show <file>` — one record, read.
//
// The verb this CLI did not have, and the absence is measurable. Across ~390 session transcripts,
// 1,400–1,650 greps are scoped to `project/`, across ~600 distinct patterns, and the recurring ones
// are five structured questions with deterministic answers: what is this record's status, which
// sections does it have, how many tracks are still open, how many entries stand under the sections
// that accumulate work, and which migration is it behind. Forty-three chains of three or more
// consecutive greps appear in the same corpus — a chain of greps is a structured query run by hand.
//
// Nothing here is new analysis. `handlingFor` already answers the type and the migration half;
// `trackCheckboxes`, `findHeaderTable` and the shape readers already exist in the records library. This
// verb is the projection: data those functions compute and then discard.

import path from "node:path";
import type { DocumentStore, VibeOpsConfig } from "@entelekheia/vibe-ops-core";
import {
  entriesUnder,
  findHeaderTable,
  sectionHeadings,
  trackCheckboxes,
  valueOf,
  type Heading,
} from "@entelekheia/governance-base";
import { handlingFor } from "./handling.ts";
import type { CensusType } from "./census.ts";

/** Every field a listing row may carry — the selectable set, and the order a row renders them in. */
export const LISTABLE = [
  "file",
  "type",
  "status",
  "tracks",
  "entries",
  "migrations",
  "ceremony",
  "sections",
] as const;

export type ListField = (typeof LISTABLE)[number];

/**
 * What a listing carries when the caller selects nothing: the three facts its own terminal line prints,
 * plus the type. `sections` is deliberately outside it.
 *
 * The distinction is the one between opening a file and listing a directory, and getting it wrong is not
 * a matter of taste — measured over this repository's 28 plans, a listing returning the whole `Shown`
 * shape was 43,761 bytes of JSON against 2,711 bytes of printed lines, a factor of 16, with `sections`
 * alone 78.7% of it. A default is still a choice, so this one is the cheap answer to the common question
 * and every other field stays one `--fields` away.
 */
export const LIST_DEFAULT: readonly ListField[] = ["file", "type", "status", "tracks"];

/**
 * A listing row carrying exactly the requested fields, in `LISTABLE` order rather than the order asked
 * for — so two calls selecting the same set produce byte-identical rows regardless of how they spelled it.
 *
 * A key absent from `Shown` stays absent rather than arriving as `null`: `entries` missing means the
 * record has no such section, which is not the same fact as an empty one, and flattening that here would
 * undo the distinction `show` exists to preserve.
 */
export function pickFrom(shown: Shown, fields: readonly ListField[]): Partial<Shown> {
  const wanted = new Set(fields);
  const row: Record<string, unknown> = {};
  for (const key of LISTABLE) {
    if (wanted.has(key) && shown[key] !== undefined) row[key] = shown[key];
  }
  return row as Partial<Shown>;
}

export interface Shown {
  /** Repository-relative, as given. */
  readonly file: string;
  /** Which record directory it was found under, absent when under none. */
  readonly type?: CensusType;
  /** The `Status` cell of the header table, absent when the record has no such row. */
  readonly status?: string;
  readonly sections: readonly Heading[];
  /**
   * Track checkboxes under `## Tracks`. Absent when the record has no Tracks section — which is every
   * type but `plan`, and is not the same fact as a plan with zero tracks.
   */
  readonly tracks?: { readonly total: number; readonly checked: number; readonly open: number };
  /**
   * Entries standing under the sections that accumulate work. A key is present only when the record has
   * that section: `surprises: 0` means "the section exists and is empty", and an absent key means the
   * record does not carry one. Those are different states and only one of them means nothing is owed.
   */
  readonly entries: {
    readonly surprises?: number;
    readonly observations?: number;
    readonly decisions?: number;
  };
  /** The migration notes between what this record declares and the current template, in order. */
  readonly migrations: readonly string[];
  /** Which closing ceremony applies, by type. Absent for a type that has none. */
  readonly ceremony?: "close-plan" | "close-task";
  /** Present only when the record could not be placed, saying why rather than defaulting. */
  readonly reason?: string;
}

const CEREMONY: Partial<Record<CensusType, "close-plan" | "close-task">> = {
  plan: "close-plan",
  task: "close-task",
};

export function showRecord(
  file: string,
  repoRoot: string,
  pluginDir: string,
  config: VibeOpsConfig,
  documents: DocumentStore,
  sourceRoot?: string,
): Shown {
  const handling = handlingFor(file, repoRoot, pluginDir, config, documents, sourceRoot);
  const document = documents.get(file);

  // `findHeaderTable` takes the tree's root node, not the document — it is a reader over the block tree,
  // shared with the `record-header` gate rather than duplicated for this verb.
  const root = document.tree?.rootNode;
  const table = root === undefined ? undefined : findHeaderTable(root);
  const status = table === undefined ? undefined : valueOf(table, "Status");

  const sections = sectionHeadings(document);
  const hasTracks = sections.some((heading) => heading.level === 2 && heading.text === "Tracks");
  const counted = hasTracks ? trackCheckboxes(document) : undefined;

  return {
    file,
    ...(handling.type !== undefined ? { type: handling.type } : {}),
    ...(status !== undefined && status !== "" ? { status } : {}),
    sections,
    ...(counted !== undefined
      ? { tracks: { total: counted.total, checked: counted.checked, open: counted.total - counted.checked } }
      : {}),
    entries: {
      // Prefix-matched, because this workspace's own records spell the first one both ways.
      ...maybe("surprises", entriesUnder(document, "Surprises")),
      ...maybe("observations", entriesUnder(document, "Observations")),
      ...maybe("decisions", entriesUnder(document, "Decision Log")),
    },
    migrations: handling.handling,
    ...(handling.type !== undefined && CEREMONY[handling.type] !== undefined
      ? { ceremony: CEREMONY[handling.type] }
      : {}),
    ...(handling.reason !== undefined ? { reason: handling.reason } : {}),
  };
}

function maybe(key: string, value: number | undefined): Record<string, number> {
  return value === undefined ? {} : { [key]: value };
}

/** The terminal rendering. `data` is the answer; these lines are the terminal's copy of it. */
export function formatShown(shown: Shown): readonly string[] {
  const lines = [`FILE=${shown.file}`, `TYPE=${shown.type ?? "(not under a record directory)"}`];
  lines.push(`STATUS=${shown.status ?? "(no Status row)"}`);
  if (shown.tracks !== undefined) {
    lines.push(`TRACKS=${shown.tracks.open} open of ${shown.tracks.total}`);
  }
  for (const [key, count] of Object.entries(shown.entries)) {
    lines.push(`${key.toUpperCase()}=${count}`);
  }
  lines.push(`SECTIONS=${shown.sections.filter((h) => h.level === 2).map((h) => h.text).join(" | ") || "(none)"}`);
  if (shown.migrations.length > 0) lines.push(`MIGRATIONS=${shown.migrations.map((m) => path.basename(m)).join(" ")}`);
  if (shown.ceremony !== undefined) lines.push(`CEREMONY=/vibe-ops:${shown.ceremony}`);
  if (shown.reason !== undefined) lines.push(`REASON=${shown.reason}`);
  return lines;
}

/** One line naming what was read and what stands out, for the required `summary`. */
export function summariseShown(shown: Shown): string {
  const parts: string[] = [];
  if (shown.status !== undefined) parts.push(`Status "${shown.status}"`);
  if (shown.tracks !== undefined) parts.push(`${shown.tracks.open} of ${shown.tracks.total} tracks open`);
  if (shown.entries.surprises !== undefined) parts.push(`${shown.entries.surprises} surprises`);
  if (shown.migrations.length > 0) parts.push(`${shown.migrations.length} migration(s) behind`);
  return parts.length === 0
    ? `${shown.file}: read, and it carries no Status, no tracks and no accumulating sections`
    : `${shown.file}: ${parts.join(", ")}`;
}
