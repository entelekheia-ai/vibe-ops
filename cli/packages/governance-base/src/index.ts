export { defineGovernance } from "./define-governance.ts";
export type { DefineGovernanceOptions, GovernancePlugin } from "./define-governance.ts";
export { resolveRecord } from "./resolve.ts";
export type { ResolvedLocation, ResolvedRecord } from "./resolve.ts";
export { formatResolved } from "./format.ts";
export { findHeaderTable, keysOf, valueOf } from "./header-table.ts";
export { findLogDir } from "./layout.ts";
export { trackCheckboxes } from "./shape.ts";
export {
  RecordsConfigError,
  DEFAULT_PAD,
  DEPTH,
  depthFor,
  dirCandidatesFor,
  padFor,
  templateCandidatesFor,
  CANDIDATE_DIRS,
  CANDIDATE_TEMPLATES,
  NOT_A_RECORD,
  listMarkdownFiles,
} from "./layout.ts";
export type { NextNumber, Numbering } from "./layout.ts";
export { githubAuth, githubRemote } from "./github.ts";
export type { GithubAuth } from "./github.ts";
export {
  extractLastArrow,
  extractMidArrow,
  livingSectionsFromTemplate,
  planActiveFromAuthority,
  planActiveFromTemplate,
  planTerminalFromAuthority,
  planTerminalFromTemplate,
} from "./plan-fields.ts";
export { entriesUnder, sectionHeadings } from "./shape.ts";
export type { Heading } from "./shape.ts";
export { closureBoxOpen, planClosureBoxOpen, tickClosureBox, tickPlanClosureBox } from "./closure.ts";
export { citationsToBasenames, linksToBasenames, relativeLinks, spliceLinks } from "./links.ts";
export { readFrontmatter } from "./frontmatter.ts";
export type { Frontmatter } from "./frontmatter.ts";
export { readTemplateVersion, VERSION_KEY } from "./template-version.ts";
export { readReferenceVersion, REFERENCE_KEY, routingPolicy } from "./reference-version.ts";
export type { DeclaredVersion } from "./template-version.ts";
export { droppedSections } from "./migration-shape.ts";
export { blocks, compareVersions, describe, dispatchRecord, readMigrationNotes } from "./dispatch.ts";
export type { Dispatch, DispatchOptions, MigrationNote } from "./dispatch.ts";
export type { FoundCitation, FoundLink } from "./links.ts";
export { parseTypeUnit, parseTypeManifest, resolveTypeUnit, resolveTypeUnitAt } from "./type-unit.ts";
export { renderGovernanceRule, renderGovernanceDoc, renderTypeSection, GOVERNANCE_BEGIN, GOVERNANCE_END } from "./render-governance.ts";
export type { RenderableType } from "./render-governance.ts";
export { renderMapTable } from "./render-governance.ts";
export type { GovernanceDocResult } from "./render-governance.ts";
export { composeGovernanceDocuments, activatedTypes, GOVERNANCE_RULE_PATH, GOVERNANCE_DOC_PATH } from "./compose-governance.ts";
export type { GovernanceDocuments } from "./compose-governance.ts";
export type { ResolvedTypeUnit, TypeUnit, TypeUnitCarrier, TypeUnitSchema } from "./type-unit.ts";
export { describeNormType, listMigrationNotes as listNormMigrationNotes, migrationsDirFor, resolveNormFacet } from "./norm-facet.ts";
export type { NormAnswer, NormFacet, NormTypeDescription } from "./norm-facet.ts";
export { composeStylePolicy, formatStyleCollisions, formatStyleExplain, parseStyleStack } from "./style-stack.ts";
export type { StyleCollision, StyleCompositionResult, StyleOrigin, StyleSectionResult, StyleSeverity } from "./style-stack.ts";

// `base` itself is an activatable, policy-only governance (Plan-040 Track 1, RFC-0005 §3): it ships no
// record, only the policy files that used to live under `plugin/references/` —
// `records norm --type base --facet policy --name convergence|migration`. Built with this package's own
// `defineGovernance`, imported locally rather than through the package specifier: this IS
// `@entelekheia/governance-base`, so importing itself would be circular for no reason. Its `type.json`
// declares `facets` and no `template`/`authoring`/`migrations`, which is exactly the policy-only shape
// `parseTypeUnit` now admits.
import { fileURLToPath } from "node:url";
import path from "node:path";
import { defineGovernance } from "./define-governance.ts";

export default defineGovernance({
  root: path.join(path.dirname(fileURLToPath(import.meta.url)), ".."),
  version: "0.0.1",
});
