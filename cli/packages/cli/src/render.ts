// The one place the terminal surface decides how anything human-facing is printed.
//
// Two readers share this binary's stdout: a person at a terminal, and a machine — a hook, a commit gate,
// continuous integration, an agent reading a pipe. The machine cannot ask for less, so it is the default
// whenever stdout is not an interactive terminal, and `rich` is what a person gets. Everything in `bin.ts`
// that is not a module's own log line or a `--json` payload goes through the writers below; nothing else
// in this package chooses colour, framing or glyphs.
//
// Streams do not change here: every line goes where it went before this file existed. Consumer
// repositories read `N checks, M failed` off stdout whatever the exit code, so the summary of a failing
// run stays on stdout too.
//
// Out of scope by construction: the hook surfaces (`hook.ts` and the `plan-*`, `task-guard`, `new-context`
// and `prefer-mcp` modules) write JSON another program parses, and never import this file.

import { styleText } from "node:util";
import { readReport } from "@entelekheia/vibe-ops-core";
import type { ModuleResult } from "@entelekheia/vibe-ops-core";
import { renderReport } from "./report-view.ts";

type Style = Parameters<typeof styleText>[0];

/** `--ui` and `--no-ui` belong to the CLI, not to any module, so they are taken out before a module's own strict parse. */
export const GLOBAL_FLAGS: readonly { readonly name: string; readonly description: string }[] = [
  { name: "ui", description: "Draw the rich report even when stdout is not a terminal" },
  { name: "no-ui", description: "Print plain lines even at a terminal" },
];

/** What the invocation asked for: `on` for `--ui`, `off` for `--no-ui`, `undefined` for neither. The last one given wins. */
export type UiChoice = "on" | "off" | undefined;

/**
 * Removes `--ui` and `--no-ui` from anywhere in `argv`. Anything after a bare `--` is a positional and is
 * left alone, as `parseArgs` would.
 */
export function extractGlobalFlags(argv: readonly string[]): { readonly rest: string[]; readonly ui: UiChoice } {
  const rest: string[] = [];
  let ui: UiChoice;
  let positionalOnly = false;
  for (const arg of argv) {
    if (!positionalOnly && arg === "--ui") ui = "on";
    else if (!positionalOnly && arg === "--no-ui") ui = "off";
    else {
      if (arg === "--") positionalOnly = true;
      rest.push(arg);
    }
  }
  return { rest, ui };
}

function envSet(value: string | undefined): boolean {
  return value !== undefined && value !== "" && value !== "0" && value.toLowerCase() !== "false";
}

export interface Environment {
  readonly isTTY: boolean;
  readonly env: NodeJS.ProcessEnv;
}

/**
 * Rich or plain. An explicit choice wins; otherwise rich needs an interactive stdout, and `CI` or
 * `NO_COLOR` in the environment keeps it plain — a terminal can be wrong about itself, and both
 * variables are how the environment says so.
 */
export function wantsRich(ui: UiChoice, environment: Environment): boolean {
  if (ui === "on") return true;
  if (ui === "off") return false;
  return environment.isTTY && !envSet(environment.env["CI"]) && !envSet(environment.env["NO_COLOR"]);
}

/** Whether colour is allowed inside a rich run: `--ui` forces the layout, and `NO_COLOR` still vetoes the colour. */
export function colourAllowed(env: NodeJS.ProcessEnv): boolean {
  return !envSet(env["NO_COLOR"]);
}

/** A line the report block redraws: `FAIL  [id] …`, `WARN  [id] …` or `SKIP  [id] …`, as the runners print them. */
const FINDING_LINE = /^(FAIL|WARN|SKIP)\s+\[[^\]]+\]/;

/**
 * The held lines a drawn block does not stand in for. A module may hand the sink several lines at once —
 * `check` passes each half of its run as one string — so the filter works line by line, never entry by
 * entry. A finding line is dropped only when nothing is indented under it: the block redraws a finding's
 * first line and no more, so one that carries continuation lines is printed whole, with them, rather than
 * cut off from them.
 */
export function withoutRedrawnFindings(held: readonly string[]): string[] {
  const lines = held.flatMap((entry) => entry.split("\n"));
  const continues = (index: number): boolean => {
    const next = lines[index + 1];
    return next !== undefined && /^\s{2}/.test(next) && !FINDING_LINE.test(next);
  };
  return lines.filter((entry, index) => !FINDING_LINE.test(entry) || continues(index));
}

/**
 * A line a rich run held back instead of writing as it came, with the stream it would have gone to: a
 * module's log line is `out`, one of its warnings is `err`. Held together so they keep their order.
 */
export interface HeldLine {
  readonly text: string;
  readonly stream: "out" | "err";
}

export interface Out {
  readonly rich: boolean;
  /**
   * Writes held lines, in order, each to its own stream. In a rich run an `out` line is styled by the
   * shapes the runners share; in a plain one every line is written as it was held.
   */
  flush(held: readonly HeldLine[]): void;
  /**
   * A status line on stderr while a module works, drawn only in a rich run whose stderr is a terminal.
   * The returned `stop()` erases it, and is safe to call more than once.
   */
  progress(label: string): () => void;
  /** A titled block: `--help`, and the flag list after a refused flag. */
  help(title: string, lines: readonly string[]): void;
  /** Something went wrong before or around the module — a refused flag, an unknown verb, a crash. */
  error(message: string): void;
  /** The end of every module run: its summary, or its `--json` payload with the summary beside it. */
  result(result: ModuleResult, options: ResultOptions): void;
}

export interface ResultOptions {
  readonly json: boolean;
  /** What ran and where, for the report block's title line. */
  readonly title?: string;
  readonly where?: string;
  /**
   * The module's own log lines, when the caller held them back instead of writing them as they came —
   * which it does only in rich mode, so that a report block can stand in for them rather than repeat
   * every finding a second time underneath.
   */
  readonly held?: readonly string[];
  /** Print the held lines even when a block is drawn: `--verbose` asked for the whole run. */
  readonly keepHeld?: boolean;
}

export interface OutOptions {
  readonly rich: boolean;
  /**
   * Whether a rich run may colour. `--ui` forces the rich layout, and `NO_COLOR` still asks for no
   * colour inside it — the variable is about colour, not layout.
   */
  readonly colour?: boolean;
  /** Whether a status line may be drawn: stderr is an interactive terminal. Absent means no. */
  readonly statusLine?: boolean;
  readonly stdout?: (text: string) => void;
  readonly stderr?: (text: string) => void;
}

export function createOut(options: OutOptions): Out {
  const { rich } = options;
  const colour = rich && (options.colour ?? true);
  const stdout = options.stdout ?? ((text: string) => void process.stdout.write(text));
  const stderr = options.stderr ?? ((text: string) => void process.stderr.write(text));
  // `validateStream: false` because this file has already decided: the default would re-check stdout and
  // strip the colour from every `--ui` run into a pipe, which is the one case `--ui` exists for.
  const paint = (style: Style, text: string): string => (colour ? styleText(style, text, { validateStream: false }) : text);
  const line = (text: string): void => stdout(`${text}\n`);

  return {
    rich,

    flush(_held) {
      throw new Error("not implemented: Out.flush");
    },

    progress(_label) {
      throw new Error("not implemented: Out.progress");
    },

    // The lines are printed as the caller wrote them: `bin.ts` already indents its verb and flag lines,
    // and a second indent here doubled them.
    help(title, lines) {
      line(paint("bold", title));
      line("");
      for (const entry of lines) line(entry);
    },

    error(message) {
      line(rich ? `${paint("red", "✖")} ${message}` : `error: ${message}`);
    },

    result(result, resultOptions) {
      const { json } = resultOptions;
      // Held lines keep the position they always had — before whatever closes the run.
      const held = resultOptions.held ?? [];
      // Raw on both streams: the payload is piped into `jq`, and the summary goes to stderr where a
      // person still reads it and a pipe never sees it. Neither is styled — `--json` names a machine
      // format, which outranks `--ui`.
      if (json) {
        for (const entry of held) line(entry);
        if (result.data !== undefined) stdout(`${JSON.stringify(result.data, null, 2)}\n`);
        stderr(`${result.summary}\n`);
        return;
      }
      if (!rich) {
        for (const entry of held) line(entry);
        line(result.summary);
        return;
      }
      const report = readReport(result.data);
      if (report === undefined) {
        for (const entry of held) line(entry);
        line(`${result.code === 0 ? paint("green", "✔") : paint("red", "✖")} ${result.summary}`);
        return;
      }
      // The block stands in for the finding lines only — the ones it redraws. Everything else a module
      // wrote (a repair it made, a hint, a warning it passed through) is not in the report, and printing
      // it above the block is the only way it reaches the terminal at all.
      const kept = resultOptions.keepHeld === true ? held : withoutRedrawnFindings(held);
      for (const entry of kept) line(entry);
      const header = { title: resultOptions.title ?? "vibe-ops", where: resultOptions.where ?? "", summary: result.summary, code: result.code };
      for (const entry of renderReport(report, header, paint)) line(entry);
    },
  };
}
