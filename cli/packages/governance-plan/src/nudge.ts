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
// AT MOST ONE MESSAGE, EVER PLAN STILL WALKED. The shell version does not stop scanning once it has
// picked a message — it keeps updating `STILL_NUDGED` for every repository and every matching plan, so a
// plan this turn also wrote to a second repository's plan file is still marked settled even though the
// firing named a different one. Stopping the walk early once `text` is set would silently under-update
// that bookkeeping and re-arm a plan on the next firing that should have stayed quiet.

import path from "node:path";
import { statSync, existsSync } from "node:fs";
import { createDocumentStore, loadConfig } from "@entelekheia/vibe-ops-core";
import { findHeaderTable, valueOf, resolveRecord, RecordsConfigError } from "@entelekheia/governance-base";
import { depthFor, listMarkdownFiles } from "@entelekheia/governance-base";

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
  for (const relative of listMarkdownFiles(absDir, depthFor("plan"))) {
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
    const { config } = await loadConfig(repo);

    let resolved;
    try {
      resolved = resolveRecord("plan", repo, config, documents);
    } catch (error) {
      if (error instanceof RecordsConfigError) continue;
      throw error;
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
