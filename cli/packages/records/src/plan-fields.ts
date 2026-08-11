// PLAN_ACTIVE and LIVING — read from a plan template's own markers rather than assumed, so a repository
// whose plan template has a different status chain or a different living-section list still gets a
// real answer. Port of resolve-governance.sh's `extract_mid_arrow`, the `Status lifecycle:` line scan,
// the AUTHORITY fallback, and the `LIVING SECTIONS` marker scan — line-based, matching the shell,
// because the markers are plain text (an HTML comment), not markdown structure a tree-sitter parse
// would help with.

const STATUS_LIFECYCLE_MARKER = "Status lifecycle:";
const LIVING_START = "===== LIVING SECTIONS";
const LIVING_END = "===== END LIVING SECTIONS";

/**
 * The middle term of an arrow chain — "Backlog → In Progress → Shipped" returns "In Progress" — via
 * the same middle-of-N rule the shell uses (`mid = (n + 1) / 2`, integer division), so a chain longer
 * or shorter than three states still gets a plausible answer instead of a hardcoded assumption of three.
 */
export function extractMidArrow(line: string): string {
  const terms = line.split("→").map((term) => term.trim());
  const mid = Math.max(1, Math.floor((terms.length + 1) / 2));
  return terms[mid - 1] ?? "";
}

/** The first `Status lifecycle:` line in the template, cut at its first `.`, then its middle term. */
export function planActiveFromTemplate(text: string): string | undefined {
  const line = text.split("\n").find((candidate) => candidate.includes(STATUS_LIFECYCLE_MARKER));
  if (line === undefined) return undefined;
  const afterMarker = line.slice(line.indexOf(STATUS_LIFECYCLE_MARKER) + STATUS_LIFECYCLE_MARKER.length);
  const chain = (afterMarker.split(".")[0] ?? "").trim();
  return chain === "" ? undefined : extractMidArrow(chain);
}

/**
 * Fallback for a repository with no template but a governance rule: the first bare arrow-chain line
 * within 8 lines of a heading naming "Plan"/"plan". Mirrors the shell's awk state machine exactly,
 * including that the heading line itself is never checked for an arrow.
 */
export function planActiveFromAuthority(text: string): string | undefined {
  let near = 0;
  for (const line of text.split("\n")) {
    if (/^#+.*[Pp]lan/.test(line)) {
      near = 8;
      continue;
    }
    if (near > 0) {
      near--;
      if (line.includes("→")) return extractMidArrow(line);
    }
  }
  return undefined;
}

/**
 * Every `## ` heading strictly between the two `LIVING SECTIONS` markers, in document order. `undefined`
 * when either marker is absent or the region between them names no heading — one marker without the
 * other is treated the same as neither, since a consumer must not guess where the list stops.
 */
export function livingSectionsFromTemplate(text: string): readonly string[] | undefined {
  if (!text.includes(LIVING_START) || !text.includes(LIVING_END)) return undefined;

  const sections: string[] = [];
  let inside = false;
  for (const line of text.split("\n")) {
    if (line.includes(LIVING_START)) {
      inside = true;
      continue;
    }
    if (line.includes(LIVING_END)) {
      inside = false;
      continue;
    }
    if (!inside) continue;
    const match = /^## (.+)$/.exec(line);
    if (match) sections.push(match[1]!);
  }
  return sections.length > 0 ? sections : undefined;
}
