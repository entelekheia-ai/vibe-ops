## License rules

- New `.md` documents need **no license header** — the root [`LICENSE`](LICENSE) covers the repository.
- Non-code example/fixture files need no header either.
- Source files (`{{SOURCE_GLOB}}`) carry a one-line SPDX header at the top:

  ```
  // SPDX-License-Identifier: {{LICENSE_ID}}
  ```

  Follow the existing pattern in the file's neighbors; don't invent a different header style.
