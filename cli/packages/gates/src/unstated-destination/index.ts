// A migration note that marks a section `**dropped**` and never mentions it again has not said where its
// content goes — and content does not evaporate because a template stopped asking for it.
// `skills/new-migration/SKILL.md` states this as a hard rule ("a dropped section with no stated
// destination is an unfinished note"), `skills/migrate/SKILL.md` refuses to act on one, and until now
// nothing read the note to find out. The cost lands on whoever runs the migration months later, against
// the artifact with the most content in the section being dropped.
//
// WHAT THIS DECIDES, AND WHAT IT DOES NOT. It cannot judge whether a sentence naming the section really
// states a destination — that is prose, and reading it as a verdict would be a guess. It decides the
// narrower thing that is true or false: the note declares this section dropped and then never mentions it
// outside the shape table. That is the detectable form of "no stated destination", and a note that
// mentions the section and still fails to route it is a review comment rather than a finding.
//
// WHY NOT WATCH THE MIGRATION ITSELF. The rule this came from was "a migration must not lose a content
// line the note gave no destination", checked as a diff. That is not decidable: content LOSS and content
// TRANSFORMATION are the same diff, and a note that retypes prose into a checklist is prescribing exactly
// the change a vanished-line guard would accuse — `plan-0.1-to-0.2.md` does precisely that to
// `## Progress`. Checking the note before anyone migrates is the same purpose at a moment where the
// question has an answer (Plan-024 Track 8).
//
// TABLE SPANS ARE EXCLUDED BY NODE, not by matching lines beginning with `|`. The note's own shape table
// names every dropped section by construction, so counting those mentions would make every note pass. The
// text is read from `describedText`, which KEEPS the interior of a code span: a destination sentence
// conventionally writes the section as `` `Progress` ``, and masking it would blank the very mention
// being looked for.

import { defineGate, describedText, lineAt } from "@entelekheia/vibe-ops-core";
import type { GateFinding } from "@entelekheia/vibe-ops-core";
import { droppedSections } from "@entelekheia/governance-base";

export default defineGate(
  {
    id: "unstated-destination",
    version: 1,
    summary: "A section a migration note drops is mentioned somewhere the note can state its destination",
  },
  async ({ files, documents }) => {
    const findings: GateFinding[] = [];
    let examined = 0;

    for (const file of files) {
      const document = documents.get(file);
      if (document.tree === undefined) continue;
      examined += 1;

      const dropped = droppedSections(document);
      if (dropped.length === 0) continue;

      const tables = document.tree.rootNode
        .descendantsOfType("pipe_table")
        .map((table) => [table.startIndex, table.endIndex] as const);
      const text = describedText(document);

      for (const section of dropped) {
        let mentioned = false;
        for (let at = text.indexOf(section); at !== -1; at = text.indexOf(section, at + 1)) {
          if (tables.some(([start, end]) => at >= start && at < end)) continue;
          mentioned = true;
          break;
        }
        if (mentioned) continue;

        findings.push({
          rule: "unstated-destination",
          file,
          line: lineAt(document.text, tables[0]?.[0] ?? 0),
          evidence: `drops \`${section}\` and never mentions it outside the shape table — an artifact's content there has nowhere to go, and a migration reading this note stops rather than guessing`,
        });
      }
    }

    return { findings, examined };
  },
);
