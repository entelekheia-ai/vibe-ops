# The document model, and why a gate never opens a file

Six of this repository's ten gates ask structural questions of markdown, and none of them opens a file.
This is the narrative around that arrangement — why the parse is shared, why it is *layered*, and how the
three concepts (a gate, an ops, a document) divide work so that no one of them holds an opinion that
belongs to another. The decisions themselves are ADRs and are linked rather than restated; the API is
[`cli/packages/core/README.md`](../../cli/packages/core/README.md#the-document-model).

## What it replaced

A check fragment fuses three things: what it detects, where it looks, and whether the result is worth
recording. `20-links.sh` — retired since Plan-038 Track 7, once its port met the bar — was the honest
example. It found links by deleting everything between backticks and then matching `](...)` on what
remained — correct for its own purpose, because link syntax quoted as code is not a link.

The cost of that approach is not that it is imprecise. It is that **it cannot see a category at all**. An
archival reference in this repository is written as `` `git show <sha>:<path>` `` — inside a code span,
which is precisely what the fragment deletes before it starts looking. A corpus could therefore accumulate
references to commits that no longer resolve, and nothing would ever report it, because the one tool
walking that corpus had removed the evidence in its first line.

Three detectors were needed at once, and all three ask structural questions of the same file: *what is a
link*, *what is a code span*, *where does the metadata block end*. Written separately, each grows its own
approximation of markdown and each approximation is wrong somewhere different. A parser removes the
category instead of improving the approximation — and the measurement said it was safe to rely on: over
173 tracked files, link sets identical to a CommonMark reference implementation, nothing invented and
nothing missed, with links inside code spans excluded because the grammar puts them in different nodes
rather than because a pass removed them.

## Why layered, and who decides the routing

A markdown file is not one language. It holds fenced blocks in other languages, a metadata header in YAML,
and — the part that surprises people — its own inline content, parsed by a *second grammar*. Treating any
of these as plain text means the embedded region is either analysed by the wrong parser or, far more
commonly, silently skipped. A run that skipped a region and reported success is worse than one that
reported nothing, because green over an unread region reads as the region being clean.

So a region written in another language becomes a document of that language, with its own tree, whose
positions map back into the host.

The part worth understanding is **who decides the routing**, because the answer is not "we do". The
grammar that owns an extension ships its own injection query declaring where it embeds other languages.
That is not configuration this repository writes; it is a fact this repository reads. Markdown's own query
settles five cases at once, and the last of them is the one that pays immediately: the block-to-inline
hand-off *is itself an injection*. Implementing the resolver generically therefore **deleted**
special-case code rather than adding it.

That ownership is right, and it is not sufficient. A grammar's authors declare the injections *they*
anticipated a consumer caring about, and markdown's query hands over a paragraph's content but never a
table cell's — so a link written inside a table cell reaches no inline layer and is invisible to anything
reading only the declared layers. Measured on this repository's own corpus: 83 links across 17 files exist
*only* there. The fix is a supplementary query this repository maintains, run beside the grammar's own
rather than instead of it, additive and unable to suppress anything the grammar declares
([ADR-0010](../../project/adr/0010-supplement-injection-queries-not-a-branch-per-grammar-gap.md)).

## Uncovered is not clean

An injected region whose language has no installed grammar is recorded as **uncovered**, never omitted.
This is the whole point of the design and the reason the resolver carries a third outcome instead of two:
a fenced block in a language nobody has a parser for must be *reported as unexamined*, because the failure
this model exists to remove is a tool reporting success over something it never read. Markdown's inline
grammar injects `html` and `latex`, neither installed here, so this is populated on ordinary documents
rather than being a theoretical branch.

The same instinct runs through the layer above. A gate reports `examined`, and an ops refuses to record an
observation over a population of zero, because "nothing examined" and "nothing wrong" are indistinguishable
in a record and only the second is a reading.

## Three concepts, and the opinions each is forbidden

The document model made a second split necessary. Once detection is cheap and shared, the question becomes
what a detector is allowed to know.

| Concept | Owns | Must not hold an opinion about |
|---|---|---|
| **Document** | structure — what the text *is* | what any of it means, or whether it is a problem |
| **Gate** | one failure mode — what is *wrong* | which repository it is in, which files it got, whether anyone records the result |
| **Ops** | population and emission — *what was read*, and whether it is worth a series | how to detect anything |

The gate/ops division is [RFC-0001](../../project/rfc/0001-gates-and-ops-as-the-cli-unit-of-composition.md),
and its motivating case is concrete: the memory-slug detector applied to "all tracked markdown" is
recurrent and worth watching on an instruction surface, and noise in `docs/`. One detector, two
populations, two different meanings — so population cannot be a property of the detector.

The corollary took a live defect to learn. A gate that filters its own files by a repository-specific rule
has quietly taken back the opinion it was forbidden, and the rule then exists in as many copies as there
are gates that remembered it. `**/templates/**` — a shipped template's links resolve in the *target*
repository, never this one — existed in three divergent forms before anyone noticed: the shell runner
filtered it, one gate hardcoded it internally, and a third applied nothing at all. The third was worth 13
false findings the first time an ops ran the set unfiltered. Population is now a typed key on an ops's own
configuration, read by every gate it composes, including gates written by someone who has never seen this
repository ([ADR-0011](../../project/adr/0011-population-belongs-to-configuration-not-a-gate.md)).

**Read by every gate is not the same as identical for every gate**, and the difference is worth stating
because the paragraph above used to say "uniformly" and that reads as a rule. What ADR-0011 decides is
*where* population lives; it says nothing about the entries agreeing. `**/templates/**` was a single `*`
entry for as long as every gate had the same relationship to a shipped template — noise. The first gate
for which a shipped template is the **subject** rather than noise is `template-heading-drift`, which
exists to catch false prose in the copies the setup skill scaffolds into other repositories: excluding
them would hide exactly the population it was built for. `ignore` is additive and has no negation, so
seeing them meant naming the entries that still need the exclusion rather than un-naming the one that
does not. A future reader restoring the blanket entry as a tidy-up would silence that gate, and the run
would still be green.

## What this does not do

The model is not incremental. Every published implementation of layered parsing spends its complexity on
keeping layers current as text changes, and a gate does not need that: one parse per file per run, and the
editing-time path is a single file. Reaching for it would import the hardest part of the problem for none
of the benefit.

It is also not, today, reachable from a browser — the markdown grammar publishes no WebAssembly build —
and it does not decide what any of the forms it reads *should* look like. Detection shipped first
deliberately, so that the decision about a reference's form, when someone makes it, arrives with a working
instrument to measure the corpus it will migrate.

## Reading on

- **Doing it**: [how-to/write-a-gate.md](../how-to/write-a-gate.md)
- **The API**: [`cli/packages/core/README.md`](../../cli/packages/core/README.md#the-document-model)
- **The design record**: [`project/plans/010-the-document-model-under-the-gates.md`](../../project/plans/shipped/010-the-document-model-under-the-gates.md)
