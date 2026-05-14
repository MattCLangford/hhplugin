# Wise HireHop Proposal Platform

This folder is now treated as the local source package for Wise's HireHop proposal tooling.

## What This Is

The system is an internal authoring and rendering platform layered on top of HireHop.

HireHop remains the operational database for jobs, headings, items, listed inventory, crew, costs and native editing. The Wise scripts add a proposal authoring experience, document preview, and targeted workflow helpers so the same HireHop list can produce polished QTC proposals and more detailed technical requirements.

## Active Runtime Scripts

Load these in HireHop:

1. `1-docprev.js`
2. `2-apselall.js`
3. `3-meta.js`
4. `4-layout.js`
5. `5-hirehop.js`
6. `6-editor2.js`
7. `7-captrack.js`

`1-docprev.js` is essential because it lets users see what their list edits do to the rendered proposal. Power users can work directly in HireHop's native list editing with that preview open.

`2-apselall.js` is a small helper for a repetitive native popup action. It should remain independent and boring in the best possible way.

`3-meta.js` owns the shared `WisePageMeta` envelope and editor/template identifiers. Load it before the main editor so metadata names stay explicit and easy to audit.

`4-layout.js` contains the proposal page catalogue and layout matching rules.

`5-hirehop.js` names the HireHop UI selectors, endpoint paths, depot rules, timings, and tree item prefixes that the editor depends on.

`6-editor2.js` is the primary editor. It gives non-technical users a safer visual page editor for baseline QTC standards, while still handing native item editing back to HireHop where appropriate.

`7-captrack.js` is the Wise capacity tracker. It opens as a full-page planning view and uses project-level Wise custom fields for event naming, status, revenue, tier, client, venue, and role allocation.

## Reference And Legacy Files

`QTC-V2.html` is reference-only in this folder. The real renderer is already deployed in HireHop, but keeping a local copy is useful when checking that editor metadata and renderer expectations still match.

`wise-headingedit-ui.js` is deprecated and should be switched off in HireHop. It was the V1 concept editor and is now superseded by `6-editor2.js`.

`wise-sectionbuilder-ui.js` is fallback-only. Keep it as a rollback snapshot, but do not load it alongside `6-editor2.js`.

## Source Of Truth

The system has three sources of truth:

- HireHop's supplying-list tree and item records.
- Hidden `WisePageMeta` JSON stored inside HireHop technical/memo fields.
- The QTC renderer's layout mappings and templates.

When these disagree, the user experience becomes confusing. Most future improvements should reduce disagreement between those three layers.

## Console Helpers

In HireHop, after the editor script loads, run:

```js
window.__wiseProposalPageEditor.describe()
```

That returns the editor version, storage model, loaded modules, and registered proposal layouts.
