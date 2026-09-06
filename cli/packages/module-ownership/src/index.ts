// vibe-ops ownership — the composed boundary's effective class for one repository-relative path, the
// full effective list, and the one write over it (Plan-031/032, RFC-0004 §7). Read verbs delegate to
// `composedOwnership`/`classOf`/`entryFor` in `@entelekheia/vibe-ops-harness` rather than re-deriving the
// boundary; `set` delegates the widening question the same way — see the comment at that call.

import { defineModule } from "@entelekheia/vibe-ops-core";
import type { VibeOpsConfig, WriteManagedConfigResult } from "@entelekheia/vibe-ops-core";
import { writeManagedConfig } from "@entelekheia/vibe-ops-core";
import { classOf, composedOwnership, entryFor } from "@entelekheia/vibe-ops-harness";
import type { ComposedBoundary, ComposedEntry } from "@entelekheia/vibe-ops-harness";
import { originFor } from "./origin.ts";

function reportFor(result: WriteManagedConfigResult): { readonly code: number; readonly lines: readonly string[] } {
  if (!result.ok) return { code: 1, lines: [result.message] };
  const lines = [`written managed:${result.file}`];
  for (const shadow of result.shadowedBy) lines.push(`shadowed by ${shadow.layer}:${shadow.file}`);
  return { code: 0, lines };
}

export default defineModule(
  {
    id: "ownership",
    version: "0.0.1",
    summary: "The composed ownership boundary: the effective class for a path, the full list, and the one write over it",
    commands: [
      {
        name: "get",
        summary: "the effective class of one repository-relative path, the entry that decided it, and any other claimants",
      },
      {
        name: "list",
        summary: "every entry of the composed boundary, in effective order, plus conflicts and refused narrowings",
        flags: [{ name: "show-origin", type: "boolean", description: "print which fragment or repository file decided each entry" }],
      },
      {
        name: "set",
        summary: "write one repository narrowing into the managed layer — refuses an unknown class, a missing reason, or a widening",
        flags: [{ name: "reason", type: "string", description: "why this path is reclassified — required, a ledger entry", required: true }],
      },
    ],
    flags: [{ name: "json", type: "boolean", description: "print the structured object instead of lines" }],
  },
  async (context) => {
    if (context.command === "get") {
      const file = context.args[0];
      if (typeof file !== "string" || file === "") {
        return { code: 2, summary: "ownership get needs a repository-relative path" };
      }
      const boundary = await composedOwnership(context.config);
      const entry = boundary === undefined ? undefined : (entryFor(boundary, file) as ComposedEntry | undefined);
      if (entry === undefined) {
        return { code: 1, summary: `no ownership entry matches ${file} — absence is not permission` };
      }
      const cls = classOf(boundary!, file);
      const origin = originFor(entry, context.config as VibeOpsConfig);
      const claimants = (boundary!.conflicts.find((c) => c.match === entry.match)?.claimants) ?? [];
      if (context.flags.json !== true) {
        context.log(`${file}: ${cls} (${entry.match}, ${origin}) — ${entry.why}`);
        for (const claim of claimants) context.log(`  also claimed by ${claim.origin}: ${claim.class}`);
      }
      return {
        code: 0,
        summary: `${file} is ${cls} — ${entry.match} (${origin})`,
        data: { path: file, class: cls, match: entry.match, why: entry.why, origin, claimants },
      };
    }

    if (context.command === "list") {
      const boundary = await composedOwnership(context.config);
      if (boundary === undefined) {
        return { code: 0, summary: "no ownership boundary composed — no fragment contributes", data: { paths: [], conflicts: [], refusedNarrowings: [] } };
      }
      const showOrigin = context.flags["show-origin"] === true;
      const rows = boundary.paths.map((entry) => ({
        match: entry.match,
        class: entry.class,
        why: entry.why,
        origin: showOrigin ? originFor(entry, context.config as VibeOpsConfig) : undefined,
      }));
      if (context.flags.json !== true) {
        for (const row of rows) {
          context.log(`${row.match}  ${row.class}${row.origin === undefined ? "" : `  [${row.origin}]`}  — ${row.why}`);
        }
        for (const conflict of boundary.conflicts) {
          context.log(`CONFLICT ${conflict.match}: ${conflict.claimants.map((c) => `${c.origin}=${c.class}`).join(", ")}`);
        }
        for (const refused of boundary.refusedNarrowings) {
          context.log(`REFUSED ${refused.match}: ${refused.why}`);
        }
      }
      return {
        code: 0,
        summary: `${rows.length} entrie(s), ${boundary.conflicts.length} conflict(s), ${boundary.refusedNarrowings.length} refused narrowing(s)`,
        data: { paths: rows, conflicts: boundary.conflicts, refusedNarrowings: boundary.refusedNarrowings },
      };
    }

    if (context.command === "set") {
      const match = context.args[0];
      const cls = context.args[1];
      const reason = context.flags.reason;
      if (typeof match !== "string" || match === "" || typeof cls !== "string" || cls === "") {
        return { code: 2, summary: "ownership set needs a match and a class: ownership set <match> <class> --reason <text>" };
      }
      if (typeof reason !== "string" || reason.trim() === "") {
        return { code: 2, summary: "ownership set needs --reason <text> — a reclassification without one is refused" };
      }

      // RFC-0004 Open Question 1 (overlapping-but-unequal globs) is deliberately NOT decided here: this
      // compares only the EXACT `match` string against composedOwnership's own claims, the same identical-
      // match rule the composition already applies to `config.ownership` — never a glob-overlap check.
      const candidate: VibeOpsConfig = {
        ...(context.config as VibeOpsConfig),
        ownership: [...((context.config as VibeOpsConfig).ownership ?? []), { match, class: cls, reason }],
      };
      const composed = (await composedOwnership(candidate)) as ComposedBoundary;
      const refused = [...composed.refusedNarrowings].reverse().find((r) => r.match === match);
      if (refused !== undefined) {
        return { code: 2, summary: `ownership set ${match} ${cls} refused: ${refused.why}` };
      }

      const result = await writeManagedConfig(context.repoRoot, { ownership: [{ match, class: cls, reason }] });
      const { code, lines } = reportFor(result);
      if (context.flags.json !== true) for (const line of lines) context.log(line);
      return { code, summary: lines[0]!, data: { match, class: cls, reason, lines } };
    }

    return { code: 2, summary: `ownership ${String(context.command)} is not implemented yet` };
  },
);
