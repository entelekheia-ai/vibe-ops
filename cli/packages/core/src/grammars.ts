// The registry of tree-sitter grammars this workspace knows how to load — read from each grammar
// package's own manifest, never hand-written. A grammar package declares its own `tree-sitter` array
// in `package.json` (`file-types`, `injection-regex`, `injections`), so `".md" -> markdown` is a copy
// of something the package already states, and it is the copy that goes stale the day a grammar adds a
// file type. See project/tasks/001-the-document-model-and-its-sensor.md, item 2, for the two traps
// this file exists to pay for exactly once.

import { createRequire } from "node:module";
import path from "node:path";
import type Parser from "tree-sitter";

const require = createRequire(import.meta.url);

/** One grammar within a package. A package may ship more than one — markdown ships two. */
export interface GrammarDescriptor {
  readonly scope: string;
  /** Extensions with no leading dot, e.g. `"md"`. Empty for a grammar with no file type of its own. */
  readonly fileTypes: readonly string[];
  /** Matches a fence label (```markdown, ```md, …). Read by Track 2, not by anything in this track. */
  readonly injectionRegex?: string;
  /**
   * Absolute path to this grammar's own `injections.scm`, when it declares one. Declared now, read by
   * nobody until Track 2 — which needs it to find the spans a fence or a block hands to another
   * grammar.
   */
  readonly injectionsPath?: string;
  /** The module wrapper `setLanguage` expects — never the raw `.language` object, see the trap below. */
  readonly language: Parser.Language;
}

/** The shape a grammar package's `package.json` `tree-sitter` array holds, one entry per grammar. */
interface RawTreeSitterDescriptor {
  readonly scope: string;
  readonly path: string;
  readonly "file-types"?: readonly string[];
  readonly "injection-regex"?: string;
  readonly injections?: string;
}

/**
 * Every grammar package this workspace pulls in, by npm specifier. Adding a grammar (Track 2's yaml,
 * eventually) means adding one entry here — the resolution below already reads everything else from
 * the package itself.
 */
const GRAMMAR_PACKAGE_NAMES: readonly string[] = ["@tree-sitter-grammars/tree-sitter-markdown"];

/**
 * Which property of the package's default export holds a given descriptor's language wrapper.
 *
 * Not derivable from `raw.path`: a package's `tree-sitter` array names each grammar's directory
 * (`"tree-sitter-markdown"`, `"tree-sitter-markdown-inline"`), but the JS module nests a second
 * grammar under a property (`.inline`) that shares no name with that directory. Mapped explicitly, one
 * scope at a time, rather than guessed.
 */
function resolveLanguageObject(
  packageName: string,
  moduleExport: Record<string, unknown>,
  raw: RawTreeSitterDescriptor,
): Parser.Language {
  if (raw.scope === "text.markdown") return moduleExport as unknown as Parser.Language;
  if (raw.scope === "text.markdown_inline") return moduleExport.inline as Parser.Language;
  throw new Error(
    `grammars.ts does not know how to resolve the language object for scope "${raw.scope}" ` +
      `in ${packageName} — add a case to resolveLanguageObject`,
  );
}

function loadPackage(packageName: string): GrammarDescriptor[] {
  // The module wrapper `setLanguage` needs — passing `moduleExport.language` instead leaves
  // `nodeSubclasses` undefined, and the first node access on the resulting tree throws a TypeError
  // (measured against tree-sitter@0.25.1: `Cannot read properties of undefined (reading '91')`,
  // inside the library's own `unmarshalNode`). It is not a silent shortcut on this pinned runtime.
  const moduleExport = require(packageName) as Record<string, unknown>;
  const manifest = require(`${packageName}/package.json`) as {
    "tree-sitter"?: readonly RawTreeSitterDescriptor[];
  };
  const raw = manifest["tree-sitter"];
  if (raw === undefined || raw.length === 0) {
    throw new Error(`${packageName} declares no "tree-sitter" array in its package.json`);
  }
  // `injections` in the manifest is relative to the package root, not to the descriptor's own `path`
  // subdirectory — resolved once here rather than re-derived by every caller.
  const packageRoot = path.dirname(require.resolve(`${packageName}/package.json`));
  return raw.map((d) => ({
    scope: d.scope,
    fileTypes: d["file-types"] ?? [],
    injectionRegex: d["injection-regex"],
    injectionsPath: d.injections === undefined ? undefined : path.join(packageRoot, d.injections),
    language: resolveLanguageObject(packageName, moduleExport, d),
  }));
}

// Built on first use, not at import time: requiring a grammar package loads its native binding, and a
// `--list` or `--help` run should not pay for that. The same laziness `DocumentStore` applies to
// parsing a file applies here to loading a language at all.
let cachedRegistry: readonly GrammarDescriptor[] | undefined;

function registry(): readonly GrammarDescriptor[] {
  if (cachedRegistry === undefined) {
    cachedRegistry = GRAMMAR_PACKAGE_NAMES.flatMap(loadPackage);
  }
  return cachedRegistry;
}

let cachedExtensionMap: ReadonlyMap<string, GrammarDescriptor> | undefined;

function extensionMap(): ReadonlyMap<string, GrammarDescriptor> {
  if (cachedExtensionMap === undefined) {
    cachedExtensionMap = new Map(registry().flatMap((d) => d.fileTypes.map((ext) => [ext, d] as const)));
  }
  return cachedExtensionMap;
}

/** Every grammar this workspace knows how to load — the population `grammars.test.ts`'s Load test walks. */
export function allGrammars(): readonly GrammarDescriptor[] {
  return registry();
}

/** The grammar declared for a file extension (no leading dot). `undefined` when nothing declares it. */
export function grammarForExtension(extension: string): GrammarDescriptor | undefined {
  return extensionMap().get(extension);
}
