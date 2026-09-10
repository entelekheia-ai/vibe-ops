// The `style` stack composer — RFC-0005 §2.1, Plan-040 Track 4. `types.style` binds an ORDERED STACK of
// layers rather than one package, because a repository wants the default voice for most of what it
// writes and a different one for a plan, a task or a private research note. This file is the whole of
// what "composing" means: parsing both binding spellings, the scope grammar, activating each layer's
// package, and merging what each layer's `style/general.md` + `style/<target>.md` contribute — by
// SECTION, not by file, because a variation should cost only its delta.
//
// RESOLUTION IS THE COMPOSER'S, NEVER THE PACKAGE'S (RFC-0005 §2.1, closed 2026-09-08). `on: "append"`
// and the per-key `rules` map live in the BINDING and are read here; a style package itself owns only
// the section key it declares. This is why `on`/`rules` are fields of `StyleLayerObject` (core's config
// shape) and never appear in a style package's `type.json`.
//
// A COLLISION IS NEVER FATAL. `onCollision` decides how loudly an unresolved one is reported
// (`"error" | "warn" | "off"`, default `"warn"`); the composer always finishes and always returns a
// merged text. The CALLER (the CLI's `records norm` verb) is what turns `"error"` into a non-zero exit —
// this module only reports, the same split every gate/ops pair in this codebase already draws between
// detection and consequence.

import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { activateGovernancePackage, effectiveGovernanceBindings } from "@entelekheia/vibe-ops-core";
import type { StyleBinding, StyleLayer, StyleLayerObject, VibeOpsConfig } from "@entelekheia/vibe-ops-core";
import { RecordsConfigError } from "./layout.ts";

export type StyleSeverity = "error" | "warn" | "off";
export type StyleOn = "append" | "replace";

/** One layer, fully parsed: package name, scope (if any), and the composer's own resolution choices. */
interface NormalizedLayer {
  readonly use: string;
  readonly scope?: { readonly mode: "include" | "exclude"; readonly targets: readonly string[] };
  /** The layer's own default for a key it collides on. `"replace"` unless the binding said `on: "append"`. */
  readonly on: StyleOn;
  /** Whether `on` was WRITTEN in the binding, vs. defaulted here — see `resolved` below: a collision the
   *  binding never mentioned is unresolved even though `on` still reads `"replace"`. */
  readonly onDeclared: boolean;
  readonly rules: Readonly<Record<string, StyleOn>>;
}

export interface StyleOrigin {
  readonly use: string;
  readonly file: string;
}

export interface StyleCollision {
  readonly key: string;
  readonly previous: StyleOrigin;
  readonly incoming: StyleOrigin;
}

export interface StyleSectionResult {
  readonly key: string;
  readonly body: string;
  readonly origins: readonly StyleOrigin[];
}

export interface StyleCompositionResult {
  readonly text: string;
  readonly sections: readonly StyleSectionResult[];
  /** Every unresolved collision found, regardless of `onCollision` — the caller decides what to do with
   *  the list; `off` still returns it, it just means "do not report", never "do not detect". */
  readonly collisions: readonly StyleCollision[];
  readonly onCollision: StyleSeverity;
  /** Anything worth telling the caller that is not a collision: a layer that will not activate, a
   *  `--for` target no activated layer or type declares. Always advisory — never affects `ok`. */
  readonly warnings: readonly string[];
  /** `false` only when `collisions.length > 0` and `onCollision === "error"`. */
  readonly ok: boolean;
}

const DEFAULT_STYLE_LAYERS: readonly StyleLayer[] = ["@entelekheia/governance-style"];

/** `general.md` + `<target>.md` are read from `<package>/style/`, NOT from the package root. RFC-0005
 *  §2.1 said "a directory of fragments, one file per target" and the first implementation read that
 *  directory as the package root — which made `<target>.md` collide with the package's own metadata, and
 *  for one target made it impossible: on a case-insensitive filesystem (APFS, NTFS) `readme.md` OCCUPIES
 *  `README.md`, so a package targeting `readme` could not have a README of its own (issue #31). Naming a
 *  subdirectory fixes the one target that could not coexist and separates shipped content from package
 *  metadata for every other. No `facets` indirection: unlike the other three norm facets, a style
 *  package's content is always these fixed filenames, now under a fixed directory. */
const FRAGMENT_DIR = "style";
const GENERAL_FILE = "general.md";

/** The layer's fragment directory, listed once. `undefined` means it is missing or unreadable — the
 *  caller turns that into a warning, because a layer that ships no `style/` is the one failure mode the
 *  move to a subdirectory creates, and it is otherwise indistinguishable from a layer with nothing to say.
 *  Listing beats a per-file `existsSync` for the reason issue #31 was filed: `existsSync` answers on the
 *  filesystem's case-folding, so it returns true for `README.md` when only `readme.md` exists, which is
 *  how a package's own README got served as its `readme` fragment. */
function listFragments(dir: string): readonly string[] | undefined {
  try {
    return readdirSync(dir);
  } catch {
    return undefined;
  }
}

/** Case-EXACT, against a listing: the names compared are the bytes the filesystem actually stored, so
 *  `README.md` and `readme.md` stay distinct even on a volume that folds their case. A `readdirSync`
 *  entry is always a direct child's basename, so a `name` carrying a path separator matches nothing. */
function readFragment(dir: string, entries: readonly string[], name: string): string | undefined {
  if (!entries.includes(name)) return undefined;
  return readFileSync(path.join(dir, name), "utf8");
}

/** A section's explicit-key marker: an HTML comment on the line right after its heading, stripped from
 *  the merged output. CHOSEN HERE, not specified by RFC-0005 — the RFC says a section may declare an
 *  explicit key without saying how; this is the one convention in this file that is this package's own
 *  invention rather than a transcription of the spec. */
const KEY_COMMENT_RE = /^<!--\s*key:\s*([A-Za-z0-9_-]+)\s*-->\s*$/;
const HEADING_RE = /^##\s+(.+?)\s*$/;
/** The reserved key a file's lead-in occupies. Not writable by a marker — see `parseSections`. */
const PREFACE_KEY = "_preface";

const FRONTMATTER_RE = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/;

function slugify(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/[`*_[\]()]/g, "")
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

interface RawSection {
  readonly key: string;
  readonly body: string;
}

/**
 * Splits one file's content into sections, the merge unit RFC-0005 §2.1 names. A `##` heading opens a
 * new section, keyed by its slug unless the very next line is an explicit-key comment; everything before
 * the first `##` (a `#` title, an intro paragraph) is its own section under the reserved key `"_preface"`
 * — CHOSEN HERE: the RFC never special-cases a file's lead-in, so it is sectioned like anything else
 * rather than needing a second parser. It does NOT merge like anything else: the first applying layer's
 * lead-in is the document's, and a later one is dropped and reported. See the merge loop for why.
 *
 * The key is reserved. A section that claims it with an explicit `<!-- key: _preface -->` marker is
 * refused, because a rule taking the document's title slot is not something a stack can express.
 *
 * A leading YAML frontmatter block (`vibe-ops-reference: …`) is stripped before sectioning — that stamp
 * is the FILE's own version marker, never content to compose into the served text.
 */
function parseSections(content: string): RawSection[] {
  const body = content.replace(FRONTMATTER_RE, "");
  const lines = body.split("\n");
  const sections: RawSection[] = [];
  let current: { key: string; lines: string[] } | undefined;
  let preface: string[] = [];

  const flushPreface = () => {
    if (preface.some((l) => l.trim() !== "")) sections.push({ key: PREFACE_KEY, body: preface.join("\n").trim() });
  };
  const flushCurrent = () => {
    if (current !== undefined) sections.push({ key: current.key, body: current.lines.join("\n").trim() });
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const heading = HEADING_RE.exec(line);
    if (heading) {
      if (current === undefined) flushPreface();
      else flushCurrent();
      let key = slugify(heading[1]!);
      // The marker may sit right after the heading, or after one blank line — either reads naturally;
      // anything past that is content, not a marker, so the scan stops at the first non-blank line.
      let lookahead = i + 1;
      while (lookahead < lines.length && lines[lookahead]!.trim() === "") lookahead++;
      const keyMatch = lookahead < lines.length ? KEY_COMMENT_RE.exec(lines[lookahead]!.trim()) : null;
      // A marker naming the reserved lead-in key is ignored, so a rule cannot take the document's title
      // slot and make the first layer's title vanish for a reason no reader could guess.
      if (keyMatch && keyMatch[1] !== PREFACE_KEY) {
        key = keyMatch[1]!;
        i = lookahead; // consume everything up to and including the marker — never printed
      }
      current = { key, lines: [line] };
    } else if (current !== undefined) {
      current.lines.push(line);
    } else {
      preface.push(line);
    }
  }
  if (current === undefined) flushPreface();
  else flushCurrent();
  return sections;
}

function parseScopeToken(raw: string, source: string): NonNullable<NormalizedLayer["scope"]> {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) {
    throw new RecordsConfigError(`${source} declares an invalid style scope ${JSON.stringify(raw)} — a scope is "{a,b}" or "{^a,b}"`);
  }
  const inner = trimmed.slice(1, -1);
  const exclude = inner.startsWith("^");
  const list = (exclude ? inner.slice(1) : inner)
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s !== "");
  if (list.length === 0) {
    throw new RecordsConfigError(`${source} declares an empty style scope — name at least one target, or drop the scope`);
  }
  return { mode: exclude ? "exclude" : "include", targets: list };
}

/** Splits a short-form layer string into its package and its inline scope suffix, which is spelled two
 *  ways: `"@scope/pkg/{a,b}"` (a `/` before the brace — an npm-scoped name already has slashes, so only
 *  the LAST `/{` before the final `}` is the scope's, never a slash inside the package name itself) or
 *  `"@scope/pkg{^a,b}"` (the brace right after the package name, no slash). */
function splitInlineScope(spec: string): { readonly use: string; readonly scopeRaw?: string } {
  const braceIndex = spec.indexOf("{");
  if (braceIndex === -1) return { use: spec };
  const scopeRaw = spec.slice(braceIndex);
  let use = spec.slice(0, braceIndex);
  if (use.endsWith("/")) use = use.slice(0, -1);
  return { use, scopeRaw };
}

function normalizeLayer(entry: StyleLayer, index: number): NormalizedLayer {
  if (typeof entry === "string") {
    const { use, scopeRaw } = splitInlineScope(entry);
    if (use === "") throw new RecordsConfigError(`types.style layer ${index} names no package: ${JSON.stringify(entry)}`);
    return {
      use,
      scope: scopeRaw === undefined ? undefined : parseScopeToken(scopeRaw, `types.style layer ${index} (${entry})`),
      on: "replace",
      onDeclared: false,
      rules: {},
    };
  }
  const object = entry as StyleLayerObject;
  if (typeof object.use !== "string" || object.use === "") {
    throw new RecordsConfigError(`types.style layer ${index} declares no "use" — a layer object names its package there`);
  }
  return {
    use: object.use,
    scope: object.scope === undefined ? undefined : parseScopeToken(object.scope, `types.style layer ${index} (${object.use})`),
    on: object.on ?? "replace",
    onDeclared: object.on !== undefined,
    rules: object.rules ?? {},
  };
}

/** The short form (`style: [...]`) is exactly the long form with the default `onCollision` — RFC-0005
 *  §2.1 says so explicitly, and this function is that sentence. */
export function parseStyleStack(raw: StyleBinding | undefined): { readonly layers: readonly StyleLayer[]; readonly onCollision: StyleSeverity } {
  if (raw === undefined) return { layers: DEFAULT_STYLE_LAYERS, onCollision: "warn" };
  if (Array.isArray(raw)) return { layers: raw, onCollision: "warn" };
  if (typeof raw === "object" && raw !== null && Array.isArray((raw as { layers?: unknown }).layers)) {
    const stack = raw as { layers: readonly StyleLayer[]; onCollision?: StyleSeverity };
    const severity = stack.onCollision ?? "warn";
    if (severity !== "error" && severity !== "warn" && severity !== "off") {
      throw new RecordsConfigError(`types.style.onCollision must be "error", "warn" or "off", got ${JSON.stringify(stack.onCollision)}`);
    }
    return { layers: stack.layers, onCollision: severity };
  }
  throw new RecordsConfigError(`types.style must be an array of layers or { layers, onCollision } — got ${JSON.stringify(raw)}`);
}

function layerApplies(layer: NormalizedLayer, target: string | undefined): boolean {
  if (layer.scope === undefined) return true;
  // "A caller passing no --for receives the unscoped layers alone" — RFC-0005 §2.1. A layer that
  // declares ANY scope, include or exclude, is not unscoped, so it sits out an unscoped request.
  if (target === undefined) return false;
  return layer.scope.mode === "include" ? layer.scope.targets.includes(target) : !layer.scope.targets.includes(target);
}

/**
 * Composes the served text for one target (or the unscoped layers alone, `target === undefined`) —
 * `records norm --type style --facet policy [--for <target>] [--explain]`'s whole implementation.
 */
export async function composeStylePolicy(
  target: string | undefined,
  config: VibeOpsConfig | undefined,
): Promise<StyleCompositionResult> {
  const raw = config?.types?.["style"] as StyleBinding | undefined;
  const { layers: rawLayers, onCollision } = parseStyleStack(raw);
  const layers = rawLayers.map((entry, index) => normalizeLayer(entry, index));

  const warnings: string[] = [];
  const collisions: StyleCollision[] = [];
  // Insertion order IS section order — a `Map` re-set of an existing key keeps its original position,
  // which is exactly "a repeated key replaces, a new key appends" without a second bookkeeping structure.
  const sections = new Map<string, { body: string; origins: StyleOrigin[] }>();
  const declaredTargets = new Set<string>(Object.keys(effectiveGovernanceBindings(config)));

  for (const layer of layers) {
    if (!layerApplies(layer, target)) continue;

    const activated = await activateGovernancePackage(layer.use, "style");
    if (activated === undefined) {
      warnings.push(`style layer "${layer.use}" is not installed — skipped`);
      continue;
    }
    for (const declared of activated.unit.targets ?? []) declaredTargets.add(declared);

    const files: { readonly name: string; readonly content: string }[] = [];
    const fragmentDir = path.join(activated.root, FRAGMENT_DIR);
    // A LAYER WITH NO `style/` IS REPORTED, NEVER SERVED FROM THE ROOT. The break is clean by decision
    // (ADR-0022) — reading the old layout would mean reading a `readme.md` that may be a README — but a
    // layer that silently contributes nothing looks identical to a layer that had nothing to say for this
    // target, and an unmigrated package is exactly the case someone needs to be told about. Advisory, like
    // every other entry here: it never affects `ok`.
    const entries = listFragments(fragmentDir);
    if (entries === undefined) {
      warnings.push(
        `style layer "${layer.use}" ships no readable ${FRAGMENT_DIR}/ directory — fragments left at the package root are not read (ADR-0022)`,
      );
    } else {
      const general = readFragment(fragmentDir, entries, GENERAL_FILE);
      if (general !== undefined) files.push({ name: GENERAL_FILE, content: general });
      if (target !== undefined) {
        const targetFile = `${target}.md`;
        const fragment = readFragment(fragmentDir, entries, targetFile);
        if (fragment !== undefined) files.push({ name: targetFile, content: fragment });
      }
    }

    for (const file of files) {
      for (const raw_ of parseSections(file.content)) {
        const mode: StyleOn = layer.rules[raw_.key] ?? layer.on;
        const origin: StyleOrigin = { use: layer.use, file: file.name };
        const existing = sections.get(raw_.key);
        if (existing === undefined) {
          sections.set(raw_.key, { body: raw_.body, origins: [origin] });
          continue;
        }

        // THE DOCUMENT'S LEAD-IN IS THE FIRST LAYER'S, AND A LATER ONE IS DROPPED RATHER THAN SWAPPED IN.
        // The default replace rule is right for a RULE — the last layer's wording of "Voice" is the one
        // that applies — and wrong for a title: replacing put the top layer's `# Concise style` heading
        // over a document that is mostly the base layer's content, and appending stacked two `#` titles.
        // Neither is what a reader predicts. The base of a stack names the document; every later lead-in
        // is reported as a collision so the drop is visible, never silent.
        if (raw_.key === PREFACE_KEY) {
          collisions.push({ key: raw_.key, previous: existing.origins[existing.origins.length - 1]!, incoming: origin });
          continue;
        }
        // A `<target>.md` overriding its OWN package's `general.md` is intentional by construction and
        // never a collision — RFC-0005 §2.1.
        //
        // SAME LAYER **AND A DIFFERENT FILE**. Testing the layer alone also exempted a key repeated
        // INSIDE one file, so a package whose `general.md` carried `## Voice` twice kept only the second
        // and reported nothing: silent content loss inside a single authored file, which is the exact
        // thing the collision machinery exists to prevent. Two headings in one file is a mistake, not an
        // override — nobody writes a file intending its own earlier section to disappear.
        const sameLayer = existing.origins.every((o) => o.use === layer.use && o.file !== file.name);
        const resolved = sameLayer || layer.onDeclared || raw_.key in layer.rules;
        if (mode === "append") {
          sections.set(raw_.key, { body: `${existing.body}\n\n${raw_.body}`, origins: [...existing.origins, origin] });
        } else {
          sections.set(raw_.key, { body: raw_.body, origins: [origin] });
        }
        if (!resolved) {
          collisions.push({ key: raw_.key, previous: existing.origins[existing.origins.length - 1]!, incoming: origin });
        }
      }
    }
  }

  // The target vocabulary is advisory (RFC-0005 §2.1): an activated type name is always valid, and any
  // OTHER target is served with a warning rather than refused — never a hard gate.
  if (target !== undefined && !declaredTargets.has(target)) {
    warnings.push(`"${target}" is not declared by any activated type or style layer — served anyway`);
  }

  const orderedSections: StyleSectionResult[] = [...sections.entries()].map(([key, value]) => ({
    key,
    body: value.body,
    origins: value.origins,
  }));

  return {
    text: orderedSections.map((s) => s.body).join("\n\n"),
    sections: orderedSections,
    collisions,
    onCollision,
    warnings,
    ok: !(onCollision === "error" && collisions.length > 0),
  };
}

/** `--explain`'s own line format: one line per section, naming every contributing package and file. */
export function formatStyleExplain(result: StyleCompositionResult): readonly string[] {
  return result.sections.map((s) => `${s.key}: ${s.origins.map((o) => `${o.use}/${o.file}`).join(" + ")}`);
}

/** One line per unresolved collision, naming both claimants — what `onCollision !== "off"` prints. */
export function formatStyleCollisions(result: StyleCompositionResult): readonly string[] {
  return result.collisions.map(
    (c) => `collision on "${c.key}": ${c.previous.use}/${c.previous.file} vs ${c.incoming.use}/${c.incoming.file}`,
  );
}
