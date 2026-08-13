// This repository's own vibe-ops configuration. The cascade continues upward from here to the home
// directory, so anything personal (an operator's preferred artifact location, for instance) belongs
// in ~/vibeops.config.ts rather than being committed into this file.

import type { VibeOpsConfig } from "@entelekheia/vibe-ops-core";

export default {
  // Which modules `vibe-ops mcp` exposes as tools. Absent means the built-ins.
  modules: ["check", "agents-md", "governance", "self", "plan", "task", "log", "records"],

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
    governance: {
      // One line, and it is a SAFE DEFAULT: every entry composed here inherits it, including one added
      // by somebody who never read this file. A shipped template's content is written to resolve in the
      // *target* repository, never this one, so a link or a `[[memory-slug]]`-shaped placeholder inside
      // plugin/skills/*/templates/ is not this repository's to judge. The one gate for which those
      // copies are the SUBJECT rather than noise lives in the `self` ops below, precisely so this line
      // can stay a blanket — see the "POPULATION VS BEHAVIOUR" note in cli/packages/core/src/ops.ts.
      ignore: {
        "*": ["**/templates/**"],
        // A directory's index is not one of its records. `project/log/README.md` is generated from the
        // entries and carries no version of its own, so scoping it in would report a permanent finding
        // nobody can close — the shape of a check people learn to ignore.
        "template-version-log": ["project/log/README.md", "project/log/RETIRED.md"],
      },
      // Research is deliberately outside the versioning scheme: the type has no template of its own and
      // its shape is not settled (Plan-012). Declared and disabled rather than left out of the
      // composition, so the run reports SKIP naming the reason — an excluded population that says
      // nothing is indistinguishable from a clean one.
      disabled: {
        "template-version-research": "research has no template; its shape is not settled — Plan-012",
      },
    },
    self: {
      // THE PATH POLICY (Plan-014). What separates a record that HAS an old heading — legitimate, it was
      // written against an older template — from a document that SAYS records have it, which is the
      // defect. Declared here rather than inside the gate, so it is reviewable and wrong in a way a
      // reader can see. Note what is NOT excluded: `**/templates/**`, because the shipped copies are the
      // population this ops exists to read.
      ignore: {
        "*": [
          // A migration note must name what it drops; it is the source these gates read.
          "plugin/skills/migrate/migrations/**",
          // A template is the authority on a shape, never a description of one. Both copies.
          "plugin/templates/**",
          "plugin/skills/setup/templates/project/templates/**",
          // A record's own structure. Written against the template of its day and correct as it stands;
          // migrating them is a separate job with its own per-entry decisions.
          "project/adr/**",
          "project/plans/**",
          "project/rfc/**",
          "project/tasks/**",
          // Write-once by this repository's own governance rule, and both legitimately narrate the old
          // shape — the trap that motivated Plan-014 lives in `project/log/` and describes the drop.
          "project/log/**",
          "project/research/**",
          // A historical record of what the shape once was.
          "CHANGELOG.md",
          // Keeps history deliberately, has its own template, and the mention attributes an EXTERNAL
          // contract rather than this repository's template — correcting it would falsify a credit.
          "ACKNOWLEDGEMENTS.md",
          // Relative symlinks into `.agents/`. The same bytes, reported twice, closed once.
          ".claude/**",
        ],
      },
      level: {
        // An occurrence the gate could not attribute to a record type ships as a warning, which is right
        // for a repository midway through a migration. This one has just finished a sweep and wants the
        // sentence read before it is committed, not after — the whole failure being prevented is a
        // partial sweep that looked complete.
        "template-heading-drift-unattributed": "fail",
      },
    },
  },
} satisfies VibeOpsConfig;
