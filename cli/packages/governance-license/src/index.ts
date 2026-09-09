// The licence governance — pure sugar over @entelekheia/governance-base for `resolve`, plus the
// registry verbs Plan-040 Track 3 moved off `plugin/skills/license-setup/get-license.sh`: the skill
// stops shipping a script of its own and names `license get <id>` / `license verify <file>` instead.
// It owns the licence texts and the registry that pins each to its published source; `mirror` verifies
// the pins.
//
// behaviour-equal across artifacts lives in defineGovernance, written once; this file only tells it
// where THIS package is, because an installed package sits wherever npm put it and nothing else can
// know. The data (type.json, templates/, migrations/, authoring.md, ownership.json) ships beside dist/.

import { fileURLToPath } from "node:url";
import path from "node:path";
import { defineGovernance } from "@entelekheia/governance-base";
import { canonicalText, fetchLicenseText, readRegistry, verifyLicenseFile, writeLicenseText } from "./registry.ts";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

export default defineGovernance({
  root: ROOT,
  version: "0.0.1",
  commands: [
    { name: "resolve", summary: "where the licence texts and their pinned registry live" },
    {
      name: "get",
      summary: "the pristine, verified text of a pinned SPDX id — cache-first, network fallback",
      flags: [{ name: "out", type: "string", description: "write to this file instead of stdout" }],
    },
    {
      name: "verify",
      summary: "is this file really that license? (the copyright holder may vary, nothing else)",
      flags: [{ name: "id", type: "string", description: "the SPDX id to verify against — omit to identify it" }],
    },
    { name: "list", summary: "every pinned SPDX id" },
  ],
  run: async (context, base) => {
    if (context.command === "get") {
      const id = context.args[0];
      if (id === undefined) return { code: 2, summary: "license get needs an SPDX id — vibe-ops license get <id>" };
      try {
        const { text, fromCache } = await fetchLicenseText(ROOT, id);
        const out = context.flags.out as string | undefined;
        if (out !== undefined) {
          writeLicenseText(out, text);
          if (context.surface === "cli") context.log(`wrote ${out} (${id}, verified${fromCache ? ", cached" : ""})`);
          return { code: 0, summary: `wrote ${out} (${id}, verified)`, data: { id, path: out, fromCache } };
        }
        // `> LICENSE` PRODUCES A FILE THAT IS NOT THE LICENCE, so the redirect is refused rather than
        // served. Everything this CLI prints on a terminal carries a summary footer, and a licence text
        // is the one output where a trailing decoration is not cosmetic: the file no longer matches its
        // own pinned digest, at exit 0, and the shell verb this replaced printed the pristine text.
        // `--out` writes byte-exact and is what the skill already documents.
        if (context.surface === "cli") {
          return {
            code: 2,
            summary: `license get writes a file, not a stream — vibe-ops license get ${id} --out LICENSE (a redirect would capture this CLI's own summary lines into the licence)`,
          };
        }
        return { code: 0, summary: `${id}, verified${fromCache ? " (cached)" : ""}`, data: { id, text, fromCache } };
      } catch (error) {
        return { code: (error as Error).message.includes("no pinned source") ? 2 : 3, summary: (error as Error).message };
      }
    }

    if (context.command === "verify") {
      const file = context.args[0];
      if (file === undefined) return { code: 2, summary: "license verify needs a file — vibe-ops license verify <file>" };
      try {
        const id = context.flags.id as string | undefined;
        const result = verifyLicenseFile(ROOT, file, id);
        if (result.ok) {
          const summary =
            id === undefined
              ? `OK ${file} is ${result.matchedId}`
              : `OK ${file} is ${id} (copyright holder and formatting may differ; every operative word matches)`;
          if (context.surface === "cli") context.log(summary);
          return { code: 0, summary, data: result };
        }
        const summary =
          id === undefined
            ? `FAIL ${file} matches no pinned license (canonical digest ${result.gotDigest})`
            : `FAIL ${file} is NOT ${id} — this file is not the license it claims to be`;
        if (context.surface === "cli") context.warn(summary);
        return { code: 1, summary, data: result };
      } catch (error) {
        return { code: 2, summary: (error as Error).message };
      }
    }

    if (context.command === "list") {
      const ids = [...readRegistry(ROOT).keys()];
      if (context.surface === "cli") for (const id of ids) context.log(id);
      return { code: 0, summary: `${ids.length} pinned id(s)`, data: { ids } };
    }

    // `canonicalText` is exercised through `verify`, never a command of its own — `digest` in the
    // retired shell script had no caller outside this file's own `verify`/`pin`, and `pin` (adding a
    // NEW pinned source) stays a maintainer-only, run-from-a-checkout operation: a pin that has to last
    // belongs in this working tree, committed and released, never in an installed consumer's clone.
    return base(context);
  },
});

export { canonicalText, fetchLicenseText, readRegistry, verifyLicenseFile, writeLicenseText } from "./registry.ts";
export type { FetchResult, LicenseSource, VerifyResult } from "./registry.ts";
