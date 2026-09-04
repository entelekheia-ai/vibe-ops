// vibe-ops harness-status — the SessionStart surface. Compares the version of each record type
// PROMULGATED into this repository (`harness.applied` in the committed vibeops.config.json) against the version the
// installed norm ships, and says something only when they differ.
//
// SILENCE IS THE POINT, NOT A FALLBACK. This runs at the start of every session in every repository the
// operator opens, and the overwhelming majority of those have nothing pending. A hook that speaks anyway
// — a standing reminder, a "nothing to report" line — spends attention on every session to deliver an
// event that happens a few times a year, and it is how the next one gets discounted wholesale. Measured
// precedent: a third-party nudge in this workspace fires outside its own stated exemptions about half the
// time and is now explicitly discounted by a rule.
//
// IT REPORTS AND STOPS. It never writes, migrates, or configures anything, however obvious the repair
// looks. Whether a hook may write into a repository the operator merely opened is open question 1 of
// RFC-0002, and answering it here as a side effect of being helpful is exactly the failure that RFC
// exists to prevent.
//
// IT FAILS OPEN. Every error path returns 0 with no output. A session-start hook that throws blocks a
// session over an advisory message, which is a far worse outcome than not delivering it — the sensor for
// a broken registration is the hooks-registration check, never this process's exit code (ADR-0009
// obligation 3).
//
// WHERE "INSTALLED" COMES FROM. `resolveSourceRoot` — declared `config.harness.source`, then this
// surface's own `--plugin <dir>` (its flavour of the seam's `--source`, kept under its original name so
// `hooks.json`'s registration does not need to change), then `CLAUDE_PLUGIN_ROOT`. A directory with no
// templates, or none of the three resolving: silence. `behindEntries`/`formatBehind`/`shippedVersions`
// used to live here; they moved to `@entelekheia/vibe-ops-harness` so the `harness status` verb
// and this hook read the same comparison rather than two copies drifting apart.

import { loadConfig } from "@entelekheia/vibe-ops-core";
import { behindEntries, formatBehind, shippedVersions } from "@entelekheia/vibe-ops-harness";
import { repoRootFrom, resolveSourceRoot } from "./run.ts";

export { behindEntries, formatBehind } from "@entelekheia/vibe-ops-harness";

interface SessionStartPayload {
  readonly cwd?: string;
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

export async function runHarnessStatusHook(argv: readonly string[]): Promise<number> {
  try {
    const pluginFlag = argv.indexOf("--plugin");
    const pluginArg = pluginFlag === -1 ? undefined : argv[pluginFlag + 1];

    let payload: SessionStartPayload;
    try {
      payload = JSON.parse(await readStdin()) as SessionStartPayload;
    } catch {
      return 0;
    }

    const repoRoot = repoRootFrom(payload.cwd ?? process.cwd());
    const { config } = await loadConfig(repoRoot);
    if (config.harness?.applied === undefined) return 0;

    const sourceRoot = resolveSourceRoot(config, pluginArg);

    const shipped = await shippedVersions(config, sourceRoot);
    const behind = behindEntries(config.harness.applied, shipped);
    if (behind.length === 0) return 0;

    process.stdout.write(
      `${JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "SessionStart",
          additionalContext: formatBehind(behind),
        },
      })}\n`,
    );
    return 0;
  } catch {
    // Fail open, deliberately catching everything. See the header: an advisory hook must never be the
    // reason a session does not start.
    return 0;
  }
}
