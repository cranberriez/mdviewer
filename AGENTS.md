# mdviewer — Application Guide

App-specific architecture, conventions, and extension points for the `mdviewer/`
Tauri + React + TypeScript + Tailwind desktop app. Read this before touching `src/`.

For repo-wide rules (pnpm-only, verification policy) see the top-level `../AGENTS.md`.
For deep dives, see `docs/` (architecture, tauri-commands, state-and-persistence,
explorer-and-context-menus, theming-and-css, preview-and-editing).

---

## Stack

- **Shell:** Tauri v2 (Rust backend in `src-tauri/`, native file IO + drag).
- **UI:** React 19 + TypeScript, Vite 7 build.
- **Styling:** Tailwind v4 (`@tailwindcss/vite`) + design-token CSS
  (`index.css`, `App.css`, `markdown.css`, `lexical.css`).
- **State:** Zustand v5, one store per feature domain + exported selectors.
- **Markdown:** `markdown-it` (+ task-lists) for preview render; **Lexical** for the
  visual/WYSIWYG editor.
- **Icons:** `lucide-react`.

Scripts: `pnpm dev`, `pnpm check` (tsc), `pnpm build`, `pnpm format`, `pnpm bundle` (Tauri).

---

## Architecture in one paragraph

The app is organized by **feature folder**, not by file type. Each feature owns its
`components/`, `hooks/`, and `state/`. Cross-cutting code lives in `shared/`. All native
calls go through one boundary: `features/files/api/filesApi.ts` (thin `invoke()` wrappers).
`App.tsx` is a **wiring hub** — it composes feature hooks and passes memoized prop bundles
into `AppWorkspace` (layout) and `AppMenus` (all popovers). Business logic lives in hooks
and Zustand stores, not in `App.tsx`.

Data flow: **UI event → controller/action hook → `filesApi` (IPC) and/or Zustand store →
re-render**. Menus are data-driven: a component builds a `MenuEntry[]` array and hands it to
the generic `ContextMenuSurface`; a separate dispatcher hook maps the chosen action string
to behavior.

---

## Directory map (`src/`)

```
src/
  App.tsx                     Wiring hub: composes hooks -> AppWorkspace + AppMenus
  main.tsx                    React root

  features/
    app-shell/                Top-level composition & app-wide concerns
      components/             AppWorkspace, AppMenus, AppPreviewArea, AppOnboardingOverlay
      hooks/                  useAppBootstrap, useApp{Menu,Keyboard,Persistence}…,
                              useFileWorkspace, useAppContextMenuRouter,
                              useHeaderMenuActions, useInitialLocations
      state/                  useUiStore, useMenuStore   (Zustand)
    explorer/                 Sidebar tree, saved locations, context menus
      components/             Sidebar, SidebarSourceList, SidebarExplorerHeader,
                              SidebarFooter, SidebarHeaderActions, TreeNode,
                              TreeInlineInput, EmptySidebar, SavedContextMenu,
                              IconPickerMenu
      components/context-menu/ *ContextMenu, *FilterMenu, savedContextMenuEntries,
                              treeContextMenuEntries
      hooks/                  useExplorerContextActions, useFolderTreeController,
                              useInlineDraftController, useSidebarResize, …
      state/                  useExplorerStore, useDraftStore
      utils/                  contextTargets
    files/                    File open/save + IPC boundary
      api/filesApi.ts         <-- THE Tauri boundary (all invoke() calls)
      hooks/useOpenFileController
      state/useFileStore
    preview/                  Rendering + editing (markdown-it + Lexical)
      components/             PreviewPanel, MarkdownPreview, PlainTextPreview,
                              LexicalMarkdownEditor, VisualMarkdownEditor, lexical/*,
                              visual-markdown/*
      markdown.ts, markdownActions.ts, domToMarkdown.ts, slug.ts
      hooks/                  useCodeEditorToolbar, usePreviewNavigation, useScrollSync
    file-actions/             Action bar / toolbar + find-in-preview
      components/             FileActionBar, FileActionControls, FindBar,
                              IconActionButton, MarkdownFormatToolbar
      hooks/useFindInPreview
    saved-locations/          Pinned locations, recents, icons, onboarding data
      hooks/, state/useSavedLocationsStore, savedLocations.ts
    search/                   Cross-file search
      hooks/useCrossFileSearch
    outline/                  Document outline panel
    dnd/                      Drag & drop (internal reorder + native drag-out)
      useAppDragDropController, useInternalDrag, useFileDrop, dropZoneResolver, …
    home/                     Home / start view + onboarding
    window-chrome/            TitleBar, MenuBar, window-frame persistence

  shared/
    types/files.ts            Entry, FileSearchMatch/Response  (contract with Rust)
    state/persistence.ts      localStorage schemas, AppConfiguration/Session state
    utils/path.ts             comparablePath, parentPath, relativePath, fileKindFromPath…
    hooks/useThemeClass.ts
    ui/components/Notice.tsx
    ui/menu/                  ContextMenuSurface, useAnchoredPosition, useMenuDismiss
```

---

## Core patterns (follow these when extending)

### 1. Feature folders
New capability = new `features/<name>/` with its own `components/`, `hooks/`, `state/`.
Don't add feature logic to `App.tsx`; add a hook and compose it there.

### 2. Zustand store per domain
`useUiStore`, `useMenuStore`, `useExplorerStore`, `useFileStore`, `useSavedLocationsStore`,
`useDraftStore`. Each exports `select*` functions used with `useShallow` for scoped reads.
Prefer reading a store directly in the component/hook that needs it over prop-drilling.

### 3. The IPC boundary is `filesApi.ts`
Every `invoke()` lives here as a typed wrapper (`readFolder`, `writeFile`, `deletePath`,
`movePath`, `startFileDrag`, …). Components/hooks call these functions — never `invoke()`
directly. Adding native behavior = new Rust command → new wrapper here.

### 4. Data-driven context menus (**the reusable menu system**)
- `ContextMenuSurface<Action>` is the generic renderer: takes `entries: MenuEntry<Action>[]`
  (`MenuItem` or `MenuSeparator`), handles portal, viewport clamping, dismissal, checkbox
  items, icons, shortcuts, danger styling. It lives in `shared/ui/menu/` with the shared
  positioning and dismissal hooks.
- Each menu is a thin component that builds an `entries` array and renders the surface —
  see `ExplorerFilterMenu`, `SourcesHeaderContextMenu`, `ExplorerHeaderContextMenu`,
  `SavedContextMenu`, and `treeContextMenuEntries.ts` (which composes shared fragments).
- Menu open/close state lives in `useMenuStore`; `AppMenus` renders whichever menu is open.
> Note: `IconPickerMenu` keeps a custom grid body, but still uses the shared positioning
> and dismissal hooks. New list-style menus should use `ContextMenuSurface`.

### 5. Preview/editor serializers
Preview copy and visual editing currently serialize different inputs:
`preview/domToMarkdown.ts` converts rendered preview DOM selections back to Markdown, while
`preview/components/visual-markdown/serialize.ts` serializes the contenteditable visual
editor. Treat them as separate implementations unless a future consolidation normalizes
both inputs behind one serializer contract.

### 6. Single action-dispatcher hooks
Menu actions are strings routed through one `switch`. `useExplorerContextActions` is the
model: `(action, target) => { switch(action) … }`. Add an action = extend the action union
+ add a `case`. Don't scatter handlers across components.

### 7. Controller hooks own workflows
`use*Controller` / `use*Actions` hooks encapsulate multi-step flows (open file, saved
locations, drag/drop, inline draft rename/create). `App.tsx` wires their inputs/outputs.

`useFileWorkspace` is the app-level coordinator for file opening, folder-tree helpers,
saved-location workflows, and location selection. Keep `selectLocation` there so file,
explorer, UI, and recents updates stay ordered without cross-hook refs in `App.tsx`.

Use feature-scoped action hooks such as `useExplorerActions()`, `useUiActions()`, and
`useMenuActions()` when a coordinator needs several store actions. Keep the existing
`select*` state selectors for rendering state.

### 8. Sidebar panels own their display state
`Sidebar.tsx` is a coordinator for the sources panel, explorer panel, and footer. Keep
panel-specific display state in `SidebarSourceList`, `SidebarExplorerHeader`, and
`SidebarFooter`, reading Zustand stores directly where appropriate. Pass workflow
callbacks down from `AppWorkspace` only when they come from controller hooks.

---

## How to extend — recipes

**Add a right-click action to tree entries**
1. Add the action to `ContextMenuAction` in `explorer/components/context-menu/treeContextMenuEntries.ts`.
2. Add a `MenuItem` to the relevant branch of `entriesForTreeContext`.
3. Handle it in the `switch` in `hooks/useExplorerContextActions.ts`.

**Add a right-click action to a saved location**
1. Add to `SavedMenuAction` and its `entriesFor…` builder.
2. Handle in `useSavedLocationMenuActions`.
3. If it must read menu position before closing (like `change-icon`), keep the menu open
   and close manually after.

**Add a new popover menu**
1. New component that builds `MenuEntry[]` + renders `ContextMenuSurface`.
2. Add open/close state to `useMenuStore`.
3. Route app-level open events through `useAppContextMenuRouter` when they are triggered
   from `AppWorkspace`; render the popover in `app-shell/components/AppMenus.tsx`.

**Add a Tauri command** → `src-tauri/src/lib.rs` (`generate_handler!`) → wrapper in
`filesApi.ts` → call from a hook. See `docs/tauri-commands.md`.

**Add a persisted setting** → schema in `shared/state/persistence.ts` → field in the owning
Zustand store → include in the config selector. See `docs/state-and-persistence.md`.

**Add a sidebar header toolbar button** → add an item to the data-driven action config in
`SidebarSourceList` or `SidebarExplorerHeader`. Shared rendering lives in
`SidebarHeaderActions`, which wraps `file-actions/components/IconActionButton`.

**Add a picker icon** → append to `ICON_OPTIONS` in `IconPickerMenu.tsx` (grid is 6 cols;
keep the count a multiple of 6).

---

## What works well — keep intact

- **Feature-based structure** with per-feature `components/hooks/state`.
- **`ContextMenuSurface` + `entriesFor*` builders** — the correct, reusable menu pattern.
- **Single action dispatchers** (`useExplorerContextActions`) and **composed menu fragments**
  (`treeContextMenuEntries.ts`).
- **`filesApi.ts` as the one IPC boundary** — keep all `invoke()` here.
- **Zustand store-per-feature + `select*`** selectors.
- **`shared/utils/path.ts`** path normalization (`comparablePath` for cross-OS comparison).

## Known rough edges — see `../fixer-tasks.md`

- No open Priority 3 App wiring cleanup remains; check `../fixer-tasks.md` for newer items.

---

## Changelog workflow

- Keep a running `changelog.md` at the `mdviewer/` root during feature work. Update it
  whenever user-facing behavior changes, especially when a roadmap item is completed.
- Changelog entries should describe features at a high level for release notes, not list
  internal implementation details. Moving completed roadmap items into simpler changelog
  bullets is enough.
- The roadmap/planning docs remain the authoritative planning inventory. The changelog is
  the user-facing summary of what shipped in the current release branch.
- When a version bucket is merged or released, move `changelog.md` into
  `changelogs/<version>.md` without the leading `v` (for example, `changelogs/0.4.md`),
  use that archived file as the GitHub Release notes source, then recreate a fresh
  `changelog.md` for the next release.
- Do not add pure refactors, dependency churn, or invisible cleanup unless it changes the
  user experience or matters for release risk.

---

## Verification

- `pnpm check` (tsc) + `pnpm build` is the verification limit for routine changes.
- `pnpm format` (Prettier: **tabs, single quotes** — match existing `context-menu/` files).
- Do not start the dev server or inspect the live UI unless explicitly asked.
