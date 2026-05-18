(function () {
  "use strict";

  /*
   * Shared metadata contract for the Wise HireHop proposal platform.
   * Keep this aligned with QTC-V2.html and 6-editor2.js.
   */
  var meta = {
    version: "2026-05-18.01",
    purpose: "Names the WisePageMeta envelope and editor/template identifiers stored in HireHop technical fields.",

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
      controlFields: meta.controlFields,
      legacyTextMarkers: meta.legacyTextMarkers
    };
  };

  window.WiseProposalSectionBuilderMeta = meta;
})();
