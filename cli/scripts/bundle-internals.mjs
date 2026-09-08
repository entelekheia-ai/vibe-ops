#!/usr/bin/env node
// Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// https://www.apache.org/licenses/LICENSE-2.0
//
// Materialises this workspace's private packages into `packages/cli/node_modules/@entelekheia/` so that
// `bundleDependencies` can pick them up, and removes them again afterwards. Run by the cli package's
// `prepack` and `postpack` hooks — never by hand.
//
// Why it has to exist: npm bundles a dependency only when it finds it in the packing package's OWN
// `node_modules`, and npm workspaces hoist every internal package to the workspace root instead. So the
// tree that `bundleDependencies` names is real at install time and absent at pack time, and npm reports
// the difference by bundling nothing — no warning, no error, a tarball that is simply 250 kB smaller.
//
// Symlinks are dereferenced (`cp -RL` equivalent): the root `node_modules/@entelekheia/*` entries are
// links into `cli/packages/*`, and a link copied as a link resolves to nothing once unpacked elsewhere.
//
//   node cli/scripts/bundle-internals.mjs          materialise
//   node cli/scripts/bundle-internals.mjs --clean  remove
//
// Idempotent in both directions.

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const cliDir = join(repoRoot, 'cli/packages/cli')
const target = join(cliDir, 'node_modules/@entelekheia')
const clean = process.argv.includes('--clean')

if (clean) {
  rmSync(join(cliDir, 'node_modules'), { recursive: true, force: true })
  console.log('bundle-internals: removed cli/packages/cli/node_modules')
  process.exit(0)
}

const packagesDir = join(repoRoot, 'cli/packages')
const internal = []
for (const d of readdirSync(packagesDir)) {
  const manifest = join(packagesDir, d, 'package.json')
  if (!existsSync(manifest)) continue
  const json = JSON.parse(readFileSync(manifest, 'utf8'))
  // Exactly the packages that never reach the registry. A published one is resolved from there, and
  // bundling a copy of it beside the installed one gives the process two instances of the same module.
  // Core reaches these from here because the CLI hands it its own resolver (cli/src/resolve.ts) — not
  // because they sit next to core, which they do not.
  if (json.private === true) internal.push({ name: json.name, dir: join(packagesDir, d) })
}

if (internal.length === 0) {
  throw new Error('no private packages found under cli/packages — nothing to bundle, which is not what this repo looks like')
}

rmSync(join(cliDir, 'node_modules'), { recursive: true, force: true })
mkdirSync(target, { recursive: true })
for (const { name, dir } of internal) {
  // dereference: the entry has to survive being unpacked in someone else's tree
  cpSync(dir, join(target, name.replace('@entelekheia/', '')), { recursive: true, dereference: true })
}

console.log(`bundle-internals: materialised ${internal.length} private package(s) for bundling`)
