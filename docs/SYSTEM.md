# Wise HireHop Proposal Platform

This folder is now treated as the local source package for Wise's HireHop proposal tooling.

## What This Is

The system is an internal authoring and rendering platform layered on top of HireHop.

HireHop remains the operational database for jobs, headings, items, listed inventory, crew, costs and native editing. The Wise scripts add a proposal authoring experience, document preview, and targeted workflow helpers so the same HireHop list can produce polished QTC proposals and more detailed technical requirements.

## Active Runtime Scripts

Load this in HireHop:

1. `0-loader.js`

`0-loader.js` is the only script in the HireHop company config string. It waits for HireHop page context, then lazy-loads the specific module bundle needed by the current surface: supplying list, Autopull popup, home page, project/job tabs, or project-details jobs grid.

`5-hirehop.js` names the HireHop UI selectors, endpoint paths, depot rules, timings, active depot detector, and tree item prefixes that the other runtime scripts depend on. It loads first so each module shares the same framework-aware HireHop context.

`1-docprev.js` is essential because it lets users see what their list edits do to the rendered proposal. On an eligible supplying-list page it opens docked by default as soon as its toolbar entry point is mounted. The user can close it normally, and a one-time startup guard prevents later refreshes or DOM activity from forcing it open again during that page session. Power users can therefore work directly in HireHop's native list editing with the preview immediately visible.

`2-apselall.js` is a small helper for a repetitive native popup action across all depots. It should remain independent and boring in the best possible way.

`3-meta.js` owns the shared `WisePageMeta` envelope and editor/template identifiers. Load it before the main editor so metadata names stay explicit and easy to audit.

`4-layout.js` contains the proposal page catalogue and layout matching rules.

`6-editor2.js` is the primary editor implementation, but it is currently disabled in `0-loader.js`. The file remains available to restore later; when enabled it gives non-technical users a safer visual page editor for baseline QTC standards, while still handing native item editing back to HireHop where appropriate.

`7-captrack.js` is the Wise capacity tracker. Its home-page entry button is visible across all depots. It opens as a full-page planning view and uses project-level Wise custom fields for event naming, status, revenue, tier, client, venue, and role allocation.

`8-stagedesigner.js` adds a simple staging kit designer to the supplying list toolbar. It loads and caches live HireHop items from the metric Staging category, the imperial Unit 10 Stock staging family, and the Unit 10 Consumables sales-stock category for imperial carpet/felt. Carpet and fascia/felt colour controls are limited to exact live sales-stock colours with one Custom option for bought-in colours. It imports generated stage rows under a stage heading that includes the 3/4 sided fascia choice, using `items_import.php`, posting hire components as `STOCK_ID` rows and selected imperial carpet/felt consumables as `SALES_ID` rows. Every stage includes one live staging box: small for 1-2 deck pieces, medium for 3-6, and large for 7 or more. Carpet is emitted as one combined stage-top/tread line. Metric mode still creates custom rows for individual 1m fascia board sections by run and the calculated felt run, overlap, tread allowance, and total linear metres.

`9-jobchecklist.js` adjusts the project and job page tabs across all depots. Non-admin users have the Billing and Purchase orders tabs hidden, admin users keep the full native tab set, and everyone gets a Checklist tab that fills the native tab content area. The checklist uses placeholder technical-manager items until the final HireHop project and job custom fields are named.

`10-projectjobs-qol.js` keeps the project page jobs list reachable across all depots when project-level custom fields make the upper information section tall. It makes the project details tab scrollable and adds a native-looking compact toggle that hides only the upper project information block so the existing HireHop jobs grid gets more visible space.

`12-projectgroups.js` is Proposal Creation depot only, gated on the logged-in user's active depot (a session-level permissions barrier, not which depot the project itself belongs to). It reads `window.user`'s own depot field directly rather than the shared `5-hirehop.js` depot-detection helper — that helper's page-wide `select,input,textarea` scan was confirmed (via its own `debug()` output) to always resolve to "Proposal Creation" on the project details page regardless of the user's real active depot, because it was matching an unrelated always-present element rather than the header depot switcher. It groups the native `#proj_info` project fields into 5 boxed sections — System Details, Wise Project Details, Project Ownership, Operational Timings, Working Links — by wrapping the elements that already sit together in the DOM with `.wrapAll()` into a header+body structure, then swaps the two top-level blocks (a plain DOM move) so the Salesforce/Wise group renders before the native System Details block. Section boxes get native-style light-grey/white panels with thin `#a1a1a1` borders, sized as a real CSS Grid (System Details) or flex-wrap (the other four) one level deeper so every field keeps the sizing HireHop already gave it. Wise Project Details is styled as the primary/main-attraction section (white body, bold accent-coloured top border); Project Ownership/Operational Timings/Working Links are supporting sections (light grey, thinner accent); System Details deliberately gets no background override, so HireHop's own native project-colour banding (the coloured header strip, white row backgrounds) keeps showing through unobscured — only a thin border and small muted caption are added. The accent colour is read directly from `#proj_info`'s own inline `background-color` (the live project colour) and exposed as the `--wise-project-accent` CSS variable. Every other depot leaves this module inactive and the native screen fully untouched.

`13-proposalpageicons.js` is a Proposal Creation depot-only supplying-list visual guide. It replaces native folder icons with compact landscape page thumbnails styled to sit alongside HireHop's native tree icons: `Section:` uses a hero-image page with a centred title, and `Dept:` uses a half-image/half-table page. Their `// Section:` and `// Dept:` forms keep the matching layout with a muted slash. The exact `Technical Summary` support heading uses a visually separate eye-and-revenue medallion for the client-visible line items and revenue it contains; it deliberately resembles neither a page nor a folder. The module reads the logged-in user's active depot from `window.user`, fails closed when that depot cannot be confirmed, and only changes rendered icon classes—the supplying-list names, records, hierarchy, and unmatched native icons are not modified.

## Reference And Legacy Files

`QTC-V2.html` is reference-only in this folder. The real renderer is already deployed in HireHop, but keeping a local copy is useful when checking that editor metadata and renderer expectations still match.

`wise-headingedit-ui.js` is deprecated and should be switched off in HireHop. It was the V1 concept editor and is now superseded by `6-editor2.js`.

`wise-sectionbuilder-ui.js` is fallback-only. Keep it as a rollback snapshot, but do not load it alongside `6-editor2.js`.

## Source Of Truth

The system has three sources of truth:

- HireHop's supplying-list tree and item records.
- Hidden `WisePageMeta` JSON stored inside HireHop technical/memo fields. Page control logic belongs here: `renderType`, `layoutId`, `hidden`, `excludeFromProjectTotal`, `imageUrl`, `splitSide`, `summaryMode`, `layoutVariant`, `pageKind`, and `deptLayout` (`image`, `no-image`, or `columns`).
- The QTC renderer's layout mappings and templates.

When these disagree, the user experience becomes confusing. Most future improvements should reduce disagreement between those three layers.

## Console Helpers

In HireHop, after the editor script loads, run:

```js
window.__wiseProposalPageEditor.describe()
```

That returns the editor version, storage model, loaded modules, and registered proposal layouts.
