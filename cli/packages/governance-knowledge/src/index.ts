// vibe-ops log — the write-once trap tier. `resolve` (Track 2), `index`, `sweep` and `lint` (Track 5).
//
// `log` is deliberately not a `RecordType`: every one of those is numbered, and a trap is addressed by
// the path where it recurs, never by a position in a sequence. `resolve` therefore reports no
// NEXT-shaped field at all, matching `new-log`'s Step 2 — "Do not call resolve-governance.sh — a log
// entry has no number."
//
// `index` is what that skill's Step 5 has an HTML comment waiting for: "when the index generator exists
// this step becomes 'run it'. Until then the row is written here, and that is the drift surface."
//
// THIS FILE IS ONE OF TWO ENTRY MODULES `@entelekheia/governance-knowledge` BUILDS FROM ONE MANIFEST
// (Plan-040 Track 3, ADR-0020) — this one serves `log` (the `.` export, the default binding, so a
// repository declaring nothing keeps working with no edit); `./index-learning.ts` serves `learning` (the
// `./learning` export). Both call `defineGovernance` against the same `type.json`, each naming its own
// unit through the `type` option, so `log` keeps its type name, its noun, its MCP tool, its settings key
// and its fragment's globs exactly as ADR-0019 promised — moving into a multi-unit package is not a
// rename. `governance-log` retires as a *package*; `log` survives as a *type*.

import { fileURLToPath } from "node:url";
import { createDocumentStore } from "@entelekheia/vibe-ops-core";
import { defineGovernance } from "@entelekheia/governance-base";
import { findLogDir, formatResolved } from "@entelekheia/governance-base";
import { logIndex, logLint, logSweep, preambleOf, readLogEntries } from "./log.ts";
import type { ResolvedLocation } from "@entelekheia/governance-base";
import { writeFileSync } from "node:fs";
import path from "node:path";

const INDEX = "README.md";

export default defineGovernance({
    root: path.join(path.dirname(fileURLToPath(import.meta.url)), ".."),
    version: "0.0.1",
    type: "log",
    summary: "The write-once trap tier: resolve it, regenerate its index, sweep it, lint it",
    commands: [
      { name: "resolve", summary: "where entries live — no number, deliberately" },
      {
        name: "index",
        summary: "regenerate the index from the entries themselves, grouped by path prefix",
        // `--dry-run` is the name every other verb in this CLI uses for "do not write" (`plan close`,
        // `task close`). `--check` meant the same thing here and nowhere else. `--check` is kept as an
        // accepted spelling rather than removed: it appears in a shipped SKILL.md and in the pre-commit
        // recipes of repositories this CLI does not control, and breaking those to tidy a name is a cost
        // paid by someone who did not choose it.
        flags: [
          { name: "dry-run", type: "boolean", description: "report drift and exit 1 instead of writing" },
          { name: "check", type: "boolean", description: "deprecated spelling of --dry-run" },
        ],
      },
      { name: "sweep", summary: "entries whose path: no longer resolves — retirement candidates, never deletions" },
      { name: "lint", summary: "name matches filename, kind is trap|debt, no status, a real attempted date" },
    ],
    flags: [{ name: "json", type: "boolean", description: "print the structured object instead of KEY=value lines" }],
    run: async (context) => {
    const documents = createDocumentStore(context.repoRoot);
    const dir = findLogDir(context.repoRoot);

    if (context.command === "resolve") {
      // Through the shared formatter, not a hand-written line: `log` prints fewer keys than a numbered
      // type, and which keys those are is the formatter's call to make once rather than this module's to
      // restate (Plan-027 Track 1).
      const resolved: ResolvedLocation = { type: "log", root: context.repoRoot, dir };
      if (context.flags.json !== true) for (const line of formatResolved(resolved)) context.log(line);
      return {
        code: 0,
        summary: dir === undefined ? "no log directory in this repository" : `log entries live in ${dir}`,
        data: resolved,
      };
    }

    if (dir === undefined) {
      return { code: 2, summary: "no log directory in this repository — nothing to read" };
    }
    const entries = readLogEntries(documents, context.repoRoot, dir);

    if (context.command === "lint") {
      const findings = logLint(entries);
      if (context.flags.json !== true) {
        if (findings.length === 0) context.log(`${entries.length} entr(ies) examined, nothing to report`);
        for (const finding of findings) context.log(`${finding.file}: [${finding.rule}] ${finding.evidence}`);
      }
      return {
        code: findings.length > 0 ? 1 : 0,
        summary:
          findings.length === 0
            ? `${entries.length} log entr(ies) in ${dir} examined, nothing to report`
            : `${findings.length} finding(s) across ${entries.length} log entr(ies) in ${dir}`,
        data: { findings, examined: entries.length },
      };
    }

    if (context.command === "sweep") {
      const retirable = logSweep(context.repoRoot, entries);
      if (context.flags.json !== true) {
        if (retirable.length === 0) context.log(`${entries.length} entr(ies) examined, none retirable`);
        for (const candidate of retirable) {
          context.log(`${candidate.file}: path no longer resolves (${candidate.unresolved.join(", ")}) — retirement candidate`);
        }
      }
      // Zero is the ordinary answer, and a candidate is a judgement to make rather than a failure, so
      // this never changes the exit code. Retirement is deletion plus a tombstone, and both are the
      // skill's to write — an entry whose path merely moved is not one whose trap is gone.
      return {
        code: 0,
        summary:
          retirable.length === 0
            ? `${entries.length} log entr(ies) in ${dir} examined, none retirable`
            : `${retirable.length} of ${entries.length} log entr(ies) in ${dir} are retirement candidates`,
        data: { retirable, examined: entries.length },
      };
    }

    if (context.command === "index") {
      const indexFile = `${dir}/${INDEX}`;
      const document = documents.get(indexFile);
      const next = logIndex(entries, preambleOf(document));

      if (context.flags["dry-run"] === true || context.flags.check === true) {
        const drifted = next !== document.text;
        if (context.flags.json !== true) {
          context.log(drifted ? `${indexFile} is out of date — run vibe-ops log index` : `${indexFile} is up to date`);
        }
        return {
          code: drifted ? 1 : 0,
          summary: drifted ? `${indexFile} is out of date — run vibe-ops log index` : `${indexFile} is up to date`,
          data: { drifted, file: indexFile },
        };
      }

      writeFileSync(path.join(context.repoRoot, indexFile), next);
      if (context.flags.json !== true) context.log(`${indexFile}: ${entries.length} entr(ies) written`);
      return {
        code: 0,
        summary: `${indexFile}: ${entries.length} entr(ies) written`,
        data: { file: indexFile, entries: entries.length },
      };
    }

    return { code: 2, summary: `log ${String(context.command)} is not implemented yet` };
    },
});

export { findLogDir } from "@entelekheia/governance-base";
export { groupOf, logIndex, logLint, logSweep, preambleOf, readLogEntries } from "./log.ts";
export type { LogEntry, LogFinding, LogRetirable } from "./log.ts";
