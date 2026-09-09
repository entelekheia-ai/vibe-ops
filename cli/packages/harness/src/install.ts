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

/** The two things a repository can opt into. Everything else this verb writes is the gate itself. */
export const HARNESS_OPTIONS = ["hook", "ci"] as const;
export type HarnessOption = (typeof HARNESS_OPTIONS)[number];

/**
 * What the apparatus is, and where each piece lands. `checks-run.sh` and `pre-commit` are stored under
 * names that are not their destinations — the runner sits in a subdirectory and the hook is a dotfile —
 * which is the same reason a governance's `scaffold` states every `to` rather than deriving it.
 *
 * TWO OF THE FOUR ARE OPT-IN, and the skill said so before this verb existed: "**Offer the CI copy — do
 * not install it.** Ask once, and take no for an answer", and of the hook, "offer, do not assume". Those
 * are consent rules with a reason — a commit hook changes what every `git commit` in somebody's clone
 * does, and a CI workflow is a snapshot that goes stale — and this verb installed both with no prompt,
 * no flag and no way to decline. The gate's own two files stay unconditional: they are what `harness
 * install` IS, and a repository that did not want them would not have run the verb.
 */
export const HARNESS_FILES: readonly {
  readonly from: string;
  readonly to: string;
  readonly executable: boolean;
  readonly option?: HarnessOption;
}[] = [
  { from: "check.sh", to: "scripts/check.sh", executable: true },
  { from: "checks-run.sh", to: "scripts/checks/_run.sh", executable: true },
  { from: "pre-commit", to: ".githooks/pre-commit", executable: true, option: "hook" },
  { from: "check-ci.yml", to: ".github/workflows/check.yml", executable: false, option: "ci" },
];

export interface InstallResult {
  readonly written: readonly string[];
  readonly kept: readonly string[];
  /** A `pre-commit` that was already there and does not call the gate. Reported rather than replaced:
   *  the existing hook is somebody's, and appending to it is a decision with a reason. */
  readonly needsAppend: readonly string[];
  /** An opt-in file the caller did not ask for, with the option that would add it. Named rather than
   *  omitted in silence: "the gate is installed" and "every commit runs it" are different claims. */
  readonly offered: readonly { readonly to: string; readonly option: HarnessOption }[];
}

/**
 * A shell line with its comment removed. Everything from an unquoted `#` to end of line goes.
 *
 * IT IS THE SAFE DIRECTION THAT NEEDED FIXING. A `pre-commit` whose only mention of the gate was
 * `# TODO: some day run vibe-ops check here` was read as already calling it: the hook was kept, no
 * warning was printed, the summary said the install succeeded, and the repository was left with no gate
 * and nothing saying so.
 */
function withoutComment(line: string): string {
  let quote: string | undefined;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index]!;
    if (character === "\\") {
      index += 1;
      continue;
    }
    if (quote !== undefined) {
      if (character === quote) quote = undefined;
      continue;
    }
    if (character === "'" || character === '"') {
      quote = character;
      continue;
    }
    if (character === "#" && (index === 0 || /\s/.test(line[index - 1]!))) return line.slice(0, index);
  }
  return line;
}

/**
 * Whether an existing pre-commit already runs the gate.
 *
 * The pattern covers what this apparatus actually installs, not only the bare CLI call: a hook running
 * `exec ./scripts/check.sh` — the entrypoint this very verb writes — was told to append the gate to
 * itself. Erring safe means warning when in doubt, so a match must look like an invocation (start of a
 * line, or after a separator) rather than a substring anywhere.
 */
function callsTheGate(content: string): boolean {
  const code = content.split("\n").map(withoutComment).join("\n");
  return /(^|[;&|(\s])(vibe-ops\s+check\b|(\.\/)?scripts\/check\.sh\b|(\.\/)?scripts\/checks\/_run\.sh\b)/m.test(code);
}

export function installHarness(
  repoRoot: string,
  options: { readonly force?: ReadonlySet<string>; readonly include?: ReadonlySet<string> } = {},
): InstallResult {
  const force = options.force ?? new Set<string>();
  const include = options.include ?? new Set<string>();
  const written: string[] = [];
  const kept: string[] = [];
  const needsAppend: string[] = [];
  const offered: { to: string; option: HarnessOption }[] = [];

  for (const file of HARNESS_FILES) {
    if (file.option !== undefined && !include.has(file.option)) {
      offered.push({ to: file.to, option: file.option });
      continue;
    }
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

  return { written, kept, needsAppend, offered };
}
