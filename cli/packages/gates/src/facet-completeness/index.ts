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
    version: 1,
    summary: "Every facet an activated governance serves exists and declares its vibe-ops-reference version",
  },
  async ({ repoRoot }) => {
    const { config } = await loadConfig(repoRoot);

    const findings: GateFinding[] = [];
    let examined = 0;

    for (const type of Object.keys(effectiveGovernanceBindings(config))) {
      const activated = await activateGovernance(type, config);
      const facets = activated?.unit.facets;
      if (activated === undefined || facets === undefined) continue;

      for (const [name, relative] of Object.entries(facets)) {
        examined += 1;
        const file = path.resolve(activated.root, relative);
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
    }

    // ZERO EXAMINED IS NOT A READING. A repository whose activated packages serve no policy gets a
    // SKIP naming that, never a pass — the failure this gate exists to replace was a pass asserting
    // coverage over an empty population.
    return examined === 0
      ? { findings: [], skipped: "no activated governance declares a policy facet" }
      : { findings, examined };
  },
);
