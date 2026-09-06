// vibe-ops config — the effective value the cascade produces for a dotted key, which file behind it
// decided that, and every value it shadows (RFC-0004 §1/§3/§4). Four verbs: `get` and `list` answer for
// the convergence policy's `audit` (every read is); `set` and `unset` are the one writer the skills need
// — `types.<name>` only, because every other writable key already has its own verb (`ownership set`,
// `harness sync`).

import { defineModule, loadConfig, loadLayerFile } from "@entelekheia/vibe-ops-core";
import type { LoadedConfig } from "@entelekheia/vibe-ops-core";
import { attributingLayers, effectiveKeys, getPath, originLabel } from "./keys.ts";
import type { LayerRef } from "./keys.ts";
import { isWritableHere, notWritableMessage, setBinding, unsetBinding } from "./write.ts";

interface OriginReport {
  readonly origin?: string;
  readonly shadowedBy: readonly string[];
}

async function originFor(key: string, loaded: LoadedConfig): Promise<OriginReport> {
  const found = await attributingLayers(key, loaded.layers as readonly LayerRef[], loadLayerFile);
  if (found.length === 0) return { shadowedBy: [] };
  const [first, ...rest] = found;
  return { origin: originLabel(first!), shadowedBy: rest.map(originLabel) };
}

function leaveLines(loaded: LoadedConfig): string[] {
  return loaded.leave.map((entry) => `leave ${entry.file}: ${entry.reason}`);
}

export default defineModule(
  {
    id: "config",
    version: "0.0.1",
    summary: "The effective value of a config key, what shadows it, and the one write these skills need (types.<name>)",
    commands: [
      {
        name: "get",
        summary: "the effective value of a dotted key, its origin, and every value shadowed beneath it",
      },
      {
        name: "list",
        summary: "every effective key, and (with --show-origin) the file behind each one",
        flags: [{ name: "show-origin", type: "boolean", description: "print the file behind each effective key, and every leftover file" }],
      },
      {
        name: "set",
        summary: "write types.<name> into the managed layer — every other key belongs to its own verb",
      },
      {
        name: "unset",
        summary: "remove a types.<name> binding from the managed layer",
      },
    ],
    flags: [{ name: "json", type: "boolean", description: "print the structured object instead of lines" }],
  },
  async (context) => {
    if (context.command === "get") {
      const key = context.args[0];
      if (typeof key !== "string" || key === "") {
        return { code: 2, summary: "config get needs a dotted key, e.g. types.plan" };
      }
      const loaded = await loadConfig(context.repoRoot);
      const value = getPath(loaded.config, key);
      if (value === undefined) {
        return { code: 1, summary: `no value set for ${key}` };
      }
      const { origin, shadowedBy } = await originFor(key, loaded);
      if (context.flags.json !== true) {
        context.log(`${key} = ${JSON.stringify(value)}`);
        if (origin !== undefined) context.log(`origin: ${origin}`);
        for (const shadow of shadowedBy) context.log(`shadowed by ${shadow}`);
      }
      return {
        code: 0,
        summary: origin === undefined ? `${key} = ${JSON.stringify(value)}` : `${key} = ${JSON.stringify(value)} (${origin})`,
        data: { key, value, origin, shadowedBy },
      };
    }

    if (context.command === "list") {
      const loaded = await loadConfig(context.repoRoot);
      const showOrigin = context.flags["show-origin"] === true;
      const keys = effectiveKeys(loaded.config);
      const rows: { key: string; value: unknown; origin?: string; shadowedBy?: readonly string[] }[] = [];
      for (const key of keys) {
        const value = getPath(loaded.config, key);
        if (!showOrigin) {
          rows.push({ key, value });
          continue;
        }
        const { origin, shadowedBy } = await originFor(key, loaded);
        rows.push({ key, value, origin, shadowedBy });
      }
      if (context.flags.json !== true) {
        for (const row of rows) {
          context.log(
            showOrigin
              ? `${row.key} = ${JSON.stringify(row.value)}  [${row.origin ?? "unresolved"}]${
                  (row.shadowedBy?.length ?? 0) > 0 ? `  (shadowed by ${row.shadowedBy!.join(", ")})` : ""
                }`
              : `${row.key} = ${JSON.stringify(row.value)}`,
          );
        }
        if (showOrigin) for (const line of leaveLines(loaded)) context.log(line);
      }
      return {
        code: 0,
        summary: `${rows.length} effective key(s)`,
        data: showOrigin ? { keys: rows, leave: loaded.leave } : { keys: rows },
      };
    }

    if (context.command === "set") {
      const key = context.args[0];
      const value = context.args[1];
      if (typeof key !== "string" || key === "" || typeof value !== "string") {
        return { code: 2, summary: "config set needs a key and a value: config set types.<name> <package>, or config set records.dirs.<type> <folder>" };
      }
      if (!isWritableHere(key)) {
        return { code: 2, summary: notWritableMessage(key) };
      }
      const { code, lines } = await setBinding(context.repoRoot, key, value);
      if (context.flags.json !== true) for (const line of lines) context.log(line);
      return { code, summary: lines[0]!, data: { key, value, lines } };
    }

    if (context.command === "unset") {
      const key = context.args[0];
      if (typeof key !== "string" || key === "") {
        return { code: 2, summary: "config unset needs a key: config unset types.<name>, or config unset records.dirs.<type>" };
      }
      if (!isWritableHere(key)) {
        return { code: 2, summary: notWritableMessage(key) };
      }
      const { code, lines } = await unsetBinding(context.repoRoot, key);
      if (context.flags.json !== true) for (const line of lines) context.log(line);
      return { code, summary: lines[0]!, data: { key, lines } };
    }

    return { code: 2, summary: `config ${String(context.command)} is not implemented yet` };
  },
);
