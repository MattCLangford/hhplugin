# HireHop Plugin String

This file is generated from `manifest.json` by `tools/build-plugin-string.ps1`.

Do not hand-edit the current string or source table. Update `manifest.json` first, then regenerate this file.

## Current String

```text
https://mattclangford.github.io/hhplugin/5-hirehop.js?v=0.7; https://mattclangford.github.io/hhplugin/1-docprev.js?v=0.5; https://mattclangford.github.io/hhplugin/2-apselall.js?v=0.4; https://mattclangford.github.io/hhplugin/3-meta.js?v=0.1; https://mattclangford.github.io/hhplugin/4-layout.js?v=0.1; https://mattclangford.github.io/hhplugin/6-editor2.js?v=1.5; https://mattclangford.github.io/hhplugin/7-captrack.js?v=2.9; https://mattclangford.github.io/hhplugin/8-stagedesigner.js?v=1.9; https://mattclangford.github.io/hhplugin/9-jobchecklist.js?v=0.8; https://mattclangford.github.io/hhplugin/10-projectjobs-qol.js?v=0.2;
```

## Source Table

| Order | File | Cache version |
| --- | --- | --- |
| 1 | `5-hirehop.js` | `0.7` |
| 2 | `1-docprev.js` | `0.5` |
| 3 | `2-apselall.js` | `0.4` |
| 4 | `3-meta.js` | `0.1` |
| 5 | `4-layout.js` | `0.1` |
| 6 | `6-editor2.js` | `1.5` |
| 7 | `7-captrack.js` | `2.9` |
| 8 | `8-stagedesigner.js` | `1.9` |
| 9 | `9-jobchecklist.js` | `0.8` |
| 10 | `10-projectjobs-qol.js` | `0.2` |

## Maintenance Rule

When Codex updates an active runtime `.js` file, increment that file's `cacheVersion` by `0.1` in `manifest.json`, then run:

```powershell
.\tools\build-plugin-string.ps1
```

When a change touches multiple runtime `.js` files, increment each touched file by `0.1`.

When Codex adds a new runtime `.js` file, add it to:

- `manifest.json`
- `docs/LOAD_ORDER.md`
- `docs/HIREHOP_PLUGIN_STRING.md` by running this generator

New runtime files start at `?v=0.1` unless they are replacing an existing file, in which case use the next version for that replaced file.

## Quick Test

After updating HireHop company config, run this in the browser console:

```js
window.__wiseProposalPageEditor.describe()
```

Check that the expected modules show `loaded: true`.