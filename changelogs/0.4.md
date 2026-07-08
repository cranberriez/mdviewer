# v0.4 Changelog

Changes accumulated on the `v0.4` branch through `0.4.7`.

## Added

- Added an Explorer filter menu so show/hide options live in the Explorer context menu
  instead of taking permanent sidebar space.
- Added **Open as Root** to folder context menus, allowing any visible folder to become the
  active project root.
- Added a refreshed app icon.

## Changed

- Reworked saved-location menus, Explorer header actions, and menu-bar actions to use shared
  menu definitions for more consistent behavior.
- Improved the saved-location icon picker flow so changing an icon can keep the menu context
  open where needed.
- Refactored the sidebar, preview panel, and visual markdown editor into smaller focused
  pieces to make the app easier to maintain without changing the core workflow.
- Updated the app build stack, including Vite, Tauri, Tailwind/Vite tooling, GitHub Actions,
  and related dependencies.

## Fixed

- Stabilized menu dismissal behavior so context menus and popovers close more reliably.
- Hardened outline anchor generation and visual markdown serialization against malformed or
  multi-character input.
- Fixed release, dependency-audit, and version-bump automation used to ship the app.

## Maintenance

- Added GitHub release-build automation for merges to `main`.
- Added CodeQL, dependency audit, Dependabot grouping, and a project security policy.
