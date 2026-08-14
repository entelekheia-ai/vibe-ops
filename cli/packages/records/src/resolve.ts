// The single resolver every noun module reads through — port of resolve-governance.sh, once, in
// TypeScript. Where the shell printed a `KEY=value` block, this returns a typed object; `formatLines()`
// in format.ts renders the same textual keys back out, for a terminal and for diffing against the shell
// during the port.

import path from "node:path";
import type { DocumentStore, RecordsConfig, RecordType, VibeOpsConfig } from "@entelekheia/vibe-ops-core";
import {
  computeNumbering,
  DEFAULT_PAD,
  DEPTH,
  findAuthority,
  findDir,
  findTemplate,
  listMarkdownBasenames,
  type NextNumber,
} from "./layout.ts";
import { githubAuth, githubRemote, type GithubAuth } from "./github.ts";
import {
  livingSectionsFromTemplate,
  planActiveFromAuthority,
  planActiveFromTemplate,
  planTerminalFromAuthority,
  planTerminalFromTemplate,
} from "./plan-fields.ts";
import { readTemplateVersion, type DeclaredVersion } from "./template-version.ts";

/**
 * Where records of some kind live, and nothing more. The half of a resolution that does not depend on
 * the kind being numbered — which is what makes it the shape `log` resolves to, the one governance kind
 * with no number at all. `ResolvedRecord` is this plus everything numbering implies.
 *
 * It exists so `formatResolved` is the single place that decides how a resolved location prints. Two
 * modules formatting the same `DIR=` line independently is how the four resolvers diverged.
 */
export interface ResolvedLocation {
  readonly type: RecordType | "log";
  readonly root: string;
  readonly dir?: string;
}

export interface ResolvedRecord {
  readonly type: RecordType;
  readonly root: string;
  readonly dir?: string;
  readonly template?: string;
  /** Where `template` came from — absent only when `template` itself is absent. */
  readonly templateSource?: "config" | "search";
  /**
   * The version the template itself declares — what a record written today is written against, and what
   * a dispatch compares an older record with. Absent when the template declares none, which is reported
   * as unknown and never resolved to the oldest known version.
   */
  readonly templateVersion?: DeclaredVersion;
  readonly authority?: string;
  readonly pad: number;
  readonly existing: number;
  readonly next: NextNumber;
  /** Present only for `type: "plan"`. */
  readonly plan?: {
    readonly active?: string;
    /** The last term of the status chain — "Shipped" — for `plan status`'s coherence read. */
    readonly terminal?: string;
    readonly living?: readonly string[];
  };
  /** Present only for `type: "task"`. */
  readonly task?: {
    readonly ghRemote?: string;
    readonly ghAuth: GithubAuth;
  };
}

// Both the template and the authority are markdown, so both are read the way every other reader in this
// workspace reads markdown: through the caller's `DocumentStore`, which parses each file once per run
// and hands back a `Document` whose injected layers are already resolved. Neither file is opened here.
// A file that does not exist, or that no grammar covers, comes back with `tree === undefined` — the
// store's own way of saying so — and every reader below treats that as "no answer", never as an error.
function resolvePlanFields(
  documents: DocumentStore,
  template: string | undefined,
  authority: string | undefined,
) {
  const templateDocument = template === undefined ? undefined : documents.get(template);
  let active = templateDocument === undefined ? undefined : planActiveFromTemplate(templateDocument);
  let terminal = templateDocument === undefined ? undefined : planTerminalFromTemplate(templateDocument);
  const living = templateDocument === undefined ? undefined : livingSectionsFromTemplate(templateDocument);

  if (active === undefined && authority !== undefined) {
    const authorityDocument = documents.get(authority);
    active = planActiveFromAuthority(authorityDocument);
    terminal = planTerminalFromAuthority(authorityDocument);
  }

  return { active, terminal, living };
}

/**
 * Everything a governance record type needs resolved, in one call — directory, template (with its
 * provenance), numbering authority, next number, and (per type) the plan or task fields. Throws
 * `RecordsConfigError` (from `./layout.ts`) when a declared `records.dirs`/`records.templates` entry
 * does not exist, rather than silently falling back to the search order.
 *
 * `documents` is the caller's per-run parse cache, built once and passed down the same way `defineOps`
 * builds one store for a whole gate composition. A command that resolves and then reads records —
 * `plan status` does both — hands the same store to both halves, so the template is parsed once.
 */
export function resolveRecord(
  type: RecordType,
  repoRoot: string,
  config: VibeOpsConfig | undefined,
  documents: DocumentStore,
): ResolvedRecord {
  const recordsConfig: RecordsConfig | undefined = config?.records;
  const { dir } = findDir(repoRoot, type, recordsConfig);
  const { template, source: templateSource } = findTemplate(repoRoot, type, recordsConfig);
  const authority = findAuthority(repoRoot, dir);

  const defaultPad = DEFAULT_PAD[type];
  let pad = defaultPad;
  let existing = 0;
  let next: NextNumber = "1".padStart(defaultPad, "0");
  if (dir !== undefined) {
    const basenames = listMarkdownBasenames(path.join(repoRoot, dir), DEPTH[type]);
    const numbering = computeNumbering(basenames, defaultPad);
    pad = numbering.pad;
    existing = numbering.existing;
    next = numbering.next;
  }

  // Read through the same store the plan fields use, so the template is parsed once for the whole call.
  const templateVersion =
    template === undefined ? undefined : readTemplateVersion(documents.get(template));

  const base: ResolvedRecord = {
    type,
    root: repoRoot,
    dir,
    template,
    templateSource,
    templateVersion,
    authority,
    pad,
    existing,
    next,
  };

  if (type === "plan") {
    return { ...base, plan: resolvePlanFields(documents, template, authority) };
  }
  if (type === "task") {
    return { ...base, task: { ghRemote: githubRemote(repoRoot), ghAuth: githubAuth() } };
  }
  return base;
}
