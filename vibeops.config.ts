// This repository's own vibe-ops configuration. The cascade continues upward from here to the home
// directory, so anything personal (an operator's preferred artifact location, for instance) belongs
// in ~/vibeops.config.ts rather than being committed into this file.

import type { VibeOpsConfig } from "@entelekheia/vibe-ops-core";

export default {
  // Which modules `vibe-ops mcp` exposes as tools. Absent means the built-ins.
  modules: ["check", "agents-md", "governance", "plan", "task", "log"],

  // Absent would disable emission entirely. Pointed inside .git/ deliberately: these are observations
  // about a working tree, not a product of it, and committing them would make every run a diff.
  artifactDir: ".git/gate-artifacts",

  // There is no project/templates/ here: the canonical templates ARE the distributable. Pointing the
  // resolver at them (Plan-011 Track 2) is what makes this repository's own adr/rfc/plan/task get
  // written from the very file it ships to every other repository — the drift 35-dogfooding-drift.sh
  // exists to catch, closed at the source instead of caught after the fact.
  records: {
    templates: {
      adr: "plugin/templates/adr.md",
      rfc: "plugin/templates/rfc.md",
      plan: "plugin/templates/plan.md",
      task: "plugin/templates/task.md",
    },
  },

  settings: {
    // A shipped template's content is written to resolve in the *target* repository, never this one —
    // a link, or a `[[memory-slug]]`-shaped placeholder, inside plugin/skills/*/templates/ is not this
    // repository's to judge. Declared once here rather than duplicated inside each gate that would
    // otherwise re-invent it; see the "POPULATION VS BEHAVIOUR" note in cli/packages/core/src/ops.ts.
    "agents-md": { ignore: { "*": ["**/templates/**"] } },
    governance: { ignore: { "*": ["**/templates/**"] } },
  },
} satisfies VibeOpsConfig;
