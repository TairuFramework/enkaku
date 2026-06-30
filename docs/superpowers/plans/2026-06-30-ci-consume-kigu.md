# Enkaku CI: Consume Kigu Reusable Workflows — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Enkaku's self-contained GitHub Actions workflows with thin wrappers that consume `TairuFramework/kigu`'s reusable workflows, mirroring kokuin.

**Architecture:** Three wrapper workflows (`build-test`, `e2e-web`, `e2e-desktop`) declare triggers and `uses:` the kigu reusable workflow at `@main` with inputs. Delete the two cruft mobile workflows and the now-unused local composite action.

**Tech Stack:** GitHub Actions (`workflow_call` reuse), pnpm, `actionlint` for validation.

## Global Constraints

- Reference kigu workflows at `@main` (path form `TairuFramework/kigu/.github/workflows/<name>.yml@main`).
- Triggers for every wrapper: `push` on `main` only + `pull_request`.
- Each wrapper passes `node-version`/`node-versions` as **strings** (quoted), per kigu input types.
- Validation tool: `actionlint` (installed at `/opt/homebrew/bin/actionlint`).
- Do NOT add a deno workflow. Do NOT keep android/ios.

---

### Task 1: Convert build-test.yml to kigu wrapper

**Files:**
- Modify (overwrite): `.github/workflows/build-test.yml`

**Interfaces:**
- Consumes: `TairuFramework/kigu/.github/workflows/build-test.yml@main` inputs `node-versions` (string JSON array), `integration-tests-dir` (string), `ts-readiness-check` (boolean).
- Produces: nothing downstream depends on this task.

- [ ] **Step 1: Overwrite the file with the wrapper**

```yaml
name: Build and test
on:
  push:
    branches: [main]
  pull_request:
jobs:
  build-test:
    uses: TairuFramework/kigu/.github/workflows/build-test.yml@main
    with:
      node-versions: '[24, 26]'
      integration-tests-dir: tests/integration
      ts-readiness-check: true
```

- [ ] **Step 2: Validate with actionlint**

Run: `actionlint .github/workflows/build-test.yml`
Expected: no output, exit code 0.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/build-test.yml
git commit -m "ci: consume kigu build-test reusable workflow"
```

---

### Task 2: Convert e2e-web.yml to kigu wrapper

**Files:**
- Modify (overwrite): `.github/workflows/e2e-web.yml`

**Interfaces:**
- Consumes: `TairuFramework/kigu/.github/workflows/e2e-web.yml@main` inputs `working-directory` (string), `node-version` (string).

- [ ] **Step 1: Overwrite the file with the wrapper**

```yaml
name: Web E2E
on:
  push:
    branches: [main]
  pull_request:
jobs:
  test:
    uses: TairuFramework/kigu/.github/workflows/e2e-web.yml@main
    with:
      working-directory: tests/e2e-web
      node-version: '24'
```

- [ ] **Step 2: Validate with actionlint**

Run: `actionlint .github/workflows/e2e-web.yml`
Expected: no output, exit code 0.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/e2e-web.yml
git commit -m "ci: consume kigu e2e-web reusable workflow"
```

---

### Task 3: Convert e2e-desktop.yml to kigu wrapper

**Files:**
- Modify (overwrite): `.github/workflows/e2e-desktop.yml`

**Interfaces:**
- Consumes: `TairuFramework/kigu/.github/workflows/e2e-desktop.yml@main` inputs `working-directory` (string), `node-version` (string).

- [ ] **Step 1: Overwrite the file with the wrapper**

```yaml
name: Desktop E2E
on:
  push:
    branches: [main]
  pull_request:
jobs:
  test:
    uses: TairuFramework/kigu/.github/workflows/e2e-desktop.yml@main
    with:
      working-directory: tests/e2e-electron
      node-version: '24'
```

- [ ] **Step 2: Validate with actionlint**

Run: `actionlint .github/workflows/e2e-desktop.yml`
Expected: no output, exit code 0.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/e2e-desktop.yml
git commit -m "ci: consume kigu e2e-desktop reusable workflow"
```

---

### Task 4: Delete cruft workflows and the local setup action

**Files:**
- Delete: `.github/workflows/e2e-android.yml`
- Delete: `.github/workflows/e2e-ios.yml`
- Delete: `.github/actions/setup-environment/action.yml` (and the now-empty `.github/actions/setup-environment/` and `.github/actions/` dirs)

**Interfaces:**
- Consumes: nothing. After Tasks 1–3, no workflow references `./.github/actions/setup-environment`.

- [ ] **Step 1: Confirm no remaining references to the local action**

Run: `grep -rn "setup-environment" .github/ || echo "no references"`
Expected: `no references` (the three wrappers from Tasks 1–3 use kigu's setup, not the local one).

- [ ] **Step 2: Delete the files**

```bash
git rm .github/workflows/e2e-android.yml .github/workflows/e2e-ios.yml
git rm -r .github/actions/setup-environment
```

- [ ] **Step 3: Verify the actions dir is gone (no empty leftover)**

Run: `ls .github/actions 2>/dev/null && echo "STILL EXISTS" || echo "removed"`
Expected: `removed`.

- [ ] **Step 4: Commit**

```bash
git commit -m "ci: drop unused mobile workflows and local setup action"
```

---

### Task 5: Final validation of the workflows directory

**Files:**
- None (verification only).

- [ ] **Step 1: actionlint over the whole workflows dir**

Run: `actionlint`
Expected: no output, exit code 0. (Runs against all `.github/workflows/*.yml`.)

- [ ] **Step 2: Confirm final workflow set**

Run: `ls .github/workflows/`
Expected exactly: `build-test.yml  e2e-desktop.yml  e2e-web.yml`

- [ ] **Step 3: Confirm every wrapper pins kigu at @main**

Run: `grep -rn "TairuFramework/kigu" .github/workflows/`
Expected: three lines, each ending `@main`.

---

## Self-Review

**Spec coverage:**
- Replace build-test → Task 1. ✓
- Replace e2e-web → Task 2. ✓
- Replace e2e-desktop → Task 3. ✓
- Delete android/ios + setup-environment → Task 4. ✓
- Trigger change (main push + PR) → applied in Tasks 1–3, captured in Global Constraints. ✓
- `integration-tests-dir: tests/integration` → Task 1 input. ✓
- `@main` pinning → Global Constraints + Task 5 Step 3. ✓
- Deno skipped, no kigu changes → enforced by Global Constraints (out of scope). ✓
- Verification (actionlint) → per-task + Task 5. ✓

**Placeholder scan:** none — every file's full content shown.

**Type consistency:** input names match kigu definitions verified during design (`node-versions`/`node-version`, `integration-tests-dir`, `ts-readiness-check`, `working-directory`).
