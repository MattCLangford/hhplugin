# HireHop Load Order

Use this order for the live HireHop scripts.

1. `0-loader.js`

`0-loader.js` is the only script that should be pasted into the HireHop company config string. It waits until HireHop has rendered enough page context, then lazy-loads the page-specific modules below.

On the supplying list, `1-docprev.js` opens the docked proposal preview by default once its toolbar button is ready. The user can close it normally; subsequent page activity does not force it open again during that page session. Directly below the native button toolbar and above the list, the same module mounts the Commercial adjustments reminder followed by the lightweight Job Performance strip. Revenue and CoS have no item-type allowlist: every non-heading supplying item participates, including hire stock, sales stock, custom, labour and any other native item kind. Revenue is read through the same commercial-field resolver used to display each row, while CoS is read from the same rendered native `Total`/CoS cell, so the visible line values add up to the performance strip. Structural heading/root rows are the only exclusion because their displayed figures can be parent subtotals that would double-count children. Rows with an actual inventory/list master may inherit its Revenue default when the line field is absent; other rows use their line-level fields. The live Job Track render (`doc=162`) supplies the three commercial adjustment percentages and its flag. Discretionary discount plus venue and client commissions are displayed as a separate monetary Adjustments total and deducted when deriving GP£; they never inflate CoS. GP% remains GP£ divided by line Revenue. The strip's solid-colour totaliser shows progress from 0% to the required 45% GP target, while the fill colour reflects the adjusted GP% on an accelerated below-target dark-blue curve, then green at 45%, dark green at 65%, amber at 75%, red at 90%, and deep red at 100%. The native totals footer remains hidden presentation-only.

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
8. `8-stagedesigner.js` — disabled in Proposal Creation only
9. `9-jobchecklist.js` (commercial-tab policy active; prototype Checklist tab disabled)
10. `10-projectjobs-qol.js`
11. `11-projectjourney.js`
12. `12-projectgroups.js`
13. `13-proposalpageicons.js`
14. `14-jobgroups.js`
15. `15-supplyingcommercial.js`
16. `16-externalmod.js`

`16-externalmod.js` is a Proposal Creation depot-only bridge for the pinned external Stage Designer tool while keeping `0-loader.js` as the only HireHop company-config URL. The loader starts the shared authoritative depot detector first, and the bridge does not request the external tool unless that detector identifies Proposal Creation. Its local menu adapter treats HireHop API `1.31` as a supported `1.x` release, avoiding the upstream loader's numeric `<= 1.3` comparison, and removes its menu entries whenever the active depot is not Proposal Creation. The bridge rejects non-HTTPS URLs and embedded credentials, prevents duplicate loading, and contains download failures so the Wise modules continue normally. Because the external script works inside HireHop, it has the same page access as the other mods and remains pinned to a reviewed version.

`8-stagedesigner.js` is excluded only when the shared depot detector identifies Proposal Creation, preventing it from interfering with the Proposal Creation external mod. It remains available on supplying lists in every other depot. The loader avoids requesting the file in Proposal Creation; the module also removes its button and open overlay if an already-loaded HireHop session changes into that depot.

`11-projectjourney.js` loads on the project/job tab route, but it only installs the Journey tab when it detects the project tab set.

`12-projectgroups.js` loads on the project details route alongside `5-hirehop.js` and `10-projectjobs-qol.js`, but only groups fields (Proposal Creation depot only) — every other depot leaves it inactive.

`13-proposalpageicons.js` loads with the supplying-list bundle, but only changes icons when the logged-in user's active depot is Proposal Creation. `Section:` headings become landscape hero/title page thumbnails and `Dept:` headings become landscape half-image/half-table thumbnails. Their `// Section:` and `// Dept:` disabled forms retain the relevant layout with a muted slash. The exact `Technical Summary` support heading gets a separate eye-and-revenue medallion to identify its client-visible line items and attached revenue. All other headings and list rows retain their native icons.

`14-jobgroups.js` loads on the native job details page after `5-hirehop.js`, but only restyles the page when the logged-in user's active depot is Proposal Creation. It presents the current values as three balanced cards—Job Info, Job Dates and Times, and Job Commercial Info—with operational subgroups, responsive two/one-column fallbacks, and Goods out/in omitted presentation-only. HireHop's underlying values and save behavior remain unchanged.

`15-supplyingcommercial.js` loads with the supplying-list bundle and activates only for the logged-in user's active Proposal Creation depot. It displays line-level `Revenue` and `Markup` from each supplying line's custom-field bag, including HireHop's namespaced fields such as `items:_Revenue` and `items:_Markup`. Namespaced line fields are authoritative when HireHop also exposes a generic row property with the same logical name. An explicit line field, including an explicit blank, always wins; when a field is absent, a row with a stable inventory `LIST_ID` can inherit its master Revenue/Markup defaults. The inventory lookup also reads the component's `RSP` custom field. Each master-backed component shows its quantity-extended line RSP (`Qty × unit RSP`) in the dedicated calculator column, and selected line totals are added once without disturbing HireHop's native row selection. The supplying grid is presented as CoS, Markup and Revenue by mapping HireHop's native header and row tables, with the jsTreeGrid structure retained as a compatibility fallback. Native Unit Price is hidden presentation-only; the underlying native values remain intact.

From `15-supplyingcommercial.js` cache version `2.3`, native-popup field injection is retired. From cache version `2.4`, each item row instead has a compact pen action beside Revenue. It opens a standalone Markup/Revenue editor and performs a partial `items_save.php` update containing only the line identity, inferred item kind, current job routing ID and merged `custom_fields`; it does not resubmit Qty, dates, pricing, memo, parent or other native values. From cache version `2.5`, stable line ID and kind routing come first from HireHop's native tree node identity. From cache version `2.6`, the editor and Job Performance use every non-heading supplying item rather than an item-kind allowlist. From cache version `2.7`, a successful native item-popup save preserves any existing line Revenue, waits for the updated CoS, recalculates whole-number Markup (`Revenue ÷ CoS − 1`), and persists only the corrected commercial custom fields. At zero CoS, Revenue remains set and Markup is cleared as not applicable. Tagged commercial-only saves are excluded from this watcher so the follow-up cannot recurse. From cache version `2.8`, a structural heading with direct item children receives a percentage action in its Markup cell. One whole-number Markup is applied sequentially to those immediate item children, with each Revenue recalculated from that child's displayed CoS. Child headings and all deeper descendants are excluded from the batch. From cache version `2.9`, the next child save starts as soon as HireHop acknowledges the previous one, removing the fixed 1.15-second per-line delay. Existing rows still use the single-identity `items_save.php` contract; `items_import.php` is not used because it creates new rows rather than updating the selected children.

From cache version `3.0`, a real native item identity takes precedence over stale `kind=0` metadata. This keeps inventory, virtual and custom picker-created rows in the commercial renderer so their `_Revenue` values remain visible and included in Job Performance.

The top commercial-view switch alternates Job Performance and the RSP Calculator by changing visibility only. `1-docprev.js` continues to own Job Performance, while `15-supplyingcommercial.js` owns RSP controls and selections. Removing or gating the RSP enhancement restores Job Performance visibility before removing its own UI.

RSP checkbox clicks are captured on the current supplying root before HireHop's row handlers can consume or redraw them. Selection is stored against a stable supplying-line identity rather than a transient DOM node, then rehydrated after bounded immediate/post-redraw checks. A short retention window preserves checked state while HireHop temporarily removes a row or its inherited RSP returns to loading during an edit/redraw; selection is removed only when the row remains absent or its RSP resolves as unavailable. Geometry writes are idempotent and excluded from the supplying mutation refresh trigger so alignment maintenance cannot create a refresh loop that interferes with checkbox state.

Because HireHop renders the supplying header and item rows as separate tables, the commercial module applies one shared width contract to CoS, Markup, Revenue and RSP. The Revenue edit icon lives within that existing width. A resize observer and a post-switch alignment pass reconcile the header with the visible row geometry after preview resizing or switching between Job Performance and RSP Calculator. The native inline styles are restored if the enhancement is removed.

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

`QTC-V4.html`

This local copy is for checking renderer behavior. The deployed renderer already lives in HireHop.
