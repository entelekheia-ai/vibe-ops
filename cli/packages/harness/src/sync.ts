// `harness sync` — promulgation. Plan-025 Track 5.
//
// It is deliberately HALF a ceremony: it ends by producing a branch and a tag, and stops. Merging is a
// judgement about timing that belongs to whoever is working in the target, possibly much later, and
// stopping at a branch also makes the result reviewable as an ordinary diff, which a direct write never
// is. It does not merge and it does not push.
//
// Three things below are load-bearing and none is obvious from reading the flow.
//
// THE ISOLATED WORKING TREE REMOVES THE DIRTY-TREE QUESTION rather than answering it. A second working
// directory of the same repository, on its own branch, means promulgation never touches the checkout
// someone is working in — so there is nothing to stash, nothing to restore, and no failure mode where an
// interrupted run leaves someone's edits somewhere they did not put them.
//
// A LINKED WORKING TREE SHARES THE REPOSITORY'S INTERNAL DIRECTORY, so clone-local git configuration
// crosses into it — the ignore list above all. Nothing already tracked is at risk, because an ignore rule
// cannot reach a file the index knows. Every NEW file is: an ignored new path stages as nothing, exits
// zero, and reports the fact only as a hint, leaving a branch that looks complete. So this verifies what
// it actually staged rather than trusting an exit code, and names the rule that caught anything it could
// not.
//
// THE DURABLE ARTIFACTS ARE THE BRANCH AND THE TAG, not the directory. The working tree is removed as the
// last step, so promulgation cannot accumulate forgotten sibling directories nobody remembers creating.

import { mkdtemp, readFile, writeFile, mkdir, unlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { classOf, composedOwnership, entryFor, ownershipPath, readOwnership, widens } from "./ownership.ts";
import type { ComposedBoundary, DoubleClaim } from "./ownership.ts";
import type { Ownership, OwnershipClass } from "./ownership.ts";
import { activateGovernance, effectiveGovernanceBindings, MANAGED_FILENAME, STATE_FILENAME, writeManagedConfig } from "@entelekheia/vibe-ops-core";
import type { HarnessConfig } from "@entelekheia/vibe-ops-core";
import { shippedVersionsFromPackages, shippedVersionsFromPinned } from "./status.ts";
import type { VersionedType } from "./status.ts";

export interface SyncOptions {
  readonly repoRoot: string;
  /**
   * A pinned norm tree, when the repository declared one. A pin carrying its own ownership.json is used
   * WHOLE — never blended with the activated packages, because promulgation takes one norm.
   */
  readonly sourceRoot?: string;
  /** The acting repository's config — what routes the activated governance packages (ADR-0019). */
  readonly config?: import("@entelekheia/vibe-ops-core").VibeOpsConfig;
  /** The branch the promulgation branch is cut from. Defaults to the target's current HEAD branch. */
  readonly base?: string;
  /** The boundary version the caller is agreeing to on this run. Absent means agree to nothing new. */
  readonly acceptBoundary?: number;
  /** The boundary this clone had already agreed to, from config. */
  readonly agreedBoundary?: number;
  readonly dryRun: boolean;
}

export interface RefusedPath {
  readonly path: string;
  readonly was: OwnershipClass;
  readonly now: OwnershipClass;
  readonly why: string;
}

export interface SyncResult {
  readonly branch?: string;
  readonly tag?: string;
  readonly written: readonly string[];
  readonly seeded: readonly string[];
  /** Paths whose class widened without consent — reported, never written. */
  readonly refused: readonly RefusedPath[];
  /** Paths that were written and did not reach the index, with the rule that swallowed each. */
  readonly swallowed: readonly { path: string; rule: string }[];
  readonly boundary: { agreed?: number; installed: number };
  /**
   * The version of each record type this run actually put into the target — what the caller records as
   * `harness.applied`. Empty on a dry run and on any run that produced no branch: the map answers "what
   * was promulgated here", and a run that promulgated nothing must not claim otherwise.
   */
  readonly applied: Partial<Record<VersionedType, number>>;
  /**
   * What RFC-0004 §6 step 7 did to the retired `vibeops.config.local.json` at the repository root after
   * the branch and the tag existed: its harness keys moved into the committed managed file, so the file
   * was emptied of them, or deleted when nothing else was in it. Absent when there was no such file, on
   * a dry run, and on any run that produced no branch.
   */
  readonly retiredState?: "emptied" | "deleted";
}

/** A `.json` config file as bytes on disk — parsed, never imported, and named when it cannot be parsed. */
async function readJsonFile(file: string): Promise<Record<string, unknown> | undefined> {
  if (!existsSync(file)) return undefined;
  const text = await readFile(file, "utf8");
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch (error) {
    throw new Error(`${file} is not valid JSON: ${(error as Error).message}`);
  }
}

/**
 * RFC-0004 §6 step 7 — a keyed write through the module that owns the keys, on a file the cascade no
 * longer reads: remove the harness's own keys from the leftover state file and delete it when nothing
 * else is in it. Anything else someone put there is kept, byte for byte in meaning if not in formatting.
 */
async function retireStateFile(repoRoot: string): Promise<"emptied" | "deleted" | undefined> {
  const file = path.join(repoRoot, STATE_FILENAME);
  const raw = await readJsonFile(file);
  if (raw === undefined) return undefined;
  const { harness, ...rest } = raw;
  const { applied: _a, boundary: _b, agreed: _c, ...restHarness } = (harness ?? {}) as Record<string, unknown>;
  const next: Record<string, unknown> = Object.keys(restHarness).length === 0 ? rest : { ...rest, harness: restHarness };
  if (Object.keys(next).length === 0) {
    await unlink(file);
    return "deleted";
  }
  await writeFile(file, `${JSON.stringify(next, undefined, 2)}\n`, "utf8");
  return "emptied";
}

function git(cwd: string, args: readonly string[]): { code: number; out: string; err: string } {
  const result = spawnSync("git", ["-C", cwd, ...args], { encoding: "utf8" });
  return { code: result.status ?? 1, out: (result.stdout ?? "").trim(), err: (result.stderr ?? "").trim() };
}

/**
 * Which rule kept a path out of the index. `git check-ignore -v` names the file, line and pattern, and
 * that whole string is the answer — "it was ignored" without saying by what leaves the reader grepping
 * four possible ignore files, one of which is `.git/info/exclude` and is not in the repository at all.
 */
function ignoredBy(cwd: string, file: string): string {
  const result = git(cwd, ["check-ignore", "-v", "--no-index", file]);
  return result.out === "" ? "not ignored — it simply did not reach the index" : result.out;
}

/** The current branch of a repository, for use as the default base. */
export function currentBranch(repoRoot: string): string {
  const result = git(repoRoot, ["rev-parse", "--abbrev-ref", "HEAD"]);
  return result.out === "" ? "HEAD" : result.out;
}

/**
 * What the norm would write, as repository-relative paths mapped to their content. Read from the norm's
 * own files rather than invented here — this is the set the ownership declaration classifies, and a
 * path it does not classify stops the run rather than being written on a guess.
 *
 * A pinned tree contributes its flat `templates/`; otherwise each activated governance package
 * contributes its own template — the same one-norm decision the caller made for the boundary.
 */
export async function normContent(
  config: import("@entelekheia/vibe-ops-core").VibeOpsConfig | undefined,
  pinned: string | undefined,
): Promise<ReadonlyMap<string, string>> {
  const content = new Map<string, string>();
  if (pinned !== undefined) {
    const templates = path.join(pinned, "templates");
    if (existsSync(templates)) {
      for (const type of ["adr", "rfc", "plan", "task", "log"]) {
        const from = path.join(templates, `${type}.md`);
        if (existsSync(from)) content.set(`project/templates/${type}.md`, await readFile(from, "utf8"));
      }
    }
    return content;
  }
  for (const type of Object.keys(effectiveGovernanceBindings(config))) {
    const activated = await activateGovernance(type, config);
    if (activated === undefined) continue;
    const from = path.resolve(activated.root, activated.unit.template);
    if (existsSync(from)) content.set(`project/templates/${type}.md`, await readFile(from, "utf8"));
  }
  return content;
}

/**
 * The boundary comparison, before anything is written.
 *
 * Only a WIDENING needs consent, and only the paths that widened are refused — the rest promulgate
 * normally. Refusing the whole run on any version change would block every repository on a bump that only
 * added entries or reworded a justification, which is how a gate gets switched off in its first week.
 */
export function boundaryRefusals(
  installed: Ownership,
  agreedTo: Ownership | undefined,
  files: Iterable<string>,
): readonly RefusedPath[] {
  if (agreedTo === undefined) return [];
  const refused: RefusedPath[] = [];
  for (const file of files) {
    const was = classOf(agreedTo, file);
    const now = classOf(installed, file);
    if (!widens(was, now)) continue;
    refused.push({ path: file, was: was!, now: now!, why: entryFor(installed, file)?.why ?? "" });
  }
  return refused;
}

export async function sync(options: SyncOptions): Promise<SyncResult> {
  const { repoRoot, sourceRoot, dryRun } = options;
  // ONE NORM, WHOLE: a pin that carries its own boundary is that norm; otherwise the norm is composed
  // from the activated governance packages plus the harness's base fragment.
  const pinned = sourceRoot !== undefined && existsSync(ownershipPath(sourceRoot)) ? sourceRoot : undefined;
  const installed = pinned !== undefined ? await readOwnership(pinned) : await composedOwnership(options.config);
  if (installed === undefined) {
    throw new Error("no ownership declaration in any norm source — promulgation has no boundary to respect and will not run");
  }
  const content = await normContent(options.config, pinned);

  const boundary = { agreed: options.agreedBoundary, installed: installed.version };

  // CONSENT (RFC-0004 §6). The declaration the repository agreed to is not on disk — only the installed
  // one is, and a version number cannot be read back into classes when the composed version is the max
  // across fragments. What IS on disk is the receipt `harness.agreed` in the committed managed file: the
  // class of every file promulgation wrote here, recorded in the commit that wrote them. Compared against
  // that, only a path whose class WIDENED is refused; a bump that renames, narrows or adds entries
  // promulgates and records the new boundary. A repository with no receipt — never promulgated to, or
  // promulgated before the receipt existed — has agreed to nothing this can compare, and promulgates.
  // Read from the committed file directly, never from the merged config: a `local` or `declared` copy is
  // exactly the forged consent §3 keeps out of the cascade.
  const agreeing = options.acceptBoundary === installed.version;
  const managedAtRoot = await readJsonFile(path.join(repoRoot, MANAGED_FILENAME));
  const receipt = ((managedAtRoot?.harness as HarnessConfig | undefined)?.agreed ?? undefined) as
    | Readonly<Record<string, string>>
    | undefined;

  const refused: RefusedPath[] = [];
  if (!agreeing && receipt !== undefined) {
    const agreedTo: Ownership = {
      version: options.agreedBoundary ?? 0,
      paths: Object.entries(receipt).map(([match, cls]) => ({ match, class: cls as OwnershipClass, why: "" })),
    };
    refused.push(...boundaryRefusals(installed, agreedTo, content.keys()));
  }

  const written: string[] = [];
  const seeded: string[] = [];
  const unclassified: string[] = [];

  // A doubly-claimed path has no single answer, and last-match-wins inside classOf would be exactly
  // the silent precedence RFC-0003 forbids between peer fragments — so a conflicted path is refused
  // naming both claimants, until a repository ownership entry resolves it. A pinned tree is one norm
  // whole and carries no conflicts by construction.
  const conflicts: readonly DoubleClaim[] =
    "conflicts" in installed ? (installed as ComposedBoundary).conflicts : [];

  for (const [file] of content) {
    const conflict = conflicts.find((claim) => path.matchesGlob(file, claim.match));
    if (conflict !== undefined) {
      const claimants = conflict.claimants.map((c) => `${c.class} by ${c.origin}`).join(", ");
      refused.push({
        path: file,
        was: conflict.claimants[0]!.class,
        now: conflict.claimants[conflict.claimants.length - 1]!.class,
        why: `claimed ${claimants} — peers, never precedence; resolve it with a repository ownership entry on "${conflict.match}"`,
      });
      continue;
    }
    const declared = classOf(installed, file);
    // Absence is not permission. Reported, never written, and never defaulted to the safest-looking class.
    if (declared === undefined) unclassified.push(file);
    else if (declared === "repo") refused.push({ path: file, was: "repo", now: "repo", why: entryFor(installed, file)?.why ?? "" });
    else if (declared === "norm") written.push(file);
    else if (!existsSync(path.join(repoRoot, file))) seeded.push(file);
  }

  if (unclassified.length > 0) {
    throw new Error(
      `${unclassified.length} path(s) the ownership declaration does not classify: ${unclassified.join(", ")}. ` +
        `Absence of an entry is not permission — extend ownership.json before promulgating these.`,
    );
  }

  if (refused.length > 0 || dryRun) {
    return { written, seeded, refused, swallowed: [], boundary, applied: {} };
  }

  // ── The ceremony ────────────────────────────────────────────────────────────────────────────────────
  const base = options.base ?? currentBranch(repoRoot);
  const branch = `vibe-ops/norm-${installed.version}`;
  const worktree = await mkdtemp(path.join(tmpdir(), "vibeops-sync-"));

  const added = git(repoRoot, ["worktree", "add", "-B", branch, worktree, base]);
  if (added.code !== 0) throw new Error(`could not create a working tree on ${branch} from ${base}: ${added.err}`);

  // Set only on the way out through a throw — the cleanup below must not fire on the returns, which
  // hand their branch back deliberately. A `finally` cannot tell the two apart on its own.
  let unwinding = false;

  try {
    const touched = [...written, ...seeded];
    for (const file of touched) {
      const destination = path.join(worktree, file);
      await mkdir(path.dirname(destination), { recursive: true });
      await writeFile(destination, content.get(file)!, "utf8");
    }

    // RFC-0004 §6 steps 1–3. The committed map is read back from THIS working tree, never from the
    // caller's merged config; the leftover state file at the repository root seeds it once, for the
    // types this run leaves untouched (step 7 deletes that file); the staged types land at their shipped
    // versions; the receipt gains the class of every file this run wrote. Written and added BEFORE
    // `git add`, so the swallowed-path verification below covers it like any other file — but only
    // counted as touched when its bytes changed, or an unchanged map would read as swallowed.
    const managedFile = path.join(worktree, MANAGED_FILENAME);
    const before = existsSync(managedFile) ? await readFile(managedFile, "utf8") : undefined;
    const committedHarness = ((await readJsonFile(managedFile))?.harness ?? {}) as HarnessConfig;
    const leftoverHarness = ((await readJsonFile(path.join(repoRoot, STATE_FILENAME)))?.harness ?? {}) as HarnessConfig;
    const shipped = pinned !== undefined ? await shippedVersionsFromPinned(pinned) : await shippedVersionsFromPackages(options.config);
    const templateOf = (type: string): string => `project/templates/${type}.md`;
    const appliedMap: Record<string, number> = {};
    for (const [type, version] of Object.entries(committedHarness.applied ?? {})) if (version !== undefined) appliedMap[type] = version;
    for (const [type, version] of Object.entries(leftoverHarness.applied ?? {})) {
      if (version !== undefined && !touched.includes(templateOf(type))) appliedMap[type] = version;
    }
    for (const [type, version] of Object.entries(shipped)) {
      if (touched.includes(templateOf(type))) appliedMap[type] = version;
    }
    const agreed: Record<string, string> = { ...committedHarness.agreed };
    for (const file of touched) agreed[file] = classOf(installed, file)!;
    const wroteManaged = await writeManagedConfig(worktree, {
      harness: { applied: appliedMap as HarnessConfig["applied"], boundary: installed.version, agreed },
    });
    if (!wroteManaged.ok) {
      throw new Error(`the promulgation tree's ${MANAGED_FILENAME} could not be written: ${wroteManaged.message}`);
    }
    if ((await readFile(managedFile, "utf8")) !== before) touched.push(MANAGED_FILENAME);

    git(worktree, ["add", "--", ...touched]);

    // VERIFY WHAT WAS STAGED, never the exit code. `git add` on an ignored path succeeds and stages
    // nothing, mentioning it only as a hint — so a branch that looks complete is the default failure here.
    // A touched path that is already tracked and byte-identical to HEAD stages nothing too, and that is
    // not swallowing: a repository already holding this norm re-promulgates as "nothing to write", and
    // RFC-0004 §6 step 4 needs exactly that run to still commit the managed file alone.
    const staged = new Set(git(worktree, ["diff", "--cached", "--name-only"]).out.split("\n").filter((n) => n !== ""));
    const tracked = (file: string): boolean => git(worktree, ["ls-files", "--error-unmatch", "--", file]).code === 0;
    const swallowed = touched
      .filter((file) => !staged.has(file) && !tracked(file))
      .map((file) => ({ path: file, rule: ignoredBy(worktree, file) }));

    if (swallowed.length > 0) {
      return { branch, written, seeded, refused, swallowed, boundary, applied: {} };
    }
    if (staged.size === 0) {
      return { branch, written: [], seeded: [], refused, swallowed: [], boundary, applied: {} };
    }

    const committed = git(worktree, ["commit", "-q", "-m", `chore(norm): promulgate ownership@${installed.version}`]);
    if (committed.code !== 0) throw new Error(`the promulgation commit failed: ${committed.err}`);

    // ANNOTATED, with a message, and the exit code is read. A lightweight `git tag -f <name>` fails on any
    // machine whose git config sets `tag.gpgsign` — it forces annotation, and the refusal reads
    // `fatal: no tag message?`, which never mentions signing and sends the reader looking in the wrong
    // place. Measured 2026-08-14 on a machine with that setting, where this test was the thing that
    // caught it. An annotated tag is also the better artifact: it records who promulgated and when.
    const tag = `vibe-ops/norm@${installed.version}`;
    const tagged = git(worktree, ["tag", "-f", "-a", "-m", `promulgated ownership@${installed.version}`, tag]);
    if (tagged.code !== 0) {
      // The branch is real and complete; only the label failed. Saying so beats both pretending the tag
      // exists and discarding a commit that is fine.
      throw new Error(`${branch} was committed, but tagging it ${tag} failed: ${tagged.err}`);
    }

    // What this run actually put there, restricted to the types whose file reached the index — the
    // committed map in the branch carries the whole picture; this is the run's own answer.
    const applied: Partial<Record<VersionedType, number>> = {};
    for (const [type, version] of Object.entries(shipped) as [VersionedType, number][]) {
      if (staged.has(templateOf(type))) applied[type] = version;
    }

    // Step 7, after the branch and the tag exist, at the repository root: the leftover state file has
    // been folded into the committed map above and is retired.
    const retiredState = await retireStateFile(repoRoot);

    return { branch, tag, written, seeded, refused, swallowed: [], boundary, applied, retiredState };
  } catch (error) {
    unwinding = true;
    throw error;
  } finally {
    // Last, and in a finally: a failed run must not leave a sibling directory nobody remembers creating.
    git(repoRoot, ["worktree", "remove", "--force", worktree]);

    // `worktree add -B` creates the branch at base BEFORE anything is committed to it, so a throw left
    // `vibe-ops/norm-N` behind pointing exactly where it started: no commit, no tag, and `harness status`
    // still reporting never promulgated. Litter shaped like a partial success, which is worse than no
    // branch at all — the next reader has to prove it is empty before deleting it.
    //
    // Only when the tip never moved, and only while unwinding: the tag-failure path above throws over a
    // branch that IS complete and says so, and the two early returns hand their branch back to be read.
    // `-B` has already reset whatever the name pointed at, so nothing deletable here survived the add.
    // After the worktree is gone, never before — git refuses to delete a branch still checked out in one.
    if (unwinding) {
      const tip = git(repoRoot, ["rev-parse", "--verify", branch]);
      const from = git(repoRoot, ["rev-parse", "--verify", base]);
      if (tip.code === 0 && from.code === 0 && tip.out === from.out) git(repoRoot, ["branch", "-D", branch]);
    }
  }
}
