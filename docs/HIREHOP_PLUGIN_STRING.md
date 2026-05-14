# HireHop Plugin String

This file is generated from `manifest.json` by `tools/build-plugin-string.ps1`.

Do not hand-edit the current string or source table. Update `manifest.json` first, then regenerate this file.

## Current String

```text
https://mattclangford.github.io/hhplugin/1-docprev.js?v=0.1; https://mattclangford.github.io/hhplugin/2-apselall.js?v=0.1; https://mattclangford.github.io/hhplugin/3-meta.js?v=0.1; https://mattclangford.github.io/hhplugin/4-layout.js?v=0.1; https://mattclangford.github.io/hhplugin/5-hirehop.js?v=0.3; https://mattclangford.github.io/hhplugin/6-editor2.js?v=1.1; https://mattclangford.github.io/hhplugin/7-captrack.js?v=1.2;
```

## Source Table

| Order | File | Cache version |
| --- | --- | --- |
| 1 | `1-docprev.js` | `0.1` |
| 2 | `2-apselall.js` | `0.1` |
| 3 | `3-meta.js` | `0.1` |
| 4 | `4-layout.js` | `0.1` |
| 5 | `5-hirehop.js` | `0.3` |
| 6 | `6-editor2.js` | `1.1` |
| 7 | `7-captrack.js` | `1.2` |

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