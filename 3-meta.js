(function () {
  "use strict";

  /*
   * Shared metadata contract for the Wise HireHop proposal platform.
   * Keep this aligned with QTC-V2.html and wise-sectionbuilder2-ui.js.
   */
  var meta = {
    version: "2026-05-05.01",
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
    }
  };

  meta.describe = function () {
    return {
      version: meta.version,
      envelope: meta.envelope,
      eventOverview: meta.eventOverview,
      genericPage: meta.genericPage,
      labourDay: meta.labourDay
    };
  };

  window.WiseProposalSectionBuilderMeta = meta;
})();
