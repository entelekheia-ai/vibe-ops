// vibe-ops hook check-global — `vibe-ops check` over the whole repository, run once at the end of a
// turn instead of by hand after every edit.
//
// Named after the command it doubles: there is no file scope here and none is possible, so "global" is
// the honest half of the name. `check` alone would collide with the module, and read ambiguously beside
// `hook ops check`.
//
// WHY A HOOK AT ALL. Measured across ~390 session transcripts: `vibe-ops check` is 27–74% of all
// CLI-side traffic, and the bigrams say it is never a decision — `Edit → check` 38 times, `Bash → check`
// 24, `Write → check` 6. Sixty-eight manual invocations immediately after writing. A command invoked
// unconditionally after an event is a hook that has not been written yet.
//
// WHY `Stop` AND NOT `PostToolUse`. Two reasons, and the second is the one that decides it:
//
//   1. Cost. The runner sweeps the whole repository and has no per-file scope — measured at ~3.1s. On
//      `PostToolUse` that is 3.1s per edit; on `Stop` it is 3.1s per turn, however many edits the turn
//      contained, for the same guarantee that nothing leaves the turn unchecked.
//   2. A file is BROKEN WHILE IT IS BEING WRITTEN. A multi-edit sequence passes through states no one
//      intends to keep, and a gate that reads one of them reports a failure that was never real. Scoping
//      to the written path does not help: that path is exactly the one mid-edit. The end of the turn is
//      the first moment the tree is meant to be coherent.
//
// WHY IT SPEAKS EVEN WHEN GREEN, unlike every other hook in this plugin. The standing discipline is that
// a hook is silent unless its exact condition holds, and this surface is the deliberate exception: a
// silent pass is indistinguishable from a hook that did not run, so the agent re-runs the gate by hand —
// which is the behaviour this whole surface exists to remove. Reporting the green run is what makes the
// manual one unnecessary. Recorded in Plan-026's Decision Log rather than left as an inconsistency.
//
// IT DECLARES NO SEVERITY OF ITS OWN. Whatever the run resolved — a check that fails, one that warns,
// one declared off through VIBE_OPS_DISABLED_CHECKS reporting SKIP with its reason — is passed through
// as it came. The hook is a second invocation path for the same run, never a second policy, so
// `git grep VIBE_OPS_DISABLED_CHECKS` stays the one answer to "what is switched off here" whether the
// gate was reached by hook, by hand, or by pre-commit.

import { loadConfig } from "@entelekheia/vibe-ops-core";
import { loadModule } from "./resolve.ts";
import { repoRootFrom, runModule } from "./run.ts";

interface StopPayload {
  readonly cwd?: string;
  /** Set when the turn is already a continuation of a Stop hook's own request. */
  readonly stop_hook_active?: boolean;
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

export async function runCheckGlobalHook(): Promise<number> {
  let payload: StopPayload;
  try {
    payload = JSON.parse(await readStdin()) as StopPayload;
  } catch {
    // A malformed payload fails silent rather than open-while-appearing-to-work (ADR-0009 obligation 3).
    return 0;
  }

  // Re-entry guard. Without it a turn the hook itself prolonged fires the hook again on its own end,
  // and the gate runs a second time saying the same thing.
  if (payload.stop_hook_active === true) return 0;

  const repoRoot = repoRootFrom(payload.cwd ?? process.cwd());

  // A repository that declares no vibe-ops config OF ITS OWN did not ask for a gate. The hook is
  // installed plugin-wide and fires in every repository the plugin is present in, most of which this
  // tooling does not govern.
  //
  // The filter is by prefix, not by `sources.length`: the cascade searches from the repository up to the
  // home directory, so an operator with a personal `vibeops.config.*` makes `sources` non-empty in every
  // repository on the machine. Guarding on the length alone would have fired this gate in all of them.
  //
  // And by layer, not by file: the managed `vibeops.config.json` is written by this tooling, so its
  // presence says a tool promulgated here, not that the repository asked for a gate (RFC-0004 §8). Only
  // a `declared` or `local` file of the repository's own switches the gate on.
  const { layers } = await loadConfig(repoRoot);
  const declaredHere = layers.some((one) => one.layer !== "managed" && one.file.startsWith(`${repoRoot}/`));
  if (!declaredHere) return 0;

  let result;
  try {
    const plugin = await loadModule("check");
    result = await runModule({
      plugin,
      flags: {},
      args: [],
      cwd: repoRoot,
      surface: "hook",
      confirmed: true,
      sink: () => {},
    });
  } catch {
    // An unresolvable module is a broken installation, and the sensor for that is
    // `25-hooks-registration.sh`, not this process pretending the repository is clean.
    return 0;
  }

  const data = result.data as
    | { findings?: { level: string; check: string; evidence: string }[]; skipped?: { check: string; reason: string }[] }
    | undefined;
  const findings = data?.findings ?? [];
  const skipped = data?.skipped ?? [];

  // Severity as the run resolved it. `level` comes from the fragment that produced the line; nothing
  // here reclassifies, and `SKIP` keeps the reason the repository declared.
  const lines = [
    result.summary,
    ...findings.map((finding) => `${finding.level.toUpperCase()}  [${finding.check}] ${finding.evidence}`),
    ...skipped.map((skip) => `SKIP  [${skip.check}] ${skip.reason}`),
  ];

  // THE FIRST LINE IS LOAD-BEARING, and it is there because `additionalContext` on `Stop` continues the
  // conversation: the documentation says it "keeps the conversation going through the same loop
  // protections as `decision: block`". Speaking on a green run therefore buys one extra model
  // round-trip, and the only thing that makes that round-trip cheap is telling the model, in the first
  // sentence, that there is nothing to do with it. Without the line the model tries to act on a report
  // that says everything passed.
  // "OUTPUT NOTHING", not "no response needed". Permission to decline is not an instruction to be
  // silent: measured across a project's session history, one `Stop` hook returning `additionalContext`
  // fired 42 times and produced 263 assistant turns, two-fifths of which ended in a paragraph explaining
  // to the user why nothing needed doing. The model narrates the decline unless told plainly not to, and
  // that narration is the whole cost of speaking on a clean run.
  const clean = findings.length === 0;
  const opening = clean
    ? "Hook: vibe-ops check — ok, nothing failed. It has already run this turn; do not run it again. Output nothing about this — do not mention it, do not acknowledge it, end the turn as you otherwise would."
    : "Hook: vibe-ops check — findings below. It has already run; do not run it again to confirm.";

  process.stdout.write(
    `${JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "Stop",
        additionalContext: `${opening}\n${lines.join("\n")}`,
      },
    })}\n`,
  );
  // Advisory, never blocking: the gate reports, the human or the commit hook decides. Exiting non-zero
  // here would turn a reading into a refusal to end the turn.
  return 0;
}
