// What a scaffolded repository receives, computed from what it ACTIVATES — Plan-040 Track 6, RFC-0005 §4.
//
// THE SCAFFOLD IS A COMPOSITION, NEVER A TEMPLATE DIRECTORY OF ITS OWN. A template no governance owns has
// no version, no migration note and no ownership entry; it is the next legacy file, which is the whole
// argument of the plan this implements. So there is no directory here — every file comes from a package
// that declares it, and this module only decides WHAT the set is.
//
// IT COMPUTES AND DOES NOT WRITE. The set is returned, and the verb in `index.ts` writes it. That split
// is what makes a dry run the same code path as a real one rather than a second implementation of it,
// and it is the only way the "what would this write" question can be answered honestly.

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { activateGovernance, effectiveGovernanceBindings } from "@entelekheia/vibe-ops-core";
import type { VibeOpsConfig } from "@entelekheia/vibe-ops-core";
import { composeGovernanceDocuments } from "@entelekheia/governance-base";
import type { RenderableType } from "@entelekheia/governance-base";

/** One file the scaffold would write, and where its content came from. */
export interface PlannedFile {
  /** Relative to the target repository. */
  readonly to: string;
  /** What produced it — a package name, or `rendered` for the two governance documents. */
  readonly origin: string;
  readonly content: string;
  /** Placeholders still standing in `content`, which the caller substitutes. */
  readonly placeholders: readonly string[];
}

export interface Composition {
  readonly files: readonly PlannedFile[];
  /** Directories that exist only to hold records — one per activated type's first `dirs` entry. */
  readonly directories: readonly string[];
  /** A package a binding names and that did not resolve. Reported, never silently skipped: a scaffold
   *  missing one governance's contribution is not the scaffold anybody asked for. */
  readonly unresolved: readonly string[];
  /**
   * A file the composition WOULD have written and will not, with the reason. Distinct from `unresolved`,
   * which is about a binding: this is about a destination — a `GOVERNANCE.md` whose markers are damaged,
   * or a frame fragment the base package does not ship. A refusal makes the verb exit non-zero, because
   * a scaffold that omitted a document nobody was told about is the failure this plan keeps finding.
   */
  readonly refusals: readonly string[];
}

const PLACEHOLDER = /\{\{([A-Z0-9_]+)\}\}/g;

function placeholdersIn(content: string): readonly string[] {
  return [...new Set([...content.matchAll(PLACEHOLDER)].map((m) => m[1]!))];
}

/**
 * Every activated type, and the packages behind them. A package shipping several units appears once per
 * bound type here, which is what the callers want — each unit contributes its own directory and section —
 * while its `scaffold` is deduplicated below, because a scaffold belongs to the package.
 */
/** What this module holds per activated type: the renderer's input plus the two things only a scaffold
 *  reads — the package's contribution, and the type's own record template. */
type ActivatedType = RenderableType & {
  readonly packageName: string;
  readonly unit: RenderableType["unit"] & {
    readonly template?: string;
    readonly scaffold?: {
      readonly dir: string;
      readonly files: readonly { readonly from: string; readonly to: string; readonly shape?: string }[];
    };
  };
};

async function activated(config: VibeOpsConfig | undefined): Promise<{
  readonly types: readonly ActivatedType[];
  readonly unresolved: readonly string[];
}> {
  const bindings = effectiveGovernanceBindings(config);
  const types: ActivatedType[] = [];
  const unresolved: string[] = [];
  for (const [name, binding] of Object.entries(bindings)) {
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
 * What a scaffold run would write. `existingGovernanceDoc` is the target's current `GOVERNANCE.md`, when
 * it has one: that document is `shaped`, so its repository-owned half is carried through rather than
 * replaced, and passing it here is what makes the composition idempotent against a repository that has
 * been scaffolded before.
 */
export async function compose(
  config: VibeOpsConfig | undefined,
  options: { readonly existingGovernanceDoc?: string; readonly shape?: string } = {},
): Promise<Composition> {
  const { types, unresolved } = await activated(config);
  const files: PlannedFile[] = [];
  const directories: string[] = [];
  const seenPackages = new Set<string>();

  for (const entry of types) {
    // A SCAFFOLD BELONGS TO THE PACKAGE, and a package may serve several bound types (ADR-0020). Writing
    // its contribution once per type would write the same file as many times as the package has units.
    if (!seenPackages.has(entry.packageName)) {
      seenPackages.add(entry.packageName);
      const scaffold = entry.unit.scaffold;
      if (scaffold !== undefined) {
        for (const file of scaffold.files) {
          // A SHAPE-BOUND FILE IS WRITTEN ONLY FOR ITS SHAPE. `package.json` is why: a single-package
          // repository and a workspace need different content at the same destination, so the choice
          // cannot be read off the destination. A file with no shape belongs to every shape.
          if (file.shape !== undefined && file.shape !== options.shape) continue;
          const source = path.resolve(entry.root, scaffold.dir, file.from);
          if (!existsSync(source)) continue; // reported by the facet-completeness gate, not invented here
          const content = readFileSync(source, "utf8");
          files.push({ to: file.to, origin: entry.packageName, content, placeholders: placeholdersIn(content) });
        }
      }
    }

    // Where this type's records live, and its template beside them. The template is READ FROM THE PACKAGE
    // rather than copied from a second source: the five byte-identical copies a drift check used to hold
    // in sync are exactly what this removes.
    const where = entry.unit.dirs?.[0];
    if (where !== undefined) directories.push(where);
    if (entry.unit.template !== undefined && where !== undefined) {
      const source = path.resolve(entry.root, entry.unit.template);
      if (existsSync(source)) {
        const content = readFileSync(source, "utf8");
        files.push({
          to: `project/templates/${entry.unit.type}.md`,
          origin: entry.packageName,
          content,
          placeholders: placeholdersIn(content),
        });
      }
    }
  }

  // The two documents that describe whatever is activated — composed by `governance-base`, because
  // `harness sync` needs the same answer on every promulgation and a second copy here would be a second
  // thing to keep in step about files this tooling writes into other people's repositories. A refusal is
  // reported, never a composition quietly missing a governance document.
  const governance = await composeGovernanceDocuments(config, { types, existingDoc: options.existingGovernanceDoc });
  for (const [to, content] of governance.files) {
    files.push({ to, origin: "rendered", content, placeholders: [] });
  }

  return { files, directories, unresolved, refusals: governance.refusals };
}
