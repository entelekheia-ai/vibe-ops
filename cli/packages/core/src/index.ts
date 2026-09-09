export { defineModule, SOURCE_FLAG } from "./module.ts";
export type { ModuleCommand, ModuleDefinition, ModuleFlag, ModulePlugin, ModuleResult } from "./module.ts";
export type { ModuleContext, Surface } from "./context.ts";
export { loadConfig, loadLayerFile, MANAGED_FILENAME, searchPath, settingsFor, STATE_FILENAME, writeManagedConfig } from "./config.ts";
export type { HarnessConfig } from "./config.ts";
export type {
  ConfigLayer,
  LoadedConfig,
  ManagedConfigPatch,
  ManagedWriteRefusal,
  OpsConfig,
  OwnershipNarrowing,
  RecordsConfig,
  RecordType,
  StyleLayer,
  StyleLayerObject,
  StyleBinding,
  StyleStackConfig,
  TypesConfig,
  VibeOpsConfig,
  WriteManagedConfigOptions,
  WriteManagedConfigResult,
} from "./config.ts";
export {
  activateGovernance,
  activateGovernancePackage,
  activatedTemplatePaths,
  DEFAULT_GOVERNANCE_BINDINGS,
  effectiveGovernanceBindings,
} from "./governance-map.ts";
export type { ActivatedGovernance, GovernanceBinding } from "./governance-map.ts";
export { DEFAULT_OPS, effectiveOps, opsSpecifier, loadOpsPlugin } from "./ops-map.ts";
export { createEmitter, UndeclaredObservationError } from "./emit.ts";
export { setHostResolver, resolveFromHost } from "./host-resolver.ts";
export type { HostResolver } from "./host-resolver.ts";
export type { Emitter, EmitterOptions, Observation } from "./emit.ts";
export { defineGate, gateSpecifierFor, loadGate, GATE_PREFIX } from "./gate.ts";
export type { GateDefinition, GateFinding, GateFix, GateOutcome, GatePlugin, GateRunContext } from "./gate.ts";
export { defineOps } from "./ops.ts";
export { deriveOpsEntries } from "./ops-derive.ts";
export { parseOpsDefinition } from "./ops-load.ts";
export type { DerivedOpsEntries, OpsDeriveRule } from "./ops-derive.ts";
export type {
  GovernedSettings,
  OpsDefinition,
  OpsFinding,
  OpsFixture,
  OpsGateEntry,
  OpsPopulation,
  OpsRepair,
  OpsSkip,
} from "./ops.ts";
export {
  excludeByGlobs,
  expandOptionTokens,
  expandPluginToken,
  expandRecordsToken,
  expandTemplateToken,
  expandTokens,
  filterByGlobs,
  resolveArtifactDir,
  recordDirCandidates,
  RECORD_DIRS,
  resolvePluginDir,
  TEMPLATE_DIRS,
  templateCandidates,
  trackedFiles,
} from "./files.ts";
export { allGrammars, grammarForExtension } from "./grammars.ts";
export type { GrammarDescriptor } from "./grammars.ts";
export { createDocumentStore, documentFromText } from "./document.ts";
export type { Document, DocumentStore } from "./document.ts";
export type { Layer, UncoveredLayer } from "./injections.ts";
export { describedText, lineAt, proseText, walkLayersWithHostPositions } from "./position.ts";
export type { HostPositionedLayer } from "./position.ts";
export { BUILTIN_MODULES } from "./builtins.ts";
export type { BuiltinModule } from "./builtins.ts";
