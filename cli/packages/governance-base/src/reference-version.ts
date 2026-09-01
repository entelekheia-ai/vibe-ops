// Which version of a cited policy a run applied.
//
// The files under `plugin/references/` are named as the authority by more than one skill — the closing
// skills both point at `knowledge-lifecycle.md` for the promotion test rather than restating it — and
// they change. Nothing recorded which version a given closure ran under, so "which closures used the old
// routing rule" was an archaeology over every record rather than a question with an answer. Plan-012
// Track 7.
//
// ONE READER, NOT A SECOND PARSER. Frontmatter, through the same `readFrontmatter` the template
// declaration goes through; only the key differs. `vibe-ops-template` names a record's shape,
// `vibe-ops-reference` names a policy's — separate keys because the two are read by different callers
// asking different questions, and a shared key would make a reference look like a record to the gate that
// sweeps for undeclared records.
//
// THE CLOSING VERBS REPORT ONLY THE ROUTING POLICY, deliberately. `knowledge-lifecycle.md` is the one
// reference that decides what a closure DOES; the others govern how a document is written. A verb
// reporting that it applied a policy it never read would be a record that looks like evidence and is not.

import path from "node:path";
import type { DocumentStore } from "@entelekheia/vibe-ops-core";
import { readFrontmatter } from "./frontmatter.ts";

/** The frontmatter key a policy file under `references/` declares itself with. */
export const REFERENCE_KEY = "vibe-ops-reference";

const DECLARATION = /^([a-z][a-z0-9/-]*)@([0-9]+)$/;

/**
 * The integer version `<pluginDir>/references/<name>.md` declares, or `undefined` when the file is absent
 * or declares none.
 *
 * `undefined` is a legitimate answer rather than a failure: a target repository installed from a plugin
 * that predates Track 7 has these files without declarations, and a closure there is not wrong — it
 * simply cannot say which policy it applied, which is the state this exists to end rather than to punish.
 */
export function readReferenceVersion(
  pluginDir: string,
  name: string,
  repoRoot: string,
  documents: DocumentStore,
): number | undefined {
  const file = path.relative(repoRoot, path.join(pluginDir, "references", `${name}.md`));
  const declared = readFrontmatter(documents.get(file))?.scalars.get(REFERENCE_KEY);
  if (declared === undefined) return undefined;
  const matched = DECLARATION.exec(declared.trim());
  if (matched === null || matched[1] !== name) return undefined;
  return Number(matched[2]);
}

/** The policy every closure applies, as `{ "knowledge-lifecycle": <version> }` — or `undefined` when unreadable. */
export function routingPolicy(
  pluginDir: string,
  repoRoot: string,
  documents: DocumentStore,
): Record<string, number> | undefined {
  const version = readReferenceVersion(pluginDir, "knowledge-lifecycle", repoRoot, documents);
  return version === undefined ? undefined : { "knowledge-lifecycle": version };
}
