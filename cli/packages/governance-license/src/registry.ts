// The licence registry — ported from `plugin/skills/license-setup/get-license.sh` (Plan-040 Track 3):
// `license get <id>` and `license verify <file>` read exactly this data, never re-typed. There is one
// trust anchor — a sha256 pinned in `templates/SOURCES.tsv` — and every route to a LICENSE file passes
// through it. Text is fetched and checksum-verified; it is never authored, edited, reflowed, summarized
// or reproduced from memory — not by a human and least of all by a model. This exists because it went
// wrong once: a LICENSE this skill shipped was a *paraphrase* of Apache-2.0 — fluent, plausible, and not
// the license — and it propagated into every repository the skill touched.
//
// KEEP `canonicalText` BYTE-FOR-BYTE EQUIVALENT to `templates/verify-license-text.sh`'s own copy — that
// script is standalone on purpose (it runs in a target repo's CI, with no plugin and no CLI installed),
// so the two drift only if someone edits one without the other.

import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export interface LicenseSource {
  readonly id: string;
  readonly url: string;
  readonly shaFile: string;
  readonly shaText: string;
}

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/**
 * Every pinned row in `templates/SOURCES.tsv`, keyed by SPDX id. Comment lines (`#`) and the header are
 * skipped; a malformed row is skipped too rather than thrown on — the registry's own shape is verified
 * by the `mirror` gate, not by this reader.
 */
export function readRegistry(root: string): ReadonlyMap<string, LicenseSource> {
  const file = path.join(root, "templates", "SOURCES.tsv");
  const text = readFileSync(file, "utf8");
  const sources = new Map<string, LicenseSource>();
  for (const line of text.split("\n")) {
    if (line.trim() === "" || line.startsWith("#")) continue;
    const [id, url, shaFile, shaText] = line.split("\t");
    if (id === undefined || url === undefined || shaFile === undefined || shaText === undefined) continue;
    sources.set(id, { id, url, shaFile, shaText });
  }
  return sources;
}

/**
 * The text every LICENSE is verified against: everything from the license's own "how to apply this
 * license" section onward is dropped (Apache's "APPENDIX:", the GPL family's "How to Apply These Terms
 * to Your New Programs" — instructions plus a boilerplate a repo fills in with its own program name,
 * year and holder); standalone `Copyright ...` lines are dropped (the holder is the one thing that
 * legitimately differs); whitespace is collapsed (apache.org ships the text hard-wrapped at 72 columns
 * and SPDX ships it reflowed; both are the same license and both must verify).
 */
export function canonicalText(text: string): string {
  const lines = text.split("\n");
  const cutoff = lines.findIndex((line) => /^\s*(APPENDIX:|How to Apply These Terms to Your New Programs)/.test(line));
  const kept = cutoff === -1 ? lines : lines.slice(0, cutoff);
  const noCopyright = kept.filter((line) => !/^\s*Copyright\s/.test(line));
  return noCopyright.join(" ").replace(/\s+/g, " ").trim();
}

export interface FetchResult {
  readonly text: string;
  readonly fromCache: boolean;
}

/**
 * The pristine, verified text of one pinned license — cache-first, network fallback, sha256-verified
 * either way. Throws naming the mismatch rather than writing anything when verification fails: the
 * failure this whole module exists to make impossible is a LICENSE that reads as legal and is not.
 */
export async function fetchLicenseText(root: string, id: string): Promise<FetchResult> {
  const registry = readRegistry(root);
  const source = registry.get(id);
  if (source === undefined) {
    throw new Error(`no pinned source for "${id}". Pinned: ${[...registry.keys()].join(", ")}`);
  }

  const cached = path.join(root, "templates", `${id}.txt`);
  if (existsSync(cached)) {
    const text = readFileSync(cached, "utf8");
    if (sha256(text) === source.shaFile) return { text, fromCache: true };
  }

  const response = await fetch(source.url);
  if (!response.ok) throw new Error(`could not fetch ${source.url} (${response.status})`);
  const text = await response.text();
  const got = sha256(text);
  if (got !== source.shaFile) {
    throw new Error(
      `${id} fetched from ${source.url} does not match its pin.\n` +
        `  expected ${source.shaFile}\n  got      ${got}\n` +
        `Upstream may have changed, or the download was tampered with. Nothing was written.`,
    );
  }
  return { text, fromCache: false };
}

export interface VerifyResult {
  readonly ok: boolean;
  readonly matchedId?: string;
  readonly gotDigest: string;
  readonly wantDigest?: string;
}

/**
 * Whether `file` is the license it claims (or, with no `id`, which pinned license it matches, if any).
 * Ignores the copyright holder and any rewrapping and forgives nothing else.
 */
export function verifyLicenseFile(root: string, filePath: string, id?: string): VerifyResult {
  const registry = readRegistry(root);
  const got = sha256(canonicalText(readFileSync(filePath, "utf8")));

  if (id === undefined) {
    for (const source of registry.values()) {
      if (source.shaText === got) return { ok: true, matchedId: source.id, gotDigest: got };
    }
    return { ok: false, gotDigest: got };
  }

  const source = registry.get(id);
  if (source === undefined) {
    throw new Error(`no pinned source for "${id}". Pinned: ${[...registry.keys()].join(", ")}`);
  }
  return { ok: source.shaText === got, matchedId: id, gotDigest: got, wantDigest: source.shaText };
}

/** Writes verified text to `outPath`, for `license get <id> --out <file>`. */
export function writeLicenseText(outPath: string, text: string): void {
  writeFileSync(outPath, text);
}
