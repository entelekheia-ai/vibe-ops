// vibe-ops task — the ephemeral dossier's lifecycle. `resolve` (Track 2), `close` and `guard` (Track 4).
// `close` deletes files and posts to an issue, which is why it is a command on an action noun and never a
// gate: a gate is a pure detector that never mutates and never resolves a destination (RFC-0001).

import { existsSync } from "node:fs";
import path from "node:path";
import { createDocumentStore, defineModule, resolvePluginDir } from "@entelekheia/vibe-ops-core";
import {
  blocks,
  closeTasks,
  closureBoxOpen,
  describe,
  dispatchRecord,
  formatResolved,
  resolveRecord,
  RecordsConfigError,
  TaskCloseError,
} from "@entelekheia/vibe-ops-records";

/**
 * Where `/vibe-ops:migrate` keeps its notes. The dispatch reads the same evidence the migrate skill
 * does, so "there is handling for this version" has one answer and one place to look when it is wrong.
 */
function migrationsDir(repoRoot: string): string {
  return path.join(resolvePluginDir(repoRoot), "skills", "migrate", "migrations");
}

export default defineModule(
  {
    id: "task",
    version: "0.0.1",
    summary: "The ephemeral dossier: resolve its layout, close it, or read its closure box",
    commands: [
      { name: "resolve", summary: "directory, template, next number, GitHub remote and auth" },
      {
        name: "close",
        summary: "the ordering-sensitive tail of closure: tick, commit, delete, repoint, post",
        destructive: true,
        flags: [
          { name: "dry-run", type: "boolean", description: "narrate every step, mutate nothing" },
          { name: "plan", type: "string", description: "the plan the breadcrumbs are appended to" },
          {
            name: "summary-file",
            type: "string",
            description: "body for the issue comment; without it nothing is posted",
          },
        ],
      },
      { name: "guard", summary: "which of the given dossiers still have an unchecked closure box" },
    ],
    flags: [{ name: "json", type: "boolean", description: "print the structured object instead of KEY=value lines" }],
  },
  async (context) => {
    const documents = createDocumentStore(context.repoRoot);

    if (context.command === "resolve") {
      let resolved;
      try {
        resolved = resolveRecord("task", context.repoRoot, context.config, documents);
      } catch (error) {
        if (error instanceof RecordsConfigError) return { code: 2, summary: error.message };
        throw error;
      }
      if (context.flags.json !== true) {
        for (const line of formatResolved(resolved)) context.log(line);
      }
      return { code: 0, data: resolved };
    }

    if (context.command === "guard") {
      if (context.args.length === 0) {
        return { code: 2, summary: "task guard needs at least one dossier path" };
      }
      const open = context.args.filter((file) => closureBoxOpen(documents.get(file)));
      if (context.flags.json !== true) {
        if (open.length === 0) context.log("no dossier with an open closure box");
        for (const file of open) context.log(`${file}: the closure box is still unchecked`);
      }
      return { code: 0, data: { open } };
    }

    if (context.command === "close") {
      const dryRun = context.flags["dry-run"] === true;
      const plan = typeof context.flags.plan === "string" ? context.flags.plan : undefined;
      const summaryFile = typeof context.flags["summary-file"] === "string" ? context.flags["summary-file"] : undefined;

      let resolved;
      try {
        resolved = resolveRecord("task", context.repoRoot, context.config, documents);
      } catch (error) {
        if (error instanceof RecordsConfigError) return { code: 2, summary: error.message };
        throw error;
      }

      // EVERY dossier is dispatched before ANY of them is touched. `closeTasks` collects referrers
      // across the whole batch and only then deletes, so closing half a batch loses the information the
      // other half's repair needs — a batch with one blocked dossier stops as a batch, naming each one.
      // A path that does not exist is not a version question, and answering it as one tells the operator
      // to declare frontmatter in a file that is not there. `closeTasks` already owns that message, so
      // the dispatch stands aside and lets it be thrown rather than growing a second copy of it.
      const dir = migrationsDir(context.repoRoot);
      const present = context.args.filter((file) => existsSync(path.join(context.repoRoot, file)));
      const dispatched = (present.length === context.args.length ? context.args : []).map((file) => {
        const dispatch = dispatchRecord({
          record: documents.get(file),
          current: resolved.templateVersion,
          migrationsDir: dir,
        });
        return { file, dispatch, line: describe(dispatch, file), blocked: blocks(dispatch) };
      });
      const blocked = dispatched.filter((entry) => entry.blocked);
      if (blocked.length > 0) {
        return { code: 2, summary: blocked.map((entry) => entry.line).join("\n") };
      }
      // Also into `data` below: `--json` suppresses every logged line, so an alert that exists only as a
      // line does not arrive on that surface. Only the dossiers that owe one appear, so a batch of
      // current dossiers adds no key at all.
      const version = dispatched
        .filter((entry): entry is typeof entry & { line: string } => entry.line !== undefined)
        .map((entry) => ({ file: entry.file, line: entry.line, dispatch: entry.dispatch }));
      if (context.flags.json !== true) {
        for (const entry of version) context.log(entry.line);
      }

      let result;
      try {
        result = closeTasks(
          { repoRoot: context.repoRoot, dossiers: context.args, plan, summaryFile, dryRun },
          documents,
        );
      } catch (error) {
        if (error instanceof TaskCloseError) return { code: 2, summary: error.message };
        throw error;
      }

      if (context.flags.json !== true) {
        for (const line of result.steps) context.log(line);
      }
      // A reference left dangling by the deletion is the failure this whole ordering exists to prevent,
      // so it is the one outcome that changes the exit code rather than only being narrated.
      return {
        code: result.dangling.length > 0 ? 1 : 0,
        summary:
          result.dangling.length > 0 ? `${result.dangling.length} file(s) still link to a deleted dossier` : undefined,
        data: { ...result, version: version.length > 0 ? version : undefined },
      };
    }

    return { code: 2, summary: `task ${String(context.command)} is not implemented yet` };
  },
);
