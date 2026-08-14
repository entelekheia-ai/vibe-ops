// New gate — no shell precedent, and deliberately not written as one. Plan-012's Track 2 dossier asked
// for an eighteenth shell fragment AND for it to read through the Track 1 reader rather than a second
// parser; once that reader turned out to be TypeScript, the two halves of that instruction stopped
// fitting together. A shell fragment would have had to re-derive frontmatter and header-anchoring in
// awk, which is the duplicate the instruction existed to prevent.
//
// WHAT IT DETECTS, and why each is a separate `rule`: they are acted on differently.
//
//   template-version-undeclared  nobody has classified this file's shape. Reported, never resolved to
//                                the oldest known version — that guess is wrong in both directions.
//   template-version-behind      an upgrade is owed. Declared WARN, and that word is doing work: it is
//                                this gate's DEFAULT, not its verdict. A template bump leaves every
//                                existing record behind at once and they are migrated one at a time, so
//                                a gate that goes red for the whole of that interval is the one people
//                                switch off — but a repository that has finished its migration should be
//                                able to hold the line. `settings.<ops>.level` overrides it per rule; see
//                                the POPULATION VS BEHAVIOUR note in core's ops.ts. The evidence carries
//                                the record's own Status, so "open AND behind" — where a fix is owed
//                                FIRST — is answerable from the findings without this gate aggregating
//                                anything.
//   template-version-ahead       the record is newer than the template. The tooling is behind, or the
//                                template was reverted; either way it is not something to migrate through.
//   template-version-mismatch    a record under one type's directory declaring another type's token.
//
// THE CURRENT VERSION IS READ FROM THE TEMPLATE, never hardcoded here or in the composition. `options.
// template` names the file, the same way `fragment-parity` is handed the runner it compares against, so
// a template bump is picked up with no edit to any of this. Hardcoding it would put the number in a
// second place and guarantee the two drift — which is the entire subject of Plan-012.
//
// THE COMPARATOR IS SHARED, not reimplemented. `compareVersions` comes from records, where the dispatch
// the closing verbs run through also reads it. Two version orderings would drift, and a drift here is
// invisible from either side: both answers look like a version ordering.
//
// NO GRADE, NO AGGREGATE. Per eita's doctrine and RFC-0001, the gate says what it saw, one finding per
// record; the composition decides what is recorded and a consuming reader decides what any of it is
// worth. A "health score" computed here would be this repository judging itself.

import { defineGate, expandPluginToken } from "@entelekheia/vibe-ops-core";
import type { Document, GateFinding } from "@entelekheia/vibe-ops-core";
import { compareVersions, findHeaderTable, readTemplateVersion, valueOf } from "@entelekheia/vibe-ops-records";

interface TemplateVersionOptions {
  /**
   * Repository-relative path to the template whose declaration is the current one, **already expanded
   * by the composing ops**. A composition names `<template:<type>>` and the ops resolves it against the
   * repository's own `records.templates` and search order; `<plugin>/` still expands too, for a
   * composition that names a path inside the plugin surface directly.
   *
   * It arrives expanded rather than being resolved here because where a template lives is a fact about
   * the target's layout, which is the ops's half of the split and never the detector's. Naming
   * `<plugin>/templates/<type>.md` in the composition put that decision here by accident: in a repo laid
   * out flat the token resolved to the repository root, where nothing writes templates, so this gate was
   * inert in every repository the tooling scaffolds while reporting SKIP.
   */
  readonly template?: string;
}

/**
 * The record's own Status, so a `behind` finding says whether the work is still open — which is what
 * separates "an upgrade is owed here" from "a fix is owed here first". `unknown` when the record carries
 * no header table, which is a legitimate shape for a log entry.
 */
function statusOf(document: Document): string {
  if (document.tree === undefined) return "unknown";
  const table = findHeaderTable(document.tree.rootNode);
  if (table === undefined) return "unknown";
  return valueOf(table, "Status") ?? "unknown";
}

export default defineGate(
  {
    id: "template-version",
    version: 1,
    summary: "Every governance record declares which template version it was written against",
  },
  async ({ files, documents, options, repoRoot, pluginDir }) => {
    const declaredPath = (options as TemplateVersionOptions).template;
    if (declaredPath === undefined) {
      throw new Error("template-version requires options.template — the path whose declaration is current");
    }
    const templatePath = expandPluginToken(declaredPath, repoRoot, pluginDir);

    // Two different absences, and collapsing them is how a gate reports a repository as broken for
    // being small. A template that is not there leaves nothing to compare against, so SKIP naming the
    // path. A template that IS there and declares nothing is a real defect: every record under it would
    // read as undeclared for a reason that is not about the record.
    //
    // THE REASON SAYS ONLY WHAT THIS GATE KNOWS. It used to say "this repository keeps no records of
    // that type", which is a statement about the records — a population this gate never looked at, and
    // one it was wrong about: the sentence was printed over a repository holding 9 ADRs, 25 RFCs and 4
    // plans, because the composition names a template path the repository does not use. A skip reason
    // that explains the wrong thing is what kept that misconfiguration invisible.
    const templateDocument = documents.get(templatePath);
    if (templateDocument.tree === undefined) {
      return { findings: [], skipped: `no ${templatePath} — nothing to compare these records against` };
    }

    const current = readTemplateVersion(templateDocument);
    if (current === undefined) {
      return {
        findings: [
          {
            rule: "template-version-undeclared",
            file: templatePath,
            evidence: "the template declares no version, so no record under it can be compared",
          },
        ],
        examined: 0,
      };
    }

    const findings: GateFinding[] = [];
    let examined = 0;

    for (const file of files) {
      const document = documents.get(file);
      if (document.tree === undefined) continue;
      examined++;

      const declared = readTemplateVersion(document);
      if (declared === undefined) {
        findings.push({
          rule: "template-version-undeclared",
          file,
          line: 1,
          evidence: `no version declared — expected ${current.type}@${current.version} in the frontmatter`,
        });
        continue;
      }

      if (declared.type !== current.type) {
        findings.push({
          rule: "template-version-mismatch",
          file,
          line: 1,
          evidence: `declares ${declared.type}@${declared.version} but sits under ${current.type}`,
        });
        continue;
      }

      const order = compareVersions(declared.version, current.version);
      if (order < 0) {
        findings.push({
          rule: "template-version-behind",
          level: "warn",
          file,
          line: 1,
          evidence:
            `declares ${declared.type}@${declared.version}, template is ${current.type}@${current.version}` +
            ` — Status: ${statusOf(document)}`,
        });
      } else if (order > 0) {
        findings.push({
          rule: "template-version-ahead",
          file,
          line: 1,
          evidence: `declares ${declared.type}@${declared.version}, ahead of the template's ${current.version}`,
        });
      }
    }

    return { findings, examined };
  },
);
