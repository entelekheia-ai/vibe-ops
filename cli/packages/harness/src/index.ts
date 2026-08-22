// vibe-ops harness — the read-only half of Plan-025. Four verbs, none of which write into the
// repository they act on: what shape it is in, whether the promulgated norm is current, what is
// composed versus merely available, and what guides/sensors exist. Promulgation (`sync`) and the skill
// split are separate tracks and are not this module's job.

import { defineModule, writeHarnessState } from "@entelekheia/vibe-ops-core";
import { repoShape } from "./shape.ts";
import { behindEntries, formatBehind, shippedVersions } from "./status.ts";
import { buildCatalog } from "./catalog.ts";
import { buildAudit } from "./audit.ts";
import { formatResolvedHarness, resolveHarness } from "./resolve.ts";
import { sync } from "./sync.ts";

export { behindEntries, formatBehind, shippedVersion, shippedVersions, TYPES } from "./status.ts";
export type { BehindEntry, VersionedType } from "./status.ts";
export { churnByTopLevel, hasRemote, hooksPath, repoShape, workflowFiles } from "./shape.ts";
export type { ChurnEntry, RepoShape } from "./shape.ts";
export { buildCatalog } from "./catalog.ts";
export type { Catalog, CatalogEntry } from "./catalog.ts";
export { buildAudit, isScopedRule, lineCount } from "./audit.ts";
export type { Audit, GuideEntry, RecordOverlayEntry, SensorEntry } from "./audit.ts";
export { formatResolvedHarness, resolveHarness } from "./resolve.ts";
export type { ResolvedHarness, Surface } from "./resolve.ts";
// The ownership declaration and its composition — readable by any actor that must consult the
// boundary before acting (Plan-031): promulgation already does, migration's handling report now does.
export { classOf, composedOwnership, entryFor, ownershipPath, readOwnership, widens } from "./ownership.ts";
export type { Ownership, OwnershipClass, OwnershipEntry } from "./ownership.ts";
export { boundaryRefusals, currentBranch, normContent, sync } from "./sync.ts";
export type { RefusedPath, SyncOptions, SyncResult } from "./sync.ts";

export default defineModule(
  {
    id: "harness",
    version: "0.0.1",
    summary:
      "The read-only half: this repository's shape, whether the promulgated norm is current, what is composed vs. available, and what guides/sensors exist",
    needsSource: true,
    // Its subject IS a repository, and usually not the one you are standing in — "which repositories are
    // on version N?" is the question this module exists for. Without this the target path is accepted as
    // a positional, silently ignored, and every verb answers about the working directory instead: right
    // by accident for `.` and wrong for every other value, which is the exact defect this field was added
    // to `check` to fix. No verb here takes positionals of its own, so consuming the first costs nothing.
    repoFromFirstArg: true,
    commands: [
      { name: "resolve", summary: "where this repository's harness surfaces are — rules, bridge, hook, runner, config" },
      { name: "shape", summary: "remote, hooks path, CI workflows, and commit churn by top-level directory" },
      { name: "status", summary: "which record types are behind the norm installed at --source" },
      { name: "catalog", summary: "gates/fragments available but not composed into any ops" },
      { name: "audit", summary: "guide and sensor inventory, with the governance overlay" },
      {
        name: "sync",
        summary: "promulgate the installed norm onto a branch and a tag — never merged, never pushed",
        // The only verb here that writes. It leaves the target's working tree untouched by building its
        // own, but it does create a branch and move a tag, and neither is trivially undone by someone who
        // did not expect them.
        destructive: true,
        flags: [
          { name: "base", type: "string", description: "branch to cut the promulgation branch from (default: the target's current branch)" },
          { name: "accept-boundary", type: "string", description: "agree to this ownership declaration version, recording it in this clone" },
          { name: "dry-run", type: "boolean", description: "report what would be written and refused, touch nothing" },
        ],
      },
    ],
    flags: [{ name: "json", type: "boolean", description: "print the structured object instead of lines" }],
  },
  async (context) => {
    if (context.command === "resolve") {
      const resolved = resolveHarness(context.repoRoot, context.config);
      if (context.flags["json"] !== true) for (const line of formatResolvedHarness(resolved)) context.log(line);
      const missing = [resolved.rules, resolved.bridge, resolved.hook, resolved.entrypoint, resolved.runner].filter(
        (one) => !one.present,
      );
      return {
        code: 0,
        summary:
          missing.length === 0
            ? "every harness surface is present"
            : `${missing.length} harness surface(s) absent: ${missing.map((one) => one.path).join(", ")}`,
        data: resolved,
      };
    }

    if (context.command === "sync") {
      const accept = context.flags["accept-boundary"];
      // sync itself decides the norm source (a pinned tree whole, else the activated packages) and
      // refuses with the boundary message when neither contributes — the message names the real gap.
      const result = await sync({
        repoRoot: context.repoRoot,
        sourceRoot: context.sourceRoot,
        config: context.config,
        base: typeof context.flags["base"] === "string" ? context.flags["base"] : undefined,
        acceptBoundary: typeof accept === "string" ? Number(accept) : undefined,
        agreedBoundary: context.config.harness?.boundary,
        dryRun: context.flags["dry-run"] === true,
      });

      if (context.flags["json"] !== true) {
        for (const one of result.written) context.log(`  norm     ${one}`);
        for (const one of result.seeded) context.log(`  seeded   ${one}`);
        for (const one of result.refused) context.log(`  REFUSED  ${one.path} (${one.was} → ${one.now}) — ${one.why}`);
        for (const one of result.swallowed) context.log(`  SWALLOWED ${one.path} — ${one.rule}`);
        if (result.branch !== undefined) context.log(`branch: ${result.branch}${result.tag === undefined ? "" : `  tag: ${result.tag}`}`);
      }

      // Refusals and swallowed paths both exit non-zero, for the same reason: each leaves the target in a
      // state the caller did not ask for, and a zero here reads as "promulgated" on the one line anybody
      // actually looks at.
      if (result.refused.length > 0) {
        return {
          code: 3,
          summary:
            `${result.refused.length} path(s) refused — the installed declaration is ownership@${result.boundary.installed}` +
            `${result.boundary.agreed === undefined ? "" : `, this clone agreed to ownership@${result.boundary.agreed}`}` +
            `. Re-run with --accept-boundary ${result.boundary.installed} once the diff above is acceptable.`,
          data: result,
        };
      }
      if (result.swallowed.length > 0) {
        return {
          code: 3,
          summary: `${result.swallowed.length} written path(s) never reached the index — the branch is incomplete, see the rule named for each`,
          data: result,
        };
      }

      // Recorded only on a run that actually promulgated — never on a dry run, and never on one that
      // refused. Both keys, not just consent: `applied` is what makes `harness status` and the session
      // signal able to answer "is this repository current?", and a sync that wrote the files without
      // recording them would leave that question exactly as unanswered as before it ran.
      //
      // The boundary is recorded whenever the run succeeded, not only when `--accept-boundary` was
      // passed. A refusal is the only thing consent clears, and a run reaching here produced none — so
      // either the versions already agreed or consent was given on this invocation.
      if (context.flags["dry-run"] !== true && result.branch !== undefined && result.tag !== undefined) {
        await writeHarnessState(context.repoRoot, {
          applied: { ...context.config.harness?.applied, ...result.applied },
          boundary: result.boundary.installed,
        });
      }

      return {
        code: 0,
        summary:
          result.branch === undefined
            ? `would write ${result.written.length} and seed ${result.seeded.length}`
            : `${result.written.length} written, ${result.seeded.length} seeded on ${result.branch}${result.tag === undefined ? "" : ` (${result.tag})`} — not merged, not pushed`,
        data: result,
      };
    }

    if (context.command === "shape") {
      const shape = repoShape(context.repoRoot);
      if (context.flags["json"] !== true) {
        context.log(`remote: ${shape.hasRemote ? "yes" : "no"}`);
        context.log(`hooksPath: ${shape.hooksPath}`);
        context.log(shape.workflowFiles.length === 0 ? "workflows: none" : `workflows: ${shape.workflowFiles.join(", ")}`);
        for (const entry of shape.churnByTopLevel.slice(0, 10)) context.log(`  ${entry.topLevel}: ${entry.commits}`);
      }
      return {
        code: 0,
        summary: `${shape.hasRemote ? "has a remote" : "no remote"}, ${shape.workflowFiles.length} workflow(s), hooksPath=${shape.hooksPath}`,
        data: shape,
      };
    }

    if (context.command === "status") {
      if (context.config.harness?.applied === undefined) {
        return { code: 0, summary: "this clone has never been promulgated to — nothing to compare", data: { behind: [] } };
      }
      // The activated governance packages answer first; a pinned tree covers a repository holding to an
      // older norm. Both absent is still an answer: nothing ships, so nothing is behind.
      const shipped = await shippedVersions(context.config, context.sourceRoot);
      const behind = behindEntries(context.config.harness.applied, shipped);
      if (context.flags["json"] !== true) {
        context.log(behind.length === 0 ? "up to date with the installed norm" : formatBehind(behind));
      }
      return {
        code: 0,
        summary: behind.length === 0 ? "up to date with the installed norm" : `${behind.length} record type(s) behind the installed norm`,
        data: { behind },
      };
    }

    if (context.command === "catalog") {
      const catalog = await buildCatalog(context);
      if (context.flags["json"] !== true) {
        if (catalog.uncomposed.length === 0) context.log("every available gate and shell fragment is composed into something");
        for (const entry of catalog.uncomposed) context.log(`  [${entry.kind}] ${entry.id}`);
      }
      return {
        code: 0,
        summary:
          catalog.uncomposed.length === 0
            ? "every available gate and shell fragment is composed into something"
            : `${catalog.uncomposed.length} available but not composed into anything`,
        data: catalog,
      };
    }

    if (context.command === "audit") {
      const audit = await buildAudit(context);
      if (context.flags["json"] !== true) {
        context.log(`guides: ${audit.guides.length}`);
        for (const g of audit.guides) context.log(`  [${g.scope}] ${g.path} (${g.lines} lines)`);
        context.log(`sensors: ${audit.sensors.length}`);
        for (const s of audit.sensors) context.log(`  [${s.firesAt}] ${s.id} — ${s.source}`);
        context.log("governance:");
        for (const o of audit.governance) context.log(`  ${o.type}: ${o.count} record(s), ${o.behind} behind the current template`);
      }
      return {
        code: 0,
        summary: `${audit.guides.length} guide(s), ${audit.sensors.length} sensor(s), ${audit.governance.reduce((n, o) => n + o.count, 0)} governance record(s)`,
        data: audit,
      };
    }

    return { code: 2, summary: `harness ${String(context.command)} is not implemented yet` };
  },
);
