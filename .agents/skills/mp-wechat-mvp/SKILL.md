---
name: mp-wechat-mvp
description: Implement or refine the `apps/mp-wechat` uni-app MVP for this repository. Use when working on the Path Seeker mini program shell, custom navigation or custom tab bar, schema-aligned mock routes, session recovery, mission flow pages, or the five fixed puzzle renderers (`observe_choice`, `clue_find`, `sort`, `match`, `code_break`).
---

# Mp Wechat Mvp

## Workflow

1. Read `docs/01-product-solution.md`, `docs/02-development-plan.md`, `apps/mp-wechat/src/mock/schema.ts`, `apps/mp-wechat/src/mock/missions.ts`, and `apps/mp-wechat/src/stores/useMissionStore.ts` before changing flow logic.
2. Keep `pages/shell/index.vue` as the mini program shell. Route hall, playing, and archive tabs through the custom shell; do not reintroduce the native tab bar.
3. Keep page responsibilities thin:
   - `task-detail`: start decision and age-band confirmation
   - `prologue`: move from browse mode into mission mode
   - `chapter-map`: navigation, progress, unlocked clues
   - `artifact-clue`: observation-first exhibit page
   - `puzzle`: renderer host, hints, submit, skip, feedback
   - `chapter-result`: short progression beat after each clear
   - `finale`: truth reveal, score, reward, share copy
4. Keep long-lived state in `useMissionStore`. Pages may hold only local UI state such as the active draft or a transient overlay flag.

## Required Coverage

Maintain schema coverage through mock data, not scattered page constants.

- Keep all age bands present in `src/mock/schema.ts`: `6-10`, `10-15`, `15+`.
- Keep all difficulty levels present: `L1`, `L2`, `L3`.
- Keep all task kinds present through `scaleType` mapping: family adventure, story detective, deep reasoning.
- Keep the five fixed renderer types present in playable routes.
- When adding a mock route or puzzle, always fill `schemaMeta` and `puzzleTypeId` so the UI still proves end-to-end schema coverage.

## UI And Styling Rules

- Reuse the dark gold admin direction. Prefer the global tokens and shared utility-like classes in `src/styles/theme.scss`.
- Use `MiniNavBar`, `MiniTabBar`, `MiniAppShell`, and `PageScaffold` instead of creating page-specific chrome.
- Keep motion lightweight and structural: shell tab fades, puzzle feedback pop-in, chapter progression transitions.
- Do not port `shadcn` patterns into the mini program. Favor custom uni-app friendly layout and Tailwind-like utility composition.
- For icons, use the repository's Lucide source only. Prefer the local `src/components/ui/AppIcon.vue` wrapper backed by `lucide-static`; do not introduce `@nuxt/icon`, iconify naming, or ad-hoc text glyph placeholders when a real icon is intended.

## Renderer Rules

- Keep `PuzzleRendererHost.vue` as the only dispatch point from `templateType` to a concrete renderer.
- Keep each renderer focused on interaction capture only. Emit `MissionAnswerDraft`; do not perform scoring, hint progression, or routing inside renderers.
- Preserve the MVP interaction model:
  - `observe_choice`: single choice
  - `clue_find`: hotspot pick
  - `sort`: ordered list controls
  - `match`: explicit pair binding
  - `code_break`: fixed-length code input

## Validation

Run these checks after meaningful changes:

```bash
pnpm --filter @path-seeker/mp-wechat type-check
```

If behavior changes touch shell flow or store transitions, manually verify:

1. Hall filters still cover age, difficulty, and task kind.
2. Starting a route creates a recoverable session.
3. Each renderer still submits a normalized draft.
4. Chapter result and finale transitions still respect the current session state.
