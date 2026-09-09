// vibe-ops setup — the scaffold, as a composition of what the repository activates (Plan-040 Track 6).
//
// `plan` ANSWERS THE SAME QUESTION `scaffold` ACTS ON, from the same code path. A dry run implemented
// separately is a second implementation that drifts, and the thing it would drift about is what a tool
// is going to write into somebody's repository — so `plan` is `scaffold` minus the writing, and there is
// no second traversal.
//
// IT REFUSES TO WRITE OVER WHAT IT DID NOT WRITE. Every destination that already exists is skipped and
// reported, unless `--force` names the file explicitly. The ownership boundary is what decides whether
// promulgation may overwrite something (`harness sync`); this verb is the FIRST write into a repository,
// where the honest default is that anything already there was put there by someone.

import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { defineModule } from "@entelekheia/vibe-ops-core";
import type { ModuleResult } from "@entelekheia/vibe-ops-core";
import { compose } from "./compose.ts";
import type { PlannedFile } from "./compose.ts";

/** `{{NAME}}` → value, for the names the caller supplied. A placeholder nobody answered is LEFT STANDING
 *  rather than emptied: a `{{PKG_NAME}}` in a written file is visible and greppable, and an empty string
 *  where a name belongs is a file that looks finished and is not. */
function substitute(content: string, values: Readonly<Record<string, string>>): string {
  return content.replace(/\{\{([A-Z0-9_]+)\}\}/g, (whole, name: string) => values[name] ?? whole);
}

function parseValues(args: readonly string[]): Readonly<Record<string, string>> {
  const values: Record<string, string> = {};
  for (const arg of args) {
    const equals = arg.indexOf("=");
    if (equals > 0) values[arg.slice(0, equals)] = arg.slice(equals + 1);
  }
  return values;
}

export default defineModule(
  {
    id: "setup",
    version: "0.0.1",
    summary: "The scaffold: what every activated governance contributes to a repository, planned or written",
    // The subject IS a repository, so the first positional is the target and the module never sees it —
    // the same declaration `check` makes, and the reason `setup scaffold ../new-repo NAME=x` works.
    repoFromFirstArg: true,
    commands: [
      {
        name: "plan",
        summary: "what a scaffold would write into this repository, and where each file comes from",
      },
      {
        name: "scaffold",
        summary: "write every activated governance's contribution, skipping what already exists",
        destructive: true,
        flags: [
          { name: "force", type: "string", description: "overwrite this destination even though it exists; repeatable as a comma-separated list" },
        ],
      },
    ],
    flags: [{ name: "json", type: "boolean", description: "print the structured object instead of KEY=value lines" }],
  },
  async (context): Promise<ModuleResult> => {
    const existingDoc = (() => {
      const file = path.join(context.repoRoot, "GOVERNANCE.md");
      return existsSync(file) ? readFileSync(file, "utf8") : undefined;
    })();

    const composition = await compose(context.config, { existingGovernanceDoc: existingDoc });
    const values = parseValues(context.args);
    const rendered = composition.files.map((file) => ({ ...file, content: substitute(file.content, values) }));
    const unanswered = [...new Set(rendered.flatMap((f) => [...f.content.matchAll(/\{\{([A-Z0-9_]+)\}\}/g)].map((m) => m[1]!)))];

    if (context.command === "plan") {
      if (context.surface === "cli" && context.flags["json"] !== true) {
        for (const dir of composition.directories) context.log(`${dir}/`);
        for (const file of rendered) context.log(`${file.to}  ← ${file.origin}`);
        for (const missing of composition.unresolved) context.warn(`${missing} does not resolve — its contribution is absent from this plan`);
        if (unanswered.length > 0) context.warn(`unanswered placeholders: ${unanswered.join(", ")}`);
      }
      return {
        code: 0,
        summary: `${rendered.length} file(s) from ${new Set(rendered.map((f) => f.origin)).size} source(s), ${composition.directories.length} directory(ies)`,
        data: {
          directories: composition.directories,
          files: rendered.map(({ to, origin, placeholders }: PlannedFile) => ({ to, origin, placeholders })),
          unresolved: composition.unresolved,
          unanswered,
        },
      };
    }

    if (context.command === "scaffold") {
      const force = new Set(
        String(context.flags["force"] ?? "")
          .split(",")
          .map((s) => s.trim())
          .filter((s) => s !== ""),
      );

      const written: string[] = [];
      const skipped: string[] = [];

      for (const dir of composition.directories) {
        mkdirSync(path.join(context.repoRoot, dir), { recursive: true });
        const keep = path.join(context.repoRoot, dir, ".gitkeep");
        if (!existsSync(keep)) writeFileSync(keep, "");
      }

      for (const file of rendered) {
        const destination = path.join(context.repoRoot, file.to);
        if (existsSync(destination) && !force.has(file.to)) {
          skipped.push(file.to);
          continue;
        }
        mkdirSync(path.dirname(destination), { recursive: true });
        writeFileSync(destination, file.content);
        written.push(file.to);
      }

      if (context.surface === "cli" && context.flags["json"] !== true) {
        for (const file of written) context.log(`wrote ${file}`);
        for (const file of skipped) context.log(`kept ${file} — already there; --force ${file} to overwrite`);
        for (const missing of composition.unresolved) context.warn(`${missing} does not resolve — its contribution was not written`);
        if (unanswered.length > 0) context.warn(`unanswered placeholders left standing: ${unanswered.join(", ")}`);
      }
      return {
        code: 0,
        summary: `${written.length} written, ${skipped.length} kept, ${composition.directories.length} directory(ies)`,
        data: { written, skipped, directories: composition.directories, unresolved: composition.unresolved, unanswered },
      };
    }

    return { code: 2, summary: `setup has no command "${context.command ?? ""}"` };
  },
);
