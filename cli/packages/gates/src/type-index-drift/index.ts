// New gate — no shell precedent, and deliberately so. `types/index.json` is generated from the type
// units under `types/<name>/type.json` (Plan-030 Track 1), and nothing kept the two in step: a type
// added, a template's version bumped, or a manifest's template path changed, each without regenerating,
// leaves both files individually well-formed and disagreeing.
//
// IT REBUILDS RATHER THAN COMPARING FIELDS. `buildTypeIndex` in @entelekheia/vibe-ops-records is what
// the generator itself calls, so this gate asks the only question that cannot go stale: would
// regenerating produce these bytes? A field-by-field comparison would have to be extended every time
// the index gains a key, and the extension it did not get is invisible — it reports clean.
//
// IT DISCOVERS ITS OWN POPULATION, like `bridge`. The subject is a plugin tree's `types/` directory,
// not a path list an ops can scope, so `files` is ignored and `examined` carries the unit count —
// which is what GateOutcome.examined exists for.
//
// FIXABLE, because regenerating is mechanical in the strict sense: the generated file has no author, so
// rewriting it destroys no judgement. That is the same test `pairing` applies when it creates a missing
// CLAUDE.md but refuses to edit one somebody wrote.

import { defineGate } from "@entelekheia/vibe-ops-core";
import type { GateFinding, GateFix } from "@entelekheia/vibe-ops-core";
import { buildTypeIndex, serialiseTypeIndex, typeIndexPath } from "@entelekheia/vibe-ops-records";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const MISSING = "type-index-missing";
const STALE = "type-index-stale";

export default defineGate(
  {
    id: "type-index-drift",
    version: 1,
    summary: "types/index.json is what regenerating it from the type units would produce",
    defaultPaths: ["<plugin>/types/index.json"],
    fixable: true,
  },
  async ({ pluginDir, repoRoot }) => {
    if (!existsSync(path.join(pluginDir, "types"))) {
      return { findings: [], skipped: "no types/ directory — this repository ships no type units" };
    }

    const expected = buildTypeIndex(pluginDir);
    const examined = Object.keys(expected).length;
    if (examined === 0) {
      return { findings: [], skipped: "types/ holds no readable type unit" };
    }

    const indexAbs = typeIndexPath(pluginDir);
    const indexRel = path.relative(repoRoot, indexAbs);

    if (!existsSync(indexAbs)) {
      return {
        findings: [
          {
            rule: MISSING,
            file: indexRel,
            evidence: `${examined} type units are declared and no index is generated from them`,
          },
        ],
        examined,
      };
    }

    const actual = await readFile(indexAbs, "utf8");
    if (actual === serialiseTypeIndex(expected)) return { findings: [], examined };

    // Names WHICH types disagree rather than only that the file does: a whole-file diff sends a reader
    // to compare 100 lines by eye, and the answer is almost always one type.
    let committed: Record<string, unknown> = {};
    try {
      committed = JSON.parse(actual) as Record<string, unknown>;
    } catch {
      return {
        findings: [{ rule: STALE, file: indexRel, evidence: "is not valid JSON — regenerate it" }],
        examined,
      };
    }
    const names = [...new Set([...Object.keys(expected), ...Object.keys(committed)])].sort();
    const drifted = names.filter(
      (name) => JSON.stringify(committed[name]) !== JSON.stringify(expected[name as keyof typeof expected]),
    );

    const findings: GateFinding[] = [
      {
        rule: STALE,
        file: indexRel,
        evidence:
          drifted.length === 0
            ? "differs from what regenerating produces (formatting only) — regenerate it"
            : `disagrees with types/ on ${drifted.join(", ")} — regenerate it`,
      },
    ];
    return { findings, examined };
  },
  async ({ pluginDir, repoRoot }) => {
    const indexAbs = typeIndexPath(pluginDir);
    await writeFile(indexAbs, serialiseTypeIndex(buildTypeIndex(pluginDir)), "utf8");
    const fixes: GateFix[] = [{ file: path.relative(repoRoot, indexAbs), action: "regenerated from types/" }];
    return fixes;
  },
);
