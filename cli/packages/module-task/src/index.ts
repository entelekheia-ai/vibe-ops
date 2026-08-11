// vibe-ops task — the ephemeral dossier's lifecycle. `resolve` (Track 2), `close` and `guard` (Track 4).
// `close` deletes files and posts to an issue, which is why it is a command on an action noun and never a
// gate: a gate is a pure detector that never mutates and never resolves a destination (RFC-0001).

import { createDocumentStore, defineModule } from "@entelekheia/vibe-ops-core";
import {
  closeTasks,
  closureBoxOpen,
  formatResolved,
  resolveRecord,
  RecordsConfigError,
  TaskCloseError,
} from "@entelekheia/vibe-ops-records";

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
        data: result,
      };
    }

    return { code: 2, summary: `task ${String(context.command)} is not implemented yet` };
  },
);
