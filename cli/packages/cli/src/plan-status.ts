// vibe-ops hook plan-status — the coherence read, fired at the moment a plan is written rather than
// asked for afterwards. Registered by `close-plan`'s own `hooks:` block, so it exists only while that
// skill is active and costs nothing standing.
//
// Why it earns a hook at all: closure's whole job is to set `Status` to the terminal state, and the
// defect Plan-011 exists for is a plan sitting at that status with a track box still open. A line in a
// checklist cannot fire at the instant the status is set; this can, and it reports only the file that
// was just written rather than sweeping the repository.

import path from "node:path";
import { createDocumentStore, loadConfig } from "@entelekheia/vibe-ops-core";
import { planStatusFindings, RecordsConfigError, resolveRecord } from "@entelekheia/vibe-ops-records";
import { repoRootFrom } from "./run.ts";

interface PostToolUsePayload {
  readonly tool_input?: { readonly file_path?: string };
  readonly cwd?: string;
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

export async function runPlanStatusHook(): Promise<number> {
  let payload: PostToolUsePayload;
  try {
    payload = JSON.parse(await readStdin()) as PostToolUsePayload;
  } catch {
    return 0;
  }

  const filePath = payload.tool_input?.file_path;
  if (filePath === undefined) return 0;

  const repoRoot = repoRootFrom(payload.cwd ?? process.cwd());
  const documents = createDocumentStore(repoRoot);
  const { config } = await loadConfig(repoRoot);

  let resolved;
  try {
    resolved = resolveRecord("plan", repoRoot, config, documents);
  } catch (error) {
    if (error instanceof RecordsConfigError) return 0;
    throw error;
  }
  if (resolved.dir === undefined) return 0;

  // Only the file that was just written. A sweep would report a plan nobody touched, which is a
  // different signal and one `vibe-ops plan status` already answers on demand.
  const relative = path.relative(repoRoot, path.resolve(repoRoot, filePath));
  if (!relative.startsWith(`${resolved.dir}/`)) return 0;

  const finding = planStatusFindings(
    documents,
    repoRoot,
    resolved.dir,
    resolved.plan?.active,
    resolved.plan?.terminal,
  ).find((candidate) => candidate.file === relative);
  if (finding === undefined) return 0;

  const text =
    finding.reason === "terminal-with-open-tracks"
      ? `${finding.file}: Status is "${finding.status}", the terminal state, but ${finding.tracksTotal - finding.tracksChecked} of ${finding.tracksTotal} track boxes are unchecked. Either the tracks are done and the boxes are stale, or the plan is not closed — a plan closed while a track is open makes the file lie, and the file is the part that survives.`
      : `${finding.file}: every one of its ${finding.tracksTotal} track boxes is checked while Status is still "${finding.status}". If the work is done, this plan is ready to close.`;

  process.stdout.write(
    `${JSON.stringify({ hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: text } })}\n`,
  );
  return 0;
}
