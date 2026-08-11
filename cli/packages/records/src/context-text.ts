// The plan-mode guidance text — port of plan-mode-context.sh's body, with the one thing that script
// never did: reading `LIVING` at all. It hardcoded "the four living sections (Progress, Surprises &
// Discoveries, Decision Log, Outcomes & Retrospective)" unconditionally, which is defect 1 in Plan-011's
// Context — correct only against a `plan@0.1` template, and wrong against `plan@0.2`'s two sections.
// This builds the sentence from `resolved.plan.living`, so there is no second place the names are
// written down.

import path from "node:path";
import type { ResolvedRecord } from "./resolve.ts";

/**
 * Empty string means "say nothing" — the caller's cue not to fire, same as the shell exiting on
 * `PLAN_DIR=(none)` or `PLAN_TPL=(none)`.
 */
export function planModeGuidance(resolved: ResolvedRecord, projectDir?: string): string {
  if (resolved.dir === undefined || resolved.template === undefined) return "";

  const living = resolved.plan?.living;
  const sectionsClause =
    living !== undefined
      ? `the living sections (${living.join(", ")})`
      : "its living sections — check the template's own LIVING SECTIONS divider rather than assuming a specific list";

  const nextClause = typeof resolved.next === "string" ? resolved.next : "(unknown — see AUTHORITY)";

  let text =
    `This repository keeps implementation plans as permanent design records in \`${resolved.dir}\`, ` +
    `written from the template at \`${resolved.template}\`. If this planning turn is going to produce a ` +
    `durable design record rather than a one-off change, read that template first and give the plan-mode ` +
    `plan its structure: the H1 title, the metadata table, Summary, Goals, Scope (In and Out), Design, ` +
    `Tracks, Success criteria, and ${sectionsClause}. Write it in English regardless of the language of ` +
    `the conversation. Where there is no material for a section, leave an honest stub rather than ` +
    `inventing content. The next plan number in this repository is ${nextClause} — do not guess one.`;

  // Only when there is real ambiguity to resolve — the resolver's own git toplevel differs from the
  // session's nominal project dir, the umbrella-workspace case. A single-repo session never sees this.
  if (projectDir !== undefined && path.resolve(projectDir) !== path.resolve(resolved.root)) {
    text +=
      ` This session's project root is not the repository this plan belongs to — add a ` +
      `\`| Repository | ${resolved.root} |\` row to the metadata table (the resolved repository's ` +
      `absolute path, nothing else in the cell) so a later automated step files the plan correctly ` +
      `without re-guessing. That row is routing metadata, not part of the record: the filing step drops ` +
      `it, because an absolute path on this machine must not survive into a committed document.`;
  }

  text +=
    ` An approved plan matching this shape is copied into \`${resolved.dir}\` automatically; ` +
    `/vibe-ops:new plan is only for a plan written outside plan mode, or an older plan-mode file never ` +
    `picked up.`;

  return text;
}
