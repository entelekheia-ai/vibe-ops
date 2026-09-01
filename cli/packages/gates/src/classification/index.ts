// A pattern that must not appear in a committed file.
//
// Every "this may not be here" check is one operation: sweep a population, match the forbidden patterns,
// report each occurrence. What varies is which patterns and how loudly a finding may speak — and the
// second of those is what `level` decides.
//
// `level` names the classification of the material being kept out, and it carries the machinery:
//
//   secret        the finding names WHERE only. Quoting anything would reproduce the material in the
//                 run's own output, which is the leak being prevented.
//   confidential  the finding quotes the MATCH. Seeing it is how someone removes it.
//   internal      the same, for material that travels badly rather than dangerously.
//   public        nothing is forbidden at this level; a rule declared here is a usage error.
//
// THE MATCH, NEVER THE LINE, and that is what makes the levels hold against each other. A gate is a pure
// detector and cannot see the rules another entry is running, so a `confidential` rule quoting whole
// lines would sooner or later print a line that a `secret` rule matched elsewhere — the stricter level
// defeated by the looser one, in a repository where both were correctly declared. Quoting only the span
// that matched removes the possibility rather than coordinating around it, and it is the better evidence
// anyway: it names the thing to change instead of the sentence containing it.
//
// The ops supplies data — the patterns, the population, what to call the finding — and never how to
// report. Patterns come inline, or from a file for a list that must not be committed anywhere.
//
// A list that was named and could not be read THROWS. Reporting "no forbidden pattern appeared" over a
// list that never loaded is the one outcome this gate may not produce.

import { defineGate, lineAt, proseText } from "@entelekheia/vibe-ops-core";
import type { GateFinding } from "@entelekheia/vibe-ops-core";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

/** How sensitive the forbidden material is, and therefore how a finding may describe it. */
type Level = "public" | "internal" | "confidential" | "secret";

const LEVELS: ReadonlySet<string> = new Set(["public", "internal", "confidential", "secret"]);

interface ClassificationOptions {
  readonly level: Level;
  /** Patterns, as regular expression sources. Composed by the ops. */
  readonly forbid?: readonly string[];
  /**
   * A file of `<label>\t<pattern>` lines, read at run time. For a list whose entries may not be
   * committed anywhere — the path is handed in, the content is never data of this gate. Falls back to
   * `VIBE_OPS_DENYLIST`, so an entry can compose the rule without naming a path that exists only while
   * the run lasts.
   */
  readonly forbidFrom?: string;
  /**
   * Where in the file the rule applies. `prose` masks fenced blocks and inline code spans, so syntax
   * being SHOWN is not read as syntax being USED — `[[…]]` is also TOML and Wikitext. `text` reads every
   * line, which is what a rule about pasted commands needs: a machine path inside a fence is exactly
   * where one appears.
   */
  readonly scope?: "text" | "prose";
  /** Occurrences matching any of these are not findings. */
  readonly allow?: readonly string[];
  readonly rule?: string;
  /** Names what is being kept out, so a finding says what was breached rather than which regex matched. */
  readonly subject?: string;
}

interface Forbidden {
  readonly label: string;
  readonly pattern: RegExp;
}

/** `<label>\t<pattern>` per line; blank lines and `#` comments skipped. */
function readList(absolute: string): readonly Forbidden[] {
  const out: Forbidden[] = [];
  for (const line of readFileSync(absolute, "utf8").split("\n")) {
    if (line.trim() === "" || line.startsWith("#")) continue;
    const [label, pattern] = line.split("\t");
    if (pattern === undefined || pattern === "") continue;
    out.push({ label: label ?? "entry", pattern: new RegExp(pattern) });
  }
  return out;
}

export default defineGate(
  {
    id: "classification",
    version: 1,
    summary: "Material a committed file may not carry, by the classification of what is kept out",
  },
  async ({ repoRoot, files, options, documents }) => {
    const {
      level,
      forbid = [],
      forbidFrom,
      allow = [],
      scope = "text",
      rule = "classification",
      subject = "forbidden material",
    } = options as unknown as ClassificationOptions;

    if (!LEVELS.has(level)) {
      throw new Error(`classification requires options.level — one of ${[...LEVELS].join(", ")}`);
    }
    if (level === "public") {
      throw new Error("classification: nothing is forbidden at level public — this rule keeps nothing out");
    }

    const forbidden: Forbidden[] = forbid.map((pattern, index) => ({
      label: `pattern ${index + 1}`,
      pattern: new RegExp(pattern),
    }));

    const listAt = forbidFrom ?? process.env["VIBE_OPS_DENYLIST"];
    if (listAt !== undefined && listAt !== "") {
      const absolute = path.resolve(repoRoot, listAt);
      if (!existsSync(absolute)) {
        throw new Error(
          `classification: the list at ${listAt} is named but not there — a list that was never read` +
            " must not report as nothing forbidden appearing",
        );
      }
      forbidden.push(...readList(absolute));
    }

    if (forbidden.length === 0) {
      return { findings: [], examined: 0, skipped: `${subject}: nothing declared forbidden — no pattern to look for` };
    }
    if (files.length === 0) {
      return { findings: [], examined: 0, skipped: `${subject}: no file in the population — zero examined is not a reading` };
    }

    const permitted = allow.map((pattern) => new RegExp(pattern));
    const findings: GateFinding[] = [];

    const report = (file: string, line: number, entry: Forbidden, match: string): void => {
      findings.push({
        rule,
        file,
        line,
        evidence:
          level === "secret"
            ? `an entry from the list appears here (${entry.label}) — rewrite the line`
            : `${subject}: ${match}`,
      });
    };

    let examined = 0;
    for (const file of files) {
      const absolute = path.resolve(repoRoot, file);
      if (!existsSync(absolute)) continue;

      if (scope === "prose") {
        const document = documents.get(file);
        if (document.tree === undefined) continue;
        examined += 1;
        const masked = proseText(document);
        for (const entry of forbidden) {
          const pattern = new RegExp(entry.pattern.source, "g");
          let match: RegExpExecArray | null;
          while ((match = pattern.exec(masked)) !== null) {
            const line = lineAt(document.text, match.index);
            const text = document.text.split("\n")[line - 1] ?? "";
            if (permitted.some((allowed) => allowed.test(text))) continue;
            report(file, line, entry, match[0]);
          }
        }
        continue;
      }

      examined += 1;
      for (const [index, text] of readFileSync(absolute, "utf8").split("\n").entries()) {
        if (permitted.some((pattern) => pattern.test(text))) continue;
        for (const entry of forbidden) {
          const found = entry.pattern.exec(text);
          if (found !== null) report(file, index + 1, entry, found[0]);
        }
      }
    }

    return { findings, examined };
  },
);
