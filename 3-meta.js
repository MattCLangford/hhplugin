(function () {
  "use strict";

  /*
   * Shared metadata contract for the Wise HireHop proposal platform.
   * Keep this aligned with QTC-V4.html and 6-editor2.js.
   */
  var meta = {
    version: "2026-07-20.01",
    purpose: "Names the Heading custom fields used by QTC-V4 plus the legacy WisePageMeta compatibility envelope.",

    headingCustomFields: {
      names: {
        imageUrl: "ImageURL",
        pageHeading: "PageHeading",
        imageSide: "ImageSide",
        createPage: "CreatePage",
        pageTemplate: "PageTemplate",
        pageVariant: "PageVariant",
        includeInProposal: "Include",
        includeInProjectTotal: "Additional"
      },
      pageTemplates: [
        { value: "1", label: "Hero" },
        { value: "2", label: "Cover" },
        { value: "11", label: "Out Experts" },
        { value: "12", label: "Proven Process" },
        { value: "13", label: "Dedicated Project Manager" },
        { value: "14", label: "Your Sepcialist Team" },
        { value: "15", label: "Our Experts" },
        { value: "16", label: "Event Overview" },
        { value: "17", label: "Proposed Timings" },
        { value: "18", label: "Critical Path" },
        { value: "19", label: "About Us" },
        { value: "20", label: "Sustainability" },
        { value: "3", label: "Costing" },
        { value: "21", label: "Thank You" },
        { value: "4", label: "Full Page Visual" },
        { value: "5", label: "3/4 Page Visual" },
        { value: "6", label: "Proposal Summary" },
        { value: "7", label: "Labour" },
        { value: "8", label: "General Requirements" },
        { value: "9", label: "Venue Hero" },
        { value: "10", label: "Experience & Expertise" }
      ],
      pageVariants: [
        { value: "1", label: "Auto" },
        { value: "2", label: "Image Left" },
        { value: "3", label: "Image Right" },
        { value: "4", label: "No Image" },
        { value: "5", label: "1 Column" },
        { value: "6", label: "2 Columns" },
        { value: "7", label: "3 Columns" },
        { value: "8", label: "Alternative" }
      ]
    },

    envelope: {
      start: "[WisePageMeta]",
      end: "[/WisePageMeta]"
    },

    eventOverview: {
      editor: "eventOverview",
      profileKey: "event_overview_schedule",
      rootTemplateKey: "section_event_overview",
      deptTemplateKey: "dept_proposed_timings",
      metaVersion: 2
    },

    genericPage: {
      editor: "genericPage",
      version: 1
    },

    labourDay: {
      editor: "genericLabourDay",
      version: 1
    },

    controlFields: {
      renderType: "section|dept|normal",
      layoutId: "renderer page layout id",
      hidden: "hide heading/page from final render",
      excludeFromProjectTotal: "exclude this heading or item from project total rollups",
      imageUrl: "renderer image source",
      splitSide: "left|right",
      summaryMode: "none|dept|section",
      layoutVariant: "alternate renderer variant, for example alt",
      pageKind: "special renderer family, for example labour",
      deptLayout: "labour or costing department layout mode: image|no-image|columns"
    },

    legacyTextMarkers: {
      hidden: "//",
      excludeFromProjectTotal: "$",
      renderPrefix: "Section:/Dept:",
      suffixes: "- Left/- Right/- Alt/- Dept/- Section"
    }
  };

  meta.describe = function () {
    return {
      version: meta.version,
      envelope: meta.envelope,
      eventOverview: meta.eventOverview,
      genericPage: meta.genericPage,
      labourDay: meta.labourDay,
      headingCustomFields: meta.headingCustomFields,
      controlFields: meta.controlFields,
      legacyTextMarkers: meta.legacyTextMarkers
    };
  };

  window.WiseProposalSectionBuilderMeta = meta;
})();
