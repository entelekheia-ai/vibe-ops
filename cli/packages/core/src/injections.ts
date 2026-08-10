// A region written in another language — a fenced block, a frontmatter block, markdown's own inline
// layer — becomes its own parsed tree instead of opaque text inside the host's. This reads a grammar's
// own `injections.scm`, resolves each named language to an installed grammar (or records it as
// uncovered), and recurses into what resolves under a depth bound. See
// project/tasks/002-the-injection-resolver.md for the design this implements.

import { readFileSync } from "node:fs";
import Parser from "tree-sitter";
import { type GrammarDescriptor, resolveInjectionLanguage } from "./grammars.ts";
import { parseWithGrammar } from "./document.ts";

/** One resolved injection layer, addressable on its own — the parsed tree of a sub-region. */
export interface Layer {
  /** The resolved grammar's own scope (e.g. `"source.yaml"`). */
  readonly languageId: string;
  /** Byte offset of this layer's span within its immediate parent's own text (not the host document). */
  readonly parentStart: number;
  readonly parentEnd: number;
  readonly tree: Parser.Tree;
  /**
   * Whether this layer came from the grammar's own `injections.scm` or from this workspace's supplement
   * to it (`queries/injections/<scope>.scm`, see `grammars.ts`). A gate wants one walk over every layer
   * regardless of origin; this is the field that answers "what did the supplement add?" without a
   * second, parallel array.
   */
  readonly origin: "declared" | "supplemental";
  /** This layer's own injections, recursed into. */
  readonly layers: readonly Layer[];
  /**
   * This layer's own uncovered injections. Necessary, not merely symmetric with `layers`: markdown's
   * inline grammar injects `html` and `latex` (neither installed here), so an uncovered finding one
   * level into recursion needs somewhere to land other than being silently dropped.
   */
  readonly uncoveredLayers: readonly UncoveredLayer[];
}

/**
 * A span that named a language no installed grammar covers, or that recursion stopped short of
 * resolving. Recorded rather than silently dropped — Plan-010's Track 2 acceptance is exactly this:
 * a named language with no grammar reports `uncovered`, never absent.
 */
export interface UncoveredLayer {
  /** The captured language string, exactly as written (e.g. `"rust"`, not normalized). */
  readonly language: string;
  readonly parentStart: number;
  readonly parentEnd: number;
  readonly reason: "no-grammar" | "depth-limit-reached";
}

interface LayerResult {
  readonly layers: readonly Layer[];
  readonly uncoveredLayers: readonly UncoveredLayer[];
}

const EMPTY_RESULT: LayerResult = { layers: [], uncoveredLayers: [] };

// markdown -> markdown_inline -> html/latex is the one measured case (depth 3, neither html nor latex
// installed here). Fixed and generous rather than configurable: nothing yet needs it higher, and an
// unbounded grammar set is not guaranteed acyclic.
const MAX_INJECTION_DEPTH = 8;

type QueryOrigin = "declared" | "supplemental";

const injectionQueryCache = new Map<string, Parser.Query>();

function loadQuery(queryPath: string, language: Parser.Language): Parser.Query {
  const cached = injectionQueryCache.get(queryPath);
  if (cached !== undefined) return cached;
  const source = readFileSync(queryPath, "utf8");
  const query = new Parser.Query(language, source);
  injectionQueryCache.set(queryPath, query);
  return query;
}

/**
 * Both of a grammar's injection queries, declared and supplemental, run and concatenated identically —
 * no branch here on which one found a match. A grammar with no supplement for its scope simply has one
 * entry, the same as before this mechanism existed.
 */
function injectionQueriesFor(
  grammar: GrammarDescriptor,
): ReadonlyArray<{ readonly query: Parser.Query; readonly origin: QueryOrigin }> {
  const queries: Array<{ query: Parser.Query; origin: QueryOrigin }> = [];
  if (grammar.injectionsPath !== undefined) {
    queries.push({ query: loadQuery(grammar.injectionsPath, grammar.language), origin: "declared" });
  }
  if (grammar.supplementalInjectionsPath !== undefined) {
    queries.push({
      query: loadQuery(grammar.supplementalInjectionsPath, grammar.language),
      origin: "supplemental",
    });
  }
  return queries;
}

interface RawInjection {
  /** `undefined` means the pattern captured content with no named language — opaque, not uncovered. */
  readonly language: string | undefined;
  readonly contentNode: Parser.SyntaxNode;
  readonly origin: QueryOrigin;
}

// `QueryMatch.setProperties` is populated at runtime by every `(#set! injection.language "…")` pattern
// but is not declared anywhere in tree-sitter's own `.d.ts` (checked: zero mentions of "setProperties"
// or "#set" in node_modules/tree-sitter/tree-sitter.d.ts). Verified directly against markdown's own
// injections.scm: `query.setProperties` is an array indexed by pattern number, and each `QueryMatch`
// carries the same shape under `.setProperties` when its pattern has one. The one pattern with none (the
// dynamic fenced-block route) instead captures a node named `injection.language` whose `.text` gives the
// language. Resolving a match's language is uniformly the union of both routes.
type QueryMatchWithSetProperties = Parser.QueryMatch & {
  readonly setProperties?: Readonly<Record<string, string>>;
};

function queryInjections(grammar: GrammarDescriptor, node: Parser.SyntaxNode): readonly RawInjection[] {
  const raw: RawInjection[] = [];
  for (const { query, origin } of injectionQueriesFor(grammar)) {
    for (const match of query.matches(node) as readonly QueryMatchWithSetProperties[]) {
      const contentNode = match.captures.find((c) => c.name === "injection.content")?.node;
      if (contentNode === undefined) continue;
      const language =
        match.setProperties?.["injection.language"] ??
        match.captures.find((c) => c.name === "injection.language")?.node.text;
      raw.push({ language, contentNode, origin });
    }
  }
  return raw;
}

/**
 * Resolves every injection in `tree` (parsed from `text` with `grammar`), recursing into what resolves.
 * `text` is always the text the immediate tree was parsed from — a full document at the top call, a
 * sliced sub-region on every recursive call — so a match's byte offsets are already parent-relative,
 * with no arithmetic needed to make them so.
 */
export function resolveLayers(
  grammar: GrammarDescriptor,
  tree: Parser.Tree,
  text: string,
  depth = 0,
): LayerResult {
  const raw = queryInjections(grammar, tree.rootNode);
  if (raw.length === 0) return EMPTY_RESULT;

  const layers: Layer[] = [];
  const uncoveredLayers: UncoveredLayer[] = [];

  for (const { language, contentNode, origin } of raw) {
    if (language === undefined) continue; // opaque: no language claimed, so no coverage to report

    const parentStart = contentNode.startIndex;
    const parentEnd = contentNode.endIndex;

    if (depth >= MAX_INJECTION_DEPTH) {
      uncoveredLayers.push({ language, parentStart, parentEnd, reason: "depth-limit-reached" });
      continue;
    }

    const resolved = resolveInjectionLanguage(language);
    if (resolved === undefined) {
      uncoveredLayers.push({ language, parentStart, parentEnd, reason: "no-grammar" });
      continue;
    }

    const contentText = text.slice(parentStart, parentEnd);
    const nestedTree = parseWithGrammar(contentText, resolved.language);
    const nested = resolveLayers(resolved, nestedTree, contentText, depth + 1);
    layers.push({
      languageId: resolved.scope,
      parentStart,
      parentEnd,
      tree: nestedTree,
      origin,
      layers: nested.layers,
      uncoveredLayers: nested.uncoveredLayers,
    });
  }

  return { layers, uncoveredLayers };
}
