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
 * A `Document` from text that is not (yet) on disk, named by the path it stands for — the extension is
 * what selects the grammar, so the name matters even when nothing is read.
 *
 * Exists because a document can arrive from somewhere other than the filesystem: a plan approved in plan
 * mode reaches a hook as a string in the payload, and it has to be read structurally *before* it is
 * written anywhere. Same code path as the store's own parse, so an in-memory document and a read one are
 * never two slightly different things.
 */
export function documentFromText(file: string, text: string): Document {
  const extension = path.extname(file).slice(1);
  const grammar = extension === "" ? undefined : grammarForExtension(extension);
  if (grammar === undefined) {
    const named = extension === "" ? "(no extension)" : `.${extension}`;
    return { file, text, uncovered: `no grammar declares a file type covering ${named}`, layers: [], uncoveredLayers: [] };
  }

  const tree = parseWithGrammar(text, grammar.language);
  const { layers, uncoveredLayers } = resolveLayers(grammar, tree, text);
  return { file, text, languageId: grammar.scope, tree, layers, uncoveredLayers };
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
        // `resolve`, not `join`: a key here is USUALLY repository-relative and sometimes absolute.
        // `<template:<type>>` expands to the activated governance package's own template — outside
        // repoRoot by construction, and absolute for exactly that reason (files.ts) — whenever the
        // repository holds no copy of its own. `join` glued the two into `<repoRoot>/Users/…`, a path
        // that cannot exist, so `template-version` reported "nothing to compare these records against"
        // over a template that was right there. Invisible in this repository, which keeps its own
        // copies under `cli/packages/governance-*/templates/` and never reaches the absolute branch;
        // five SKIPs in every target that does not. Measured 2026-08-23 (Plan-035 Track 3).
        text = readFileSync(path.resolve(repoRoot, file), "utf8");
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

      const document = documentFromText(file, text);
      cache.set(file, document);
      return document;
    },
  };
}
