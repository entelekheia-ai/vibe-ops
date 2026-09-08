// Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// https://www.apache.org/licenses/LICENSE-2.0

/**
 * Where a bare package specifier is resolved FROM.
 *
 * `import("@entelekheia/vibe-ops-gates/budget")` written inside this package resolves against **this
 * module's own location**, and Node's resolution only ever walks *up* from there. That is the right
 * behaviour for a dependency core declares, and the wrong one for the three things core loads by name
 * on someone else's behalf — gates, ops and governance packages — because those belong to the *host*
 * that composed them, not to core.
 *
 * It costs nothing while every package sits in one flat `node_modules`, which is why it went unnoticed:
 * up-from-core and up-from-the-host reach the same directory. They stop being the same the moment the
 * host carries its own copies — an install where the CLI bundles its internals, a pnpm store, a
 * consumer that pins two versions. Core then reports the package as absent, and for governance that is
 * indistinguishable from a type nobody activated, because `activateGovernance` treats a failed import
 * as "not activated" by design.
 *
 * So the host installs its resolver once at startup and core asks it. No resolver means the previous
 * behaviour exactly: the specifier is handed to `import()` untouched.
 */

/** Resolves a bare specifier to a URL, or throws the way `import.meta.resolve` throws. */
export type HostResolver = (specifier: string) => string;

let hostResolver: HostResolver | undefined;

/**
 * Called by the executable that owns the dependency tree — `cli/src/resolve.ts` does it with
 * `import.meta.resolve`, which resolves from the CLI's own module. A library that embeds core passes
 * its own. Calling it twice replaces the resolver; calling it never is supported and is the default.
 */
export function setHostResolver(resolver: HostResolver | undefined): void {
  hostResolver = resolver;
}

/**
 * The specifier to hand `import()`. A relative, absolute or already-resolved URL specifier is returned
 * untouched — those carry their own base and the host has no say in them.
 *
 * A resolver that throws means "the host cannot see this one", and the bare specifier is returned so
 * that `import()` gets its own attempt: the host tree is an additional place to look, never a
 * replacement for core's own. The error the caller finally reports is then `import()`'s, which names
 * the specifier, rather than this layer's, which would name only the lookup.
 */
export function resolveFromHost(specifier: string): string {
  if (specifier.startsWith(".") || specifier.startsWith("/") || specifier.includes("://")) return specifier;
  if (hostResolver === undefined) return specifier;
  try {
    return hostResolver(specifier);
  } catch {
    return specifier;
  }
}
