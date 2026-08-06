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

It also owns multi-source Proposal Creation depot resolution, docked/undocked supplying-toolbar discovery and the shared automatic-read queue. The depot resolver evaluates all known logged-in-user depot fields and active header state; one unrelated numeric field cannot veto a positive Proposal Creation match. HireHop reads are prioritised, deduplicated, cached where safe, and serialised with a conservative minimum gap. A detected rate-limit response pauses queued work instead of causing a retry burst. Loader and request diagnostics are available through `WiseHireHopDiagnostics.describe()`. See [PERFORMANCE_AUDIT.md](PERFORMANCE_AUDIT.md) for the request inventory and live verification checklist.

`1-docprev.js` is essential because it lets users see what their list edits do to the rendered proposal. On an eligible supplying-list page it opens docked by default as soon as its toolbar entry point is mounted. The user can close it normally, and a one-time startup guard prevents later refreshes or DOM activity from forcing it open again during that page session. Immediately below HireHop's native button toolbar and above the supplying list, the module mounts the Commercial adjustments reminder followed by the compact Job Performance strip. Revenue and CoS use every non-heading supplying item without an item-type allowlist. Revenue is resolved through the same commercial-field path used by the visible row and CoS is read from the same rendered native `Total`/CoS cell, ensuring the displayed item-line figures add up to Job Performance. Structural headings/roots are excluded to prevent their parent subtotals from double-counting child lines. Any row with an actual inventory/list master can fall back to its master Revenue when the line field is absent; rows without a master use line fields. A hidden same-origin Job Track render (`doc=162`) supplies the commercial assumptions and Review/OK flag. Discretionary discount plus venue and client commissions are presented as a separate monetary Adjustments total and deducted from GP£, never added to CoS. GP% remains GP£ divided by line Revenue. Adjusted GP% drives the strip colour using continuous RGB interpolation: the below-target curve is deliberately accelerated towards dark blue at 0%, with green at 45%, dark green at 65%, amber at 75%, red at 90%, and deep red at 100%. The rail is a solid-colour totaliser whose fill represents progress from 0% to the required 45% GP target and caps at full once that target is achieved. The strip refreshes after supplying-list saves and after inventory defaults resolve. The native footer containing Replacement cost, Weight, Volume, Discount/Markup, and Quoted net total remains hidden presentation-only using its unique labels; no HireHop value is changed or deleted. `15-supplyingcommercial.js` also exposes inventory-master RSP beside master-backed rows and totals checked components by supplying quantity for ad-hoc kit/bundle pricing; this is display-only and does not write RSP or alter native row selection.

Job Performance and the RSP Calculator remain independent modules. A segmented commercial-view switch changes only their visibility at the top of the supplying list; it does not move ownership, clear RSP selections, recalculate Job Performance, or remove either module. Job Performance is the default whenever a supplying page is opened; users explicitly switch to the RSP Calculator when needed.

Revenue and Markup are stored in each supplying line's HireHop custom-field bag, even for native item types whose editor does not expose those fields. The standalone Revenue editor owns direct commercial changes. A structural heading whose immediate children include real item lines also receives a Markup-only percentage action; it preflights the full direct-child batch, calculates each child's Revenue from its own visible CoS, and saves those lines through the same minimal commercial update path. HireHop's existing-line endpoint accepts one item identity per request, so the batch starts each next save immediately after the preceding server acknowledgement rather than using the normal fixed write delay. The bulk-import endpoint is not used because it creates supplying rows. Nested headings and their descendants are not part of that heading's batch. When a user instead saves HireHop's native item popup, `15-supplyingcommercial.js` leaves the saved Revenue fixed, waits for the line's updated CoS, recalculates Markup from that new cost, and writes only the merged commercial custom fields. For example, £500 Revenue against a CoS changed from £100 to £250 becomes 100% Markup while Revenue remains £500. The follow-up write is tagged and excluded from native-save detection to prevent a save loop.

`2-apselall.js` is a small helper for a repetitive native popup action across all depots. It should remain independent and boring in the best possible way.

`3-meta.js` owns the shared `WisePageMeta` envelope and editor/template identifiers. Load it before the main editor so metadata names stay explicit and easy to audit.

`4-layout.js` contains the proposal page catalogue and layout matching rules.

`6-editor2.js` is the primary editor implementation, but it is currently disabled in `0-loader.js`. The file remains available to restore later; when enabled it gives non-technical users a safer visual page editor for baseline QTC standards, while still handing native item editing back to HireHop where appropriate.

`7-captrack.js` is the Wise capacity tracker. Its home-page entry button is visible across all depots. It opens as a full-page planning view and uses project-level Wise custom fields for event naming, status, revenue, tier, client, venue, and role allocation. Technical and Production can be viewed separately or together; these manager views show grey `DaysPrior` and `DaysPost` allocation buffers whose outer handles save whole-day changes directly to the project custom fields.

`8-stagedesigner.js` adds a simple staging kit designer to the supplying list toolbar in every depot except Proposal Creation, where the loader excludes it to avoid conflicts with the depot's external mod. It loads and caches live HireHop items from the metric Staging category, the imperial Unit 10 Stock staging family, and the Unit 10 Consumables sales-stock category for imperial carpet/felt. Carpet and fascia/felt colour controls are limited to exact live sales-stock colours with one Custom option for bought-in colours. It imports generated stage rows under a stage heading that includes the 3/4 sided fascia choice, using `items_import.php`, posting hire components as `STOCK_ID` rows and selected imperial carpet/felt consumables as `SALES_ID` rows. Every stage includes one live staging box: small for 1-2 deck pieces, medium for 3-6, and large for 7 or more. Carpet is emitted as one combined stage-top/tread line. Metric mode still creates custom rows for individual 1m fascia board sections by run and the calculated felt run, overlap, tread allowance, and total linear metres.

`16-externalmod.js` loads the pinned third-party Stage Designer tool only while the active depot is Proposal Creation. It supplies the HireHop New/context-menu adapter locally because the upstream loader incorrectly rejects API `1.31` with a numeric `<= 1.3` comparison. The adapter accepts HireHop API `1.x`, preserves the shared depot gate, and removes its entries after a depot switch away from Proposal Creation.

`9-jobchecklist.js` adjusts the project and job page tabs across all depots. Non-admin users have the Billing and Purchase orders tabs hidden and admin users keep the full native tab set. The prototype Checklist tab and panel are currently disabled; their source remains available if the feature is revived later.

`10-projectjobs-qol.js` keeps the project page jobs list reachable across all depots when project-level custom fields make the upper information section tall. It makes the project details tab scrollable and adds a native-looking compact toggle that hides only the upper project information block so the existing HireHop jobs grid gets more visible space.

`12-projectgroups.js` is Proposal Creation depot only, gated on the logged-in user's active depot (a session-level permissions barrier, not which depot the project itself belongs to). It reads `window.user`'s own depot field directly rather than the shared `5-hirehop.js` depot-detection helper — that helper's page-wide `select,input,textarea` scan was confirmed (via its own `debug()` output) to always resolve to "Proposal Creation" on the project details page regardless of the user's real active depot, because it was matching an unrelated always-present element rather than the header depot switcher. It groups the native `#proj_info` project fields into 5 boxed sections — System Details, Wise Project Details, Project Ownership, Operational Timings, Working Links — by wrapping the elements that already sit together in the DOM with `.wrapAll()` into a header+body structure, then swaps the two top-level blocks (a plain DOM move) so the Salesforce/Wise group renders before the native System Details block. Section boxes get native-style light-grey/white panels with thin `#a1a1a1` borders, sized as a real CSS Grid (System Details) or flex-wrap (the other four) one level deeper so every field keeps the sizing HireHop already gave it. Wise Project Details is styled as the primary/main-attraction section (white body, bold accent-coloured top border); Project Ownership/Operational Timings/Working Links are supporting sections (light grey, thinner accent); System Details deliberately gets no background override, so HireHop's own native project-colour banding (the coloured header strip, white row backgrounds) keeps showing through unobscured — only a thin border and small muted caption are added. The accent colour is read directly from `#proj_info`'s own inline `background-color` (the live project colour) and exposed as the `--wise-project-accent` CSS variable. Every other depot leaves this module inactive and the native screen fully untouched.

`13-proposalpageicons.js` is a Proposal Creation depot-only supplying-list visual guide. It replaces native folder icons with compact landscape page thumbnails styled to sit alongside HireHop's native tree icons: `Section:` uses a hero-image page with a centred title, and `Dept:` uses a half-image/half-table page. Their `// Section:` and `// Dept:` forms keep the matching layout with a muted slash. The exact `Technical Summary` support heading uses a visually separate eye-and-revenue medallion for the client-visible line items and revenue it contains; it deliberately resembles neither a page nor a folder. The module reads the logged-in user's active depot from `window.user`, fails closed when that depot cannot be confirmed, and only changes rendered icon classes—the supplying-list names, records, hierarchy, and unmatched native icons are not modified.

`14-jobgroups.js` is the matching Proposal Creation-only visual treatment for the native job details page. It leaves HireHop's underlying values and save behavior unchanged, but presents the current values as three equal cards on wide screens: Job Info, Job Dates and Times, and Job Commercial Info. Each card follows a natural top-to-bottom workflow with subtle labelled dividers; narrower screens reflow to two columns and then one. Goods out and Goods in are deliberately omitted from this presentation. The same active-depot gate and live HireHop colour accent pattern used by the project cards is retained.

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
