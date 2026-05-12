# HireHop Load Order

Use this order for the live HireHop scripts.

1. `1-docprev.js`
2. `2-apselall.js`
3. `3-meta.js`
4. `4-layout.js`
5. `5-hirehop.js`
6. `6-editor2.js`
7. `7-captrack.js`

For the full paste-ready company config string, use `docs/HIREHOP_PLUGIN_STRING.md`.

After changing runtime files or cache versions in `manifest.json`, regenerate the string with:

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
