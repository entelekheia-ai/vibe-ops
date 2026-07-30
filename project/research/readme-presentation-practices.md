# Research — what makes a README worth reading

Feeds [Plan-003](../plans/003-readme-presentation.md).

> **Attribution.** External findings are **linked inline at first use** — follow the link for the
> original claim. Anything *not* linked is our own analysis: measurements we took, and rules derived from
> drafting three READMEs against three different kinds of project. Where our conclusion contradicts a
> published one, that is stated rather than smoothed over.

## The published advice does not agree with itself

[*Art of README*](https://github.com/hackergrrl/art-of-readme) is the canonical essay and the most
demanding. Its argument is that the author's job is to let a reader *evaluate the project as objectively
as possible and decide it does not meet their needs* — explicitly not to maximise downloads or userbase.
It prescribes name, one-liner, usage, API, installation, license, with usage above installation, because
a reader decides from the example rather than from the setup steps.

The contemporary "attractive README" advice pulls the other way. Its most concrete form
([*8 Rules That Got 60k+ Stars*](https://dev.to/iris1031/github-readme-best-practices-how-to-write-a-readme-that-gets-stars-2gb2))
asks for visual proof immediately after the title — a GIF of fifteen to thirty seconds, a screenshot, or
an architecture diagram — badges that build trust rather than vanity metrics, a quick start executable in
about thirty seconds, a features **table** rather than a bullet list, a "why" section carrying a personal
story, and a total length of roughly 500–1500 words. Its named failure modes are a wall of text, no
visuals, a complex setup, and a missing "why". The same body of advice separately warns against
front-loading marketing copy before showing what the thing does, which sits awkwardly beside its own
instruction to open with a story.

[Make a README](https://www.makeareadme.com/) and
[GitHub's documentation](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-readmes)
agree on the questions a README must answer: what the project does, why it is useful, how to get started,
where to get help, who maintains it. GitHub's page adds one mechanical fact worth acting on: it
**auto-generates a table of contents** from the headings, reachable from the "Outline" control on any
rendered Markdown file.

The curated set at [awesome-readme](https://github.com/matiassingers/awesome-readme) describes a de-facto
genre in its own entry summaries: logo or banner, a row of badges, a one-sentence description, a GIF demo,
a table of contents, simple install instructions, links onward.

## What READMEs people actually like are shaped like

Our corpus: three READMEs [WebLLM](https://github.com/mlc-ai/web-llm),
[oMLX](https://github.com/jundot/omlx) and [career-ops](https://github.com/santifer/career-ops) —
selected by this repository's maintainer as ones he found appealing, i.e. chosen for effect before being
analysed — plus the three projects this plugin was drafted against.

All three open with the same six elements, in this order, before any prose:

1. a centred mark (logo or wordmark)
2. an `<h1>`
3. a bold one-line claim, plus one clarifying sentence
4. a centred row of badges
5. a single centred row of navigation links
6. the proof — a visual, or the first substantive section

Two of the three also carry a language-switcher row inside that block. Two of the three use `<picture>`
with `prefers-color-scheme` so the mark renders correctly in both GitHub themes.

All three place a first-person account of why the thing was built **before** the feature list, and two
write it as an italic quote rather than body prose. oMLX: *"Every LLM server I tried made me choose
between convenience and control… That's why I built it."* career-ops: *"I spent months applying to jobs
the hard way. So I engineered the system I wish I had."*

None of the three carries a repository-layout table.

## Where practice contradicts the advice

**Length.** Our measurement: WebLLM is 567 lines / ~3,065 words; oMLX 424 / ~2,349; career-ops 505 /
~3,614. Every README selected as a positive example exceeds the recommended 500–1500-word ceiling, two of
them by more than double. Length is evidently not the variable. The rule worth keeping is about the first
screenful, not the total.

**Navigation.** The auto-generated outline does replace a nested table of contents — but nobody in the set
writes one. oMLX writes a single centred row (`Install · Quickstart · Features · Models · CLI
Configuration · Benchmarks · oMLX.ai`) above the fold, mixing in-page anchors with external destinations.
That is a navigation bar, and the outline does not replace it.

**"Add a visual immediately."** WebLLM — the only pure library in the set — has no image at the top at
all. It leads with prose, then `npm install`, then a code block. This is not an oversight: its output
*is* code, so a code block is its visual proof. The advice generalises from applications to libraries and
breaks in the process.

**Social proof.** career-ops carries a Trendshift badge, a Product Hunt badge, a "FEATURED IN" row with
WIRED and Business Insider, a live star-telemetry chart, and the line *"740+ job listings evaluated · 100+
personalized CVs · 1 dream role landed"*. These are the vanity categories the same advice tells you to
skip. Our reading: they work, for a consumer-facing project seeking adoption, and that is a different goal
from a tool addressed to maintainers. The structural layer underneath — mark, claim, badges, navigation,
proof, why — separates cleanly from them and is what transfers.

## Our conclusions

Not found in any source above; derived from drafting READMEs for a Claude Code plugin, an npm-workspaces
monorepo and an Electron application, and checking which rules survived all three.

**The medium selects the proof.** "Add a visual" is wrong for a library and "show a code example" is
impossible for an application. The generalisable instruction is *show the thing working, in whatever
medium this project's output actually has*: a code block for a library, a terminal transcript or a
before-and-after tree for a CLI or a plugin, a screenshot for a GUI.

**Prefer a proof that can be regenerated from the thing it depicts.** A directory tree produced by running
the tool is text — diffable, reviewable, reproducible when behaviour changes. A recorded GIF is a binary
that nothing verifies and that diverges silently at the first change. This is a preference, not an
absolute: career-ops is the closest structural analogue to a slash-command-driven tool in our corpus, and
its answer is a GIF.

**A screenshot is a privacy surface.** No source surveyed mentions this. A screenshot of a real session
captures whatever was on screen, into the most-read file of a public repository, permanently in git
history. Our first attempt captured a personal email address, a list of former employers, a debug toggle
left on, and a sidebar of throwaway test conversations.

**Brief the shot before it is taken; reviewing it afterwards is a different, weaker control.** Review
catches what is wrong with an image. A brief is what makes it show the right thing. Our first screenshot
was not merely unsafe — it showed a generic chat window and none of the state-machine panel that is the
product's entire differentiator, so it would have sold the application as an ordinary chat client. Taken
against an explicit brief, the second showed live state execution, which no paragraph could replace.
Corollary observed twice: framing an interface for an audience is a review pass on the product. Directing
the second screenshot surfaced three untranslated strings that daily use had stopped seeing.

**Copy a runnable example; never compose one.** The agent writing a README is the one least able to write
the code sample, and the front page is the worst place for invalid syntax. An instruction to "write a
minimal example" invites a fabricated snippet; "copy a runnable example from the repository and shorten
it" cannot produce one. Failure mode already present in our corpus: one README documents dragging `.flow`
files, an extension the project renamed some time ago.

**Where a public site exists, it owns the framing; the README owns the facts.** Site and README routinely
describe the same product differently — one as an open standard, the other as a monorepo of packages — and
an agent writing the README will invent a third claim unless told a canonical one exists. The site is
written deliberately for persuasion and is what a stranger meets first, so it sets the framing. It does
not get to make the README claim something untrue: sites go stale, and describe roadmaps as if shipped.
Where there is no site, the README's opening becomes the canonical claim and any later site inherits it.

**Two inputs cannot be discovered from a working tree**, and a skill that does not ask for them produces
output that looks finished and is wrong: the canonical claim (which may live only on a website with no
repository) and the proof artefact for a GUI (which only a human running the application can produce).

**"Known limitations" is not status narrative.** The distinction worth encoding is between *how the
project is doing* — a roadmap, a progress report — and *how this will break for you*, a failure the reader
hits in their first hour, with a workaround. Only the first belongs elsewhere.

**Contributor material is a third category of leakage.** Build toolchains, workspace commands and release
tagging conventions are neither decision history nor status — the two categories usually named — merely
addressed to the wrong reader. They belong in `CONTRIBUTING.md`.

**The mark is optional; the claim is not.** A skill shipped to other people cannot assume they own a
wordmark, and should not push anyone into commissioning one. The opening degrades cleanly to `<h1>` plus
the claim, which is the one element present in every example examined.
