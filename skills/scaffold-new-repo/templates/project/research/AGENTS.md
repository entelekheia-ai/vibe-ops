# AGENTS.md — research/

**Investigations that feed decisions** — spikes, comparisons, gap analyses. Input to an ADR/RFC, not a
commitment to build. A research item may be a single file or a `<topic>/` folder with its notes and a
decision log.

## learnings/

`research/learnings/` holds the **distilled, reusable lessons** extracted from work — one file per lesson,
topic-named, written as a claim ("X is true, proved by Y"). These are the **permanent extract** that
outlives a closed issue or a deleted task dossier. They are an extract, not a second working log.

Use `/vibe-ops:new-learning` to file one; cite the source issue + a `git show <sha>:...` ref so the full
detail stays retrievable.

Keep every file here **self-contained** — no personal-memory slugs, no cross-repo/workspace references; a
committed file must make sense to someone who cloned only this repo.

See [`../../GOVERNANCE.md`](../../GOVERNANCE.md).
