# HireHop Plugin String

This file is generated from `manifest.json` by `tools/build-plugin-string.ps1`.

Do not hand-edit the current string or source table. Update `manifest.json` first, then regenerate this file.

## Current String

```text
https://mattclangford.github.io/hhplugin/0-loader.js?v=7.1;
```

## Source Table

| Order | File | Cache version |
| --- | --- | --- |
| 1 | `0-loader.js` | `7.1` |

## Lazy Loaded Runtime Modules

These files are not included directly in the HireHop company config string. `0-loader.js` injects them only when the matching HireHop page, tab set, supplying list, or dialog exists.

| Order | File | Cache version | Trigger | Enabled |
| --- | --- | --- | --- | --- |
| 1 | `5-hirehop.js` | `1.3` | `lazy-shared-module` | yes |
| 2 | `1-docprev.js` | `2.5` | `lazy-supplying-list` | yes |
| 3 | `2-apselall.js` | `0.5` | `lazy-autopull-dialog` | yes |
| 4 | `3-meta.js` | `0.2` | `lazy-supplying-list-module` | yes |
| 5 | `4-layout.js` | `0.2` | `lazy-supplying-list-module` | yes |
| 6 | `6-editor2.js` | `1.8` | `disabled-ready-to-enable` | no |
| 7 | `7-captrack.js` | `3.5` | `lazy-home-page` | yes |
| 8 | `8-stagedesigner.js` | `2.4` | `lazy-supplying-list-except-proposal-creation` | yes |
| 9 | `9-jobchecklist.js` | `1.2` | `lazy-project-job-tabs` | yes |
| 10 | `10-projectjobs-qol.js` | `1.0` | `lazy-project-details` | yes |
| 11 | `11-projectjourney.js` | `0.7` | `lazy-project-tabs` | yes |
| 12 | `12-projectgroups.js` | `0.13` | `lazy-project-details` | yes |
| 13 | `13-proposalpageicons.js` | `0.8` | `lazy-supplying-list-proposal-creation` | yes |
| 14 | `14-jobgroups.js` | `2.0` | `lazy-job-details` | yes |
| 15 | `15-supplyingcommercial.js` | `3.0` | `lazy-supplying-list-proposal-creation` | yes |
| 16 | `16-externalmod.js` | `0.3` | `lazy-proposal-creation-external-mod-bridge` | yes |

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

On a supplying-list page, the proposal bundle should lazy-load. Inspect the result with:

```js
window.WiseHireHopEnhancementLoader.loaded
```

Enabled supplying-list modules such as `hirehop` and `docprev` should be `true`. `stage` should be absent in Proposal Creation and `true` on supplying lists in other depots. A disabled module such as `editor` should be absent.