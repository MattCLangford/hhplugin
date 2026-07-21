# HireHop Load Order

Use this order for the live HireHop scripts.

1. `0-loader.js`

`0-loader.js` is the only script that should be pasted into the HireHop company config string. It waits until HireHop has rendered enough page context, then lazy-loads the page-specific modules below.

On the supplying list, `1-docprev.js` opens the docked proposal preview by default once its toolbar button is ready. The user can close it normally; subsequent page activity does not force it open again during that page session. Directly below the native button toolbar and above the list, the same module mounts the Commercial adjustments reminder followed by the lightweight Job Performance strip. Revenue is the sum of each supplying line's explicit `Revenue` value or its inventory-master default when the line field is absent, while CoS is strictly the sum of native line `Total` values. The live Job Track render (`doc=162`) supplies the three commercial adjustment percentages and its flag. Discretionary discount plus venue and client commissions are displayed as a separate monetary Adjustments total and deducted when deriving GP£; they never inflate CoS. GP% remains GP£ divided by line Revenue. The strip's solid-colour totaliser shows progress from 0% to the required 45% GP target, while the fill colour reflects the adjusted GP% on an accelerated below-target dark-blue curve, then green at 45%, dark green at 65%, amber at 75%, red at 90%, and deep red at 100%. The native totals footer remains hidden presentation-only.

## Lazy Module Order

The loader preserves this order when a route needs the modules.

The loader does not start shared-dependent modules until `5-hirehop.js` is available. After that dependency succeeds, sibling modules for the detected route initialize independently. A failed sibling uses bounded exponential backoff and cannot prevent other features from loading. Replacing HireHop's complete supplying root invokes the modules' local health hooks so observers and toolbar controls attach to the new DOM. Automatic HireHop reads using the shared request service are serialised and rate-limit aware; user-opened work receives priority over background inventory hydration.

1. `5-hirehop.js`
2. `1-docprev.js`
3. `2-apselall.js`
4. `3-meta.js`
5. `4-layout.js`
6. `6-editor2.js` — currently disabled
7. `7-captrack.js`
8. `8-stagedesigner.js`
9. `9-jobchecklist.js` (commercial-tab policy active; prototype Checklist tab disabled)
10. `10-projectjobs-qol.js`
11. `11-projectjourney.js`
12. `12-projectgroups.js`
13. `13-proposalpageicons.js`
14. `14-jobgroups.js`
15. `15-supplyingcommercial.js`

`11-projectjourney.js` loads on the project/job tab route, but it only installs the Journey tab when it detects the project tab set.

`12-projectgroups.js` loads on the project details route alongside `5-hirehop.js` and `10-projectjobs-qol.js`, but only groups fields (Proposal Creation depot only) — every other depot leaves it inactive.

`13-proposalpageicons.js` loads with the supplying-list bundle, but only changes icons when the logged-in user's active depot is Proposal Creation. `Section:` headings become landscape hero/title page thumbnails and `Dept:` headings become landscape half-image/half-table thumbnails. Their `// Section:` and `// Dept:` disabled forms retain the relevant layout with a muted slash. The exact `Technical Summary` support heading gets a separate eye-and-revenue medallion to identify its client-visible line items and attached revenue. All other headings and list rows retain their native icons.

`14-jobgroups.js` loads on the native job details page after `5-hirehop.js`, but only restyles the page when the logged-in user's active depot is Proposal Creation. It presents the current values as three balanced cards—Job Info, Job Dates and Times, and Job Commercial Info—with operational subgroups, responsive two/one-column fallbacks, and Goods out/in omitted presentation-only. HireHop's underlying values and save behavior remain unchanged.

`15-supplyingcommercial.js` loads with the supplying-list bundle and activates only for the logged-in user's active Proposal Creation depot. It adds editable line-level `Revenue` and `Markup` custom fields to HireHop's native inventory-item dialog, including HireHop's namespaced supplying-row fields such as `items:_Revenue` and `items:_Markup`. Every popup is bound to its selected supplying row. An explicit line field, including an explicit blank, always wins; when a field is absent, the module resolves the inventory master by the row's stable `LIST_ID` and uses its custom Revenue/Markup as the untouched line's default. The same cached inventory-master lookup reads the component's `RSP` custom field. Each component row shows its per-unit RSP in a dedicated checkbox pill, and a summary above the list totals checked rows as `Qty × RSP` so users can price an ad-hoc kit or bundle without disturbing HireHop's native row selection. Components without RSP remain visible but cannot be checked. Entering Markup calculates Revenue from the native line Total (shown as CoS); entering Revenue calculates and saves a whole-number Markup. When CoS is blank or zero, Revenue can be entered and saved directly as a 100% GP line while Markup is cleared as not applicable. A live watcher follows HireHop's visible CoS control, so changing native Qty retains Markup and recalculates Revenue when a cost base exists, while preserving direct Revenue if CoS falls to zero. The supplying grid is presented as CoS, Markup, Revenue by mapping HireHop's native `supplying_list_heads` header and per-row `cust_node` tables, with the jsTreeGrid structure retained as a compatibility fallback. Native Unit Price is hidden presentation-only; the underlying Unit Price, Discount/Markup, Flag and Total values remain intact.

The top commercial-view switch alternates Job Performance and the RSP Calculator by changing visibility only. `1-docprev.js` continues to own Job Performance, while `15-supplyingcommercial.js` owns RSP controls and selections. Removing or gating the RSP enhancement restores Job Performance visibility before removing its own UI.

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
