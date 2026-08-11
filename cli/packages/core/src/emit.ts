// The eita seam. A module that declares `emits` records observations; everything else has no emitter
// and cannot record by accident.
//
// eita's doctrine holds here without modification: a producer records WHAT WAS OBSERVED and never
// scores, ranks or grades it. There is deliberately no `severity`, no `pass`, no `score` on this
// interface — the consuming product applies its own thresholds. A field for a verdict would be used.
//
// THE SHAPE IS THE RECEIVING SIDE'S, NOT OURS. eita's translator validates a header line and refuses an
// artifact that does not open with one; it was written against `gate-emit.sh`, which the shell checks
// have used since before this file existed. This file used to write a different, flat record per
// observation into the same directory — and the consequence was measured on 2026-08-11: the shell path's
// observations are in eita's registry and nothing this emitter ever wrote could be ingested at all. It
// failed at line 1 of every file, silently, for as long as it had existed.
//
//   line 1   {"schemaVersion":1,"kind":"gate","producer":…,"tool":"<gate>@<version>","moment":…,
//             "producedAt":…,"population":{"unit":…,"examined":N}}
//   then     {"kind":"finding","rule":…,"count":N}   — one per rule, counts aggregated, never zero
//
// ONE ARTIFACT PER SIGNAL, not per run. The header carries ONE producer, ONE instrument and ONE
// population, so a file holding two entries' findings would describe neither. A signal's identity is
// the population it was read over (RFC-0001), which makes the emitting ops entry the unit.
//
// `tool` IS THE GATE, WITH ITS OWN VERSION — not the ops's. The ops is the composition; the gate is the
// detector that actually produced the finding, and it is the thing whose change makes two readings under
// one rule incomparable. Recording the composition's version there would give every gate in an ops the
// same instrument, which is the conflation this whole seam exists to remove.
//
// A RULE THAT FOUND NOTHING HAS NO LINE. eita refuses a zero count, on the grounds that a finding line
// saying a rule fired zero times claims it fired. Absence of the line is how "nothing found" is written,
// and `population.examined` is what separates that from "nothing looked at".

import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";

/** Moves when the shape below changes in a way a reader must handle differently. */
export const ARTIFACT_SCHEMA_VERSION = 1;

export interface Observation {
  /** Which declared observation this is. Must appear in the module's `emits`. */
  readonly id: string;
  /** The instrument that produced it, with its own version — `<gate-id>@<version>`. */
  readonly tool: string;
  /** How many subjects were actually examined. Zero is not a reading and is refused by the caller. */
  readonly examined: number;
  /** What `examined` counts — `file`, `record`, … */
  readonly unit: string;
  /** One entry per rule that fired, with how many times. A rule that found nothing is absent. */
  readonly counts: Readonly<Record<string, number>>;
  /** When in the work this was read — `attempt`, `sweep`, … */
  readonly moment: string;
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

    const header = {
      schemaVersion: ARTIFACT_SCHEMA_VERSION,
      kind: "gate",
      producer: observation.id,
      tool: observation.tool,
      moment: observation.moment,
      producedAt: options.now(),
      population: { unit: observation.unit, examined: observation.examined },
      // Ours, and ignored by the receiving side's parser. The composition and the repository are how a
      // reader tells two runs of the same gate apart; the header proper has nowhere to put either.
      composition: `${options.moduleId}@${options.moduleVersion}`,
      repo: path.basename(options.repoRoot),
      ...(observation.tags === undefined ? {} : { tags: observation.tags }),
    };

    const lines = [JSON.stringify(header)];
    for (const [rule, count] of Object.entries(observation.counts)) {
      if (count <= 0) continue;
      lines.push(JSON.stringify({ kind: "finding", rule, count }));
    }

    // One file per signal: the header describes one producer over one population, so two signals in one
    // file would describe neither. The id is the emitting entry's, which is what makes it unique.
    const file = path.join(options.artifactDir, `${options.moduleId}.${observation.id}.jsonl`);
    await appendFile(file, `${lines.join("\n")}\n`, "utf8");
  };
}
