// vibe-ops harness — the read-only half of Plan-025. Four verbs, none of which write into the
// repository they act on: what shape it is in, whether the promulgated norm is current, what is
// composed versus merely available, and what guides/sensors exist. Promulgation (`sync`) and the skill
// split are separate tracks and are not this module's job.

import { defineModule } from "@entelekheia/vibe-ops-core";
import { repoShape } from "./shape.ts";
import { behindEntries, formatBehind, shippedVersions } from "./status.ts";

export { behindEntries, formatBehind, shippedVersion, shippedVersions, TYPES } from "./status.ts";
export type { BehindEntry, VersionedType } from "./status.ts";
export { churnByTopLevel, hasRemote, hooksPath, repoShape, workflowFiles } from "./shape.ts";
export type { ChurnEntry, RepoShape } from "./shape.ts";

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
      return { code: 2, summary: "harness catalog is not implemented yet" };
    }

    if (context.command === "audit") {
      return { code: 2, summary: "harness audit is not implemented yet" };
    }

    return { code: 2, summary: `harness ${String(context.command)} is not implemented yet` };
  },
);
