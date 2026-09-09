// The two governance documents for one repository's activation — the composition, not the rendering.
//
// WHY IT LIVES HERE AND NOT IN THE VERB THAT WRITES. Two writers need the same answer: `setup scaffold`
// on the first write, and `harness sync` on every promulgation after it. Until Plan-040's remediation
// only the first existed, and it refuses every destination that already exists — so a repository that
// bound a sixth type after being scaffolded kept two documents describing five, permanently, which is
// the drift rendering them from data was built to end. A second copy of this in the harness would be a
// second thing to keep in step, about the files this tooling writes into other people's repositories.
//
// IT RESOLVES, IT DOES NOT WRITE. What to do with a refusal — warn, exit non-zero, leave the file alone
// — belongs to the caller, which is the one that knows whether it is a dry run.

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { activateGovernance, effectiveGovernanceBindings } from "@entelekheia/vibe-ops-core";
import type { VibeOpsConfig } from "@entelekheia/vibe-ops-core";
import { renderGovernanceRule, renderGovernanceDoc } from "./render-governance.ts";
import type { RenderableType } from "./render-governance.ts";

/** Where the rule and the map land in a repository. Named once: two writers and the ownership fragment
 *  all have to agree, and a literal in each is how they stop agreeing. */
export const GOVERNANCE_RULE_PATH = ".agents/rules/governance.md";
export const GOVERNANCE_DOC_PATH = "GOVERNANCE.md";

export interface GovernanceDocuments {
  /** Destination → content, for what could be rendered. */
  readonly files: ReadonlyMap<string, string>;
  /** A document that was not rendered, with the reason. Never silently absent. */
  readonly refusals: readonly string[];
}

/** Every activated type, in binding order, with the package root its fragments resolve against. */
export async function activatedTypes(
  config: VibeOpsConfig | undefined,
): Promise<{ readonly types: readonly (RenderableType & { readonly packageName: string })[]; readonly unresolved: readonly string[] }> {
  const types: (RenderableType & { packageName: string })[] = [];
  const unresolved: string[] = [];
  for (const [name, binding] of Object.entries(effectiveGovernanceBindings(config))) {
    const found = await activateGovernance(name, config);
    if (found === undefined) {
      unresolved.push(`${name} → ${binding.packageName}`);
      continue;
    }
    types.push({ unit: found.unit, root: found.root, packageName: binding.packageName });
  }
  return { types, unresolved };
}

/**
 * The rule and the map, rendered for this activation.
 *
 * `existingDoc` is the target's current `GOVERNANCE.md` when it has one: that document is `shaped`, so
 * its repository-owned half is carried through rather than replaced. Passing it is what makes a second
 * promulgation an update rather than a replacement, and omitting it is what makes a first one additive.
 */
export async function composeGovernanceDocuments(
  config: VibeOpsConfig | undefined,
  options: {
    readonly existingDoc?: string;
    /** Already-activated types, when the caller has them. Recomputed here otherwise. */
    readonly types?: readonly RenderableType[];
  } = {},
): Promise<GovernanceDocuments> {
  const types = options.types ?? (await activatedTypes(config)).types;
  const files = new Map<string, string>();
  const refusals: string[] = [];

  const base = types.find((entry) => entry.unit.type === "base");
  if (base === undefined) {
    return { files, refusals: ["no activated governance declares the type `base`, so neither governance document can be framed"] };
  }
  const fragment = (name: string): string | undefined => {
    const file = path.resolve(base.root, "scaffold", name);
    return existsSync(file) ? readFileSync(file, "utf8") : undefined;
  };

  const preamble = fragment("governance-preamble.md");
  if (preamble === undefined) {
    refusals.push(`the \`base\` governance ships no scaffold/governance-preamble.md — the rule's frame, so the rule is not written`);
  } else {
    files.set(GOVERNANCE_RULE_PATH, renderGovernanceRule(types, preamble));
  }

  const map = fragment("governance-map.md");
  if (map === undefined) {
    refusals.push(`the \`base\` governance ships no scaffold/governance-map.md — the map half of GOVERNANCE.md, so the document is not written`);
  } else {
    const doc = renderGovernanceDoc(types, options.existingDoc, map);
    if (doc.ok) files.set(GOVERNANCE_DOC_PATH, doc.content);
    else refusals.push(doc.refusal);
  }

  return { files, refusals };
}
