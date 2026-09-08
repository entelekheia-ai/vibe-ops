// The harness's own policy prose — Plan-040 Track 1, RFC-0005 §3: `harness-model`, `harness-pair` and
// `ownership` moved out of `plugin/references/` into this package, which is where `ownership.json`
// already lived. `harness` is a CLI-internal module, never a governance type — it has no `type.json`,
// no `records norm` ladder, and no consumer that would bind a different package for it — so these three
// files are served as a plain verb on the `harness` noun instead of through the facet grammar
// `records norm --facet policy` reads: `vibe-ops harness policy --name model|pair|ownership`.
//
// A BARE POSITIONAL WAS THE FIRST SHAPE TRIED (`harness policy model`) and it does not fit: `harness`
// declares `repoFromFirstArg: true` for every one of its verbs (`resolve`, `shape`, `status`, …), so a
// positional here would be consumed as the repository to check, not the policy name — the same shape
// every other verb on this noun avoids by taking none. `--name` is what `records norm` already uses for
// exactly this "pick one of several named things" call, so this reuses it rather than inventing a
// second spelling.

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// One level up from src/ (or dist/) — the same shape `ownership.ts`'s `HARNESS_ROOT` already uses.
const HARNESS_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

export const POLICY_NAMES = ["model", "pair", "ownership"] as const;
export type PolicyName = (typeof POLICY_NAMES)[number];

export function isPolicyName(value: string): value is PolicyName {
  return (POLICY_NAMES as readonly string[]).includes(value);
}

/** Absolute path to one of the harness's own policy files — always under this package, never resolved
 *  against a repository or an installed norm: there is exactly one harness, the one running. */
export function policyPath(name: PolicyName): string {
  return path.join(HARNESS_ROOT, "policy", `${name}.md`);
}

export interface PolicyAnswer {
  readonly name: PolicyName;
  readonly path: string;
  readonly exists: boolean;
}

export function resolvePolicy(name: PolicyName): PolicyAnswer {
  const file = policyPath(name);
  return { name, path: file, exists: existsSync(file) };
}

export function readPolicy(name: PolicyName): string {
  return readFileSync(policyPath(name), "utf8");
}
