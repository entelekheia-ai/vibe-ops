// The harness's own block in a repository's .gitignore: the four clone-local config names and the comment
// above them, both shipped by the setup template. The file is `seed` — written once, the repository's
// from then on — but this block is the harness's KEY in it (RFC-0004 §7: a keyed write through the owning
// module is not a file-level write), so `sync` may bring the comment up to date the way it brings the
// managed map up to date: located by the four literal names, rewritten in place, everything else kept
// byte for byte. A block that is not there in the expected shape is left, and said so.

/** The four names, in the order the setup template writes them. Literal, never a glob (RFC-0004 §7). */
export const IGNORE_BLOCK_NAMES = [
  "vibeops.config.local.ts",
  "vibeops.config.local.mjs",
  "vibeops.config.local.js",
  "vibeops.config.local.json",
] as const;

/** The comment the block carries today — the same text as `plugin/skills/setup/templates/root/gitignore`. */
export const IGNORE_BLOCK_COMMENT = [
  "# Clone-local configuration: what is true of one working tree on one machine, layered over the committed",
  "# vibeops.config.*. The .json name is retired — this tooling's own record (which norm was promulgated",
  "# here, the boundary it agreed to) is committed in vibeops.config.json, which must NOT be listed here.",
  "# The four names stay literal: a glob would un-track that file with no error.",
] as const;

export type IgnoreBlockOutcome =
  | { readonly outcome: "unchanged" }
  | { readonly outcome: "rewritten"; readonly text: string }
  | { readonly outcome: "left"; readonly reason: string };

/** The contiguous `#` lines immediately above `index`, as a start index. */
function commentStart(lines: readonly string[], index: number): number {
  let start = index;
  while (start > 0 && lines[start - 1]!.startsWith("#")) start -= 1;
  return start;
}

/**
 * Brings the block to the template's current shape. Two shipped shapes are recognised: the four names
 * together, in order (the template since RFC-0004), and the three executable names together with the
 * `.json` name in a block of its own further down (the template before it — ADR-0015 added the state
 * file as a second block). Either becomes one block of four under the current comment; the comment is
 * every contiguous `#` line immediately above each block, and a blank line that separated the second
 * block goes with it. Anything else — names absent, scattered, or in another order — is left, with the
 * reason, because a block that matches neither shape is one the repository reshaped, and that is theirs.
 */
export function migrateIgnoreBlock(text: string): IgnoreBlockOutcome {
  const lines = text.split("\n");
  const first = lines.indexOf(IGNORE_BLOCK_NAMES[0]);
  if (first === -1) return { outcome: "left", reason: `${IGNORE_BLOCK_NAMES[0]} is not listed` };
  for (let i = 1; i < 3; i += 1) {
    if (lines[first + i] !== IGNORE_BLOCK_NAMES[i]) {
      return { outcome: "left", reason: "the clone-local names are not listed together in the template's order" };
    }
  }
  const start = commentStart(lines, first);
  const fourth = IGNORE_BLOCK_NAMES[3];
  let body: string[];
  if (lines[first + 3] === fourth) {
    // The current shape. Unchanged when the comment already matches.
    const current = lines.slice(start, first);
    if (current.length === IGNORE_BLOCK_COMMENT.length && current.every((line, i) => line === IGNORE_BLOCK_COMMENT[i])) {
      return { outcome: "unchanged" };
    }
    body = lines.slice(first + 4);
  } else {
    // The older shape: the .json name in its own block, further down, with its own comment.
    const json = lines.indexOf(fourth, first + 3);
    if (json === -1) return { outcome: "left", reason: `${fourth} is not listed` };
    let jsonStart = commentStart(lines, json);
    if (jsonStart > 0 && lines[jsonStart - 1] === "") jsonStart -= 1;
    body = [...lines.slice(first + 3, jsonStart), ...lines.slice(json + 1)];
  }
  const next = [...lines.slice(0, start), ...IGNORE_BLOCK_COMMENT, ...IGNORE_BLOCK_NAMES, ...body];
  return { outcome: "rewritten", text: next.join("\n") };
}
