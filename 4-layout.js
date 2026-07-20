(function () {
  "use strict";

  window.WiseProposalSectionBuilderLayouts = {
    version: "2026-07-20.01",
    purpose: "Shared page/layout catalogue and QTC-V4 Heading custom-field value mappings.",
    layouts: {
      "hero": { label: "Hero cover" },
      "section-cover": { label: "Title cover" },
      "dept-table": { label: "Dept costing/text page", costingRows: true },
      "summary": { label: "Proposal summary / project total" },
      "visual": { label: "Visual page" },
      "fpvisual": { label: "Full-page visual / embed" },
      "venue-hero": { label: "Venue hero" },
      "exp": { label: "Experience & Expertise" },
      "experts": { label: "Our Experts" },
      "pm": { label: "Project manager" },
      "team": { label: "Specialist team" },
      "critical-path": { label: "Critical path", managedRows: true },
      "thankyou": { label: "Thank you" },
      "sustainability": { label: "Sustainability", locked: true },
      "about-us": { label: "About us", locked: true },
      "details-container": { label: "Details container" }
    },
    pageTemplates: {
      "1": { label: "Hero", layoutId: "hero", renderType: "section" },
      "2": { label: "Cover", layoutId: "section-cover", renderType: "section" },
      "3": { label: "Costing", layoutId: "dept-table", renderType: "dept" },
      "4": { label: "Full Page Visual", layoutId: "fpvisual", renderType: "dept" },
      "5": { label: "3/4 Page Visual", layoutId: "visual", renderType: "dept" },
      "6": { label: "Proposal Summary", layoutId: "summary", renderType: "dept" },
      "7": { label: "Labour", layoutId: "dept-table", renderType: "dept", pageKind: "labour" },
      "8": { label: "General Requirements", layoutId: "dept-table", renderType: "dept", pageKind: "general-requirements" },
      "9": { label: "Venue Hero", layoutId: "venue-hero", renderType: "dept" },
      "10": { label: "Experience & Expertise", layoutId: "exp", renderType: "dept" },
      "11": { label: "Out Experts", layoutId: "experts", renderType: "dept", pageKind: "experts-intro" },
      "12": { label: "Proven Process", layoutId: "section-cover", renderType: "dept", pageKind: "proven-process" },
      "13": { label: "Dedicated Project Manager", layoutId: "pm", renderType: "dept" },
      "14": { label: "Your Sepcialist Team", layoutId: "team", renderType: "dept" },
      "15": { label: "Our Experts", layoutId: "experts", renderType: "dept" },
      "16": { label: "Event Overview", layoutId: "section-cover", renderType: "section", pageKind: "event-overview" },
      "17": { label: "Proposed Timings", layoutId: "dept-table", renderType: "dept", pageKind: "proposed-timings" },
      "18": { label: "Critical Path", layoutId: "critical-path", renderType: "dept" },
      "19": { label: "About Us", layoutId: "about-us", renderType: "dept" },
      "20": { label: "Sustainability", layoutId: "sustainability", renderType: "dept" },
      "21": { label: "Thank You", layoutId: "thankyou", renderType: "dept" }
    },
    pageVariants: {
      "1": { label: "Auto", variant: "auto" },
      "2": { label: "Image Left", variant: "image-left", splitSide: "left" },
      "3": { label: "Image Right", variant: "image-right", splitSide: "right" },
      "4": { label: "No Image", variant: "no-image", deptLayout: "no-image" },
      "5": { label: "1 Column", variant: "one-column", columns: 1 },
      "6": { label: "2 Columns", variant: "two-columns", columns: 2 },
      "7": { label: "3 Columns", variant: "three-columns", columns: 3, deptLayout: "columns" },
      "8": { label: "Alternative", variant: "alternative", layoutVariant: "alt" }
    },
    rules: {
      shared: [
        { id: "venue-hero", field: "titleText", equals: ["venue hero"] }
      ],
      section: [
        { id: "hero", field: "titleText", equals: ["hero", "hero page"] },
        { id: "details-container", field: "titleText", equals: ["details"] }
      ],
      dept: [
        { id: "fpvisual", field: "rawTitle", regex: "^fpv(?:isual)?\\b" },
        { id: "pm", field: "titleText", containsAny: ["project manager", "dedicated project manager"] },
        { id: "team", field: "titleText", equals: ["team"] },
        { id: "team", field: "titleText", containsAny: ["specialist team"] },
        { id: "team", field: "titleText", containsAll: ["team", "specialist"] },
        { id: "exp", field: "titleText", containsAll: ["experience", "expertise"] },
        { id: "experts", field: "titleText", equals: ["our experts"] },
        { id: "experts", field: "titleText", containsAny: ["experts"] },
        { id: "critical-path", field: "titleText", equals: ["critical path"] },
        { id: "sustainability", field: "titleText", equals: ["sustainability"] },
        { id: "about-us", field: "titleText", equals: ["about us"] },
        { id: "thankyou", field: "titleText", containsAny: ["thank you"] },
        { id: "summary", field: "titleText", equals: ["project total", "proposal summary"] },
        { id: "visual", field: "sectionTitleText", equals: ["visual"] }
      ]
    }
  };
})();
