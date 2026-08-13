// Ported from cli/packages/module-check/sh/checks/60-memory-slugs.sh. A committed file must never
// point at a personal memory store: the reader does not have it, and the pointer dangles the moment
// the memory is renamed.
//
// `[[...]]` is not only a memory link. TOML array-of-tables (`[[language]]`), Wikitext and several
// template languages share the shape, so the match runs against `proseText`, which excludes a fenced
// block and an inline code span before this gate ever sees them: syntax quoted as code is being
// *shown*, not used.
//
// Plan-013 Track 2: `proseText` replaces a hand-rolled fence toggle and `` /`[^`]*`/g `` strip — and had
// to, not merely could. `[[project_something]]` does not become a `text` node under the inline grammar
// at all; it parses as `(shortcut_link (link_text))`, whose own `.text` is `[project_something]`, one
// bracket pair. A walk over node types finds nothing here. Masking the source string first and matching
// the mask is the only approach that reproduces what the shell fragment already caught line by line.
//
// THE ONE GATE THAT EMITS in this ops (RFC-0001, Rationale). The other four are structural properties
// — a file has a sibling or it does not — that stay fixed once corrected. This one is behavioural and
// recurrent: a model reintroducing a memory link on an instruction surface is a real rate to watch.

import { defineGate, lineAt, proseText } from "@entelekheia/vibe-ops-core";
import type { GateFinding } from "@entelekheia/vibe-ops-core";

const SLUG = /\[\[[a-z0-9][a-z0-9_-]*\]\]/g;

export default defineGate(
  { id: "memory-slug", version: 1, summary: "No committed file links to a personal-memory slug" },
  async ({ files, documents }) => {
    const findings: GateFinding[] = [];
    let examined = 0;

    for (const file of files) {
      const document = documents.get(file);
      if (document.tree === undefined) continue;
      examined += 1;

      const masked = proseText(document);
      const lines = document.text.split("\n");
      const reportedLines = new Set<number>();
      const pattern = new RegExp(SLUG.source, "g");
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(masked)) !== null) {
        const line = lineAt(document.text, match.index);
        if (reportedLines.has(line)) continue;
        reportedLines.add(line);
        findings.push({ rule: "memory-slug", file, line, evidence: `wiki-style memory link: ${lines[line - 1] ?? ""}` });
      }
    }
    return { findings, examined };
  },
);
