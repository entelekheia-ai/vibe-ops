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

  // There is no project/templates/ here: the canonical templates ARE the distributable — since
  // Plan-033 each lives in its artifact's own governance package. Pointing the resolver at them
  // (Plan-011 Track 2) is what makes this repository's own records get written from the very file it
  // ships to every other repository — the drift 35-dogfooding-drift.sh exists to catch, closed at the
  // source instead of caught after the fact. log is declarable since Plan-029 opened the type union.
  records: {
    templates: {
      adr: "cli/packages/governance-adr/templates/adr.md",
      rfc: "cli/packages/governance-rfc/templates/rfc.md",
      plan: "cli/packages/governance-plan/templates/plan.md",
      task: "cli/packages/governance-task/templates/task.md",
      log: "cli/packages/governance-log/templates/log.md",
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
        // The same two files, for the same reason, against the entry that reads their frontmatter keys
        // rather than their version. Two entries over one directory need the exclusion each — `ignore`
        // is keyed by label and additive, never inherited from a sibling.
        "record-frontmatter-log": ["project/log/README.md", "project/log/RETIRED.md"],
        // The plans directory gained an index of its own (the roadmap, Plan-033's closure) — an index,
        // not a record, same reasoning as the log READMEs above, one exclusion per entry over the dir.
        "record-header-plan": ["project/plans/README.md"],
        // THE SHIPPED CORPUS KEEPS THE SHAPE IT WAS WRITTEN IN (maintainer decision, 2026-08-22,
        // Plan-017's open question answered against its own assumption): delivered records are never
        // migrated — that corpus only grows, so migrating it is a treadmill — and are therefore
        // exempt from version reporting. The archival directories leave this entry's population; a
        // LIVING record behind its template still warns, which is the honest reading of open work.
        "template-version-plan": ["project/plans/README.md", "project/plans/shipped/**"],
        // The same policy for the RFC lifecycle's archival halves — frozen on arrival by the
        // governance rule, so a version gap there is a fact about history, not a debt.
        "template-version-rfc": ["project/rfc/implemented/**", "project/rfc/rejected/**"],
      },
      // Research needs no disablement any more: the per-type entries are derived from the activated
      // governances (Plan-034), and no governance package serves research — the type entered the old
      // hand-written list by mistake (Plan-030's Decision Log), so nothing derives an entry for it.
    },
    self: {
      // THE PATH POLICY (Plan-014). What separates a record that HAS an old heading — legitimate, it was
      // written against an older template — from a document that SAYS records have it, which is the
      // defect. Declared here rather than inside the gate, so it is reviewable and wrong in a way a
      // reader can see. Note what is NOT excluded: `**/templates/**`, because the shipped copies are the
      // population this ops exists to read.
      ignore: {
        // A migration note is the SOURCE this gate reads, never a description to be corrected. Scoped to
        // the label rather than blanketed across the ops, because `unstated-destination` takes the same
        // notes as its SUBJECT — one path whose exclusion belongs to an entry, moved out of a default
        // that stays safe for everything else.
        "template-heading-drift": ["cli/packages/governance-*/migrations/**"],
        "*": [
          // A template is the authority on a shape, never a description of one. Both copies — the
          // canonical one in each governance package, and setup's scaffold copy.
          "cli/packages/governance-*/templates/**",
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
