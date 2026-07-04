# Rename `asset/` to `assets/` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `subagent-driven-development` (recommended) or `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename `asset/` directory to `assets/` and update the `plugin.json` CDN URL reference.

**Architecture:** Mechanical rename — move the directory with `git mv` (to preserve git history), then update the single code reference in `plugin.json`. No code logic changes.

**Tech Stack:** N/A (directory rename + JSON edit)

## Global Constraints

- Must preserve git history for all files (use `git mv` or `git mv --force`).
- Do not modify any `assets/` references in `src/` or `test/` directories (those refer to SiYuan's built-in attachments directory).
- Do not modify any docs/ CDN URLs pointing to the `@image-host` branch.
- After rename, verify `npm run test` and `npm run lint` pass.

---

### Task 1: Rename directory and update plugin.json

**Files:**
- Rename: `asset/` → `assets/`
- Modify: `plugin.json` line 25

**Interfaces:**
- Consumes: nothing
- Produces: renamed `assets/` directory with all original files

- [ ] **Step 1: Git rename the directory**

```bash
git mv asset/ assets/
```

Expected: directory `asset/` is now `assets/`, git tracks the rename.

- [ ] **Step 2: Verify all 6 files moved**

Run: `ls assets/`
Expected output: `donate.png  icon-20260616.png  note.png  op.gif  setting.png  todo-dock.png`

- [ ] **Step 3: Update CDN URL in plugin.json**

Replace `asset/donate.png` with `assets/donate.png` in the funding URL at line 25.

Before:
```json
"https://cdn.jsdelivr.net/gh/MoonBottle/siyuan-plugin-bullet-journal@main/asset/donate.png"
```

After:
```json
"https://cdn.jsdelivr.net/gh/MoonBottle/siyuan-plugin-bullet-journal@main/assets/donate.png"
```

- [ ] **Step 4: Run npm run test**

Run: `npm run test`
Expected: All tests pass.

- [ ] **Step 5: Run npm run lint**

Run: `npm run lint`
Expected: No lint errors.

- [ ] **Step 6: Commit**

```bash
git add assets/ plugin.json
git commit -m "refactor: rename asset/ to assets/ and update plugin.json reference"
```