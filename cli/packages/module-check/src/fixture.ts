// The deliberately-broken repository every port is measured against.
//
// IT WAS THE SHELL RUNNER'S, AND IT OUTLIVED IT. `build_fixture` lived in `check-agents-md.sh` and was
// reached through an `--emit-fixture` seam (Plan-038 track 3); when track 7 retired the fragments the
// fixture did not go with them, because ownership of that evidence had already moved. `check --self-test`
// asserts the nine ports whose fragments were retired still FAIL here — and with the fragments gone this
// is the only thing in the repository that does.
//
// EVERY DEFECT AND EVERY DECOY IS DELIBERATE, and the decoys are the half that is easy to lose. A fixture
// carrying only violations passes whether or not a detector distinguishes anything; the near-misses beside
// each violation are what give an assertion meaning. Removing one to "clean up" silently weakens every
// port measured here, and nothing would report it.

/**
 * Paths are repository-relative; the caller writes them into a fresh git repository and stages them.
 * Kept as data rather than as code so the fixture reads as the broken repository it is.
 */
export const PARITY_FIXTURE: Readonly<Record<string, string>> = {
  // Over budget (200 lines), a link that does not resolve, one that climbs out of the repository, a
  // memory slug, a `${CLAUDE_PLUGIN_ROOT}` path that does not ship, and a home directory in a committed
  // document. The last two lines are a `${CLAUDE_PLUGIN_ROOT}/../` climb — unreachable from any install
  // even though it resolves inside this fixture's own tree — beside one marked `allow` that must NOT
  // fire. That pair is the only place the allow-marker is exercised at all.
  "AGENTS.md": `${"padding line\n".repeat(200)}- [gone](docs/does-not-exist.md)
- [escape](../../etc/passwd)
- [memory](x) see [[project_something]]
- run \`\${CLAUDE_PLUGIN_ROOT}/scripts/does-not-ship.sh\` — a path in a command, not a link
- built from \`/Users/somebody/checkouts/thing\` — a home directory in a committed document
- run \`\${CLAUDE_PLUGIN_ROOT}/../cli/ghost.sh\` — climbs out of the plugin root
- run \`\${CLAUDE_PLUGIN_ROOT}/../cli/shipped.sh\` — plugin-root-paths: allow
`,

  // `[[...]]` shapes that are NOT memory links, beside one that is (in AGENTS.md above). A fixture with
  // only the real slug would pass whether or not the check distinguishes them, so these two decoys are
  // what make "exactly one hit, on the un-fenced un-quoted line" an assertion rather than a count. The
  // last line carries the two elided home-directory spellings a document uses when describing that rule.
  "decoys.md": `# decoys
\`\`\`toml
[[language]]
name = "description"
\`\`\`
inline \`[[also_not_a_link]]\` quoted as code
the elided forms \`/Users/…/thing\` and \`/Users/.../thing\`, which describe the rule
`,

  // A rule with frontmatter but no `description:`, and its `.claude/` counterpart checked out as plain
  // text where a symlink belongs — the bridge failure that reads as a working rule file.
  ".agents/rules/nodesc.md": '---\npaths: ["x/**"]\n---\n\nno description above.\n',
  ".claude/rules/nodesc.md": "not a symlink\n",

  // A shipped template attributing a real person, in a repository that is not theirs.
  "skills/demo/templates/demo.md":
    "<!--\n Copyright (c) 2026 Some Person (https://example.invalid)\n-->\n\n# demo\n",

  // A broken `/vibe-ops:<name>` reference, on the two live surfaces that check covers.
  "skills/demo/SKILL.md": "# demo\n\nUse `/vibe-ops:ghost` for this.\n",
  "README.md": "See /vibe-ops:ghost in the README.\n",

  // Two manifests disagreeing on version, description and keywords at once — three comparisons, one pair.
  ".claude-plugin/plugin.json":
    '{"name":"fixture","version":"1.0.0","description":"A","keywords":["a","b"]}\n',
  ".claude-plugin/marketplace.json":
    '{"plugins":[{"name":"fixture","version":"1.0.1","description":"B","keywords":["a"]}]}\n',

  // A hook registered but absent, one present but unregistered, and a description whose literal count is
  // wrong either way — three distinct failures that a single-direction comparison would only half catch.
  "hooks/hooks.json":
    '{"description":"Five guards.","hooks":{"Stop":[{"hooks":[{"type":"command","command":"sh","args":["${CLAUDE_PLUGIN_ROOT}/hooks/missing.sh"]}]}]}}\n',
  "hooks/orphan.sh": "",

  // A skill's OWN `hooks:` frontmatter block naming an event that does not exist — a second, unrelated
  // population, here so that `hooks.json` existing at all cannot accidentally cover it.
  "skills/broken-hook/SKILL.md":
    '---\nname: broken-hook\ndescription: fixture\nhooks:\n  NotARealEvent:\n    - matcher: "Write"\n      hooks:\n        - type: command\n          command: vibe-ops\n---\n\nfixture\n',


  // A references/records/ missing two of the four types `/new` reads.
  "references/records/adr.md": "adr rules\n",
  "references/records/plan.md": "plan rules\n",
};
