---
name: Package conflict prevention
description: Rules for keeping pnpm workspace packages conflict-free across all artifacts.
---

## Rules

1. **Shared dependencies go in the catalog** (`pnpm-workspace.yaml` → `catalog:` section). Never pin the same package at different versions across artifact `package.json` files — always use `catalog:` so there's one source of truth.

2. **Internal packages use `workspace:*`** — `@workspace/db`, `@workspace/api-client-react`, etc. Never pin a semver for workspace-local packages.

3. **Run `pnpm install` after any `package.json` change** before building, to catch peer-dep or resolution conflicts early.

4. **Do not install packages with `npm` or `yarn`** — this workspace enforces pnpm-only via the preinstall script. Always use `pnpm add --filter @workspace/<pkg> <dep>`.

5. **Check the `minimumReleaseAge` exemption list** before installing very new packages. Packages must be ≥1 day old unless they're in the `minimumReleaseAgeExclude` list in `pnpm-workspace.yaml`.

**Why:** The workspace has a strict `pnpm-only` preinstall guard and a `minimumReleaseAge: 1440` supply-chain defense. Violating either silently breaks installs.

**How to apply:** Before every `pnpm add ...`, confirm: (a) is this a shared dep that belongs in `catalog:`? (b) is the version ≥1 day old or exempted? (c) run `pnpm install` and check output for warnings before committing.
