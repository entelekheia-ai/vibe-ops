// `vibe-ops task close` — the mechanical tail of task closure, ported from plugin/skills/close/finalize.sh
// (Plan-011 Track 4). Task-only: a plan is never deleted, so plan closure has no equivalent.
//
// THE ORDER IS THE PRODUCT. Everything here is deterministic and ordering-sensitive, which is exactly the
// part prose keeps getting wrong, and each constraint below is a failure that already happened:
//
//   1. Referrers are collected across the WHOLE BATCH before anything is deleted. Closures come in
//      batches; after the deletion the information is gone and the repair is manual.
//   2. The tick is committed BEFORE the `git rm`, so the breadcrumb sha names a commit that still
//      contains the dossier. A breadcrumb pointing at a commit without the file is a dead reference that
//      looks alive.
//   3. The link check runs AFTER the deletion. Running it before is how 13 dangling links across two
//      documents got committed the first time.
//
// The judgement — the write-back, the promotion test, whether an ADR is needed, the text of the summary —
// stays in the skill and never enters this file.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { DocumentStore } from "@entelekheia/vibe-ops-core";
import { tickClosureBox } from "./closure.ts";

export interface TaskCloseOptions {
  readonly repoRoot: string;
  /** Repository-relative dossier paths, the whole batch being closed at once. */
  readonly dossiers: readonly string[];
  /** The plan the breadcrumbs are appended to, when the batch belongs to one. */
  readonly plan?: string;
  /** A file whose contents become the issue comment's body. Nothing is posted without it. */
  readonly summaryFile?: string;
  readonly dryRun: boolean;
}

export interface TaskCloseResult {
  /** The narration, in execution order — this is also what asserts the ordering above. */
  readonly steps: readonly string[];
  /** The commit that still contains the dossiers. Every breadcrumb names this one. */
  readonly dossierSha: string;
  /** The commit that removes them, together with the repointed referrers. */
  readonly closeSha: string;
  readonly referrers: readonly string[];
  readonly ticked: readonly string[];
  readonly repointed: readonly string[];
  readonly dangling: readonly string[];
  readonly issue?: number;
  readonly posted: boolean;
}

export class TaskCloseError extends Error {}

const DRY_SHA = "<sha of the commit this would create>";

function git(repoRoot: string, args: readonly string[]): string {
  return execFileSync("git", args, { cwd: repoRoot, encoding: "utf8" });
}

/** `git grep -l` exits 1 when it matches nothing, which is not an error here. */
function gitGrepFiles(repoRoot: string, needle: string): readonly string[] {
  try {
    return git(repoRoot, ["grep", "-l", "-F", needle, "--", "."]).split("\n").filter((line) => line !== "");
  } catch {
    return [];
  }
}

function slugOf(dossier: string): string {
  return path.basename(dossier).replace(/\.md$/, "");
}

/** Escapes a literal for use inside a `RegExp` — a dossier basename carries `-` and `.`. */
function escapeRegExp(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function closeTasks(options: TaskCloseOptions, documents: DocumentStore): TaskCloseResult {
  const { repoRoot, dossiers, plan, summaryFile, dryRun } = options;
  const steps: string[] = [];
  const say = (line: string): void => {
    steps.push(line);
  };
  const run = (args: readonly string[]): void => {
    if (dryRun) say(`  would run: git ${args.join(" ")}`);
    else git(repoRoot, args);
  };

  if (dossiers.length === 0) throw new TaskCloseError("no dossier given");
  for (const dossier of dossiers) {
    if (!existsSync(path.join(repoRoot, dossier))) throw new TaskCloseError(`no such dossier: ${dossier}`);
  }
  if (plan !== undefined && !existsSync(path.join(repoRoot, plan))) {
    throw new TaskCloseError(`no such plan: ${plan}`);
  }

  // -------------------------------------------------------------------- step 0
  say("== referrers (collected before any deletion)");
  const referrers: string[] = [];
  for (const dossier of dossiers) {
    const base = path.basename(dossier);
    for (const hit of gitGrepFiles(repoRoot, base)) {
      if (dossiers.includes(hit)) continue;
      say(`  ${hit} -> ${dossier}`);
      if (!referrers.includes(hit)) referrers.push(hit);
    }
  }
  if (referrers.length === 0) say("  (none)");

  // -------------------------------------------------------------------- step 1
  // Ticking the box here rather than leaving it to the model is deliberate: it is what `task guard`
  // reads, so the two must be written by the same code that decides the batch is closing.
  say("== tick the Closure box");
  const ticked: string[] = [];
  for (const dossier of dossiers) {
    const next = tickClosureBox(documents.get(dossier));
    if (next === undefined) {
      say(`  already ticked or no box: ${dossier}`);
      continue;
    }
    if (dryRun) {
      say(`  would tick: ${dossier}`);
    } else {
      writeFileSync(path.join(repoRoot, dossier), next);
      say(`  ticked: ${dossier}`);
    }
    ticked.push(dossier);
  }

  // ---------------------------------------------------------------- steps 2, 3
  // Stage by name only: other agents work in these repositories concurrently, and `git add -A` has
  // already swept a sibling's in-flight edits into an unrelated commit.
  say("== commit the tick (this becomes the breadcrumb commit)");
  const slugs = dossiers.map(slugOf).join(" ");
  run(["add", ...dossiers, ...(plan === undefined ? [] : [plan])]);
  const tickMessage = `docs(tasks): record closure for ${slugs}`;
  let dossierSha: string;
  if (dryRun) {
    say(`  would run: git commit -m "${tickMessage}"`);
    dossierSha = DRY_SHA;
  } else {
    git(repoRoot, ["commit", "-q", "-m", tickMessage]);
    dossierSha = git(repoRoot, ["rev-parse", "HEAD"]).trim();
  }
  say(`  DOSSIER_SHA=${dossierSha}`);

  // ---------------------------------------------------------------- steps 4, 5
  say("== delete the dossiers and repoint what referred to them");
  run(["rm", "-q", ...dossiers]);

  // A closed dossier is named in plain text with a runnable `git show`, never left as a link: a link to
  // a deleted file makes a healthy repository look broken.
  const repointed: string[] = [];
  for (const referrer of referrers) {
    const absolute = path.join(repoRoot, referrer);
    if (!existsSync(absolute)) continue;
    let text = dryRun ? "" : readFileSync(absolute, "utf8");
    for (const dossier of dossiers) {
      const base = path.basename(dossier);
      if (dryRun) {
        say(`  would repoint in ${referrer}: links to ${base} -> plain text + git show ${dossierSha}:${dossier}`);
        continue;
      }
      const link = new RegExp(`\\[([^\\]]*)\\]\\([^)]*${escapeRegExp(base)}\\)`, "g");
      text = text.replace(link, `$1 (closed dossier — \`git show ${dossierSha}:${dossier}\`)`);
    }
    if (dryRun) continue;
    writeFileSync(absolute, text);
    repointed.push(referrer);
    say(`  repointed: ${referrer}`);
  }

  if (plan !== undefined) {
    if (dryRun) {
      say(`  would append the breadcrumbs to ${plan}`);
    } else {
      const lines = [
        "",
        "- Task dossiers closed and removed per the task lifecycle (`Planned → In Progress → Done → file removed, git history is the archive`):",
        ...dossiers.map((dossier) => `  - \`git show ${dossierSha}:${dossier}\``),
        "",
      ].join("\n");
      const absolute = path.join(repoRoot, plan);
      writeFileSync(absolute, readFileSync(absolute, "utf8") + lines);
      say(`  breadcrumbs appended to ${plan}`);
    }
  }

  // -------------------------------------------------------------------- step 6
  // NOT the dossiers: `git rm` already staged their deletion, and naming a file that no longer exists
  // makes `git add` exit with a pathspec error that drops every other path in the same invocation — the
  // commit then silently never happens. Stage only what still exists on disk.
  say("== commit the deletion together with the repointed referrers");
  const alsoStage = [...(plan === undefined ? [] : [plan]), ...referrers.filter((r) => r !== plan)];
  if (alsoStage.length > 0) run(["add", ...alsoStage]);
  else say("  (nothing beyond the deletion to stage)");

  const closeMessage = `chore(tasks): close ${slugs}, archived in history`;
  let closeSha: string;
  if (dryRun) {
    say(`  would run: git commit -m "${closeMessage}"`);
    closeSha = DRY_SHA;
  } else {
    git(repoRoot, ["commit", "-q", "-m", closeMessage]);
    closeSha = git(repoRoot, ["rev-parse", "HEAD"]).trim();
  }
  say(`  CLOSE_SHA=${closeSha}`);

  // -------------------------------------------------------------------- step 7
  // After the deletion, not before. The shell ran the whole links gate here and grepped one line out of
  // it; this asks the narrower question that step exists for — does any tracked file still name a
  // dossier that is now gone — which is answerable in-process and cannot be diluted by an unrelated
  // finding. The full gate still runs at the commit gate.
  say("== dangling check, run AFTER the deletion");
  const dangling: string[] = [];
  if (dryRun) {
    say("  skipped under --dry-run: nothing was deleted, so a pass here would mean nothing");
  } else {
    for (const dossier of dossiers) {
      const base = path.basename(dossier);
      // Matched the same way the repoint matched, by basename inside a link target — a referrer writes
      // `](../tasks/001-x.md)`, so grepping the repository-relative path would miss exactly the links
      // the repoint was aiming at, and report clean.
      const link = new RegExp(`\\[[^\\]]*\\]\\([^)]*${escapeRegExp(base)}\\)`);
      for (const hit of gitGrepFiles(repoRoot, base)) {
        if (!link.test(readFileSync(path.join(repoRoot, hit), "utf8"))) continue;
        if (!dangling.includes(hit)) dangling.push(hit);
        say(`  still links to the deleted ${dossier}: ${hit}`);
      }
    }
    if (dangling.length === 0) say("  no tracked file still links to a deleted dossier");
  }

  // -------------------------------------------------------------------- step 8
  say("== issue comment");
  let issue: number | undefined;
  let posted = false;
  if (summaryFile === undefined) {
    say("  no summary file given; nothing posted");
  } else if (dryRun) {
    say("  skipped under --dry-run (posting to an issue is outward-facing and not reversible)");
  } else {
    // The dossier is gone by now, so its issue number is read out of the breadcrumb commit — the last
    // one that still contains the file.
    for (const dossier of dossiers) {
      const match = /issues\/(\d+)/.exec(gitShow(repoRoot, dossierSha, dossier));
      if (match !== null) {
        issue = Number(match[1]);
        break;
      }
    }
    if (issue === undefined && plan !== undefined) {
      const match = /issues\/(\d+)/.exec(readFileSync(path.join(repoRoot, plan), "utf8"));
      if (match !== null) issue = Number(match[1]);
    }
    if (issue === undefined) {
      say("  no issue number found in the dossiers or the plan; nothing posted");
    } else {
      const plural = dossiers.length > 1;
      const body = [
        readFileSync(path.resolve(repoRoot, summaryFile), "utf8"),
        "",
        `The dossier${plural ? "s" : ""} below ${plural ? "were" : "was"} removed by the task lifecycle, not lost — the full content is in history:`,
        "",
        "```",
        ...dossiers.map((dossier) => `git show ${dossierSha}:${dossier}`),
        "```",
        "",
      ].join("\n");
      try {
        execFileSync("gh", ["issue", "comment", String(issue), "--body-file", "-"], {
          cwd: repoRoot,
          input: body,
          encoding: "utf8",
        });
        posted = true;
        say(`  posted to issue #${issue}`);
      } catch (cause) {
        say(`  could not post to issue #${issue}: ${String(cause)}`);
      }
    }
  }

  return { steps, dossierSha, closeSha, referrers, ticked, repointed, dangling, issue, posted };
}

function gitShow(repoRoot: string, sha: string, file: string): string {
  try {
    return git(repoRoot, ["show", `${sha}:${file}`]);
  } catch {
    return "";
  }
}
