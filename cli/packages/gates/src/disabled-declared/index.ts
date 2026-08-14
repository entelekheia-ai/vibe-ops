// cli/AGENTS.md's Configuration section: "disabled takes a reason string — never a boolean, so a
// disablement is a ledger entry rather than a silent pass." TypeScript enforces that shape for a
// `vibeops.config.ts` written against `VibeOpsConfig`, but nothing enforces it for a hand-edited `.js`/
// `.mjs` config, where `disabled: { foo: true }` type-checks fine as `any`. This gate is that
// enforcement, read directly.
//
// UNLIKE EVERY OTHER GATE IN THIS PACKAGE, this one's subject is the config cascade itself, not a
// repository-relative file an ops handed it through `files` — there is no population to filter, so
// reading `loadConfig` directly here is not the population-filtering RFC-0001 forbids a gate from doing
// (see cli/AGENTS.md, "a gate must never filter its own population by a repository-specific rule").
//
// Not composed anywhere yet (Plan-025 Track 4 item 6) — which population this belongs to is a separate
// decision.

import { defineGate, loadConfig } from "@entelekheia/vibe-ops-core";
import type { GateFinding } from "@entelekheia/vibe-ops-core";

export default defineGate(
  {
    id: "disabled-declared",
    version: 1,
    summary: "Every settings.<ops>.disabled entry names a reason, never a boolean or an empty string",
  },
  async ({ repoRoot }) => {
    const { config } = await loadConfig(repoRoot);
    const settings = config.settings ?? {};

    const findings: GateFinding[] = [];
    let examined = 0;
    for (const [opsId, raw] of Object.entries(settings)) {
      const disabled = (raw as { disabled?: unknown } | undefined)?.disabled;
      if (disabled === undefined || typeof disabled !== "object" || disabled === null) continue;
      for (const [key, reason] of Object.entries(disabled as Record<string, unknown>)) {
        examined += 1;
        if (typeof reason !== "string" || reason.trim() === "") {
          findings.push({
            rule: "disabled-declared",
            evidence: `settings.${opsId}.disabled.${key} is ${JSON.stringify(reason)} — must be a non-empty reason string`,
          });
        }
      }
    }
    return examined === 0
      ? { findings: [], skipped: "no settings.<ops>.disabled entries in this repository's config" }
      : { findings, examined };
  },
);
