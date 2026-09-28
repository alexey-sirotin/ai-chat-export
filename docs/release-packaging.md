# Release packaging

AI Chat Export builds the Chromium and Firefox release archives from the same source tree with `scripts/package.sh`.

## Requirements

The packaging script requires a Unix-like environment with:

- Bash
- Python 3
- `zip`
- `unzip`

Git metadata is optional. The script works both from a normal Git checkout and from GitHub's generated **Source code (zip/tar.gz)** archives, which do not contain a `.git` directory.

Node.js/npm are not required to assemble the browser release archives because the prepared KaTeX and Mermaid runtime files are tracked in the repository. Node.js is required for development tests and for regenerating those vendored runtimes.

## Build

From the repository root or an unpacked GitHub source archive:

```bash
bash scripts/package.sh
python3 scripts/package-smoke.py
```

For a tagged release, pass the expected tag so the script verifies that it matches the version in `manifest.json`:

```bash
bash scripts/package.sh v0.1.38
python3 scripts/package-smoke.py
```

The resulting archives are written to `dist/`:

```text
dist/ai-chat-export-<version>-chromium.zip
dist/ai-chat-export-<version>-firefox.zip
```

## Source selection

When Git metadata is available, the packager uses the tracked-file list from Git. When `.git` is absent, as in GitHub-generated source archives, it falls back to the files present in the source archive while ignoring `.git`, `dist`, and `node_modules`.

In both cases the same source-only paths are excluded from browser packages, and `scripts/package-smoke.py` verifies the exact release file set plus browser-specific manifest rules.

CI also performs a second package build from a Git archive extracted without `.git` metadata. This guards the source-archive path used for reproducible store-review submissions.
