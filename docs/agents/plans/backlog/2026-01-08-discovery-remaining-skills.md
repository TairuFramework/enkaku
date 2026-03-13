# Remaining Discovery System Skills

**Extracted from:** `docs/agents/plans/completed/2026-01-08-llm-discovery-system-design.md`
**Priority:** Low

## Missing Domain Skills

The progressive discovery system is functional with 6 domain skills. Two optional skills from the original plan were not created:

### 1. `/enkaku:utilities` — Utilities
- **Packages:** `result`, `patch`, `generator`
- **Focus:** Result types, JSON patching, code generation

### 2. `/enkaku:platform` — Platform-Specific
- **Packages:** `react`, `electron-rpc`
- **Focus:** Platform integrations, React hooks, Electron patterns

## Resolved

- `/enkaku:execution` reference removed from `discover.skill.md` (2026-03-13). The domain is still listed in the discover skill but no longer points to a nonexistent skill.
