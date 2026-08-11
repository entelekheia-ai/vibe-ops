// vibe-ops log — the write-once trap tier. `resolve` (Track 2), `index`, `sweep` and `lint` (Track 5).
//
// `log` is deliberately not a `RecordType`: every one of those is numbered, and a trap is addressed by
// the path where it recurs, never by a position in a sequence. `resolve` therefore reports no
// NEXT-shaped field at all, matching `new-log`'s Step 2 — "Do not call resolve-governance.sh — a log
// entry has no number."
//
// `index` is what that skill's Step 5 has an HTML comment waiting for: "when the index generator exists
// this step becomes 'run it'. Until then the row is written here, and that is the drift surface."

import { createDocumentStore, defineModule } from "@entelekheia/vibe-ops-core";
import {
  findLogDir,
  logIndex,
  logLint,
  logSweep,
  preambleOf,
  readLogEntries,
} from "@entelekheia/vibe-ops-records";
import { writeFileSync } from "node:fs";
import path from "node:path";

const INDEX = "README.md";

export default defineModule(
  {
    id: "log",
    version: "0.0.1",
    summary: "The write-once trap tier: resolve it, regenerate its index, sweep it, lint it",
    commands: [
      { name: "resolve", summary: "where entries live — no number, deliberately" },
      {
        name: "index",
        summary: "regenerate the index from the entries themselves, grouped by path prefix",
        flags: [{ name: "check", type: "boolean", description: "report drift and exit 1 instead of writing" }],
      },
      { name: "sweep", summary: "entries whose path: no longer resolves — retirement candidates, never deletions" },
      { name: "lint", summary: "name matches filename, kind is trap|debt, no status, a real attempted date" },
    ],
    flags: [{ name: "json", type: "boolean", description: "print the structured object instead of KEY=value lines" }],
  },
  async (context) => {
    const documents = createDocumentStore(context.repoRoot);
    const dir = findLogDir(context.repoRoot);

    if (context.command === "resolve") {
      if (context.flags.json !== true) context.log(`DIR=${dir ?? "(none)"}`);
      return { code: 0, data: { type: "log" as const, root: context.repoRoot, dir } };
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
      return { code: findings.length > 0 ? 1 : 0, data: { findings, examined: entries.length } };
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
      return { code: 0, data: { retirable, examined: entries.length } };
    }

    if (context.command === "index") {
      const indexFile = `${dir}/${INDEX}`;
      const document = documents.get(indexFile);
      const next = logIndex(entries, preambleOf(document));

      if (context.flags.check === true) {
        const drifted = next !== document.text;
        if (context.flags.json !== true) {
          context.log(drifted ? `${indexFile} is out of date — run vibe-ops log index` : `${indexFile} is up to date`);
        }
        return { code: drifted ? 1 : 0, data: { drifted, file: indexFile } };
      }

      writeFileSync(path.join(context.repoRoot, indexFile), next);
      if (context.flags.json !== true) context.log(`${indexFile}: ${entries.length} entr(ies) written`);
      return { code: 0, data: { file: indexFile, entries: entries.length } };
    }

    return { code: 2, summary: `log ${String(context.command)} is not implemented yet` };
  },
);
