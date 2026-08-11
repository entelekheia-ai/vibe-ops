// The single resolver every noun module reads through — port of resolve-governance.sh, once, in
// TypeScript. Where the shell printed a `KEY=value` block, this returns a typed object; `formatLines()`
// in format.ts renders the same textual keys back out, for a terminal and for diffing against the shell
// during the port.

import { readFileSync } from "node:fs";
import path from "node:path";
import type { RecordsConfig, RecordType, VibeOpsConfig } from "@entelekheia/vibe-ops-core";
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
import { livingSectionsFromTemplate, planActiveFromAuthority, planActiveFromTemplate } from "./plan-fields.ts";

export interface ResolvedRecord {
  readonly type: RecordType;
  readonly root: string;
  readonly dir?: string;
  readonly template?: string;
  /** Where `template` came from — absent only when `template` itself is absent. */
  readonly templateSource?: "config" | "search";
  readonly authority?: string;
  readonly pad: number;
  readonly existing: number;
  readonly next: NextNumber;
  /** Present only for `type: "plan"`. */
  readonly plan?: {
    readonly active?: string;
    readonly living?: readonly string[];
  };
  /** Present only for `type: "task"`. */
  readonly task?: {
    readonly ghRemote?: string;
    readonly ghAuth: GithubAuth;
  };
}

function readTextIfPresent(repoRoot: string, relative: string | undefined): string | undefined {
  if (relative === undefined) return undefined;
  try {
    return readFileSync(path.join(repoRoot, relative), "utf8");
  } catch {
    return undefined;
  }
}

function resolvePlanFields(repoRoot: string, template: string | undefined, authority: string | undefined) {
  const templateText = readTextIfPresent(repoRoot, template);
  let active = templateText === undefined ? undefined : planActiveFromTemplate(templateText);
  const living = templateText === undefined ? undefined : livingSectionsFromTemplate(templateText);

  if (active === undefined && authority !== undefined) {
    const authorityText = readTextIfPresent(repoRoot, authority);
    if (authorityText !== undefined) active = planActiveFromAuthority(authorityText);
  }

  return { active, living };
}

/**
 * Everything a governance record type needs resolved, in one call — directory, template (with its
 * provenance), numbering authority, next number, and (per type) the plan or task fields. Throws
 * `RecordsConfigError` (from `./layout.ts`) when a declared `records.dirs`/`records.templates` entry
 * does not exist, rather than silently falling back to the search order.
 */
export function resolveRecord(type: RecordType, repoRoot: string, config: VibeOpsConfig | undefined): ResolvedRecord {
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

  const base: ResolvedRecord = { type, root: repoRoot, dir, template, templateSource, authority, pad, existing, next };

  if (type === "plan") {
    return { ...base, plan: resolvePlanFields(repoRoot, template, authority) };
  }
  if (type === "task") {
    return { ...base, task: { ghRemote: githubRemote(repoRoot), ghAuth: githubAuth() } };
  }
  return base;
}
