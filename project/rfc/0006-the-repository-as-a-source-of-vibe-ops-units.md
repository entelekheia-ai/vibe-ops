---
vibe-ops-template: rfc@2
---

# RFC-0006: The repository as a source of vibe-ops units

| Field | Value |
|---|---|
| Status | Draft |
| Created | 2026-09-08 |
| Author | Danilo Borges |
| Depends on | RFC-0001 (gates and ops as the unit of composition) |
| Related | ADR-0019 (the config is the registry), Plan-039 |

---

## Summary

A repository can extend vibe-ops with units of its own — a gate, an ops, a module, a governance type —
by putting them in a `.vibe-ops/` directory whose layout mirrors `cli/packages/`, and naming them in
`vibeops.config`. `.vibe-ops/` is to a consumer what `cli/packages/` is to this repository: the place
its own units live. Nothing has to be published, installed, or registered.

## Motivation

Everything vibe-ops composes today has to be an npm package. That was invisible while the only consumer
was this repository, and it became the binding constraint the moment a consumer wanted a detector of its
own:

- **The packages are not published.** A repository that is not this checkout cannot `npm install`
  `@entelekheia/vibe-ops-core`, so a unit written against it cannot load. Measured 2026-09-08 against a
  scratch repository: `Cannot find package '@entelekheia/vibe-ops-core'`.
- **Some units are irreducibly local.** `eita`'s build-order check is about `eita`; `dot-agent`'s
  freeze-status governance is about `dot-agent`. Publishing a package per repository-specific rule is a
  ceremony nobody performs, so the rule stays prose and nothing enforces it.
- **The shell fragment used to be the escape hatch**, and Plan-038 removed it. A repository's own
  `scripts/checks/NN-*.sh` needed no install and no package. Retiring that surface without a successor
  would trade a working local extension point for none.

The workaround that exists — compose a *built-in* gate through a local `ops.json` — covers only the case
where the detection already exists. It does not let a repository write detection of its own.

## Specification

### The directory

```text
<repo>/.vibe-ops/
├── gate-build-order/index.mjs        a detector this repository owns
├── ops-build-order/ops.json          a composition this repository owns
├── module-release-audit/index.mjs    a noun this repository owns
└── governance-freeze-status/         a record type this repository owns
    ├── type.json
    └── templates/
```

The prefix names the kind, exactly as it does under `cli/packages/`. A reader who knows one layout knows
the other, and the kind is legible without opening the file.

### The binding

A unit is named in `vibeops.config` the way its kind already is — the config is the registry (ADR-0019),
and this RFC adds a **source**, not a second registry:

```ts
export default {
  ops: {
    "build-order": {},                       // .vibe-ops/ops-build-order/  — the local one
    audit: "@xpto/vibe-ops-audit",           // a package, unchanged
    legacy: "./tools/ops-legacy/ops.json",   // an explicit path, unchanged
  },
  types: { "freeze-status": {} },            // .vibe-ops/governance-freeze-status/
};
```

`{}` — an empty declaration — means *"the local one"*. It reads as "this name is mine" and leaves room
for per-unit options later without a second syntax.

### Resolution order, and what happens on a collision

For a bare name, in this order:

1. `.vibe-ops/<kind>-<name>/` in the repository being checked.
2. The shipped built-in (`@entelekheia/vibe-ops-<kind>-<name>`, or `…-gates/<name>` for a gate).

A name that exists in both is **reported, not silently resolved**. Shadowing a built-in is a legitimate
thing to want and a terrible thing to do by accident, so it is allowed only when the declaration says so
explicitly — an empty `{}` that would shadow is refused, naming both candidates.

An `@`-prefixed name is a package and a `.`/`/`-prefixed name is a path, both unchanged.

### A local unit imports nothing

This is the property that makes the whole proposal work under the publication freeze, and it already
holds: `loadGate` accepts any object with `{definition, run}` and revalidates the definition itself —
its own comment notes that a gate which never called `defineGate` reaches that line intact. So a local
gate is a plain module:

```js
// .vibe-ops/gate-build-order/index.mjs — no imports
export default {
  definition: { id: "build-order", version: 1, summary: "every package builds after its dependencies" },
  run: ({ files, documents }) => ({ findings: [], examined: files.length }),
};
```

Verified end to end on 2026-09-08 in a scratch repository holding nothing but the CLI on `PATH`: a local
gate composed through a local `ops.json` reported `FAIL [shouting-heading] notes.md:3`.

The same must hold for the other three kinds: a local unit is validated at the boundary that loads it,
never required to have been built against a package it cannot resolve.

## Rationale

**Why a directory convention rather than paths everywhere.** Paths already work for ops and gates
(as of 2026-09-08) and would be enough mechanically. They are rejected as the *primary* form because a
path says where a file is and not what it is: `"./tools/x.mjs"` gives a reader no way to know whether it
is a gate or an ops without opening it, and nothing stops two repositories from inventing two layouts
for the same job. The prefix convention is the one this repository already uses and already teaches.
Paths stay supported for the case the convention does not fit — a unit inside an existing tree, or one
being developed elsewhere.

**Why `{}` rather than `true` or a bare string.** `true` cannot grow options. A bare string is already
taken (it is the package or the path). `{}` is the shape a per-unit options block will have.

**Why refuse a silent shadow.** ADR-0019 made the config the registry precisely so that "who serves this
name" has one answer. A local unit quietly outranking a built-in would make that answer depend on a
directory listing, which is the ambiguity the registry decision removed.

**Why not solve this by publishing.** Publication is a maintainer decision under a stated freeze
(`plugin/AGENTS.md`), and it would not remove the need: a rule about one repository does not belong in a
package the world installs, published or not.

## Implementation Notes

The path half is done and is the prerequisite: `opsSpecifier` (`core/src/ops-map.ts`) and
`gateSpecifierFor` (`core/src/gate.ts`) now resolve a path-like specifier against `repoRoot`.

What this RFC adds, in order:

1. **One resolver**, in core, taking `(kind, name, repoRoot, config)` and returning a specifier. The four
   call sites — `cli/src/resolve.ts` (module and ops), `core/src/gate.ts`, `core/src/governance-map.ts` —
   collapse onto it. Today they are four near-copies of the same three-branch rule, and
   `governance-map.ts` is the odd one out: it accepts no path at all.
2. **The `.vibe-ops/` lookup** and the collision refusal, with a fixture per kind.
3. **`specifierFor` gains `repoRoot`.** A module resolves before the repository root is known
   (`cli/src/bin.ts` loads the module to read its definition, then `runModule` resolves the root), so
   this is a sequencing change rather than an added argument — the reason it was left out of the path
   fix.
4. **The `modules-omits-builtin` gate learns about local units**, or it reports every local module as a
   built-in that went missing.
5. **`new-signal` gains the local recipe** as its default shape, since it becomes the one that works
   everywhere.

## Open Questions

- **Does a local unit get a version, and who checks it?** A gate must declare an integer `version`, and
  the reason is that observations recorded under one rule are comparable only while the detector has not
  moved. For a local gate nobody publishes, is that still the right obligation, or does the repository's
  own git history serve?
- **Does `.vibe-ops/` belong in the ownership boundary?** `harness sync` writes into a target under a
  declared boundary. A directory the repository authors should presumably be `local` and never written
  by promulgation — but that needs stating, not assuming.
- **Does a local ops participate in `harness catalog`'s "composed nowhere" reading?** It should, or a
  local gate that nothing composes goes unreported in the one verb that exists to report that.

## Decisions Closed

- A local unit imports nothing; validation happens where it is loaded. Already true for gates, and the
  property the freeze makes non-negotiable.
- Paths remain supported alongside the convention, rather than being replaced by it.
- The kind is carried by the directory prefix, mirroring `cli/packages/`, rather than by a field inside
  the unit.

## Related

- `project/rfc/0001-gates-and-ops-as-the-cli-unit-of-composition.md` — what a gate and an ops are.
- `project/adr/0019-one-artifact-one-governance-package-activated-by-config.md` — the config is the
  registry; this RFC adds a source under it.
- `project/plans/039-the-ports-that-do-less-than-what-they-replaced.md` — the plan that removed the
  shell fragment as a local extension point without a successor.
