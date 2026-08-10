// Ported from cli/packages/module-check/sh/checks/60-memory-slugs.sh. A committed file must never
// point at a personal memory store: the reader does not have it, and the pointer dangles the moment
// the memory is renamed.
//
// `[[...]]` is not only a memory link. TOML array-of-tables (`[[language]]`), Wikitext and several
// template languages share the shape, so the match runs per file with fenced blocks and inline code
// spans removed first: syntax quoted as code is being *shown*, not used.
//
// THE ONE GATE THAT EMITS in this ops (RFC-0001, Rationale). The other four are structural properties
// — a file has a sibling or it does not — that stay fixed once corrected. This one is behavioural and
// recurrent: a model reintroducing a memory link on an instruction surface is a real rate to watch.

import { defineGate } from "@entelekheia/vibe-ops-core";
import type { GateFinding } from "@entelekheia/vibe-ops-core";
import { readFile } from "node:fs/promises";
import path from "node:path";

const FENCE = /^\s*```/;
const CODE_SPAN = /`[^`]*`/g;
const SLUG = /\[\[[a-z0-9][a-z0-9_-]*\]\]/;

export default defineGate(
  { id: "memory-slug", summary: "No committed file links to a personal-memory slug" },
  async ({ repoRoot, files }) => {
    const findings: GateFinding[] = [];
    let examined = 0;

    for (const file of files) {
      // A link inside a shipped template is written to resolve in the *target* repo, not this one.
      if (file.includes("/templates/")) continue;
      examined += 1;

      const content = await readFile(path.join(repoRoot, file), "utf8");
      let fenced = false;
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i] ?? "";
        if (FENCE.test(line)) {
          fenced = !fenced;
          continue;
        }
        if (fenced) continue;
        const stripped = line.replace(CODE_SPAN, "");
        if (SLUG.test(stripped)) {
          findings.push({ rule: "memory-slug", file, line: i + 1, evidence: `wiki-style memory link: ${line}` });
        }
      }
    }
    return { findings, examined };
  },
);
