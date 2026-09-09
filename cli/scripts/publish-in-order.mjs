#!/usr/bin/env node
// Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// https://www.apache.org/licenses/LICENSE-2.0
//
// Publishes this workspace's packages to npm in dependency order — a dependency always before the
// package that needs it. `npm run release`, and the `publish-script` the release workflow hands to
// changesets/action.
//
// Why not plain `changeset publish`: it publishes with `Promise.all` and no topological ordering, so a
// dependent can land on the registry before the dependency it declares. `npm publish` validates nothing
// about dependencies and would accept that happily — the cost is not the publish call, it is the window
// afterwards, in which the package IS on npm and `npm install` of it fails. For every consumer, and for
// the next `npm ci` in this repository's own workflow.
//
//   node cli/scripts/publish-in-order.mjs             publish what is not yet on the registry
//   node cli/scripts/publish-in-order.mjs --dry-run   print the order and what each would do
//   node cli/scripts/publish-in-order.mjs --otp=123456   an account with 2FA enforced on publish
//
// The OTP is passed to every publish in the run, not re-prompted per package: npm accepts one code for
// a short window, and a run that asked once per package would outlive the code it started with. From CI
// there is no OTP at all — trusted publishing authenticates the workflow itself.
//
// Idempotent: a package whose current version is already on the registry is skipped, so a run after a
// partial failure finishes the remainder instead of starting over. Nothing is ever republished, and no
// version is ever bumped to get past a conflict.

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join, resolve, relative } from 'node:path'
import { execFileSync } from 'node:child_process'

const dryRun = process.argv.includes('--dry-run')
const otp = process.argv.find((a) => a.startsWith('--otp='))?.slice('--otp='.length)
const root = resolve(process.argv.find((a, i) => i > 1 && !a.startsWith('--')) ?? '.')
const read = (f) => JSON.parse(readFileSync(f, 'utf8'))

function workspaceDirs(rootPkg) {
  const globs = Array.isArray(rootPkg.workspaces) ? rootPkg.workspaces : (rootPkg.workspaces?.packages ?? [])
  const out = []
  for (const glob of globs) {
    if (!glob.endsWith('/*')) {
      if (existsSync(join(root, glob, 'package.json'))) out.push(join(root, glob))
      continue
    }
    const base = join(root, glob.slice(0, -2))
    if (!existsSync(base)) continue
    for (const d of readdirSync(base)) {
      const dir = join(base, d)
      if (statSync(dir).isDirectory() && existsSync(join(dir, 'package.json'))) out.push(dir)
    }
  }
  // A workspaces glob matching nothing is not an npm error. It is one here.
  if (out.length === 0) throw new Error(`no package.json under any of: ${globs.join(', ')}`)
  return out
}

const pkgs = new Map()
for (const dir of workspaceDirs(read(join(root, 'package.json')))) {
  const json = read(join(dir, 'package.json'))
  if (json.private === true) continue
  pkgs.set(json.name, { name: json.name, version: json.version, dir })
}

const needs = (name) => {
  const json = read(join(pkgs.get(name).dir, 'package.json'))
  const all = { ...json.dependencies, ...json.peerDependencies, ...json.optionalDependencies }
  return Object.keys(all).filter((d) => pkgs.has(d))
}

const order = []
const state = new Map()
function visit(name, trail) {
  if (state.get(name) === 'done') return
  if (state.get(name) === 'visiting') {
    const loop = trail.slice(trail.indexOf(name)).concat(name).join(' -> ')
    throw new Error(`dependency cycle — every order publishes one member before its dependency: ${loop}`)
  }
  state.set(name, 'visiting')
  for (const dep of needs(name)) visit(dep, [...trail, name])
  state.set(name, 'done')
  order.push(name)
}
for (const name of [...pkgs.keys()].sort()) visit(name, [])

// ── The preflight, and the detection it does NOT carry ──────────────────────────────────────────────
//
// A NAME THAT HAS NEVER BEEN PUBLISHED STOPS THE WHOLE RUN, BEFORE ANYTHING IS PUBLISHED. Trusted
// publishing authenticates against a package that exists and cannot create one, so a run containing a
// new name publishes every package ahead of it in dependency order and then 404s — and publication is
// the one act here that does not undo. Measured 2026-09-09: six packages reached npm at 0.2.0 and the
// seventh stopped the run, leaving `main` declaring versions the registry did not have.
//
// THE DETECTOR IS NOT HERE. `.vibe-ops/gates/registry-first-publish/` owns the question, is composed
// into `vibe-ops check` so it warns while the work is happening, and is imported here so this path
// refuses on the same reading rather than on a second copy of it. Detection is a gate's; what a finding
// costs is the caller's (RFC-0001) — and the cost differs, which is the whole point: a commit is warned,
// a publish is refused.
import { nameOnRegistry } from '../../.vibe-ops/gates/registry-first-publish/index.ts'

const unpublishable = []
for (const name of order) {
  const known = await nameOnRegistry(name)
  // `undefined` is "could not ask", and it is not permission. A release that cannot reach the registry
  // has no business deciding that every name on it is fine — but a DRY RUN is allowed to say so and
  // carry on, because reporting is the whole of what it does.
  if (known === undefined) {
    if (!dryRun) {
      console.error(`refusing: the registry did not answer for ${name} — publishing on an unread boundary is how half a workspace ships`)
      process.exit(1)
    }
    console.log(`?     ${name} — the registry did not answer`)
    continue
  }
  if (!known) unpublishable.push(name)
}
if (unpublishable.length > 0) {
  const verb = dryRun ? 'would refuse to publish' : 'refusing to publish'
  console.error(`${verb}: ${unpublishable.length} package name(s) have never been published, and a workflow cannot create one:\n`)
  for (const name of unpublishable) console.error(`  ${name}`)
  console.error(`\nPublish each once by hand — \`npm publish --access public\` from its directory — then re-run.${dryRun ? '' : ' Nothing was published.'}`)
  // A DRY RUN REPORTS AND DOES NOT REFUSE. It exists to answer "what would this run do", and a refusal
  // that pre-empts the listing answers a question nobody asked — including, here, the question of which
  // packages the refusal is about, which the listing below is the only place to read.
  if (!dryRun) process.exit(1)
  console.error('')
}

/** Already on the registry at this exact version? A 404 means the package or the version is new. */
async function onRegistry(name, version) {
  const res = await fetch(`https://registry.npmjs.org/${name}/${version}`, { method: 'HEAD' })
  if (res.status === 404) return false
  if (res.ok) return true
  throw new Error(`registry answered ${res.status} for ${name}@${version} — not a publish decision to guess at`)
}

let published = 0
let skipped = 0
for (const name of order) {
  const { version, dir } = pkgs.get(name)
  if (await onRegistry(name, version)) {
    console.log(`skip  ${name}@${version} — already on the registry`)
    skipped++
    continue
  }
  if (dryRun) {
    console.log(`would  ${name}@${version}  (${relative(root, dir)})`)
    continue
  }
  console.log(`publish ${name}@${version}`)
  // --access public: required on a scoped package's first publish, harmless after. Provenance is
  // automatic under OIDC from a public repository, so no --provenance flag.
  const args = ['publish', '--access', 'public', ...(otp === undefined ? [] : [`--otp=${otp}`])]
  execFileSync('npm', args, { cwd: dir, stdio: 'inherit' })
  published++
}

console.log(`\n${published} published, ${skipped} already on the registry, ${order.length} total`)
