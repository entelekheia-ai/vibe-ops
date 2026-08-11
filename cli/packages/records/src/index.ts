export { resolveRecord } from "./resolve.ts";
export type { ResolvedRecord } from "./resolve.ts";
export { formatResolved } from "./format.ts";
export { findHeaderTable, keysOf, valueOf } from "./header-table.ts";
export { RecordsConfigError, DEFAULT_PAD, DEPTH, CANDIDATE_DIRS, CANDIDATE_TEMPLATES } from "./layout.ts";
export type { NextNumber, Numbering } from "./layout.ts";
export { githubAuth, githubRemote } from "./github.ts";
export type { GithubAuth } from "./github.ts";
export { extractMidArrow, livingSectionsFromTemplate, planActiveFromAuthority, planActiveFromTemplate } from "./plan-fields.ts";
