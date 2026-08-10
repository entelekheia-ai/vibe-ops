// The parsed document a gate reads instead of re-opening and re-scanning a file with its own regular
// expression. Three gates asking structural questions of the same markdown file must parse it once,
// and a file the model cannot parse has to say so — a run that silently skipped a file and reported
// success is the failure Plan-010 exists to remove.

import { readFileSync } from "node:fs";
import path from "node:path";
import Parser from "tree-sitter";
import { grammarForExtension } from "./grammars.ts";
import { resolveLayers, type Layer, type UncoveredLayer } from "./injections.ts";

export interface Document {
  /** Repository-relative, matching what every other surface in this codebase already uses. */
  readonly file: string;
  readonly text: string;
  /** The resolved grammar's own scope (e.g. `"text.markdown"`). Absent exactly when `tree` is. */
  readonly languageId?: string;
  /** Absent when no grammar resolved for this file, or the file could not be read — see `uncovered`. */
  readonly tree?: Parser.Tree;
  /** Why there is no `tree`. Never silently absent alongside a missing tree — see the two call sites below. */
  readonly uncovered?: string;
  /** Every region resolved to another grammar (a fenced block, frontmatter, markdown's inline layer). */
  readonly layers: readonly Layer[];
  /** Every named language with no installed grammar, or that hit the recursion depth bound. */
  readonly uncoveredLayers: readonly UncoveredLayer[];
}

export interface DocumentStore {
  get(file: string): Document;
}

// Callback form, always. The string form of `Parser#parse` throws "Invalid argument" once the input
// passes 32,767 bytes — measured against this repository's own tracked files, eight of which already
// do, the largest at 44,328 bytes. Chunk size is arbitrary; 4096 balances call overhead against the
// string-slice cost per callback.
const CHUNK_SIZE = 4096;

export function parseWithGrammar(text: string, language: Parser.Language): Parser.Tree {
  const parser = new Parser();
  parser.setLanguage(language);
  return parser.parse((index) => text.slice(index, index + CHUNK_SIZE));
}

/**
 * One store per run, built once beside `pluginDir` — never per gate. Parses on first `get`, caches by
 * repository-relative path, and never parses eagerly: `trackedFiles` returns the whole repository, a
 * gate scoped to `project/**` must not pay for the rest of it, and a `--file` run must parse exactly
 * the one file it was handed.
 */
export function createDocumentStore(repoRoot: string): DocumentStore {
  const cache = new Map<string, Document>();

  return {
    get(file: string): Document {
      const cached = cache.get(file);
      if (cached !== undefined) return cached;

      let text: string;
      try {
        text = readFileSync(path.join(repoRoot, file), "utf8");
      } catch (cause) {
        // One unreadable file must not take down a run of six gates — it returns a Document like any
        // other, text empty, tree absent, the reason named rather than left for the caller to guess.
        const document: Document = {
          file,
          text: "",
          uncovered: `cannot read file: ${String(cause)}`,
          layers: [],
          uncoveredLayers: [],
        };
        cache.set(file, document);
        return document;
      }

      const extension = path.extname(file).slice(1);
      const grammar = extension === "" ? undefined : grammarForExtension(extension);
      if (grammar === undefined) {
        const named = extension === "" ? "(no extension)" : `.${extension}`;
        const document: Document = {
          file,
          text,
          uncovered: `no grammar declares a file type covering ${named}`,
          layers: [],
          uncoveredLayers: [],
        };
        cache.set(file, document);
        return document;
      }

      const tree = parseWithGrammar(text, grammar.language);
      const { layers, uncoveredLayers } = resolveLayers(grammar, tree, text);
      const document: Document = {
        file,
        text,
        languageId: grammar.scope,
        tree,
        layers,
        uncoveredLayers,
      };
      cache.set(file, document);
      return document;
    },
  };
}
