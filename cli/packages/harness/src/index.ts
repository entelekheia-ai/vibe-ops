// vibe-ops harness — the read-only half of Plan-025. Four verbs, none of which write into the
// repository they act on: what shape it is in, whether the promulgated norm is current, what is
// composed versus merely available, and what guides/sensors exist. Promulgation (`sync`) and the skill
// split are separate tracks and are not this module's job.

import { defineModule } from "@entelekheia/vibe-ops-core";
import { installHarness } from "./install.ts";
import { repoShape } from "./shape.ts";
import { behindEntries, formatBehind, shippedVersions } from "./status.ts";
import { buildCatalog } from "./catalog.ts";
import { buildAudit } from "./audit.ts";
import { formatResolvedHarness, resolveHarness } from "./resolve.ts";
import { sync } from "./sync.ts";
import { isPolicyName, POLICY_NAMES, readPolicy, resolvePolicy } from "./policy.ts";

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
export type { ComposedBoundary, ComposedEntry, DoubleClaim, Ownership, OwnershipClass, OwnershipEntry, RefusedNarrowing } from "./ownership.ts";
export { boundaryRefusals, currentBranch, normContent, sync } from "./sync.ts";
export { IGNORE_BLOCK_COMMENT, IGNORE_BLOCK_NAMES, migrateIgnoreBlock } from "./ignore-block.ts";
export type { IgnoreBlockOutcome } from "./ignore-block.ts";
export type { RefusedPath, SyncOptions, SyncResult } from "./sync.ts";
export { isPolicyName, policyPath, POLICY_NAMES, readPolicy, resolvePolicy } from "./policy.ts";
export type { PolicyAnswer, PolicyName } from "./policy.ts";

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
        // The harness's own policy prose (Plan-040 Track 1) — served here rather than through
        // `records norm --facet policy`, because `harness` is a CLI-internal module with no `type.json`
        // and no swappable binding: there is exactly one harness, the one this CLI ships.
        name: "policy",
        summary: `the harness's own policy prose (${POLICY_NAMES.join(", ")})`,
        flags: [
          { name: "name", type: "string", description: "which policy file", required: true, choices: [...POLICY_NAMES] },
          { name: "print", type: "boolean", description: "print the file's content" },
        ],
      },
      {
        name: "install",
        summary: "write the commit gate's four files into the repository you name, keeping whatever is already there",
        destructive: true,
        // It CREATES, so its positional is the path itself and is required — walking up to the enclosing
        // git toplevel would install a gate into a checkout the caller never named.
        literalTargetArg: true,
        flags: [
          { name: "force", type: "string", description: "overwrite this destination even though it exists; comma-separated" },
        ],
      },
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
        if (result.retiredState !== undefined) context.log(`retired  vibeops.config.local.json (${result.retiredState}) — its map now lives in vibeops.config.json on ${result.branch}`);
        if (result.ignoreBlock?.outcome === "rewritten") context.log(`ignore   .gitignore — the clone-local block's comment brought up to date on ${result.branch}`);
        if (result.ignoreBlock?.outcome === "left") context.log(`ignore   .gitignore left — ${result.ignoreBlock.reason}`);
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

      // What was promulgated, and the boundary it was promulgated under, are in the branch: sync wrote
      // `vibeops.config.json` into the promulgation commit itself (RFC-0004 §6), so nothing is recorded
      // here, and `harness status` on the base branch answers from the committed map once that branch
      // merges — the named limitation between promulgation and merge (§8).
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
        return {
          code: 0,
          summary: "this repository has never been promulgated to — nothing to compare (a promulgation branch not yet merged does not count)",
          data: { behind: [] },
        };
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

    if (context.command === "install") {
      const force = new Set(
        String(context.flags["force"] ?? "")
          .split(",")
          .map((entry) => entry.trim())
          .filter((entry) => entry !== ""),
      );
      const result = installHarness(context.repoRoot, { force });
      if (context.surface === "cli" && context.flags["json"] !== true) {
        for (const file of result.written) context.log(`wrote ${file}`);
        for (const file of result.kept) context.log(`kept ${file} — already there; --force ${file} to overwrite`);
        for (const file of result.needsAppend) {
          context.warn(
            `${file} exists and does not call \`vibe-ops check\` — append the gate to it rather than replacing it, or the gate is not installed`,
          );
        }
      }
      return {
        code: 0,
        summary: `${result.written.length} written, ${result.kept.length} kept${result.needsAppend.length > 0 ? ", 1 hook needs the gate appended" : ""}`,
        data: result,
      };
    }

    if (context.command === "policy") {
      const name = context.flags["name"];
      if (typeof name !== "string" || !isPolicyName(name)) {
        return { code: 2, summary: `harness policy needs --name, one of: ${POLICY_NAMES.join(", ")}` };
      }
      const answer = resolvePolicy(name);
      if (context.flags["print"] === true && answer.exists) {
        const body = readPolicy(name);
        if (context.surface === "cli") context.log(body);
        return { code: 0, summary: `harness policy ${name}`, data: { ...answer, body } };
      }
      if (context.surface === "cli" && context.flags["json"] !== true) {
        context.log(`${answer.path}${answer.exists ? "" : "  (does not exist)"}`);
      }
      return {
        code: answer.exists ? 0 : 1,
        summary: `harness policy ${name}${answer.exists ? "" : ", not present"}`,
        data: answer,
      };
    }

    return { code: 2, summary: `harness ${String(context.command)} is not implemented yet` };
  },
);
