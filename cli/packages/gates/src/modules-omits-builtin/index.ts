// A declared `modules` list that omits a built-in noun: the MCP server in this repository will not
// expose that noun, silently — `config` and `ownership` arrived after most lists were written. The list
// is the repository's preference (declared, never tool-written), so this only reports; the fix is theirs:
// add the name, or delete the list and inherit every built-in.

import { BUILTIN_MODULES, defineGate, loadConfig, loadLayerFile } from "@entelekheia/vibe-ops-core";
import type { GateFinding } from "@entelekheia/vibe-ops-core";

export default defineGate(
  {
    id: "modules-omits-builtin",
    version: 1,
    summary: "A declared modules list names every built-in noun, or says which it leaves out",
  },
  async ({ repoRoot }) => {
    const { config, layers } = await loadConfig(repoRoot);
    const declared = config.modules;
    if (declared === undefined) return { findings: [], skipped: "no modules list is declared — every built-in is exposed" };
    const missing = BUILTIN_MODULES.filter((name) => !declared.includes(name));
    // Name the file that sets the list — the nearest layer holding `modules` — not every layer read.
    let where = "the configuration cascade";
    for (const layer of layers) {
      const own = await loadLayerFile(layer.file).catch(() => undefined);
      if (own?.modules !== undefined) {
        where = layer.file;
        break;
      }
    }
    const findings: GateFinding[] = missing.map((name) => ({
      rule: "modules-omits-builtin",
      level: "warn", // an omission can be deliberate; the fix is the repository's, and a repository that wants it to block raises it through settings.governance.level
      evidence: `modules (${where}) omits the built-in "${name}" — vibe-ops mcp here will not expose it; add it, or delete the list to inherit every built-in`,
    }));
    return { findings, examined: BUILTIN_MODULES.length };
  },
);
