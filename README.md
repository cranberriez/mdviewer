# MDViewer

A local markdown viewer/editor built with Tauri, React, TypeScript, and Tailwind.

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

## Build Scripts

Use pnpm for all JavaScript and Tauri CLI tasks.

```powershell
pnpm install
pnpm build
pnpm bundle
```

- `pnpm build` validates TypeScript and builds the Vite frontend.
- `pnpm bundle` builds the production Tauri desktop bundle for the current OS.
- `pnpm check:release-version v0.1.1` verifies that a release tag matches `package.json`, `src-tauri/tauri.conf.json`, and `src-tauri/Cargo.toml`.

## GitHub Release Flow

Pull requests into `main` run `pnpm build`.

Commits merged to `main` build a Windows installer and upload it as a GitHub Actions artifact.

Pushing a version tag that starts with `v` creates a GitHub Release and uploads the Windows installer. Publishing a GitHub Release on github.com with a new `v` tag does the same thing. Before tagging, update the app version in all three files:

- `package.json`
- `src-tauri/tauri.conf.json`
- `src-tauri/Cargo.toml`

Also make sure the matching version changelog exists. Patch versions use the same
major/minor changelog, so `v0.4.7` reads `changelogs/0.4.md` for the GitHub Release body.

Example release from the command line:

```powershell
git checkout main
git pull
git tag v0.1.1
git push origin v0.1.1
```

Example release commit message:

```text
chore: release v0.1.1
```

You can also create and push the same tag from VS Code's Git commands. On github.com, open Releases, draft a new release, choose a new tag like `v0.1.1` targeting `main`, then publish the release.
