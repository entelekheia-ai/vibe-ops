// The plan-progress nudge's decision logic — what `plugin/hooks/plan-progress-nudge.sh` computed by
// shelling out to `vibe-ops plan resolve` and grepping a header table by hand, now reading the same
// resolution this package already builds for every other plan verb. Ported field for field from that
// script (Plan-006, Plan-008); see project/rfc/0005-*.md §5 and project/plans/040-*.md Track 7 for why
// it moved and what stayed host-specific.
//
// WHY THIS IS THE "HANDLER" AND NOT THE HOOK. Everything host-specific — the session transcript, the
// state directory, the JSON envelope, the once-per-day log — belongs to the CLI wrapper
// (`packages/cli/src/plan-progress.ts`), which is handed a transcript already reduced to "which
// repositories, which files, this turn" (`touchedRepos` in that same package). This function knows
// nothing about sessions or transcripts: give it a list of repository roots, the paths written this
// turn, and the plan paths already asked about, and it decides — per repository, in the order given —
// whether one of them has a plan worth naming, and updates the outstanding set the same way the shell
// script's NUDGED variable did.
//
// AT MOST ONE MESSAGE, AND THE WALK CONTINUES — but only one of the two branches keeps recording. After
// a message is picked, a plan THIS TURN WROTE is still marked settled, which is why the loop must not
// break: a plan written in a second repository would otherwise be re-armed on the next firing. A plan
// that is merely a fresh candidate is neither named nor recorded once the message is taken; it stays
// outstanding and gets its own firing later. The shell behaves identically, by an early `continue` that
// sits before its `STILL_NUDGED` append (line 193 before line 214 of the script this replaced), and a
// test asserts the pair rather than the sentence.

import path from "node:path";
import { statSync, existsSync } from "node:fs";
import { createDocumentStore, loadConfig } from "@entelekheia/vibe-ops-core";
import { findHeaderTable, valueOf, resolveRecord } from "@entelekheia/governance-base";
import { listMarkdownFiles } from "@entelekheia/governance-base";

export interface PlanProgressNudge {
  /** The one plan this firing may speak about — absent when nothing new crossed the threshold. */
  readonly text?: string;
  /** The plan file the text names, absolute path — for the caller's once-per-day log. */
  readonly nudgedPlan?: string;
  /** The full outstanding set to persist for this session, carried forward across firings. */
  readonly stillNudged: readonly string[];
}

interface Candidate {
  readonly file: string; // absolute path
  readonly mtimeMs: number;
}

/** Every plan file under `dir` whose `Status` header cell equals `active`, newest `mtime` first — the
 *  TypeScript reading of the shell version's `grep -lE ... | ls -t`. */
function plansAtStatus(
  documents: ReturnType<typeof createDocumentStore>,
  repoRoot: string,
  dir: string,
  active: string,
): readonly Candidate[] {
  const absDir = path.join(repoRoot, dir);
  const out: Candidate[] = [];
  // DEPTH 1, NOT `depthFor("plan")`. The nudge reads the live directory only, which is what the shell
  // it replaces globbed (`"$REPO/$DIR"/*.md`). The generic depth is 2 and reaches `shipped/`, where an
  // archived plan whose `Status` row was never demoted would be named as if it were live — a hook
  // speaking when it should be silent, which is the failure Plan-008 exists to prevent.
  for (const relative of listMarkdownFiles(absDir, 1)) {
    const document = documents.get(`${dir}/${relative}`);
    if (document.tree === undefined) continue;
    const table = findHeaderTable(document.tree.rootNode);
    if (table === undefined) continue;
    if (valueOf(table, "Status") !== active) continue;

    const file = path.join(absDir, relative);
    let mtimeMs = 0;
    try {
      mtimeMs = statSync(file).mtimeMs;
    } catch {
      // A file the directory listing found but stat cannot read is treated as oldest, never as an error
      // — the shell version's `stat` fallback chain fails the same way, silently.
    }
    out.push({ file, mtimeMs });
  }
  return out.sort((a, b) => b.mtimeMs - a.mtimeMs);
}

/**
 * `repos`: every repository this turn wrote to (already deduplicated, in the order the touched-repos
 * scan found them — the shell version's `REPOS` word list).
 * `written`: every absolute file path this turn wrote to, across all of them (the shell version's
 * `WRITTEN` — used only to test "did this turn write the plan's own file").
 * `alreadyNudged`: the outstanding set carried in from the caller's state file.
 */
export async function planProgressNudge(
  repos: readonly string[],
  written: readonly string[],
  alreadyNudged: readonly string[],
): Promise<PlanProgressNudge> {
  let stillNudged = [...alreadyNudged];
  let text: string | undefined;
  let nudgedPlan: string | undefined;

  for (const repo of repos) {
    const documents = createDocumentStore(repo);

    // ONE UNREADABLE REPOSITORY IS SKIPPED, NEVER FATAL — and `loadConfig` is inside the try for that
    // reason. A config that fails to import throws something other than `RecordsConfigError` (a
    // SyntaxError, from that repository's own `vibeops.config.ts`), which propagated to the surface's
    // outer catch and returned before the state file was written: the offset stayed pinned at its seed,
    // so the offending write never left the attribution window and the nudge was dead for the rest of
    // the session. The shell it replaced skipped that repository and went on to the next
    // (`RESOLVED=$(cd "$REPO" && $RESOLVE_PLAN) || continue`).
    let resolved;
    try {
      const { config } = await loadConfig(repo);
      resolved = resolveRecord("plan", repo, config, documents);
    } catch {
      continue;
    }

    const { dir, plan, template, authority } = resolved;
    if (dir === undefined || !existsSync(path.join(repo, dir))) continue;
    // Unknown taxonomy: silence, never a guessed status word or section name (the same rule the shell
    // script's `ACTIVE` guard enforced).
    const active = plan?.active;
    if (active === undefined) continue;

    for (const { file } of plansAtStatus(documents, repo, dir, active)) {
      if (stillNudged.includes(file)) continue; // already asked about this session: stay silent

      if (written.includes(file)) {
        // This turn wrote the plan itself: silent, AND recorded as settled.
        stillNudged = [...stillNudged, file];
        continue;
      }

      // At most one plan per firing — but the scan keeps running so the two cases above still apply to
      // every remaining plan and repository.
      if (text !== undefined) continue;

      const living = plan?.living;
      const body =
        living !== undefined && living.length > 0
          ? `Those sections (${living.join(", ")}) are maintained while the work happens, not reconstructed afterwards — that reconstruction is worthless per this repository's own governance rule.`
          : `This repository's living sections are the ones below the LIVING SECTIONS divider in \`${template ?? authority ?? "(none)"}\` — check there rather than assuming a specific list.`;

      text = `${file} — status "${active}". ${body}`;
      nudgedPlan = file;
      stillNudged = [...stillNudged, file];
    }
  }

  return { text, nudgedPlan, stillNudged };
}
