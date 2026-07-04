# Rename `asset/` to `assets/` — Design Doc

## Summary

Rename the project's `asset/` directory to `assets/` for better convention alignment (Vite, SiYuan, and most JS tooling use `assets/` as the standard name). This is a mechanical rename with one code reference to update.

## Scope

### What changes

| Item | Action |
|---|---|
| `asset/` directory | Rename to `assets/` |
| `asset/donate.png` file | Moved to `assets/donate.png` |
| `plugin.json:25` CDN URL | `asset/donate.png` → `assets/donate.png` |

### What does NOT change

- `src/api.ts` — `assetsDirPath` and `/api/asset/upload` are SiYuan kernel API paths, not local directory references.
- `src/parser/lineParser.ts` / `src/parser/core.ts` — `url.startsWith('assets/')` refers to SiYuan's built-in `assets/` attachments directory.
- `test/` — `assets/demo.png` references in tests are SiYuan attachment paths in test data.
- `docs/article/0.13.0-release.md` — CDN URLs point to the `@image-host` branch on GitHub, which is outside this project's scope.
- `docs/API/后端API.md` — `/api/asset/upload` is SiYuan kernel API documentation.

## Risk Assessment

- **Low risk.** Single file rename + one URL string change in `plugin.json`.
- The `plugin.json` CDN URL points to `@main/asset/donate.png` on GitHub; after renaming locally, the user must also rename the `asset/` directory on the GitHub `main` branch to match.

## Verification

After implementation:
1. `asset/` directory no longer exists.
2. `assets/` directory exists with all 6 original files.
3. `plugin.json` contains `assets/donate.png` instead of `asset/donate.png`.
4. `npm run test` passes.
5. `npm run lint` passes.