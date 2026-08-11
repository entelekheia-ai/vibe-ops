# docs/

Implementation documentation, organized by the [Diátaxis](https://diataxis.fr/) framework. Written in
**English**. Each quadrant answers a different reader need — put a doc where its *purpose* fits, not where
its topic fits.

| Folder | Purpose | Reader is… |
|---|---|---|
| [`reference/`](reference/) | Information — precise technical description (APIs, schemas, config) | looking something up |
| [`explanation/`](explanation/) | Understanding — background, design rationale, "why" | trying to understand |
| [`how-to/`](how-to/) | Tasks — goal-oriented recipes | trying to get something done |
| [`tutorials/`](tutorials/) | Learning — step-by-step lessons for newcomers | learning by doing |

The **source of truth is the code**; these docs describe intent. When they diverge, the code wins.

**An API reference belongs beside the code it describes**, so each package documents its own surface and
this folder does not copy it — see [`reference/`](reference/). What lands here is what no single package
owns: the connective narrative, and recipes that cross package boundaries.
