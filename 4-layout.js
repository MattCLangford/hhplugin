(function () {
  "use strict";

  window.WiseProposalSectionBuilderLayouts = {
    version: "2026-05-05.01",
    purpose: "Shared page/layout catalogue for the Wise proposal section builder.",
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
