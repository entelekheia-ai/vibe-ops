// Shared between the terminal surface and the hook surface — both parse a module's declared flags
// against raw argv, so the bare-`--fix` rewrite has exactly one copy rather than one per caller.

import type { ModuleFlag } from "@entelekheia/vibe-ops-core";

/**
 * `--fix` alone must mean "everything fixable", but Node's `parseArgs` rejects a bare `--name` on a
 * `string` option — it wants a value token after it. Rewriting `--fix` to `--fix=all` before parsing is
 * what lets `--fix` and `--fix pairing` both parse, as the same option, with different values.
 */
export function applyImplicitFlags(argv: readonly string[], flags: readonly ModuleFlag[]): string[] {
  const implicitFor = new Map(flags.filter((f) => f.implicit !== undefined).map((f) => [`--${f.name}`, f.implicit!]));
  return argv.map((token, i) => {
    const implicit = implicitFor.get(token);
    if (implicit === undefined) return token;
    const next = argv[i + 1];
    return next === undefined || next.startsWith("-") ? `${token}=${implicit}` : token;
  });
}
