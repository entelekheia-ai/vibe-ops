// `harness install` — the four files the commit gate is made of, written into a repository.
//
// WHY THE HARNESS SHIPS THESE AND A GOVERNANCE DOES NOT. `setup scaffold` composes what each activated
// GOVERNANCE contributes, and the harness is not one: it is CLI-internal, has no type, no records and no
// binding. Its files are the apparatus a repository runs the governances THROUGH, so they arrive by
// their own verb rather than by being a governance that pretends to be a type.
//
// WHAT IS NOT DECIDED HERE. Whether an existing file may be overwritten is the ownership boundary's
// question, and promulgation (`harness sync`) is the verb that asks it. This verb is the FIRST install,
// so it keeps whatever it finds and says so — with one exception it names, because a repository that
// already has a `pre-commit` needs the gate APPENDED rather than dropped, and silently keeping the old
// hook would leave the gate uninstalled while reporting success.

import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** One level up from src/ (or dist/) — the same shape `policy.ts` and `ownership.ts` already use. */
const HARNESS_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

/** What the apparatus is, and where each piece lands. `checks-run.sh` and `pre-commit` are stored under
 *  names that are not their destinations — the runner sits in a subdirectory and the hook is a dotfile —
 *  which is the same reason a governance's `scaffold` states every `to` rather than deriving it. */
export const HARNESS_FILES: readonly { readonly from: string; readonly to: string; readonly executable: boolean }[] = [
  { from: "check.sh", to: "scripts/check.sh", executable: true },
  { from: "checks-run.sh", to: "scripts/checks/_run.sh", executable: true },
  { from: "pre-commit", to: ".githooks/pre-commit", executable: true },
  { from: "check-ci.yml", to: ".github/workflows/check.yml", executable: false },
];

export interface InstallResult {
  readonly written: readonly string[];
  readonly kept: readonly string[];
  /** A `pre-commit` that was already there and does not call the gate. Reported rather than replaced:
   *  the existing hook is somebody's, and appending to it is a decision with a reason. */
  readonly needsAppend: readonly string[];
}

/** Whether an existing pre-commit already runs the gate — a repository that has one is done, and one
 *  that has a different hook needs the gate appended to it rather than dropped on top of it. */
function callsTheGate(content: string): boolean {
  return /vibe-ops\s+check/.test(content);
}

export function installHarness(repoRoot: string, options: { readonly force?: ReadonlySet<string> } = {}): InstallResult {
  const force = options.force ?? new Set<string>();
  const written: string[] = [];
  const kept: string[] = [];
  const needsAppend: string[] = [];

  for (const file of HARNESS_FILES) {
    const source = path.join(HARNESS_ROOT, "scaffold", file.from);
    if (!existsSync(source)) continue;
    const destination = path.join(repoRoot, file.to);

    if (existsSync(destination) && !force.has(file.to)) {
      kept.push(file.to);
      if (file.to === ".githooks/pre-commit" && !callsTheGate(readFileSync(destination, "utf8"))) {
        needsAppend.push(file.to);
      }
      continue;
    }

    mkdirSync(path.dirname(destination), { recursive: true });
    writeFileSync(destination, readFileSync(source, "utf8"));
    if (file.executable) chmodSync(destination, 0o755);
    written.push(file.to);
  }

  return { written, kept, needsAppend };
}
