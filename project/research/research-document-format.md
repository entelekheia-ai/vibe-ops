# Research — what a research document must carry that a later reader cannot reconstruct

Feeds [Plan-004](../plans/004-new-research-skill.md), and answers the two questions that plan left open:
whether research is numbered or dated, and whether it has a lifecycle at all.

Re-read when three investigations have been written under the shape proposed here. Until then the central
claim — that the required fields get filled with substance rather than with filler — is a prediction, not
a measurement.

> **Attribution.** External findings are **linked inline at first use** — follow the link for the original
> claim. Anything *not* linked is our own analysis: the eight-gap diagnosis, the mapping of each published
> standard onto the artifact type, the three-level confidence scale as worded, and the decision of what to
> reject. The audit quoted below is ours, over a corpus of research written without a template.

## The gap

`project/research/` is the one folder in the governance skeleton with no skill and no template behind it.
Every other artifact type is scaffolded and has a lifecycle: an ADR is immutable once accepted, an RFC has
stage gates, a plan is permanent, a task dossier is deleted at closure. Research has none of that written
down, so each investigation invents its own shape.

The obvious reading is that this is a structure problem — sections in the wrong order, fields missing from
a header. It is not. Compared against generic spike templates, a hand-written research document that dates
itself and separates a private from a public layer is already ahead. What is missing is of a different
kind: **a reader cannot tell what the document concluded, how firmly, or when the conclusion dies**, and
none of the three can be recovered later by anyone but the author.

## What published standards contribute

[**ICD 203**](https://www.intelligence.gov/assets/documents/intelligence-community-directives/ICD_203.pdf),
the analytic standard governing US intelligence products, is the closest fit available, for a structural
reason: it governs exactly this genre — a document that feeds a decision under uncertainty, drawing on
sources of unequal quality. Three of its requirements have no equivalent in ordinary engineering research:

- **Fact, assumption and judgment are separated**, and an assumption that carries the argument is stated as
  one, together with what changes if it does not hold.
- **Confidence and likelihood are two different uncertainties**, and the directive forbids putting them in
  the same sentence: how likely something is describes the world, how confident you are describes the
  judgment, and fusing them communicates neither.
- **Alternatives are analysed**, each with the indicator that would shift the choice between them.

[**PRISMA-S**](https://library-guides.imperial.ac.uk/systematic-review/documenting_search) contributes one
thing, and it is the one most often missing: the search is recorded **as run** — the literal query, the
tool, the date executed, the number of results — never paraphrased. Without it, "this does not exist" and
"this was not looked for" are indistinguishable to every later reader.

The [**technical spike template**](https://microsoft.github.io/code-with-engineering-playbook/design/design-reviews/recipes/templates/template-technical-spike/)
in Microsoft's engineering playbook is thin, with one exception worth taking: `Conclusions` is a mandatory
section, and it answers the question the spike opened with.

The [**epistemic status**](https://maggieappleton.com/epistemic-disclosure) convention (gwern, later Slate
Star Codex) is the lightweight form of the same idea — a sentence at the top about how much effort went in
and how sure the author is.

[**Research repositories**](https://www.nngroup.com/articles/research-repositories/) and
[**atomic research**](https://dovetail.com/blog/atomic-research/) have nothing to say about the document
and something important to say about the **index**: a repository of research is useless if the finding is
not legible without opening the file.

## What an audit of untemplated research showed

We audited a corpus of roughly fifteen investigations written by hand over about two months. Eight gaps,
in order of what they cost:

1. **Not one document opened with its conclusion.** The single exception had a summary only because it
   began life as a task dossier and was reclassified.
2. **No confidence vocabulary.** "This breaks" and "this probably breaks" carried identical weight.
3. **Measured, assumed and concluded were not distinguished** — though one document had spontaneously
   titled a section "(measured, not read)", which is the ICD 203 distinction reinvented by hand.
4. **Rejected candidates had no reopening trigger.** One document carried a full table of candidates and
   how each failed, and said nothing about what would bring any of them back.
5. **The method was not reproducible.** One document had invented a "traces of the experiment" section; the
   rest had no equivalent, and none recorded what was searched for and where.
6. **Nothing said when the research expires.** A snapshot with no expiry gets believed indefinitely, which
   is precisely the failure that dating the file was supposed to prevent.
7. **Supersession was asserted and had no mechanism.** The convention said research is superseded rather
   than edited, but nothing wrote the pointer back into the superseded file, so anyone opening it directly
   still believed it.
8. **The index carried no conclusion and no status** — a list of titles is a list of files you still have
   to open.

**The pattern across items 3, 4 and 5 is the actual argument.** Three sections appeared spontaneously, each
in exactly one document, none surviving into the next. A convention that gets independently reinvented and
then lost is not a matter of taste — it is a need of the genre that the format was failing to meet.

## The shape that follows

**Four fields, because none of the four can be reconstructed later:**

| Field | What it prevents |
|---|---|
| **The answer**, at the top, three lines at most | A reader with a small budget leaving without the conclusion. It is also the honest place for an investigation that dissolved its own question |
| **Expires when** — an *observable event*, never a duration | Indefinite belief. "When the tool passes version X" is checkable; "in six months" is not |
| **How this was established** — commands and queries as run, versions, execution date, counts | A later reader re-arguing the investigation instead of re-running it |
| **What was rejected, and what would reopen it** | The next person re-running the same comparison from zero, because the document read as if there had never been a choice |

**Two calibration rules that apply throughout.** A measurement is reported and its method recorded; a
judgment is reasoned; an assumption that bridges a gap in the evidence is stated as an assumption and
paired with what changes if it is wrong — tagging the load-bearing ones, which are few, not every sentence.
And confidence labels judgments only, never measurements, and never shares a sentence with a claim about
likelihood:

| Confidence | When |
|---|---|
| **high** | measured here and reproducible, or a primary source the measurement confirms |
| **moderate** | a single unrepeated measurement, or a credible source not verified here |
| **low** | read from documentation, inferred, argued by analogy — nothing was executed |

A document with no `low` anywhere is usually one that stopped labelling, not one that measured everything.

**A lifecycle, which is what Plan-004 asked about.** Research is write-once and dated — named by date on the
private side, by topic where it is published, because a snapshot is referenced by *when* and a published
finding by *what*. Write-once has exactly one legal edit: when a later investigation supersedes it, a
banner goes at the top and nothing else changes. Its index row carries a status:
`valid → to-be-checked → expired | superseded by <link>`. `to-be-checked` is the honest value for research
old enough that the world may have moved under it while nobody looked — it is **not** a placeholder for
"did not read the file".

**Index columns** exist so the conclusion is legible without opening anything: date, link, the conclusion
in one line, what it feeds, status.

## Where our reading contradicts a source

**With PRISMA-S, against our own rule.** Research is reasoning, so the house style is prose over lists.
PRISMA-S wants the query copied and pasted as run. These collide head-on, and the method block is the one
place in the document where literal listing beats prose. Resolved in favour of PRISMA-S there and only
there, rather than split into a compromise that satisfies neither.

**Against the most-adopted artifact in the category.** The largest research-skill suite for coding agents
optimises for producing a paper: LaTeX class selection, citation-format conversion, simulated peer review,
a 0–100 rubric mapped to accept/revise/reject. None of that feeds an architecture decision. Popularity
measures adoption, not fit — and this is the second time the most popular tool in a neighbouring category
has turned out to solve a neighbouring problem.

**Against the epistemic-status convention.** ICD 203 explicitly forbids fusing confidence and likelihood in
one sentence. The epistemic-status format does exactly that, in a single line, and it is the most widely
copied version of the idea on the web. We went with ICD 203.

## What was rejected, and what would reopen it

| Rejected | Why | What would reopen it |
|---|---|---|
| [IMRaD / structured abstracts](https://procomm.ieee.org/transactions-of-professional-communication/for-prospective-authors/guidelines-to-follow/preparing-structured-abstracts/) | Presupposes peer review; these documents feed an ADR or a plan | Research here becoming an external submission |
| [Research compendium](https://book.the-turing-way.org/reproducible-research/compendia/) — separated `data/`, `analysis/`, declared environment | Measurement research already keeps its traces inline; a folder per document costs more than it returns at this scale | A document needing to hand raw data to a third party to reproduce, rather than a command to re-run |
| A 0–100 rubric with decision mapping | A single score hides what decides — and that critique is itself the central finding of two investigations in the corpus | Having to choose between competing investigations at volume |
| A separate reviewer skill | The authoring skill's own checklist covers it; a second skill duplicates the source and then drifts from it | Two consecutive investigations shipping without the required fields |
| Tag taxonomy / atomic nuggets | A corpus this size does not need a taxonomy, it needs a legible index | The index growing past the point where scanning titles works |
| A structured research → ADR handoff schema | A prose "feeds" line already carries it; a schema between artifacts is coupling nobody asked for | An investigation feeding more than two artifacts, or the destination becoming automatic |

## How this was established

Nine web searches and eight sources fetched and indexed, all on one day. Every source that survived into a
claim is linked at first use above; the full set is credited in
[`ACKNOWLEDGEMENTS.md`](../../ACKNOWLEDGEMENTS.md).

**One method limit matters, and it constrains everything quoted above.** The primary ICD 203 PDF did not
yield text — the extractor returned the raw PDF bytes rather than prose — so the nine tradecraft standards
were read through a [secondary explainer](https://legalclarity.org/icd-203-analytic-standards-for-all-source-intelligence/).
The primary wording was **not** verified, and nothing here should be quoted as the directive's own words.

The corpus audit read four documents in full and eleven by structural extraction — header, section list,
tail. Conclusions drawn for those eleven are summaries of head and tail, not checked against the body.

## What is open

- **Whether the four required fields are fillable with substance was not tested.** The predicted failure
  mode is a method section reading "measured locally" and an expiry reading "when things change" — but
  predicting a failure mode is not observing one.
- **The shape was designed against a single corpus.** Whether it fits research folders in repositories with
  different working habits has not been looked at.
- **Existing research was not converted**, deliberately: rewriting the header of an old document falsifies
  what was knowable on the day it was written. Documents still feeding open decisions got the answer and
  the expiry annotated with their own dates; the rest were left alone.
