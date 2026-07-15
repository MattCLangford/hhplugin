# HireHop Load Order

Use this order for the live HireHop scripts.

1. `0-loader.js`

`0-loader.js` is the only script that should be pasted into the HireHop company config string. It waits until HireHop has rendered enough page context, then lazy-loads the page-specific modules below.

On the supplying list, `1-docprev.js` opens the docked proposal preview by default once its toolbar button is ready. The user can close it normally; subsequent page activity does not force it open again during that page session. Directly below the native button toolbar and above the list, the same module mounts the Commercial adjustments reminder followed by the lightweight Job Performance strip. It reads the final post-assumption subtotal from the live Job Track render (`doc=162`) and shows Revenue, COS, GP£ and GP%. Its solid-colour totaliser shows progress from 0% to the required 45% GP target, while the fill colour reflects the current overall GP% on an accelerated below-target dark-blue curve, then green at 45%, dark green at 65%, amber at 75%, red at 90%, and deep red at 100%. The native totals footer remains hidden presentation-only.

## Lazy Module Order

The loader preserves this order when a route needs the modules.

1. `5-hirehop.js`
2. `1-docprev.js`
3. `2-apselall.js`
4. `3-meta.js`
5. `4-layout.js`
6. `6-editor2.js` — currently disabled
7. `7-captrack.js`
8. `8-stagedesigner.js`
9. `9-jobchecklist.js`
10. `10-projectjobs-qol.js`
11. `11-projectjourney.js`
12. `12-projectgroups.js`
13. `13-proposalpageicons.js`
14. `14-jobgroups.js`

`11-projectjourney.js` loads on the project/job tab route, but it only installs the Journey tab when it detects the project tab set.

`12-projectgroups.js` loads on the project details route alongside `5-hirehop.js` and `10-projectjobs-qol.js`, but only groups fields (Proposal Creation depot only) — every other depot leaves it inactive.

`13-proposalpageicons.js` loads with the supplying-list bundle, but only changes icons when the logged-in user's active depot is Proposal Creation. `Section:` headings become landscape hero/title page thumbnails and `Dept:` headings become landscape half-image/half-table thumbnails. Their `// Section:` and `// Dept:` disabled forms retain the relevant layout with a muted slash. The exact `Technical Summary` support heading gets a separate eye-and-revenue medallion to identify its client-visible line items and attached revenue. All other headings and list rows retain their native icons.

`14-jobgroups.js` loads on the native job details page after `5-hirehop.js`, but only restyles the page when the logged-in user's active depot is Proposal Creation. It groups the current fields into Job Info, Job Dates and Times, and Job Commercial Info while preserving the original field elements and HireHop save behavior.

`6-editor2.js` remains registered but `0-loader.js` currently skips it, so the other supplying-list modules continue loading normally. To turn it back on, change its loader entry from `enabled: false` to `enabled: true`, restore its manifest status to `lazy-supplying-list-primary`, and set manifest `enabled` to `true`.

For the full paste-ready company config string, use `docs/HIREHOP_PLUGIN_STRING.md`.

After changing runtime files or cache versions in `manifest.json`, update lazy versions in `0-loader.js` when needed, then regenerate the string with:

```powershell
.\tools\build-plugin-string.ps1
```

## Keep Off In Normal Production

`wise-headingedit-ui.js`

This is the V1 concept editor and is superseded by the section builder.

`wise-sectionbuilder-ui.js`

This is the older fallback snapshot. Keep it available, but do not load it at the same time as `6-editor2.js`.

## Reference Only

`QTC-V2.html`

This local copy is for checking renderer behavior. The deployed renderer already lives in HireHop.
