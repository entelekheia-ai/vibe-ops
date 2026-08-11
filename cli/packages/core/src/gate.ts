// A gate: one detector, and nothing else.
//
// The unit deliberately does NOT know which repository it is in, which paths it was given, or whether
// anything downstream records what it found. Those three were fused into a shell check fragment, and
// the fusion is what made `60-memory-slugs.sh` apply one detector to a population nobody chose —
// "all tracked markdown" — where the same finding is recurrent on an instruction surface and noise in
// docs/. Splitting them is RFC-0001; a gate is the failure mode, an ops is the population.
//
// Same relationship eita has between a trait and a profile, and for the same reason: a versioned unit
// of observation is recombinable only if it holds no opinion about what it is pointed at.

import type { DocumentStore } from "./document.ts";

/** One thing the gate saw. Never a verdict about the repository — see `level`. */
export interface GateFinding {
  /**
   * Names the FAILURE MODE, never the check — `machine-path`, not `52-machine-paths`. It defaults to
   * the gate's own id, and differs only when one gate detects more than one distinct failure.
   * references/harness-pair.md states this as naming discipline; here it is the field.
   */
  readonly rule: string;
  /** Repository-relative. Absent when the finding is about the repository rather than a file in it. */
  readonly file?: string;
  readonly line?: number;
  /** What was seen, one line, in the words a reader needs to go fix it. */
  readonly evidence: string;
  /**
   * Reporting only. The CLI needs an exit code and a WARN tier, and this is where that lives — it is
   * stripped before anything reaches the emitter, because a producer that records a verdict has
   * already done the consuming product's job for it. A test asserts it never appears in an artifact.
   * Default `fail`.
   */
  readonly level?: "fail" | "warn";
}

export interface GateRunContext {
  readonly repoRoot: string;
  /** Where the target's plugin surface lives — `plugin/` or the root. Resolved once, by the ops. */
  readonly pluginDir: string;
  /** Repository-relative paths, already filtered to this entry's scope by the ops. */
  readonly files: readonly string[];
  /** Whatever the composing ops passed for this entry. A gate validates its own options. */
  readonly options: Readonly<Record<string, unknown>>;
  /**
   * The parsed document behind any file in `files`, built once per run. Required rather than optional
   * so a gate reads structure without a branch for "nobody handed me any" — the store is lazy, so
   * building it costs nothing on a run that never calls `.get()` (`--list`, `--help`). See
   * `document.ts`. `gates/markdown-link` and `gates/breadcrumb` are its first two readers — both walk
   * `document.layers` via `walkLayersWithHostPositions` rather than opening the file a second time.
   */
  readonly documents: DocumentStore;
}

/** One repair a gate's `fix` made. `action` is a one-line description, in the words a reader needs. */
export interface GateFix {
  readonly file: string;
  readonly action: string;
}

export interface GateOutcome {
  readonly findings: readonly GateFinding[];
  /**
   * The population this gate actually looked at, when it is not simply `files.length` — a gate that
   * discovers its own subjects (bridge reads `git ls-files .claude`) is the case this exists for.
   */
  readonly examined?: number;
  /**
   * Set when there was nothing to examine and that is a legitimate state, naming why. A gate that
   * returns no findings over a population of zero must say so: "nothing examined" and "nothing wrong"
   * are indistinguishable in a record, and only one of them is a reading.
   */
  readonly skipped?: string;
}

export interface GateDefinition {
  /** Lowercase, hyphenated. Also the default `rule` on this gate's findings. */
  readonly id: string;
  /**
   * The DETECTOR's version: a whole number, starting at 1, and a different number from the package's
   * semver, which answers a different question. It moves **only on a break** — a change a consumer of
   * this gate's findings cannot absorb silently. Detection made stricter within the same vocabulary does
   * not move it; a gate that starts reporting a category nobody was handling does.
   *
   * It exists because a finding recorded under one `rule` at two different times is not comparable when
   * the detector between them changed, and nothing said so. It travels onto every observation as the
   * instrument that produced it, which is why it is required rather than optional: an absent version is
   * absent exactly where the comparison needs it.
   */
  readonly version: number;
  /** One line, shown by `--list`. */
  readonly summary: string;
  /**
   * The scope this gate works over with no configuration at all. A default, never a constraint: an
   * ops overriding it is the normal case, and is what makes the gate recombinable (RFC-0001, Q1).
   */
  readonly defaultPaths?: readonly string[];
  /** Whether a repair is mechanical rather than a judgement. Declared now; no `--fix` reads it yet. */
  readonly fixable?: boolean;
}

export interface GatePlugin {
  readonly definition: GateDefinition;
  run(context: GateRunContext): Promise<GateOutcome>;
  /** Present only when `definition.fixable` is true — the agreement is enforced at define time. */
  fix?(context: GateRunContext, findings: readonly GateFinding[]): Promise<readonly GateFix[]>;
}

const ID_PATTERN = /^[a-z][a-z0-9-]*$/;

/**
 * Every rule a gate definition must satisfy, in one place, because it is enforced at TWO boundaries and
 * a second copy would drift. `defineGate` is the first — the author's own build. `loadGate` is the
 * second, and it is the one that matters for a gate this repository did not write: nothing obliges a
 * third-party gate to have called `defineGate` at all, and one that exports a bare object reaches the
 * emitter with whatever it happens to carry. That produced `tool: "<id>@undefined"` in a real artifact,
 * which every consumer accepts as a non-empty string — an absent version becoming a plausible record,
 * which is the exact failure this whole seam exists to remove.
 */
export function assertGateDefinition(definition: GateDefinition, where: string): void {
  if (!ID_PATTERN.test(definition.id)) {
    throw new Error(`${where}: gate id "${definition.id}" must be lowercase, starting with a letter`);
  }
  if (typeof definition.summary !== "string" || definition.summary.trim() === "") {
    throw new Error(`${where}: gate "${definition.id}" declares no summary — it would be invisible in --list`);
  }
  // A version that can be absent is absent in exactly the artifact that needed it, and by then the
  // reading it would have qualified is already recorded. A float would also make two versions orderable
  // in ways nobody intended.
  if (!Number.isInteger(definition.version) || definition.version < 1) {
    throw new Error(
      `${where}: gate "${definition.id}" must declare version as a whole number from 1 — ` +
        `got ${String(definition.version)}`,
    );
  }
}

export function defineGate(
  definition: GateDefinition,
  run: (context: GateRunContext) => Promise<GateOutcome>,
  fix?: (context: GateRunContext, findings: readonly GateFinding[]) => Promise<readonly GateFix[]>,
): GatePlugin {
  assertGateDefinition(definition, "defineGate");
  // The declaration and the code cannot silently disagree — the same rule the emitter applies to
  // `emits`. A gate that forgets to declare `fixable: true` would have its fix silently never called;
  // one that declares it and forgets `fix` would report a repair capability nothing backs.
  if (definition.fixable === true && fix === undefined) {
    throw new Error(`gate "${definition.id}" declares fixable: true but defineGate was given no fix()`);
  }
  if (definition.fixable !== true && fix !== undefined) {
    throw new Error(`gate "${definition.id}" was given a fix() but does not declare fixable: true`);
  }
  return fix === undefined ? { definition, run } : { definition, run, fix };
}

/**
 * Turning what an ops entry names into a gate, by convention and dynamic import. Three forms, the same
 * three `resolve.ts` accepts for a module, so there is one convention in this codebase rather than a
 * second one for gates:
 *
 *   budget       -> @entelekheia/vibe-ops-gates/budget   (a built-in, or anyone following it)
 *   @scope/pkg   -> @scope/pkg                            (a third-party gate, verbatim)
 *   ./path       -> that path                             (a gate being developed)
 *
 * Deliberately no registry file: a registry is a second place to forget, and a gate missing from it
 * looks broken rather than absent.
 */
export const GATE_PREFIX = "@entelekheia/vibe-ops-gates/";

export function gateSpecifierFor(name: string): string {
  if (name.startsWith("@") || name.startsWith(".") || name.startsWith("/")) return name;
  return `${GATE_PREFIX}${name}`;
}

export async function loadGate(name: string): Promise<GatePlugin> {
  const specifier = gateSpecifierFor(name);
  let imported: { default?: GatePlugin };
  try {
    imported = (await import(specifier)) as { default?: GatePlugin };
  } catch (cause) {
    throw new Error(
      `cannot load gate "${name}" (resolved to ${specifier}). A built-in gate is a folder under ` +
        `${GATE_PREFIX}; a third-party gate is named by its full package specifier and must be installed.`,
      { cause },
    );
  }
  const gate = imported.default;
  if (gate?.definition === undefined || typeof gate.run !== "function") {
    throw new Error(`${specifier} does not default-export a gate — expected the result of defineGate()`);
  }
  // The definition is re-checked here, not only where it was authored: a gate that never called
  // defineGate reaches this line intact, and `emits` would then record it with whatever it carries.
  assertGateDefinition(gate.definition, specifier);
  return gate;
}
