export { defineModule } from "./module.ts";
export type { ModuleCommand, ModuleDefinition, ModuleFlag, ModulePlugin, ModuleResult } from "./module.ts";
export type { ModuleContext, Surface } from "./context.ts";
export { loadConfig, searchPath, settingsFor } from "./config.ts";
export type { LoadedConfig, RecordsConfig, RecordType, VibeOpsConfig } from "./config.ts";
export { createEmitter } from "./emit.ts";
export type { Emitter, EmitterOptions, Observation } from "./emit.ts";
export { defineGate, gateSpecifierFor, loadGate, GATE_PREFIX } from "./gate.ts";
export type { GateDefinition, GateFinding, GateFix, GateOutcome, GatePlugin, GateRunContext } from "./gate.ts";
export { defineOps } from "./ops.ts";
export type {
  GovernedSettings,
  OpsDefinition,
  OpsFinding,
  OpsGateEntry,
  OpsPopulation,
  OpsRepair,
  OpsSkip,
} from "./ops.ts";
export { excludeByGlobs, expandPluginToken, filterByGlobs, resolvePluginDir, trackedFiles } from "./files.ts";
export { allGrammars, grammarForExtension } from "./grammars.ts";
export type { GrammarDescriptor } from "./grammars.ts";
export { createDocumentStore, documentFromText } from "./document.ts";
export type { Document, DocumentStore } from "./document.ts";
export type { Layer, UncoveredLayer } from "./injections.ts";
export { lineAt, proseText, walkLayersWithHostPositions } from "./position.ts";
export type { HostPositionedLayer } from "./position.ts";
