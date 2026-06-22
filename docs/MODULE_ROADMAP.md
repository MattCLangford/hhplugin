# Module Roadmap

The platform should become modular in stages, while keeping HireHop deployment simple.

## Rule

Develop in modules, deploy in a predictable load order.

The primary editor can consume small module files when they are available, but it should keep safe defaults for critical behavior until the module set is stable.

## Current Module Boundary

`3-meta.js` owns the shared metadata contract.

It owns:

- `WisePageMeta` envelope markers.
- Event Overview profile/template keys.
- Generic page editor IDs and versions.
- Labour day editor IDs and versions.
- Page control field names such as `renderType`, `layoutId`, `hidden`, `excludeFromProjectTotal`, `imageUrl`, `splitSide`, `summaryMode`, `layoutVariant`, `pageKind`, and `deptLayout` (`image`, `no-image`, or `columns`).

`4-layout.js` owns the shared layout catalogue.

It owns:

- Page layout labels.
- Layout matching rules.
- Layout flags such as `locked`, `managedRows`, and `costingRows`.

`5-hirehop.js` owns the shared HireHop integration contract.

It owns:

- HireHop supplying-list selectors.
- HireHop item save/delete endpoint paths.
- Depot gating defaults.
- Retry timings.
- Tree item kind prefixes.

`6-editor2.js` still owns:

- Modal/editor rendering.
- HireHop tree reads.
- HireHop save/delete calls.
- Event Overview editor behavior.
- Labour day folder behavior.
- Native listed-item handoff.
- Preview docking.

`9-jobchecklist.js` owns:

- Project and job page tab polish across all depots.
- Hiding Billing and Purchase orders from non-admin users at both levels.
- Keeping the full native button set visible for admin users.
- Native Checklist tab panels and placeholder checklist state until final HireHop project/job custom fields are agreed.

`10-projectjobs-qol.js` owns:

- Project details page job-list reachability across all depots.
- Making the project details tab scrollable when project custom fields push the jobs grid below the visible viewport.
- The compact project-information toggle that temporarily hides the upper project details block so the native jobs grid has more room.

## Next Extractions

1. `wise-sectionbuilder-preview-ui.js`
   Owns the preview dock integration with `1-docprev.js`.

2. `wise-sectionbuilder-eventoverview-ui.js`
   Owns the Event Overview-specific editor state, validation, rendering, and save behavior.

3. `wise-sectionbuilder-pages-ui.js`
   Owns generic proposal page rendering and action handling.

4. `wise-sectionbuilder-hirehop-actions-ui.js`
   Owns toolbar detection, tree selection, native New/Edit handoff, refresh detection, depot detection, and item endpoint wrappers after those behaviours are ready to move out of the editor.

## Deployment Policy

Recommended HireHop script set:

- Load only `0-loader.js` in the HireHop company config string.

`0-loader.js` then lazy-loads the old module set only when the matching HireHop surface exists:

- Supplying list: `5-hirehop.js`, `1-docprev.js`, `3-meta.js`, `4-layout.js`, `6-editor2.js`, and `8-stagedesigner.js`.
- Autopull dialog: `2-apselall.js`.
- Home page: `5-hirehop.js` and `7-captrack.js`.
- Project or job tab set: `9-jobchecklist.js`.
- Project details jobs grid: `10-projectjobs-qol.js`.

Do not load `wise-headingedit-ui.js` or `wise-sectionbuilder-ui.js` in normal production.

## Fallback Policy

If the metadata module causes issues, disable `3-meta.js` first. The main editor has built-in metadata defaults and should continue running.

If the layout module causes issues, disable `4-layout.js`. The main editor has built-in layout defaults and should continue running.

If the HireHop integration module causes issues, disable `5-hirehop.js`. The main editor has built-in selector, endpoint, timing, depot, and prefix defaults and should continue running.

If the job checklist module causes issues, disable `9-jobchecklist.js`. It is standalone and does not affect the proposal editor, capacity tracker, or staging designer.

If the project jobs quality-of-life module causes issues, disable `10-projectjobs-qol.js`. It is standalone and only affects project details page scrolling and the compact project-information toggle.

If `6-editor2.js` causes issues, disable it and temporarily load the older `wise-sectionbuilder-ui.js` snapshot.
