"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const qtc = fs.readFileSync(path.join(root, "QTC-V4.html"), "utf8");

[
  "Reminder", "PageHeading", "Blurb", "ImageURL", "CreatePage",
  "Include", "Additional", "PageTemplate", "PageVariant", "Grouping"
].forEach(field => {
  assert(qtc.includes(`name="items:_${field}"`), `QTC V4 should request items:_${field}`);
  assert(qtc.includes(`data-qtc-field="${field}"`), `QTC V4 should expose ${field} to its strict field reader`);
});

assert(qtc.includes('"15": Object.freeze({ label: "Our Experts", layoutId: "experts", renderType: "Dept" })'), "PageTemplate 15 should route to the Our Experts layout");
assert(qtc.includes('"15": Object.freeze(["1", "2", "3"])'), "Our Experts should support Auto, Image Left and Image Right variants");
assert(qtc.includes("const isPageHeading = isHeading && parseCreatePage(headingFields.createPage"), "CreatePage should be authoritative for page creation");
assert(qtc.includes("const configuredPageHeading = cleanHeadingFieldValue(headingFields.pageHeading)"), "PageHeading should feed the rendered page title");
assert(qtc.includes("const headingBlurb = cleanHeadingFieldValue(headingFields.blurb)"), "Blurb should feed the configured page layout");
assert(qtc.includes("const imageUrl = normaliseImageUrl(cleanHeadingFieldValue(fields.imageUrl)"), "ImageURL should feed the configured page layout");
assert(qtc.includes('blurb: "items:_Blurb is the sole page/table-heading blurb source'), "the strict V4 contract should reject legacy blurb fallbacks");
assert(qtc.includes('revenue: "items:_Revenue is the sole line-revenue source'), "the strict V4 contract should retain _Revenue as the line revenue source");

console.log("QTC V4 heading-field contract tests passed.");
