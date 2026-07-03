# HireHop Plugin String

This file is generated from `manifest.json` by `tools/build-plugin-string.ps1`.

Do not hand-edit the current string or source table. Update `manifest.json` first, then regenerate this file.

## Current String

```text
https://mattclangford.github.io/hhplugin/0-loader.js?v=0.7;
```

## Source Table

| Order | File | Cache version |
| --- | --- | --- |
| 1 | `0-loader.js` | `0.7` |

## Lazy Loaded Runtime Modules

These files are not included directly in the HireHop company config string. `0-loader.js` injects them only when the matching HireHop page, tab set, supplying list, or dialog exists.

| Order | File | Cache version | Trigger |
| --- | --- | --- | --- |
| 1 | `5-hirehop.js` | `0.7` | `lazy-shared-module` |
| 2 | `1-docprev.js` | `0.6` | `lazy-supplying-list` |
| 3 | `2-apselall.js` | `0.5` | `lazy-autopull-dialog` |
| 4 | `3-meta.js` | `0.1` | `lazy-supplying-list-module` |
| 5 | `4-layout.js` | `0.1` | `lazy-supplying-list-module` |
| 6 | `6-editor2.js` | `1.6` | `lazy-supplying-list-primary` |
| 7 | `7-captrack.js` | `3.0` | `lazy-home-page` |
| 8 | `8-stagedesigner.js` | `2.0` | `lazy-supplying-list` |
| 9 | `9-jobchecklist.js` | `1.0` | `lazy-project-job-tabs` |
| 10 | `10-projectjobs-qol.js` | `0.9` | `lazy-project-details` |
| 11 | `11-projectjourney.js` | `0.6` | `lazy-project-tabs` |
| 12 | `12-projectgroups.js` | `0.5` | `lazy-project-details` |

## Maintenance Rule

When Codex updates an active or lazy runtime `.js` file, increment that file's `cacheVersion` by `0.1` in `manifest.json` and mirror that version in `0-loader.js` if the file is lazy-loaded, then run:

```powershell
.\tools\build-plugin-string.ps1
```

When a change touches multiple runtime `.js` files, increment each touched file by `0.1`.

When Codex adds a new runtime `.js` file, add it to:

- `manifest.json`
- `docs/LOAD_ORDER.md`
- `docs/HIREHOP_PLUGIN_STRING.md` by running this generator
- `0-loader.js` if it should be lazy-loaded

New runtime files start at `?v=0.1` unless they are replacing an existing file, in which case use the next version for that replaced file.

## Quick Test

After updating HireHop company config, run this in the browser console:

```js
window.WiseHireHopEnhancementLoader
```

On a supplying-list page, the proposal bundle should lazy-load. Then this should be available:

```js
window.__wiseProposalPageEditor.describe()
```
