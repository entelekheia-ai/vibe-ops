// vibe-ops plan — the permanent design record's lifecycle. `resolve` (Track 2), `status` and `context`
// (Track 3) here; `file` and `close` are Track 6, on this same module — the noun is `plan`, the verbs
// accumulate on it.

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createDocumentStore, defineModule, resolvePluginDir } from "@entelekheia/vibe-ops-core";
import {
  blocks,
  closePlan,
  describe,
  dispatchRecord,
  filePlan,
  PlanCloseError,
  formatResolved,
  planModeGuidance,
  planStatusFindings,
  resolveRecord,
  RecordsConfigError,
} from "@entelekheia/vibe-ops-records";
import type { Dispatch, PlanStatusFinding } from "@entelekheia/vibe-ops-records";

/** The approved plan arrives on stdin when `--from` is absent — the shape a hook hands it over in. */
async function readAll(stream: NodeJS.ReadableStream): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

/**
 * Where `/vibe-ops:migrate` keeps its notes. The dispatch reads the same evidence the migrate skill
 * does, so "there is handling for this version" has one answer and one place to look when it is wrong.
 */
function migrationsDir(repoRoot: string): string {
  return path.join(resolvePluginDir(repoRoot), "skills", "migrate", "migrations");
}

export default defineModule(
  {
    id: "plan",
    version: "0.0.1",
    summary: "The permanent design record: resolve its layout, check Status against its tracks",
    commands: [
      { name: "resolve", summary: "directory, template, next number, active status, living sections" },
      {
        name: "status",
        summary: "every plan whose Status disagrees with its own track checkboxes — the coherence read",
      },
      {
        name: "context",
        summary: "the plan-mode guidance text, built from the resolved living sections",
        flags: [{ name: "project-dir", type: "string", description: "the session's nominal project root, if it may differ from repoRoot" }],
      },
      {
        name: "file",
        summary: "file an approved plan into the plans directory, dropping its Repository row",
        flags: [{ name: "from", type: "string", description: "the plan-mode file to read; without it, stdin" }],
      },
      {
        name: "close",
        summary: "set the terminal status and move the plan into shipped/, keeping its number",
        destructive: true,
        flags: [{ name: "dry-run", type: "boolean", description: "say what would happen, change nothing" }],
      },
    ],
    flags: [{ name: "json", type: "boolean", description: "print the structured object instead of KEY=value lines" }],
  },
  async (context) => {
    // One store for the whole invocation, the way `defineOps` builds one for a gate composition: the
    // template, the authority and every plan under the resolved directory are parsed once, however many
    // of the verbs below happen to read them.
    const documents = createDocumentStore(context.repoRoot);

    if (context.command === "resolve") {
      let resolved;
      try {
        resolved = resolveRecord("plan", context.repoRoot, context.config, documents);
      } catch (error) {
        if (error instanceof RecordsConfigError) return { code: 2, summary: error.message };
        throw error;
      }
      if (context.flags.json !== true) {
        for (const line of formatResolved(resolved)) context.log(line);
      }
      return { code: 0, data: resolved };
    }

    if (context.command === "status") {
      let resolved;
      try {
        resolved = resolveRecord("plan", context.repoRoot, context.config, documents);
      } catch (error) {
        if (error instanceof RecordsConfigError) return { code: 2, summary: error.message };
        throw error;
      }
      const findings: readonly PlanStatusFinding[] =
        resolved.dir === undefined
          ? []
          : planStatusFindings(documents, context.repoRoot, resolved.dir, resolved.plan?.active, resolved.plan?.terminal);

      if (context.flags.json !== true) {
        if (findings.length === 0) context.log("no incoherent plan found");
        for (const finding of findings) {
          const reason =
            finding.reason === "terminal-with-open-tracks"
              ? `Status is "${finding.status}" (terminal) but ${finding.tracksTotal - finding.tracksChecked} of ${finding.tracksTotal} tracks are unchecked`
              : `Status is "${finding.status}" (active) but all ${finding.tracksTotal} tracks are checked`;
          context.log(`${finding.file}: ${reason}`);
        }
      }
      return { code: 0, data: { findings } };
    }

    if (context.command === "context") {
      let resolved;
      try {
        resolved = resolveRecord("plan", context.repoRoot, context.config, documents);
      } catch (error) {
        if (error instanceof RecordsConfigError) return { code: 2, summary: error.message };
        throw error;
      }
      const projectDir = typeof context.flags["project-dir"] === "string" ? context.flags["project-dir"] : undefined;
      const text = planModeGuidance(resolved, projectDir);
      if (context.flags.json !== true && text !== "") context.log(text);
      return { code: 0, data: { text } };
    }

    if (context.command === "file") {
      let resolved;
      try {
        resolved = resolveRecord("plan", context.repoRoot, context.config, documents);
      } catch (error) {
        if (error instanceof RecordsConfigError) return { code: 2, summary: error.message };
        throw error;
      }
      if (resolved.dir === undefined) return { code: 2, summary: "no plans directory in this repository" };
      if (typeof resolved.next !== "string") return { code: 2, summary: "the next plan number is unknown — see AUTHORITY" };

      const from = typeof context.flags.from === "string" ? context.flags.from : undefined;
      const text = from === undefined ? await readAll(process.stdin) : readFileSync(path.resolve(context.repoRoot, from), "utf8");

      const filed = filePlan({ repoRoot: context.repoRoot, dir: resolved.dir, next: resolved.next, text });
      if (filed.skipped !== undefined) {
        if (context.flags.json !== true) context.log(`not filed: ${filed.skipped}`);
        return { code: 0, data: filed };
      }
      if (context.flags.json !== true) context.log(`filed: ${filed.file}`);
      return { code: 0, data: filed };
    }

    if (context.command === "close") {
      let resolved;
      try {
        resolved = resolveRecord("plan", context.repoRoot, context.config, documents);
      } catch (error) {
        if (error instanceof RecordsConfigError) return { code: 2, summary: error.message };
        throw error;
      }
      const [file] = context.args;
      if (file === undefined) return { code: 2, summary: "plan close needs the plan's path" };
      if (resolved.dir === undefined) return { code: 2, summary: "no plans directory in this repository" };
      if (resolved.plan?.terminal === undefined) {
        return { code: 2, summary: "the terminal status could not be resolved — check the plan template's Status lifecycle marker" };
      }

      // BEFORE closePlan, which rewrites the Status row, moves the file and commits: a stop that lands
      // after the first mutation is not a stop. `describe` returns undefined for a current plan, so the
      // common path says nothing about versions at all.
      //
      // A path that does not exist is not a version question, and answering it as one tells the operator
      // to declare frontmatter in a file that is not there. `closePlan` already owns that message, so the
      // dispatch stands aside and lets it be thrown rather than growing a second copy of it.
      //
      // The alert travels in `data` as well, because `--json` suppresses every logged line and an alert
      // that only exists as a line does not arrive there. A current plan sets nothing, so `JSON.stringify`
      // emits no key for it and the common path stays silent about versions on this channel too.
      let version: { readonly line: string; readonly dispatch: Dispatch } | undefined;
      if (existsSync(path.join(context.repoRoot, file))) {
        const dispatch = dispatchRecord({
          record: documents.get(file),
          current: resolved.templateVersion,
          migrationsDir: migrationsDir(context.repoRoot),
        });
        const line = describe(dispatch, file);
        if (blocks(dispatch)) return { code: 2, summary: line };
        if (line !== undefined) {
          version = { line, dispatch };
          if (context.flags.json !== true) context.log(line);
        }
      }

      let closed;
      try {
        closed = closePlan(
          {
            repoRoot: context.repoRoot,
            dir: resolved.dir,
            file,
            terminal: resolved.plan.terminal,
            dryRun: context.flags["dry-run"] === true,
          },
          documents,
        );
      } catch (error) {
        if (error instanceof PlanCloseError) return { code: 2, summary: error.message };
        throw error;
      }
      if (context.flags.json !== true) {
        for (const line of closed.steps) context.log(line);
      }
      return { code: 0, data: { ...closed, version } };
    }

    return { code: 2, summary: `plan ${String(context.command)} is not implemented yet` };
  },
);
