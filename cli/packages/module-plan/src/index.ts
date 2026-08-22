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
  planClosureBoxOpen,
  planStatusFindings,
  resolveRecord,
  RecordsConfigError,
  routingPolicy,
} from "@entelekheia/governance-base";
import type { Dispatch, PlanStatusFinding } from "@entelekheia/governance-base";

/** The approved plan arrives on stdin when `--from` is absent — the shape a hook hands it over in. */
async function readAll(stream: NodeJS.ReadableStream): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

/**
 * Where `/vibe-ops:migrate` keeps its notes. The dispatch reads the same evidence the migrate skill
 * does, so "there is handling for this version" has one answer and one place to look when it is wrong.
 *
 * TWO PLACES, IN THIS ORDER, and the second is why this is not a one-liner. `resolvePluginDir` answers
 * "where is *the target's* plugin surface", which is right for a gate scoped to `<plugin>/skills/*` and
 * wrong here: a consumer repository ships no migration notes, so it resolved to a directory that does not
 * exist and every older record reported `unhandled`. That reads as "nobody wrote a note for this shape"
 * when the note exists and was merely looked for in the wrong tree — and since `unhandled` blocks, it
 * stopped `plan close` on any record not already at the current version, in every repository but this one.
 *
 * So: the target's own notes when it has them (a repository may version its own templates), otherwise the
 * installed norm's. The notes belong to the tool, not to the repository being acted on, which is what
 * `needsSource` names — `context.sourceRoot` resolves `config.harness.source`, then `--source`, then
 * `CLAUDE_PLUGIN_ROOT`. Undefined stays undefined: no source is "nothing to compare against", not an error.
 */
function migrationsDir(repoRoot: string, sourceRoot: string | undefined): string | undefined {
  const local = path.join(resolvePluginDir(repoRoot), "skills", "migrate", "migrations");
  if (existsSync(local)) return local;
  return sourceRoot === undefined ? undefined : path.join(sourceRoot, "skills", "migrate", "migrations");
}

export default defineModule(
  {
    id: "plan",
    version: "0.0.1",
    summary: "The permanent design record: resolve its layout, check Status against its tracks",
    // The migration notes this module dispatches on belong to the installed norm, not to the repository
    // being closed — see `migrationsDir` above. Without this, `sourceRoot` is never populated and a
    // consumer repository can only ever find notes it does not ship.
    needsSource: true,
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
      {
        // The symmetric of `task guard`, which has asked this of dossiers since Plan-011 while nothing
        // asked it of plans. That asymmetry has a body count: every plan shipped before 2026-08-12 left
        // its closure box open, so `plan status` reported each of them as terminal-with-an-unchecked-track
        // indefinitely and nobody read the complaint.
        name: "guard",
        summary: "which of the given plans still have an unchecked closure box",
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
      return {
        code: 0,
        summary:
          resolved.dir === undefined
            ? "no plans directory in this repository"
            : `plans live in ${resolved.dir}, next number ${typeof resolved.next === "string" ? resolved.next : "unknown"}`,
        data: resolved,
      };
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
      // The summary names the population, not just the verdict. "no incoherent plan found" alone reads
      // as an answer about the repository; with nowhere named, it is indistinguishable from having
      // looked nowhere — which is exactly what an empty result was doing before.
      return {
        code: 0,
        summary:
          resolved.dir === undefined
            ? "no plans directory in this repository, so no plan was read"
            : findings.length === 0
              ? `no plan in ${resolved.dir} has a Status disagreeing with its tracks`
              : `${findings.length} plan(s) in ${resolved.dir} have a Status disagreeing with their tracks`,
        data: { findings },
      };
    }

    if (context.command === "guard") {
      if (context.args.length === 0) {
        return { code: 2, summary: "plan guard needs at least one plan path" };
      }
      const open = context.args.filter((file) => planClosureBoxOpen(documents.get(file)));
      if (context.flags.json !== true) {
        if (open.length === 0) context.log("no plan with an open closure box");
        for (const file of open) context.log(`${file}: the closure box is still unchecked`);
      }
      return {
        code: 0,
        summary:
          open.length === 0
            ? `${context.args.length} plan(s) checked, none with an open closure box`
            : `${open.length} of ${context.args.length} plan(s) still have an open closure box`,
        data: { open },
      };
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
      return {
        code: 0,
        summary: text === "" ? "no plan-mode guidance applies in this repository" : "plan-mode guidance built",
        data: { text },
      };
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
        return { code: 0, summary: `not filed: ${filed.skipped}`, data: filed };
      }
      if (context.flags.json !== true) context.log(`filed: ${filed.file}`);
      return { code: 0, summary: `filed: ${filed.file}`, data: filed };
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
          migrationsDir: migrationsDir(context.repoRoot, context.sourceRoot),
        });
        const line = describe(dispatch, file);
        // `describe` returns undefined for a current plan, and a current plan never blocks — but the two
        // facts are not tied together in the types, so a blocking dispatch with no line still needs to
        // say something rather than close silently on an empty summary.
        if (blocks(dispatch)) return { code: 2, summary: line ?? `${file}: its template version blocks closing` };
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
      // Which routing policy this closure ran under. Recorded on every closure, not only when something
      // is owed: the question it answers — "which closures used the old rule" — is asked about the runs
      // that looked ordinary at the time.
      const policy = routingPolicy(resolvePluginDir(context.repoRoot), context.repoRoot, documents);
      return {
        code: 0,
        summary:
          context.flags["dry-run"] === true
            ? `dry run: ${closed.from} would move to ${closed.to} with status "${closed.status}"`
            : `${closed.from} closed as "${closed.status}" and moved to ${closed.to}`,
        data: { ...closed, version, policy },
      };
    }

    return { code: 2, summary: `plan ${String(context.command)} is not implemented yet` };
  },
);
