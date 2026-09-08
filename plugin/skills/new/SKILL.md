---
name: new
description: 'Create one governance record from the repo''s own template and numbering: an ADR (decision record), RFC (design proposal), plan (implementation design with tracks), or task (issue-linked dossier). Use when asked to record a decision, propose a design, plan implementation work, break work into tracks, open a work item, or "/new <type> <topic>". Reads the repo''s own lifecycle.'
argument-hint: "<adr|rfc|plan|task> <topic>"
effort: inherit
---

# /new — Create one governance record

Four record types, one command. Which one to write is a real question, and the wrong answer is expensive:

| Type | Answers | Lifecycle |
|---|---|---|
| `adr` | *what did we decide, and why?* | immutable once accepted; superseded, never edited |
| `rfc` | *should we do X, and how?* | Draft → Accepted → Implemented (frozen) |
| `plan` | *how do we build X?* | permanent design record; the file is never deleted |
| `task` | *what is being worked on right now?* | ephemeral; the dossier is deleted at closure |

If the user did not say which, ask — do not infer from the topic. A misfiled record is worse than a
missing one, because the lifecycle attached to it is wrong from the start.

**This is an event skill** (why that matters: `vibe-ops records norm --type base --facet policy --name convergence --print`). It records that
something happened at a point in time. Running it twice correctly produces two records; it has no update
mode. An existing record is advanced through its own lifecycle, never re-scaffolded.

---

> **Prefer the MCP tool over the terminal.** This plugin ships its own `vibe-ops` MCP server
> (`.claude-plugin/plugin.json`), so the verbs below are tools, and a tool returns its report as
> structured data instead of terminal text to read back. The tool's full name depends on how the server
> was registered — `mcp__vibe-ops__<noun>` from a project `.mcp.json`, `mcp__plugin_vibe-ops_vibe-ops__<noun>`
> when it comes from the plugin. **If neither is listed, the CLI is correct**: the shell forms shown below
> are the same command, and the server may simply not be running in this session.

## Step 0 — Resolve the repo, in one call

**One record type, one spelling.** A type with a noun of its own is resolved through that noun;
everything else is answered by `records` — the shipped types that have no noun, and **a type this tooling
ships nowhere**, which resolves once the repository declares its directory or an installed package
declares the type. Its *layout* answers; its authoring rules arrive with the type's own package, so a
contributed type has none until then and Step 1 says so rather than inventing them.

```bash
vibe-ops plan resolve                 # plan
vibe-ops task resolve                 # task
vibe-ops records resolve --type adr   # adr, and rfc the same way
```

Each prints where records of that type live, which template governs them, which file is the numbering
authority, how many exist, and what number comes next. `plan` and `task` add what is specific to them —
the status chain and living sections for one, the GitHub remote and auth for the other.

**Then read two files it named**, in this order:

1. The type's authoring rules — **the second half of this skill.** Since Plan-033 they travel in the
   type's own governance package, read through the CLI (never through a plugin path, which an npm-only
   install does not have): `vibe-ops records norm --type <type> --facet authoring --print`. They are not
   repeated here, and only the matching type's rules are ever read: every type's rules delivered at once
   is that many times the context for one record.
2. The path in `TPL=`, when you are about to write immediately.

**A typed `/vibe-ops:new <type> …` has already resolved this**, before this skill started: `vibe-ops hook
new-context` runs on the command's expansion and puts the block in context. When it is there, do not run
the command again — it says so in its own first line.

What the output means:

- `DIR=(none)` — this repo keeps no records of that type. Ask whether to create the directory; do not
  create it silently. The default is the `project/<kind>/` layout `/vibe-ops:setup repo` scaffolds.
- `TPL=<path> (config|search)` — the provenance says whether the repository declared it in
  `vibeops.config.ts` or the search order found it. A declared path that does not exist is an error, not a
  fallback.
- `TPL=(none)` — **stop and ask.** Never invent a structure. Offer to copy the matching template from
  `${CLAUDE_PLUGIN_ROOT}/skills/setup/templates/project/templates/`.
- `AUTHORITY=` — the file that overrides this skill on numbering and lifecycle. When it is a path (rather
  than `(default)`), **read it and follow it** over anything here: older repos tie ids to a release train,
  or require follow-ups like an `INDEX.md` row.
- `NEXT=(unknown …)` — records exist but none is numbered the way the resolver understands. That is the
  signal to read `AUTHORITY` and derive the id its way, not to start over at 1.

## Step 1 — Collect what the record needs

**Topic** — from the command argument, else ask for a short phrase. **Author** — `git config user.name`,
asking only if empty. **Date** — `date +%Y-%m-%d`, never guessed.

Each type asks for one more thing (a supersession, an issue, a source document to migrate). The rules
printed in Step 0 say which. Do not proceed until you have it.

## Step 2 — Name the file

Slug is lowercase and hyphen-separated. The filename pattern comes from the type's rules — three of the
four are `<DIR>/<number>-<slug>.md`, and `task` is not always.

## Step 3 — Read the template

Read `TPL`. **Never reproduce a template's structure from memory** — the file is the single source of
truth for section order, formatting, and any license block. It is also where the guidance lives: most of a
template is HTML comments explaining what each section is for, and those comments are the specification
for filling it. This skill deliberately does not restate them.

## Step 4 — Fill it

Starting from the exact template content, and **writing every section in English regardless of the
conversation's language** — that is a product guarantee of this plugin, not a preference.

- **Write it the way this plugin writes** —
  [`${CLAUDE_PLUGIN_ROOT}/references/authoring-style.md`](../../references/authoring-style.md) governs
  every document written into a repository, and a record is one. Two of its sections decide how a plan or
  an RFC reads: **prescriptive over hedged**, and **Diagrams** — a ```mermaid fence earns its place
  wherever the thing being described is a flow with branches, which most of a `Design` section is. Records
  written without ever consulting it come out as prose-only walls; that is the observed failure, not a
  hypothetical one.
- Keep any license comment block at the top unchanged.
- Delete the template's guidance HTML comments.
- Delete optional metadata rows (`Depends on`, `Related`, `Tracking issue`) unless they are really
  populated. Never invent an issue number.
- **Where there is no material for a section, leave the template's stub or a short italic note.** A section
  that looks filled but was fabricated misrepresents how settled the record is, and it is the failure a
  small model reaches for first. This applies hardest to success criteria, tracks and options considered.
- **Apply the exposure contract to the first sentence, not to the finished file.** A record is written
  where the work happens and read wherever the repository ends up — cloned on its own, and public on a day
  nobody re-reads forty governance records first. So no machine path, no repository named that is not this
  one, no pointer to a private companion; anything outside this repository is stated as the *constraint it
  imposes*, never as a name. What may cross, and which section of each of the four types actually leaks, is
  in the exposure policy: `vibe-ops records norm --type classification --facet policy --name exposure --print`.
  This is the one thing in the skill that a later edit cannot repair.

### For a plan: settle the delegation split before writing, and write it down

A plan is where the work gets carried out, so **how** it gets carried out is agreed here, once, and lands
in the `Decision Log` as a decision like any other: which parts may go to a subagent, and which may not.
The usable line is that discovery and mechanical edits under a contract that fits in a paragraph are cheap
to delegate, while a judgement that has to agree with this plan's intent is not — a subagent does not hold
the plan and returns something plausible that drifts.

**Ask, do not assume it.** Whatever is settled goes into the file in the same breath: an agreement that
lives only in the conversation is summarised away at the first compaction, and the agent that proposed it
then breaks it — which is a measured outcome, not a caution.

## Step 5 — Write, then do the type's follow-ups

Write the file. Then whatever the type's rules require afterwards — updating a superseded record, adding
an `INDEX.md` row the authority file asks for, stating a maintenance contract. Those are in the rules from
Step 0.

Do not create an index file unless the repo's own `AGENTS.md` asks for one: an uninstructed index is an
artifact nobody keeps updated.

## Confirming before you write

This skill is model-invocable, so it may fire when the user asked for something adjacent rather than for a
record. Creating a governance record is not reversible in the way an edit is — a number is consumed and,
for an ADR, immutability attaches immediately. **State the type, the path and the number, and get
agreement before writing.**

## Checklist — verify before reporting done

- [ ] The type was chosen by the user, not inferred
- [ ] Step 0 ran once; `AUTHORITY` was read and followed when it was a path
- [ ] File at the path the type's rules specify; the id follows this repo's scheme
- [ ] License block (if the template has one) intact; every guidance comment removed
- [ ] Metadata complete: status, date from `date`, author; unpopulated rows deleted; no invented issue
- [ ] Every section from the template present
- [ ] Sections with no source material left as honest stubs, not invented
- [ ] For a plan: the delegation split was asked about and written into the `Decision Log`, not left in
      the conversation
- [ ] Exposure contract applied while writing: no machine path, no repository named but this one, no
      pointer to a private companion, nothing about this repository's security posture
- [ ] Content written in English
- [ ] No index file created unless the repo asked for one
- [ ] The type's own follow-ups from Step 5 done
