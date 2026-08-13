// vibe-ops harness-status — the SessionStart surface. Compares the version of each record type
// PROMULGATED into this clone (`harness.applied` in vibeops.config.local.*) against the version the
// installed plugin ships, and says something only when they differ.
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
// WHERE "INSTALLED" COMES FROM. The shipped versions are read out of the plugin's own templates, and the
// plugin's location is passed in as `--plugin <dir>` rather than guessed: the hook registration expands
// ${CLAUDE_PLUGIN_ROOT} for exactly this. A module is handed one repository root and the target/source
// seam does not exist yet (Plan-025 Track 4), so this surface takes the narrow, explicit route rather
// than pre-empting that design. No `--plugin`, or a directory with no templates: silence.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { loadConfig } from "@entelekheia/vibe-ops-core";
import { repoRootFrom } from "./run.ts";

interface SessionStartPayload {
  readonly cwd?: string;
}

/** The record types carrying a versioned template. `log` has one and is not a `RecordType`, hence the union. */
const TYPES = ["adr", "rfc", "plan", "task", "log"] as const;
type VersionedType = (typeof TYPES)[number];

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

/**
 * The version a shipped template declares, from its own `vibe-ops-template: <type>@<n>` frontmatter — the
 * same line /migrate reads. Matched against the type being asked for rather than accepted from any
 * `<word>@<n>`: a template that was copied from its neighbour and kept the source's token would otherwise
 * report a version belonging to a different document, which is the failure mode that looks like an answer.
 */
async function shippedVersion(pluginDir: string, type: VersionedType): Promise<number | undefined> {
  let text: string;
  try {
    text = await readFile(path.join(pluginDir, "templates", `${type}.md`), "utf8");
  } catch {
    return undefined;
  }
  const match = new RegExp(`^vibe-ops-template: ${type}@(\\d+)$`, "m").exec(text);
  if (match?.[1] === undefined) return undefined;
  return Number.parseInt(match[1], 10);
}

export interface BehindEntry {
  readonly type: VersionedType;
  readonly applied: number;
  readonly shipped: number;
}

/**
 * Which types are behind. A type absent from `applied` is NOT reported: absence means this clone has never
 * been promulgated to for that type, which is a different state from being on an old version and is not
 * this hook's news — reporting it would make every unrelated repository the operator opens light up, and a
 * signal that fires everywhere is one nobody reads. Comparing only what someone actually promulgated keeps
 * precision at 1 by construction.
 */
export function behindEntries(
  applied: Partial<Record<string, number>> | undefined,
  shipped: Partial<Record<VersionedType, number>>,
): readonly BehindEntry[] {
  if (applied === undefined) return [];
  const behind: BehindEntry[] = [];
  for (const type of TYPES) {
    const here = applied[type];
    const there = shipped[type];
    if (here === undefined || there === undefined) continue;
    if (here < there) behind.push({ type, applied: here, shipped: there });
  }
  return behind;
}

/** The message, built here rather than inline so the test asserts the text a session actually receives. */
export function formatBehind(behind: readonly BehindEntry[]): string {
  const lines = behind.map((b) => `  - ${b.type}: this repository is on ${b.type}@${b.applied}, installed is ${b.type}@${b.shipped}`);
  return [
    "A newer version of the governance templates is installed than was promulgated into this repository:",
    ...lines,
    "",
    "Run /vibe-ops:migrate to bring existing records up to the current template, one recorded jump at a time.",
    "Nothing has been changed — this is a reading, not a repair.",
  ].join("\n");
}

export async function runHarnessStatusHook(argv: readonly string[]): Promise<number> {
  try {
    const pluginFlag = argv.indexOf("--plugin");
    const pluginDir = pluginFlag === -1 ? undefined : argv[pluginFlag + 1];
    if (pluginDir === undefined) return 0;

    let payload: SessionStartPayload;
    try {
      payload = JSON.parse(await readStdin()) as SessionStartPayload;
    } catch {
      return 0;
    }

    const repoRoot = repoRootFrom(payload.cwd ?? process.cwd());
    const { config } = await loadConfig(repoRoot);
    if (config.harness?.applied === undefined) return 0;

    const shipped: Partial<Record<VersionedType, number>> = {};
    for (const type of TYPES) {
      const version = await shippedVersion(pluginDir, type);
      if (version !== undefined) shipped[type] = version;
    }

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
