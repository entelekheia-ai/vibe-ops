// This repository's own vibe-ops configuration. The cascade continues upward from here to the home
// directory, so anything personal (an operator's preferred artifact location, for instance) belongs
// in ~/vibeops.config.ts rather than being committed into this file.

import type { VibeOpsConfig } from "@entelekheia/vibe-ops-core";

export default {
  // Which modules `vibe-ops mcp` exposes as tools. Absent means the built-ins.
  modules: ["check", "agents-md", "governance"],

  // Absent would disable emission entirely. Pointed inside .git/ deliberately: these are observations
  // about a working tree, not a product of it, and committing them would make every run a diff.
  artifactDir: ".git/gate-artifacts",

  settings: {
    // A shipped template's content is written to resolve in the *target* repository, never this one —
    // a link, or a `[[memory-slug]]`-shaped placeholder, inside plugin/skills/*/templates/ is not this
    // repository's to judge. Declared once here rather than duplicated inside each gate that would
    // otherwise re-invent it; see the "POPULATION VS BEHAVIOUR" note in cli/packages/core/src/ops.ts.
    "agents-md": { ignore: { "*": ["**/templates/**"] } },
    governance: { ignore: { "*": ["**/templates/**"] } },
  },
} satisfies VibeOpsConfig;
