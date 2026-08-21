// Writes `<pluginRoot>/types/index.json` from the hand-written manifests under
// `<pluginRoot>/types/<name>/type.json` — Plan-030 Track 1, item 5.
//
// A thin CLI wrapper and nothing else: what the index CONTAINS is `buildTypeIndex` in
// `../src/type-index.ts`, shared with the `type-index-drift` gate that verifies it. This file only
// decides where the bytes go.
//
// Usage: node generate-type-index.ts <pluginRoot> [--write <file>]
// Prints to stdout by default; --write persists to <file>, which is how the committed copy is refreshed.

import path from "node:path";
import { writeFileSync } from "node:fs";
import { buildTypeIndex, serialiseTypeIndex, typeIndexPath } from "../src/type-index.ts";

function main(): void {
  const args = process.argv.slice(2);
  const pluginRoot = args[0];
  if (pluginRoot === undefined) {
    process.stderr.write("usage: generate-type-index.ts <pluginRoot> [--write <file>]\n");
    process.exit(2);
  }

  const output = serialiseTypeIndex(buildTypeIndex(pluginRoot));
  const writeIndex = args.indexOf("--write");
  if (writeIndex === -1) {
    process.stdout.write(output);
    return;
  }
  // `--write` with no path defaults to the index's own home, which is what refreshing it always means.
  const target = args[writeIndex + 1] ?? typeIndexPath(pluginRoot);
  writeFileSync(path.resolve(target), output);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
