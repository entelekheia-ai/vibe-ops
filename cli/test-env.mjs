// Preloaded by the root `test` script (`node --import ./cli/test-env.mjs --test …`). A git hook exports
// GIT_DIR / GIT_INDEX_FILE, which outrank `git -C`; a test that builds a throwaway repository would then act
// on the real one (writing `user.email` into its config, staging into its index). Dropped before any test file loads.
for (const key of Object.keys(process.env)) {
  if (key.startsWith("GIT_")) delete process.env[key];
}
