// The eita seam. A module that declares `emits` records observations; everything else has no emitter
// and cannot record by accident.
//
// eita's doctrine holds here without modification: a producer records WHAT WAS OBSERVED and never
// scores, ranks or grades it. There is deliberately no `severity`, no `pass`, no `score` on this
// interface — the consuming product applies its own thresholds. A field for a verdict would be used.
//
// One JSON object per line, appended. The format is the same gate-artifact shape the shell gate's
// gate-emit.sh already writes, so both producers land in one registry.

import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";

export interface Observation {
  /** Which declared observation this is. Must appear in the module's `emits`. */
  readonly id: string;
  /** What was observed. Free-form but stable per id — a consumer keys off it. */
  readonly value: unknown;
  /** Where it was observed, repo-relative when it has a location at all. */
  readonly subject?: string;
  readonly tags?: readonly string[];
}

export type Emitter = (observation: Observation) => Promise<void>;

export interface EmitterOptions {
  readonly artifactDir: string;
  readonly moduleId: string;
  readonly moduleVersion: string;
  readonly repoRoot: string;
  readonly declared: readonly string[];
  /** Injected rather than read from the clock, so a run is reproducible in a test. */
  readonly now: () => string;
}

export function createEmitter(options: EmitterOptions): Emitter {
  const declared = new Set(options.declared);
  const file = path.join(options.artifactDir, `${options.moduleId}.jsonl`);
  let ready = false;

  return async (observation) => {
    if (!declared.has(observation.id)) {
      // Undeclared means the definition and the code disagree. Failing loudly here is the only way
      // that disagreement ever surfaces — a silently accepted id would make `emits` decorative.
      throw new Error(
        `module "${options.moduleId}" emitted "${observation.id}", which it does not declare in emits`,
      );
    }
    if (!ready) {
      await mkdir(options.artifactDir, { recursive: true });
      ready = true;
    }
    const record = {
      observedAt: options.now(),
      producer: `${options.moduleId}@${options.moduleVersion}`,
      repo: path.basename(options.repoRoot),
      id: observation.id,
      subject: observation.subject,
      value: observation.value,
      tags: observation.tags,
    };
    await appendFile(file, `${JSON.stringify(record)}\n`, "utf8");
  };
}
