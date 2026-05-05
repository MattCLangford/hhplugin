# HireHop Load Order

Use this order for the live HireHop scripts.

1. `wise-docpreviewpanel-ui.js`
2. `wise-autopull-selectall-ui.js`
3. `wise-sectionbuilder-meta-ui.js`
4. `wise-sectionbuilder-layouts-ui.js`
5. `wise-sectionbuilder2-ui.js`

## Keep Off In Normal Production

`wise-headingedit-ui.js`

This is the V1 concept editor and is superseded by the section builder.

`wise-sectionbuilder-ui.js`

This is the older fallback snapshot. Keep it available, but do not load it at the same time as `wise-sectionbuilder2-ui.js`.

## Reference Only

`QTC-V2.html`

This local copy is for checking renderer behavior. The deployed renderer already lives in HireHop.
