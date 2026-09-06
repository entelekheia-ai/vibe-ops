// RFC-0004 §4, gate 1: a key held by both the toplevel `declared` layer and the `managed` layer at the
// same directory. Granularity follows R1 — `types.<name>` per name, `ownership` per identical `match`,
// `harness.applied`/`boundary`/`agreed` whole — because a shadow at any finer or coarser grain would
// disagree with what `writeManagedConfig` itself refuses.
//
// Like `disabled-declared`, this gate's subject is the config cascade itself, not a repository-relative
// file an ops handed it through `files` — reading `loadConfig`/`loadLayerFile` directly here is not the
// population-filtering RFC-0001 forbids a gate from doing.

import { defineGate, loadConfig, loadLayerFile } from "@entelekheia/vibe-ops-core";
import type { GateFinding, VibeOpsConfig } from "@entelekheia/vibe-ops-core";
import path from "node:path";

export default defineGate(
  {
    id: "config-shadow",
    version: 1,
    summary: "A key set by both the toplevel declared config and the managed layer at the same shadow",
  },
  async ({ repoRoot }) => {
    const { layers } = await loadConfig(repoRoot);
    const managedRef = layers.find((l) => l.layer === "managed");
    if (managedRef === undefined) {
      return { findings: [], skipped: "no managed layer (vibeops.config.json) in this repository" };
    }
    const managedDir = path.dirname(managedRef.file);
    const declaredRef = layers.find((l) => l.layer === "declared" && path.dirname(l.file) === managedDir);
    if (declaredRef === undefined) {
      return { findings: [], skipped: "no declared config file at the same toplevel as the managed layer" };
    }

    const managed = (await loadLayerFile(managedRef.file)) ?? ({} as VibeOpsConfig);
    const declared = (await loadLayerFile(declaredRef.file)) ?? ({} as VibeOpsConfig);

    const findings: GateFinding[] = [];
    let examined = 0;

    for (const name of Object.keys(managed.types ?? {})) {
      examined += 1;
      if (declared.types?.[name] !== undefined) {
        findings.push({
          rule: "config-shadow",
          evidence: `types.${name} is set in both ${declaredRef.file} and ${managedRef.file}`,
        });
      }
    }

    for (const entry of managed.ownership ?? []) {
      examined += 1;
      if ((declared.ownership ?? []).some((d) => d.match === entry.match)) {
        findings.push({
          rule: "config-shadow",
          evidence: `ownership match "${entry.match}" is set in both ${declaredRef.file} and ${managedRef.file}`,
        });
      }
    }

    for (const key of ["applied", "boundary", "agreed"] as const) {
      if (managed.harness?.[key] === undefined) continue;
      examined += 1;
      if (declared.harness?.[key] !== undefined) {
        findings.push({
          rule: "config-shadow",
          evidence: `harness.${key} is set in both ${declaredRef.file} and ${managedRef.file}`,
        });
      }
    }

    for (const type of Object.keys(managed.records?.dirs ?? {})) {
      examined += 1;
      if (declared.records?.dirs?.[type as keyof typeof declared.records.dirs] !== undefined) {
        findings.push({
          rule: "config-shadow",
          evidence: `records.dirs.${type} is set in both ${declaredRef.file} and ${managedRef.file}`,
        });
      }
    }

    return examined === 0
      ? { findings: [], skipped: "the managed layer holds no key that could shadow the declared one" }
      : { findings, examined };
  },
);
