(function () {
  "use strict";

  /*
   * Shared HireHop integration contract for the Wise proposal platform.
   * This module names the HireHop UI surfaces and endpoints the editor depends on.
   */
  var hirehop = {
    version: "2026-05-07.01",
    purpose: "Centralises HireHop selectors, endpoints, depot gating, retry timings, and tree item prefixes.",

    selectors: {
      itemsTab: "#items_tab",
      toolbarHost: "#items_tab > div:first-child",
      tree: "#items_tab .jstree",
      treeNodes: "#items_tab li.jstree-node,#items_tab a.jstree-anchor",
      treeClicked: "#items_tab .jstree-clicked",
      treeSelectedFallback: "#items_tab li.jstree-node.jstree-clicked, #items_tab li.jstree-selected, #items_tab li[aria-selected='true'], #items_tab a.jstree-anchor[aria-selected='true']",
      depotLabel: "[data-label=\"depotTxt\"]"
    },

    endpoints: {
      itemsSave: "/php_functions/items_save.php",
      itemsDelete: "/php_functions/items_delete.php"
    },

    depot: {
      allowedIds: ["14"],
      allowedNames: ["Project Costs", "Proposal Creation"],
      blockWhenUndetected: true
    },

    timings: {
      bootstrapMaxTries: 120,
      bootstrapRetryMs: 500,
      writeThrottleMs: 1150,
      rateLimitRetryMs: 65000,
      saveMaxAttempts: 2,
      previewAttachRetryDelays: [10, 180, 720, 1600],
      listedItemMenuRetryDelays: [350, 900, 1500, 2300]
    },

    kindPrefixes: {
      0: "a",
      1: "b",
      2: "c",
      3: "d",
      4: "e",
      5: "f",
      6: "g"
    }
  };

  hirehop.describe = function () {
    return {
      version: hirehop.version,
      selectors: hirehop.selectors,
      endpoints: hirehop.endpoints,
      depot: hirehop.depot,
      timings: hirehop.timings,
      kindPrefixes: hirehop.kindPrefixes
    };
  };

  window.WiseProposalSectionBuilderHireHop = hirehop;
})();
