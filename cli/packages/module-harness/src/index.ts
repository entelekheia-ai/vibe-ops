// vibe-ops harness — the read-only half of Plan-025. Four verbs, none of which write into the
// repository they act on: what shape it is in, whether the promulgated norm is current, what is
// composed versus merely available, and what guides/sensors exist. Promulgation (`sync`) and the skill
// split are separate tracks and are not this module's job.

import { defineModule } from "@entelekheia/vibe-ops-core";
import { repoShape } from "./shape.ts";
import { behindEntries, formatBehind, shippedVersions } from "./status.ts";
import { buildCatalog } from "./catalog.ts";
import { buildAudit } from "./audit.ts";

export { behindEntries, formatBehind, shippedVersion, shippedVersions, TYPES } from "./status.ts";
export type { BehindEntry, VersionedType } from "./status.ts";
export { churnByTopLevel, hasRemote, hooksPath, repoShape, workflowFiles } from "./shape.ts";
export type { ChurnEntry, RepoShape } from "./shape.ts";
export { buildCatalog } from "./catalog.ts";
export type { Catalog, CatalogEntry } from "./catalog.ts";
export { buildAudit, isScopedRule, lineCount } from "./audit.ts";
export type { Audit, GuideEntry, RecordOverlayEntry, SensorEntry } from "./audit.ts";

export default defineModule(
  {
    id: "harness",
    version: "0.0.1",
    summary:
      "The read-only half: this repository's shape, whether the promulgated norm is current, what is composed vs. available, and what guides/sensors exist",
    needsSource: true,
    commands: [
      { name: "shape", summary: "remote, hooks path, CI workflows, and commit churn by top-level directory" },
      { name: "status", summary: "which record types are behind the norm installed at --source" },
      { name: "catalog", summary: "gates/fragments available but not composed into any ops" },
      { name: "audit", summary: "guide and sensor inventory, with the governance overlay" },
    ],
    flags: [{ name: "json", type: "boolean", description: "print the structured object instead of lines" }],
  },
  async (context) => {
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
      if (context.sourceRoot === undefined) {
        return { code: 0, summary: "no source root resolved (config.harness.source, --source, or CLAUDE_PLUGIN_ROOT) — nothing to compare against", data: { behind: [] } };
      }
      if (context.config.harness?.applied === undefined) {
        return { code: 0, summary: "this clone has never been promulgated to — nothing to compare", data: { behind: [] } };
      }
      const shipped = await shippedVersions(context.sourceRoot);
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
