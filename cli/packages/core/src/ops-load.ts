// The ops collection's canonical form is `.json` — Plan-034 Track 2.
//
// Measured 2026-08-22 before this existed: the three shipped ops' entry lists contained zero functions
// — fixtures are string maps — so the collection was already data that happened to be spelled in
// TypeScript. This parser is what lets the data be the file: an ops package's `ops.json` holds the
// composition, and its `src/index.ts` shrinks to typing sugar — read the file, parse, `defineOps` —
// plus the narrative comments JSON cannot carry.
//
// VALIDATION FOLLOWS defineModule'S PRECEDENT: a definition that describes itself wrongly fails at
// load, naming the file and the field, never at the first run that happens to read the broken half.
// Unknown keys are rejected for the same reason — in a hand-edited data file a typoed optional key
// (`emit` for `emits`) would otherwise compose cleanly and silently not do the thing.
//
// THE PARSER DOES NOT TOUCH THE FILESYSTEM. It takes text plus the name used in errors, so the sugar
// owns the read (`new URL("../ops.json", import.meta.url)` — one level up from src/ and from dist/
// alike) and a test can feed it a string.

import type { OpsDeriveRule } from "./ops-derive.ts";
import type { OpsDefinition, OpsFixture, OpsGateEntry } from "./ops.ts";

const DERIVE_RULES: ReadonlySet<string> = new Set(["record-schema", "template-version"]);

class OpsParseError extends Error {
  constructor(file: string, message: string) {
    super(`${file}: ${message}`);
    this.name = "OpsParseError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireString(parsed: Record<string, unknown>, field: string, file: string, where: string): string {
  const value = parsed[field];
  if (typeof value !== "string" || value === "") {
    throw new OpsParseError(file, `${where} declares no ${field} — a string is required`);
  }
  return value;
}

function rejectUnknownKeys(parsed: Record<string, unknown>, known: readonly string[], file: string, where: string): void {
  for (const key of Object.keys(parsed)) {
    if (!known.includes(key)) {
      throw new OpsParseError(file, `${where} carries an unknown key "${key}" — a typo composes silently, so it is refused`);
    }
  }
}

function stringArray(value: unknown, file: string, where: string): readonly string[] {
  if (!Array.isArray(value) || value.length === 0 || value.some((v) => typeof v !== "string")) {
    throw new OpsParseError(file, `${where} must be a non-empty array of strings`);
  }
  return value as string[];
}

function parseFixture(value: unknown, file: string, where: string): OpsFixture {
  if (!isRecord(value)) throw new OpsParseError(file, `${where} must be an object`);
  rejectUnknownKeys(value, ["files", "expect", "options"], file, where);
  const files = value["files"];
  if (!isRecord(files) || Object.keys(files).length === 0 || Object.values(files).some((v) => typeof v !== "string")) {
    throw new OpsParseError(file, `${where}.files must map at least one path to string contents`);
  }
  const expect = stringArray(value["expect"], file, `${where}.expect`);
  const options = value["options"];
  if (options !== undefined && !isRecord(options)) throw new OpsParseError(file, `${where}.options must be an object`);
  return {
    files: files as Readonly<Record<string, string>>,
    expect,
    ...(options === undefined ? {} : { options }),
  };
}

function parseEntry(value: unknown, file: string, index: number): OpsGateEntry {
  const where = `gates[${index}]`;
  if (!isRecord(value)) throw new OpsParseError(file, `${where} must be an object`);
  rejectUnknownKeys(value, ["gate", "paths", "emits", "options", "label", "fixture"], file, where);
  const gate = requireString(value, "gate", file, where);
  const emits = value["emits"];
  if (emits !== undefined && typeof emits !== "boolean") throw new OpsParseError(file, `${where}.emits must be a boolean`);
  const label = value["label"];
  if (label !== undefined && (typeof label !== "string" || label === "")) {
    throw new OpsParseError(file, `${where}.label must be a non-empty string`);
  }
  const options = value["options"];
  if (options !== undefined && !isRecord(options)) throw new OpsParseError(file, `${where}.options must be an object`);
  return {
    gate,
    ...(value["paths"] === undefined ? {} : { paths: stringArray(value["paths"], file, `${where}.paths`) }),
    ...(emits === undefined ? {} : { emits }),
    ...(options === undefined ? {} : { options }),
    ...(label === undefined ? {} : { label }),
    ...(value["fixture"] === undefined ? {} : { fixture: parseFixture(value["fixture"], file, `${where}.fixture`) }),
  };
}

/** Parses and validates an `ops.json`'s content into the definition `defineOps` takes. */
export function parseOpsDefinition(text: string, file: string): OpsDefinition {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new OpsParseError(file, `not valid JSON: ${(error as Error).message}`);
  }
  if (!isRecord(parsed)) throw new OpsParseError(file, "the collection must be a JSON object");
  rejectUnknownKeys(parsed, ["id", "version", "summary", "derives", "gates"], file, "the collection");

  const id = requireString(parsed, "id", file, "the collection");
  const version = requireString(parsed, "version", file, "the collection");
  const summary = requireString(parsed, "summary", file, "the collection");

  const derives = parsed["derives"];
  if (derives !== undefined) {
    if (!Array.isArray(derives) || derives.some((rule) => !DERIVE_RULES.has(rule as string))) {
      throw new OpsParseError(file, `derives may name only: ${[...DERIVE_RULES].join(", ")}`);
    }
  }

  const gates = parsed["gates"];
  if (!Array.isArray(gates)) throw new OpsParseError(file, "gates must be an array (empty only when derives is not)");
  const entries = gates.map((entry, index) => parseEntry(entry, file, index));

  return {
    id,
    version,
    summary,
    gates: entries,
    ...(derives === undefined ? {} : { derives: derives as OpsDeriveRule[] }),
  };
}
