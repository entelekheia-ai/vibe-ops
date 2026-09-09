// Every policy facet an activated governance package serves exists, and says which version it is.
//
// A facet is a policy file a package hands out through `records norm --facet policy --name <n>`
// (RFC-0005 §3) — what used to be a file under the plugin's `references/` and reachable only through
// `${CLAUDE_PLUGIN_ROOT}`. The stamp is what makes a closure able to report the policy version it
// applied, so a facet without one is a cited policy that cannot say which version it is.
//
// WHY THIS IS A GATE AND NOT A LINE IN `55-references-completeness.sh`. The fragment reads paths under
// `$ROOT`, and every one of a consumer's facets lives inside an installed package instead — enumerating
// `cli/packages/*/type.json` finds this repository's own eight and a consumer's zero, while the pass
// message claims coverage either way. A gate resolves what the repository ACTIVATES, through the same
// binding map every other reader uses, so the population is the same in both installs. `cli/AGENTS.md`
// says a new detector is a gate, never a new fragment; this is that rule applied to the one detector
// Plan-040 Track 1 added.
//
// LIKE THE CONFIG GATES, its subject is not a file list an ops handed it: there is no repository-
// relative population to filter, so reading the bindings directly here is not the population-filtering
// a gate may not do.

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { defineGate, loadConfig, activateGovernance, effectiveGovernanceBindings } from "@entelekheia/vibe-ops-core";
import type { GateFinding } from "@entelekheia/vibe-ops-core";

/** Any well-formed stamp. The NAME travelled with the file, not with the key it is served under —
 *  `convergence-policy@2` is still that, though its facet key is `convergence` — so matching against
 *  the key would fail on every facet whose serving label was chosen after the document was written. */
const STAMP = /^vibe-ops-reference: [A-Za-z0-9_/-]+@[0-9]+$/m;

export default defineGate(
  {
    id: "facet-completeness",
    version: 3,
    summary: "Every file an activated governance declares exists, stays inside the package, and every facet says which version it is",
  },
  async ({ repoRoot }) => {
    const { config } = await loadConfig(repoRoot);

    const findings: GateFinding[] = [];
    let examined = 0;

    for (const type of Object.keys(effectiveGovernanceBindings(config))) {
      const activated = await activateGovernance(type, config);
      if (activated === undefined) continue;

      // The two declarations are independent: `governance-license` ships a scaffold and serves no facet,
      // `governance-base` serves facets and ships no scaffold. Skipping the package on an absent `facets`
      // would have made this gate blind to every scaffold entry of the one package that has the most.
      for (const [name, relative] of Object.entries(activated.unit.facets ?? {})) {
        examined += 1;
        const file = path.resolve(activated.root, relative);
        if (path.relative(activated.root, file).startsWith("..")) {
          findings.push({
            rule: "facet-completeness",
            evidence: `${type} declares facets.${name} = ${relative}, which leaves ${activated.root} — the package cannot serve a file it does not ship`,
          });
          continue;
        }
        if (!existsSync(file)) {
          findings.push({
            rule: "facet-completeness",
            evidence: `${type} declares facets.${name} = ${relative}, which does not exist in ${activated.root}`,
          });
          continue;
        }
        if (!STAMP.test(readFileSync(file, "utf8"))) {
          findings.push({
            rule: "facet-completeness",
            file: path.relative(repoRoot, file),
            evidence: `${type}'s facet "${name}" declares no \`vibe-ops-reference: <name>@<integer>\` — a cited policy that cannot say which version it is`,
          });
        }
      }

      // EVERY OTHER PATH THE MANIFEST DECLARES, for the reason `notes` proved. Only `facets` was
      // checked, so a package could declare `notes: ./lifecycle-notes.md`, ship no such file, and lose
      // its whole section from both governance documents of every consuming repository with this gate
      // still reporting a clean run. The three record paths read the same way — a `template` that
      // resolves to nothing fails at `/vibe-ops:new`, in somebody else's tree.
      for (const [field, relative] of [
        ["notes", activated.unit.notes],
        ["template", activated.unit.template],
        ["authoring", activated.unit.authoring],
        ["migrations", activated.unit.migrations],
      ] as const) {
        if (relative === undefined) continue;
        examined += 1;
        const file = path.resolve(activated.root, relative);
        // CONTAINMENT, WHERE THE ROOT IS KNOWN. The parser refuses only an absolute path, because a unit
        // a repository declares under `.agents/` legitimately reaches its own templates through `../../`.
        // An ACTIVATED package's root is the package, and a path leaving it reads a file the package does
        // not ship — for `notes` that file is then inlined into a consumer's `GOVERNANCE.md`.
        if (path.relative(activated.root, file).startsWith("..")) {
          findings.push({
            rule: "facet-completeness",
            evidence: `${type} declares ${field} = ${relative}, which leaves ${activated.root} — the package cannot serve a file it does not ship`,
          });
          continue;
        }
        if (!existsSync(file)) {
          findings.push({
            rule: "facet-completeness",
            evidence: `${type} declares ${field} = ${relative}, which does not exist in ${activated.root}`,
          });
        }
      }

      // The same question asked of the other thing a package declares and ships. A scaffold entry names
      // a file it will write into someone else's repository, so a `from` that resolves to nothing fails
      // at the moment of use, in a tree that is not this one and with nobody here to read the error.
      const scaffold = activated.unit.scaffold;
      if (scaffold === undefined) continue;
      for (const entry of scaffold.files) {
        examined += 1;
        const source = path.resolve(activated.root, scaffold.dir, entry.from);
        if (!existsSync(source)) {
          findings.push({
            rule: "scaffold-completeness",
            evidence: `${type} declares the scaffold file ${entry.from} → ${entry.to}, and ${entry.from} does not exist under ${scaffold.dir}`,
          });
        }
        // A `to` IS A PATH INTO SOMEBODY ELSE'S REPOSITORY. The parser refuses one that leaves it, and
        // the assertion is repeated here because a manifest is data a third party ships (RFC-0003) and
        // the parser is not the only way one is read — a package built against an older parser reaches
        // the writer with no check between.
        const landing = path.resolve("/target", entry.to);
        if (path.isAbsolute(entry.to) || path.relative("/target", landing).startsWith("..")) {
          findings.push({
            rule: "scaffold-completeness",
            evidence: `${type} declares the scaffold file ${entry.from} → ${entry.to}, which leaves the repository it would be written into`,
          });
        }
      }
    }

    // ZERO EXAMINED IS NOT A READING. A repository whose activated packages serve no policy gets a
    // SKIP naming that, never a pass — the failure this gate exists to replace was a pass asserting
    // coverage over an empty population.
    return examined === 0
      ? { findings: [], skipped: "no activated governance declares a policy facet or a scaffold file" }
      : { findings, examined };
  },
);
